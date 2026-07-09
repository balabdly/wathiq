-- ══════════════════════════════════════════════════════
-- المرحلة 2 — تشغيل في Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- أعمدة اختيارية لتتبع القيود المحاسبية
do $$ begin
  alter table hr_settlements add column if not exists journal_entry_id bigint;
exception when undefined_table then null;
end $$;

do $$ begin
  alter table hr_leave_compensations add column if not exists journal_entry_id bigint;
exception when undefined_table then null;
end $$;

-- تأكد من وجود حسابات المحاسبة المطلوبة للمرحلة 2
-- (شغّل فقط إذا لم تكن موجودة — يتخطى الموجود)
insert into finance_accounts (tenant_id, code, name, name_en, account_type, account_class, normal_balance, is_parent, is_active, level)
select t.id::text, v.code, v.name, v.name_en, v.account_type, v.account_class, v.normal_balance, false, true, 4
from tenants t
cross join (values
  ('2420', 'مخصص مكافأة نهاية الخدمة', 'EOS Provision',           'خصوم', 'ميزانية', 'دائن'),
  ('5240', 'مصروف مكافأة نهاية الخدمة', 'EOS Expense',             'مصروفات', 'دخل', 'مدين'),
  ('5230', 'مصروف بدلات وعلاوات',       'Allowances Expense',      'مصروفات', 'دخل', 'مدين')
) as v(code, name, name_en, account_type, account_class, normal_balance)
where not exists (
  select 1 from finance_accounts fa where fa.tenant_id::text = t.id::text and fa.code = v.code
);

-- ✅ انتهى
