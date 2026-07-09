-- ══════════════════════════════════════════════════════
-- المرحلة P1 — شجرة حسابات كاملة + حماية قاعدة البيانات
-- آمن للتشغيل المتكرر في Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- ── 1. دالة زرع الشجرة المعيارية لشركة واحدة ──
create or replace function seed_tenant_chart_of_accounts(p_tenant_id uuid)
returns int
language plpgsql as $$
declare
  v_count int := 0;
  r record;
  v_parent_id bigint;
begin
  for r in
    select * from (values
      -- أصول
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
      ('1500','الممتلكات والآلات والمعدات','Property, Plant & Equipment','أصول','مدين',true,1,null),
      ('1510','الأراضي','Land','أصول','مدين',false,2,'1500'),
      ('1520','المباني','Buildings','أصول','مدين',false,2,'1500'),
      ('1530','الآلات والمعدات','Machinery & Equipment','أصول','مدين',false,2,'1500'),
      ('1540','المركبات','Vehicles','أصول','مدين',false,2,'1500'),
      ('1550','الأثاث والتجهيزات','Furniture & Fixtures','أصول','مدين',false,2,'1500'),
      ('1600','الاستهلاك المتراكم','Accumulated Depreciation','أصول','دائن',true,1,null),
      ('1610','استهلاك المباني','Depreciation - Buildings','أصول','دائن',false,2,'1600'),
      ('1620','استهلاك الآلات','Depreciation - Machinery','أصول','دائن',false,2,'1600'),
      ('1630','استهلاك المركبات','Depreciation - Vehicles','أصول','دائن',false,2,'1600'),
      ('1640','استهلاك الأثاث','Depreciation - Furniture','أصول','دائن',false,2,'1600'),
      ('1700','الأصول غير الملموسة','Intangible Assets','أصول','مدين',true,1,null),
      ('1710','الشهرة','Goodwill','أصول','مدين',false,2,'1700'),
      ('1720','براءات الاختراع','Patents','أصول','مدين',false,2,'1700'),
      ('1730','العلامات التجارية','Trademarks','أصول','مدين',false,2,'1700'),
      ('1740','حقوق الامتياز','Franchise Rights','أصول','مدين',false,2,'1700'),
      ('1800','استثمارات طويلة الأجل','Long-term Investments','أصول','مدين',true,1,null),
      ('1810','استثمارات في أسهم','Share Investments','أصول','مدين',false,2,'1800'),
      ('1820','سندات استثمارية','Investment Bonds','أصول','مدين',false,2,'1800'),
      ('1830','قروض طويلة الأجل','Long-term Loans','أصول','مدين',false,2,'1800'),
      -- خصوم
      ('2000','الخصوم المتداولة','Current Liabilities','خصوم','دائن',true,1,null),
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
      ('2500','الخصوم طويلة الأجل','Long-term Liabilities','خصوم','دائن',true,1,null),
      ('2600','القروض طويلة الأجل','Long-term Loans','خصوم','دائن',true,2,'2500'),
      ('2610','قروض بنكية طويلة الأجل','Bank Long-term Loans','خصوم','دائن',false,3,'2600'),
      ('2620','سندات الدين','Bonds Payable','خصوم','دائن',false,3,'2600'),
      ('2700','الإيرادات المقدمة','Deferred Revenue','خصوم','دائن',true,2,'2500'),
      ('2710','إيرادات الخدمات المقدمة','Deferred Service Revenue','خصوم','دائن',false,3,'2700'),
      ('2720','إيرادات المشاريع المقدمة','Deferred Project Revenue','خصوم','دائن',false,3,'2700'),
      ('2800','المخصصات','Provisions','خصوم','دائن',true,2,'2500'),
      ('2810','مخصص قضايا قانونية','Litigation Provision','خصوم','دائن',false,3,'2800'),
      ('2820','مخصص ضمانات المنتجات','Warranty Provision','خصوم','دائن',false,3,'2800'),
      -- حقوق ملكية
      ('3000','حقوق الملكية','Equity','حقوق ملكية','دائن',true,1,null),
      ('3100','رأس المال','Capital','حقوق ملكية','دائن',true,2,'3000'),
      ('3110','رأس المال المدفوع','Paid-in Capital','حقوق ملكية','دائن',false,3,'3100'),
      ('3120','الاحتياطيات','Reserves','حقوق ملكية','دائن',false,3,'3100'),
      ('3130','علاوة الإصدار','Share Premium','حقوق ملكية','دائن',false,3,'3100'),
      ('3200','الأرباح المحتفظ بها','Retained Earnings','حقوق ملكية','دائن',false,2,'3000'),
      ('3300','الأرباح الموزعة','Dividends','حقوق ملكية','دائن',true,2,'3000'),
      ('3310','أرباح نقدية موزعة','Cash Dividends','حقوق ملكية','دائن',false,3,'3300'),
      ('3320','أرباح أسهم موزعة','Stock Dividends','حقوق ملكية','دائن',false,3,'3300'),
      -- إيرادات
      ('4000','الإيرادات','Revenue','إيرادات','دائن',true,1,null),
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
      -- تكلفة
      ('5000','تكلفة المبيعات','Cost of Goods Sold','تكلفة','مدين',true,1,null),
      ('5100','المواد الخام المستخدمة','Raw Materials Used','تكلفة','مدين',true,2,'5000'),
      ('5110','تكلفة المواد الأولية','Prime Materials Cost','تكلفة','مدين',false,3,'5100'),
      ('5120','النقل والتأمين','Transportation & Insurance','تكلفة','مدين',false,3,'5100'),
      ('5130','مقاولي باطن','Subcontractors','تكلفة','مدين',false,3,'5100'),
      ('5140','معدات وآلات الموقع','Site Equipment','تكلفة','مدين',false,3,'5100'),
      ('5200','العمل المباشر','Direct Labor','تكلفة','مدين',false,2,'5000'),
      ('5300','المصروفات الصناعية','Manufacturing Overhead','تكلفة','مدين',true,2,'5000'),
      -- مصروفات
      ('5500','مصروفات البيع والتسويق','Selling & Marketing','مصروفات','مدين',true,1,null),
      ('5510','رواتب فريق البيع','Sales Staff Salaries','مصروفات','مدين',false,2,'5500'),
      ('5520','مصروفات الإعلان','Advertising Expenses','مصروفات','مدين',false,2,'5500'),
      ('5530','عمولات البيع','Sales Commissions','مصروفات','مدين',false,2,'5500'),
      ('5540','مصروفات التوزيع','Distribution Expenses','مصروفات','مدين',false,2,'5500'),
      ('5410','مصروفات السيارات','Vehicle Expenses','مصروفات','مدين',false,2,'5500'),
      ('5600','مصروفات إدارية','Administrative Expenses','مصروفات','مدين',true,1,null),
      ('5610','رواتب الموظفين الإداريين','Admin Staff Salaries','مصروفات','مدين',false,2,'5600'),
      ('5210','رواتب وأجور','Salaries & Wages','مصروفات','مدين',false,2,'5600'),
      ('5220','تأمينات اجتماعية','GOSI Expense','مصروفات','مدين',false,2,'5600'),
      ('5230','بدلات وعلاوات','Allowances','مصروفات','مدين',false,2,'5600'),
      ('5240','مصروف مكافأة نهاية الخدمة','EOS Expense','مصروفات','مدين',false,2,'5600'),
      ('5340','ضيافة وعلاقات عامة','Hospitality','مصروفات','مدين',false,2,'5600'),
      ('5620','مصروفات المكتب','Office Expenses','مصروفات','مدين',false,2,'5600'),
      ('5630','مصروفات القانونية والاستشارات','Legal & Consulting','مصروفات','مدين',false,2,'5600'),
      ('5640','مصروفات السفر','Travel Expenses','مصروفات','مدين',false,2,'5600'),
      ('5700','مصروفات المرافق','Utilities & Rent','مصروفات','مدين',true,1,null),
      ('5310','الإيجار','Rent','مصروفات','مدين',false,2,'5700'),
      ('5320','الكهرباء والمياه','Electricity & Water','مصروفات','مدين',false,2,'5700'),
      ('5330','الصيانة','Maintenance','مصروفات','مدين',false,2,'5700'),
      ('5710','الإيجار — تفصيلي','Rent Detail','مصروفات','مدين',false,2,'5700'),
      ('5720','الكهرباء والمياه — تفصيلي','Utilities Detail','مصروفات','مدين',false,2,'5700'),
      ('5730','الإنترنت والاتصالات','Internet & Communications','مصروفات','مدين',false,2,'5700'),
      ('5740','التأمين','Insurance','مصروفات','مدين',false,2,'5700'),
      ('5800','مصروفات أخرى','Other Expenses','مصروفات','مدين',true,1,null),
      ('5810','الاستهلاك','Depreciation','مصروفات','مدين',false,2,'5800'),
      ('5820','خسائر بيع الأصول','Loss on Sale of Assets','مصروفات','مدين',false,2,'5800'),
      ('5830','فائدة مصروفة','Interest Expense','مصروفات','مدين',false,2,'5800'),
      ('6000','المصروفات العامة','General Expenses','مصروفات','مدين',true,1,null),
      ('6100','رسوم وعمولات بنكية','Bank Fees','مصروفات','مدين',false,2,'6000'),
      ('6200','ضرائب ومدفوعات حكومية','Government Fees','مصروفات','مدين',false,2,'6000'),
      ('6300','مصروفات موارد بشرية','HR Expenses','مصروفات','مدين',true,2,'6000'),
      ('6310','تكاليف التدريب','Training Costs','مصروفات','مدين',false,3,'6300'),
      ('6320','مصروفات الصحة والسلامة','Health & Safety','مصروفات','مدين',false,3,'6300')
    ) as t(code, name, name_en, account_type, normal_balance, is_parent, lvl, parent_code)
    order by lvl
  loop
    if exists (
      select 1 from finance_accounts
      where tenant_id = p_tenant_id and code = r.code
    ) then
      continue;
    end if;

    v_parent_id := null;
    if r.parent_code is not null then
      select id into v_parent_id
      from finance_accounts
      where tenant_id = p_tenant_id and code = r.parent_code;
    end if;

    insert into finance_accounts (
      tenant_id, code, name, name_en, account_type, account_class,
      normal_balance, parent_id, level, is_parent, is_active
    ) values (
      p_tenant_id, r.code, r.name, r.name_en, r.account_type,
      case when r.account_type in ('أصول','خصوم','حقوق ملكية') then 'ميزانية' else 'دخل' end,
      r.normal_balance, v_parent_id, r.lvl, r.is_parent, true
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── 2. زرع الشجرة لكل الشركات الحالية ──
do $$
declare
  t record;
  n int;
begin
  for t in select id from tenants loop
    n := seed_tenant_chart_of_accounts(t.id);
    raise notice 'tenant %: seeded % accounts', t.id, n;
  end loop;
end $$;

-- ── 3. منع الترحيل على حسابات تجميعية أو معطّلة ──
create or replace function trg_check_journal_line_account()
returns trigger
language plpgsql as $$
declare
  acc record;
  ent record;
begin
  select fa.is_parent, fa.is_active, fa.code, fa.name
  into acc
  from finance_accounts fa
  where fa.id = new.account_id;

  if not found then
    raise exception 'الحساب المحاسبي غير موجود';
  end if;

  if acc.is_parent then
    raise exception 'لا يمكن الترحيل على حساب تجميعي: % — %', acc.code, acc.name;
  end if;

  if not acc.is_active then
    raise exception 'الحساب معطّل ولا يقبل قيوداً: % — %', acc.code, acc.name;
  end if;

  select je.tenant_id into ent
  from finance_journal_entries je
  where je.id = new.entry_id;

  if found then
    if not exists (
      select 1 from finance_accounts fa
      where fa.id = new.account_id and fa.tenant_id = ent.tenant_id
    ) then
      raise exception 'الحساب لا ينتمي لنفس الشركة';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_line_account on finance_journal_lines;
create trigger trg_journal_line_account
  before insert or update on finance_journal_lines
  for each row execute function trg_check_journal_line_account();

-- ── 4. منع الترحيل في فترة محاسبية مقفلة ──
create or replace function trg_check_journal_entry_period()
returns trigger
language plpgsql as $$
declare
  v_month int;
  v_year  int;
begin
  v_year  := extract(year  from new.entry_date)::int;
  v_month := extract(month from new.entry_date)::int;

  if exists (
    select 1 from finance_fiscal_periods
    where tenant_id = new.tenant_id
      and year = v_year and month = v_month
      and status = 'مقفلة'
  ) then
    raise exception 'الفترة المحاسبية %/% مقفلة — لا يمكن الترحيل', v_month, v_year;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_entry_period on finance_journal_entries;
create trigger trg_journal_entry_period
  before insert or update on finance_journal_entries
  for each row execute function trg_check_journal_entry_period();

-- ✅ انتهى
