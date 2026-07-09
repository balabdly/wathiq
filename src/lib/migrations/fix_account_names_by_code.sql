-- ══════════════════════════════════════════════════════
-- توحيد أسماء الحسابات حسب الكود المعياري
-- يصلح tenants زُرعت بـ fix_finance_account_codes القديم (1130=مخزون، 1210=مركبات، ...)
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

update finance_accounts fa
set
  name    = v.name,
  name_en = v.name_en
from (values
  ('1110', 'الصندوق',                         'Cash Box'),
  ('1111', 'الصندوق - العملة المحلية',        'Cash - Local Currency'),
  ('1120', 'البنك',                           'Bank Account'),
  ('1130', 'الشيكات تحت التحصيل',             'Cheques Under Collection'),
  ('1150', 'عهد الموظفين',                    'Employee Custody'),
  ('1160', 'سلف الموظفين',                    'Employee Loans'),
  ('1210', 'ذمم العملاء',                     'Customer Receivables'),
  ('1250', 'ضريبة القيمة المضافة المستردة',   'VAT Input Recoverable'),
  ('1310', 'المواد الخام',                    'Raw Materials'),
  ('2110', 'ذمم الموردين',                    'Supplier Payables'),
  ('2320', 'ضريبة القيمة المضافة',            'VAT Payable'),
  ('4110', 'مبيعات المنتجات',                 'Product Sales'),
  ('5120', 'النقل والتأمين',                  'Transportation & Insurance')
) as v(code, name, name_en)
where fa.code = v.code
  and (fa.name is distinct from v.name or fa.name_en is distinct from v.name_en);
