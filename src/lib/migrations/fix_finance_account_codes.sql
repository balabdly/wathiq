-- ══════════════════════════════════════════════════════
-- حسابات محاسبية معيارية مطلوبة للقيود الآلية واليدوية
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

insert into finance_accounts (tenant_id, code, name, name_en, account_type, account_class, normal_balance, is_parent, is_active, level)
select t.id::text, v.code, v.name, v.name_en, v.account_type, v.account_class, v.normal_balance, false, true, 4
from tenants t
cross join (values
  ('1110', 'الصندوق',                    'Cash Box',                 'أصول',       'ميزانية', 'مدين'),
  ('1111', 'الصندوق - العملة المحلية',   'Cash - Local Currency',    'أصول',       'ميزانية', 'مدين'),
  ('1120', 'البنك',                      'Bank Account',             'أصول',       'ميزانية', 'مدين'),
  ('1130', 'المخزون',                    'Inventory',                'أصول',       'ميزانية', 'مدين'),
  ('1210', 'ذمم العملاء',                'Customer Receivables',     'أصول',       'ميزانية', 'مدين'),
  ('1250', 'ضريبة القيمة المضافة المستردة', 'VAT Input Recoverable', 'أصول',       'ميزانية', 'مدين'),
  ('2110', 'ذمم الموردين',               'Supplier Payables',        'خصوم',       'ميزانية', 'دائن'),
  ('2320', 'ضريبة القيمة المضافة',       'VAT Payable',              'خصوم',       'ميزانية', 'دائن'),
  ('4110', 'مبيعات المنتجات',            'Product Sales',            'إيرادات',    'دخل',     'دائن'),
  ('5120', 'تكلفة النقل والتأمين',       'Transportation Cost',      'تكلفة',      'دخل',     'مدين')
) as v(code, name, name_en, account_type, account_class, normal_balance)
where not exists (
  select 1 from finance_accounts fa
  where fa.tenant_id::text = t.id::text and fa.code = v.code
);

-- ✅ انتهى
