-- ══════════════════════════════════════════════════════
-- إصلاح شجرة الحسابات: الهرمية + اليتامى + الأسماء المكررة
-- يصلح أضرار fix_finance_account_codes + fix_account_names_by_code
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

create or replace function repair_tenant_coa_hierarchy(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_legacy_5 boolean;
  v_updated int := 0;
  v_row int;
  r record;
  v_parent_id bigint;
  v_parent_code text;
  v_level int;
begin
  -- هل الشركة تستخدم الهيكل القديم (5 جذور)؟
  select exists (
    select 1 from finance_accounts
    where tenant_id = p_tenant_id::text
      and code = '1000'
      and name in ('الأصول', 'Assets')
  ) into v_legacy_5;

  -- ── 1. إصلاح أسماء مكررة / خاطئة ──
  update finance_accounts
  set name = 'الذمم المدينة', name_en = 'Accounts Receivable'
  where tenant_id = p_tenant_id::text
    and code = '1200'
    and name = 'الأصول الثابتة';
  get diagnostics v_row = row_count;
  v_updated := v_updated + v_row;

  update finance_accounts
  set name = 'القروض قصيرة الأجل', name_en = 'Short-term Loans'
  where tenant_id = p_tenant_id::text
    and code = '2200'
    and name = 'الخصوم طويلة الأجل';
  get diagnostics v_row = row_count;
  v_updated := v_updated + v_row;

  -- ── 2. ربط اليتامى المعروفين (أُدرجوا بدون parent_id) ──
  for r in
    select * from (values
      ('1250', '1200'),
      ('1310', '1300'),
      ('2160', '2100'),
      ('2320', '2300'),
      ('2420', '2400'),
      ('4110', '4100'),
      ('5240', '5200')
    ) as t(code, parent_code)
  loop
    select id into v_parent_id
    from finance_accounts
    where tenant_id = p_tenant_id::text and code = r.parent_code;

    if v_parent_id is not null then
      update finance_accounts fa
      set parent_id = v_parent_id,
          level = coalesce(p.level, fa.level) + 1
      from finance_accounts p
      where fa.tenant_id = p_tenant_id::text
        and fa.code = r.code
        and p.id = v_parent_id
        and (fa.parent_id is distinct from v_parent_id);
      get diagnostics v_row = row_count;
      v_updated := v_updated + v_row;
    end if;
  end loop;

  -- ── 3. في الهيكل القديم: إنزال الجذور الزائدة تحت الخمسة الرئيسية ──
  if v_legacy_5 then
    for r in
      select * from (values
        ('1500', '1000', 2),
        ('1600', '1000', 2),
        ('1700', '1000', 2),
        ('1800', '1000', 2),
        ('2500', '2000', 2),
        ('5500', '5000', 2),
        ('5600', '5000', 2),
        ('5700', '5000', 2),
        ('5800', '5000', 2),
        ('6000', '5000', 2)
      ) as t(code, parent_code, new_level)
    loop
      select id into v_parent_id
      from finance_accounts
      where tenant_id = p_tenant_id::text and code = r.parent_code;

      if v_parent_id is not null then
        update finance_accounts
        set parent_id = v_parent_id,
            level = r.new_level
        where tenant_id = p_tenant_id::text
          and code = r.code
          and (parent_id is distinct from v_parent_id or level is distinct from r.new_level);
        get diagnostics v_row = row_count;
        v_updated := v_updated + v_row;
      end if;
    end loop;
  end if;

  -- ── 4. تطبيق الهرمية المعيارية من جدول القواعد (UPDATE وليس INSERT) ──
  for r in
    select * from (values
      ('1000','الأصول المتداولة','Current Assets','أصول','مدين',true,1,null::text),
      ('1100','النقد والعملات','Cash & Currency','أصول','مدين',true,2,'1000'),
      ('1110','الصندوق','Cash Box','أصول','مدين',true,3,'1100'),
      ('1111','الصندوق - العملة المحلية','Cash - Local Currency','أصول','مدين',false,4,'1110'),
      ('1112','الصندوق - دولار أمريكي','Cash - USD','أصول','مدين',false,4,'1110'),
      ('1120','البنك','Bank Account','أصول','مدين',true,3,'1100'),
      ('1121','البنك الأهلي','National Bank','أصول','مدين',false,4,'1120'),
      ('1122','البنك الراجحي','Al Rajhi Bank','أصول','مدين',false,4,'1120'),
      ('1130','الشيكات تحت التحصيل','Cheques Under Collection','أصول','مدين',false,3,'1100'),
      ('1140','التحويلات البنكية','Bank Transfers','أصول','مدين',false,3,'1100'),
      ('1150','عهد الموظفين','Employee Custody','أصول','مدين',true,3,'1100'),
      ('1160','سلف الموظفين','Employee Loans','أصول','مدين',true,3,'1100'),
      ('1200','الذمم المدينة','Accounts Receivable','أصول','مدين',true,2,'1000'),
      ('1210','ذمم العملاء','Customer Receivables','أصول','مدين',false,3,'1200'),
      ('1220','ذمم موظفين','Employee Receivables','أصول','مدين',false,3,'1200'),
      ('1230','ذمم أخرى','Other Receivables','أصول','مدين',false,3,'1200'),
      ('1240','مخصص ديون مشكوك فيها','Provision for Doubtful Debts','أصول','دائن',false,3,'1200'),
      ('1250','ضريبة القيمة المضافة المستردة','VAT Input Recoverable','أصول','مدين',false,3,'1200'),
      ('1300','المخزون','Inventory','أصول','مدين',true,2,'1000'),
      ('1310','المواد الخام','Raw Materials','أصول','مدين',false,3,'1300'),
      ('1320','الإنتاج تحت التشغيل','Work in Progress','أصول','مدين',false,3,'1300'),
      ('1330','المنتجات النهائية','Finished Goods','أصول','مدين',false,3,'1300'),
      ('1340','البضائع الراكدة','Obsolete Inventory','أصول','مدين',false,3,'1300'),
      ('1400','المصروفات المقدمة','Prepaid Expenses','أصول','مدين',true,2,'1000'),
      ('1410','الإيجار المقدم','Prepaid Rent','أصول','مدين',false,3,'1400'),
      ('1420','التأمين المقدم','Prepaid Insurance','أصول','مدين',false,3,'1400'),
      ('1430','الرسوم والاشتراكات المقدمة','Prepaid Fees','أصول','مدين',false,3,'1400'),
      ('1500','الممتلكات والآلات والمعدات','Property, Plant & Equipment','أصول','مدين',true,1,null::text),
      ('1510','الأراضي','Land','أصول','مدين',false,2,'1500'),
      ('1520','المباني','Buildings','أصول','مدين',false,2,'1500'),
      ('1530','الآلات والمعدات','Machinery & Equipment','أصول','مدين',false,2,'1500'),
      ('1540','المركبات','Vehicles','أصول','مدين',false,2,'1500'),
      ('1550','الأثاث والتجهيزات','Furniture & Fixtures','أصول','مدين',false,2,'1500'),
      ('1600','الاستهلاك المتراكم','Accumulated Depreciation','أصول','دائن',true,1,null::text),
      ('1610','استهلاك المباني','Depreciation - Buildings','أصول','دائن',false,2,'1600'),
      ('1620','استهلاك الآلات','Depreciation - Machinery','أصول','دائن',false,2,'1600'),
      ('1630','استهلاك المركبات','Depreciation - Vehicles','أصول','دائن',false,2,'1600'),
      ('1640','استهلاك الأثاث','Depreciation - Furniture','أصول','دائن',false,2,'1600'),
      ('1700','الأصول غير الملموسة','Intangible Assets','أصول','مدين',true,1,null::text),
      ('1710','الشهرة','Goodwill','أصول','مدين',false,2,'1700'),
      ('1720','براءات الاختراع','Patents','أصول','مدين',false,2,'1700'),
      ('1730','العلامات التجارية','Trademarks','أصول','مدين',false,2,'1700'),
      ('1740','حقوق الامتياز','Franchise Rights','أصول','مدين',false,2,'1700'),
      ('1800','استثمارات طويلة الأجل','Long-term Investments','أصول','مدين',true,1,null::text),
      ('1810','استثمارات في أسهم','Share Investments','أصول','مدين',false,2,'1800'),
      ('1820','سندات استثمارية','Investment Bonds','أصول','مدين',false,2,'1800'),
      ('1830','قروض طويلة الأجل','Long-term Loans','أصول','مدين',false,2,'1800'),
      ('2000','الخصوم المتداولة','Current Liabilities','خصوم','دائن',true,1,null::text),
      ('2100','الذمم الدائنة','Accounts Payable','خصوم','دائن',true,2,'2000'),
      ('2110','ذمم الموردين','Supplier Payables','خصوم','دائن',false,3,'2100'),
      ('2120','ذمم الموظفين','Employee Payables','خصوم','دائن',false,3,'2100'),
      ('2130','ذمم أخرى','Other Payables','خصوم','دائن',false,3,'2100'),
      ('2160','تأمينات مستحقة','GOSI Payable','خصوم','دائن',false,3,'2100'),
      ('2200','القروض قصيرة الأجل','Short-term Loans','خصوم','دائن',true,2,'2000'),
      ('2210','قرض بنكي قصير الأجل','Bank Short-term Loan','خصوم','دائن',false,3,'2200'),
      ('2220','قروض من الجهات الحكومية','Government Loans','خصوم','دائن',false,3,'2200'),
      ('2300','الضرائب المستحقة','Taxes Payable','خصوم','دائن',true,2,'2000'),
      ('2310','ضريبة الدخل المستحقة','Income Tax Payable','خصوم','دائن',false,3,'2300'),
      ('2320','ضريبة القيمة المضافة','VAT Payable','خصوم','دائن',false,3,'2300'),
      ('2330','ضرائب أخرى','Other Taxes','خصوم','دائن',false,3,'2300'),
      ('2400','الرواتب والأجور المستحقة','Accrued Salaries','خصوم','دائن',true,2,'2000'),
      ('2410','رواتب الموظفين','Employee Salaries','خصوم','دائن',false,3,'2400'),
      ('2420','مكافآت نهاية الخدمة','End of Service Benefits','خصوم','دائن',false,3,'2400'),
      ('2500','الخصوم طويلة الأجل','Long-term Liabilities','خصوم','دائن',true,1,null::text),
      ('2600','القروض طويلة الأجل','Long-term Loans','خصوم','دائن',true,2,'2500'),
      ('2610','قروض بنكية طويلة الأجل','Bank Long-term Loans','خصوم','دائن',false,3,'2600'),
      ('2620','سندات الدين','Bonds Payable','خصوم','دائن',false,3,'2600'),
      ('2700','الإيرادات المقدمة','Deferred Revenue','خصوم','دائن',true,2,'2500'),
      ('2710','إيرادات الخدمات المقدمة','Deferred Service Revenue','خصوم','دائن',false,3,'2700'),
      ('2720','إيرادات المشاريع المقدمة','Deferred Project Revenue','خصوم','دائن',false,3,'2700'),
      ('2800','المخصصات','Provisions','خصوم','دائن',true,2,'2500'),
      ('2810','مخصص قضايا قانونية','Litigation Provision','خصوم','دائن',false,3,'2800'),
      ('2820','مخصص ضمانات المنتجات','Warranty Provision','خصوم','دائن',false,3,'2800'),
      ('3000','حقوق الملكية','Equity','حقوق ملكية','دائن',true,1,null::text),
      ('3100','رأس المال','Capital','حقوق ملكية','دائن',true,2,'3000'),
      ('3110','رأس المال المدفوع','Paid-in Capital','حقوق ملكية','دائن',false,3,'3100'),
      ('3120','الاحتياطيات','Reserves','حقوق ملكية','دائن',false,3,'3100'),
      ('3130','علاوة الإصدار','Share Premium','حقوق ملكية','دائن',false,3,'3100'),
      ('3200','الأرباح المحتفظ بها','Retained Earnings','حقوق ملكية','دائن',false,2,'3000'),
      ('3300','الأرباح الموزعة','Dividends','حقوق ملكية','دائن',true,2,'3000'),
      ('3310','أرباح نقدية موزعة','Cash Dividends','حقوق ملكية','دائن',false,3,'3300'),
      ('3320','أرباح أسهم موزعة','Stock Dividends','حقوق ملكية','دائن',false,3,'3300'),
      ('4000','الإيرادات','Revenue','إيرادات','دائن',true,1,null::text),
      ('4100','إيرادات المبيعات','Sales Revenue','إيرادات','دائن',true,2,'4000'),
      ('4110','مبيعات المنتجات','Product Sales','إيرادات','دائن',false,3,'4100'),
      ('4120','مبيعات الخدمات','Service Revenue','إيرادات','دائن',false,3,'4100'),
      ('4130','مبيعات مرتجعة','Sales Returns','إيرادات','مدين',false,3,'4100'),
      ('4140','خصومات المبيعات','Sales Discounts','إيرادات','مدين',false,3,'4100'),
      ('4200','إيرادات أخرى','Other Revenue','إيرادات','دائن',true,2,'4000'),
      ('4210','إيرادات الفوائد','Interest Revenue','إيرادات','دائن',false,3,'4200'),
      ('4220','إيرادات الإيجار','Rental Revenue','إيرادات','دائن',false,3,'4200'),
      ('4230','إيرادات العمولات','Commission Revenue','إيرادات','دائن',false,3,'4200'),
      ('4240','أرباح بيع الأصول','Gain on Sale of Assets','إيرادات','دائن',false,3,'4200'),
      ('5000','تكلفة المبيعات','Cost of Goods Sold','تكلفة','مدين',true,1,null::text),
      ('5100','المواد الخام المستخدمة','Raw Materials Used','تكلفة','مدين',true,2,'5000'),
      ('5110','تكلفة المواد الأولية','Prime Materials Cost','تكلفة','مدين',false,3,'5100'),
      ('5120','النقل والتأمين','Transportation & Insurance','تكلفة','مدين',false,3,'5100'),
      ('5130','مقاولي باطن','Subcontractors','تكلفة','مدين',false,3,'5100'),
      ('5140','معدات وآلات الموقع','Site Equipment','تكلفة','مدين',false,3,'5100'),
      ('5200','العمل المباشر','Direct Labor','تكلفة','مدين',false,2,'5000'),
      ('5300','المصروفات الصناعية','Manufacturing Overhead','تكلفة','مدين',true,2,'5000'),
      ('5500','مصروفات البيع والتسويق','Selling & Marketing','مصروفات','مدين',true,1,null::text),
      ('5510','رواتب فريق البيع','Sales Staff Salaries','مصروفات','مدين',false,2,'5500'),
      ('5520','مصروفات الإعلان','Advertising Expenses','مصروفات','مدين',false,2,'5500'),
      ('5530','عمولات البيع','Sales Commissions','مصروفات','مدين',false,2,'5500'),
      ('5540','مصروفات التوزيع','Distribution Expenses','مصروفات','مدين',false,2,'5500'),
      ('5410','مصروفات السيارات','Vehicle Expenses','مصروفات','مدين',false,2,'5500'),
      ('5600','مصروفات إدارية','Administrative Expenses','مصروفات','مدين',true,1,null::text),
      ('5610','رواتب الموظفين الإداريين','Admin Staff Salaries','مصروفات','مدين',false,2,'5600'),
      ('5210','رواتب وأجور','Salaries & Wages','مصروفات','مدين',false,2,'5600'),
      ('5220','تأمينات اجتماعية','GOSI Expense','مصروفات','مدين',false,2,'5600'),
      ('5230','بدلات وعلاوات','Allowances','مصروفات','مدين',false,2,'5600'),
      ('5240','مصروف مكافأة نهاية الخدمة','EOS Expense','مصروفات','مدين',false,2,'5600'),
      ('5340','ضيافة وعلاقات عامة','Hospitality','مصروفات','مدين',false,2,'5600'),
      ('5620','مصروفات المكتب','Office Expenses','مصروفات','مدين',false,2,'5600'),
      ('5630','مصروفات القانونية والاستشارات','Legal & Consulting','مصروفات','مدين',false,2,'5600'),
      ('5640','مصروفات السفر','Travel Expenses','مصروفات','مدين',false,2,'5600'),
      ('5700','مصروفات المرافق','Utilities & Rent','مصروفات','مدين',true,1,null::text),
      ('5310','الإيجار','Rent','مصروفات','مدين',false,2,'5700'),
      ('5320','الكهرباء والمياه','Electricity & Water','مصروفات','مدين',false,2,'5700'),
      ('5330','الصيانة','Maintenance','مصروفات','مدين',false,2,'5700'),
      ('5710','الإيجار — تفصيلي','Rent Detail','مصروفات','مدين',false,2,'5700'),
      ('5720','الكهرباء والمياه — تفصيلي','Utilities Detail','مصروفات','مدين',false,2,'5700'),
      ('5730','الإنترنت والاتصالات','Internet & Communications','مصروفات','مدين',false,2,'5700'),
      ('5740','التأمين','Insurance','مصروفات','مدين',false,2,'5700'),
      ('5800','مصروفات أخرى','Other Expenses','مصروفات','مدين',true,1,null::text),
      ('5810','الاستهلاك','Depreciation','مصروفات','مدين',false,2,'5800'),
      ('5820','خسائر بيع الأصول','Loss on Sale of Assets','مصروفات','مدين',false,2,'5800'),
      ('5830','فائدة مصروفة','Interest Expense','مصروفات','مدين',false,2,'5800'),
      ('6000','المصروفات العامة','General Expenses','مصروفات','مدين',true,1,null::text),
      ('6100','رسوم وعمولات بنكية','Bank Fees','مصروفات','مدين',false,2,'6000'),
      ('6200','ضرائب ومدفوعات حكومية','Government Fees','مصروفات','مدين',false,2,'6000'),
      ('6300','مصروفات موارد بشرية','HR Expenses','مصروفات','مدين',true,2,'6000'),
      ('6310','تكاليف التدريب','Training Costs','مصروفات','مدين',false,3,'6300'),
      ('6320','مصروفات الصحة والسلامة','Health & Safety','مصروفات','مدين',false,3,'6300')
    ) as t(code, name, name_en, account_type, normal_balance, is_parent, lvl, parent_code)
    order by lvl
  loop
    v_parent_code := r.parent_code;
    v_level := r.lvl;

    -- تعديلات الهيكل القديم
    if v_legacy_5 then
      if r.code in ('1500','1600','1700','1800') then
        v_parent_code := '1000';
        if v_level = 1 then v_level := 2; end if;
      elsif r.code = '2500' then
        v_parent_code := '2000';
        if v_level = 1 then v_level := 2; end if;
      elsif r.code in ('5500','5600','5700','5800','6000') then
        v_parent_code := '5000';
        if v_level = 1 then v_level := 2; end if;
      end if;
      -- لا نغيّر أسماء الجذور الخمسة
      if r.code in ('1000','2000','3000','4000','5000') then
        continue;
      end if;
    end if;

    -- يتامى معروفون
    if r.code = '1250' then v_parent_code := '1200'; v_level := 3; end if;
    if r.code = '1310' then v_parent_code := '1300'; v_level := 3; end if;
    if r.code = '2160' then v_parent_code := '2100'; v_level := 3; end if;
    if r.code = '2320' then v_parent_code := '2300'; v_level := 3; end if;
    if r.code = '2420' then v_parent_code := '2400'; v_level := 3; end if;
    if r.code = '4110' then v_parent_code := '4100'; v_level := 3; end if;
    if r.code = '5240' and v_legacy_5 then v_parent_code := '5200'; v_level := 3; end if;

    v_parent_id := null;
    if v_parent_code is not null then
      select id into v_parent_id
      from finance_accounts
      where tenant_id = p_tenant_id::text and code = v_parent_code;
    end if;

    update finance_accounts fa
    set
      parent_id      = v_parent_id,
      level          = v_level,
      is_parent      = r.is_parent,
      account_type   = r.account_type,
      normal_balance = r.normal_balance,
      account_class  = case when r.account_type in ('أصول','خصوم','حقوق ملكية') then 'ميزانية' else 'دخل' end
    where fa.tenant_id = p_tenant_id::text
      and fa.code = r.code
      and (
        fa.parent_id is distinct from v_parent_id
        or fa.level is distinct from v_level
        or fa.is_parent is distinct from r.is_parent
      );
    get diagnostics v_row = row_count;
    v_updated := v_updated + v_row;
  end loop;

  -- ── 5. تحديث is_parent للآباء ──
  update finance_accounts p
  set is_parent = exists (
    select 1 from finance_accounts c
    where c.tenant_id = p.tenant_id and c.parent_id = p.id and c.is_active
  )
  where p.tenant_id = p_tenant_id::text;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'legacy_5_root', v_legacy_5,
    'rows_updated', v_updated,
    'orphans_remaining', (
      select count(*) from finance_accounts
      where tenant_id = p_tenant_id::text
        and is_active
        and parent_id is null
        and code not in ('1000','2000','3000','4000','5000')
    )
  );
end;
$$;

-- تشغيل الإصلاح لكل الشركات
do $$
declare
  t record;
  res jsonb;
begin
  for t in select id from tenants loop
    res := repair_tenant_coa_hierarchy(t.id);
    raise notice 'COA repair %: %', t.id, res;
  end loop;
end $$;
