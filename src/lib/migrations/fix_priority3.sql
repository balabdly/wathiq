-- ══════════════════════════════════════════════════════
-- المرحلة 3 — RLS + سجل تدقيق + حسابات مطلوبة
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

-- ── 1. دالة مساعدة لسياسة مؤقتة (حتى ترحيل Auth) ──
create or replace function wathiq_tenant_match(p_tenant_id text)
returns boolean
language sql stable as $$
  select coalesce(
    p_tenant_id::text = nullif(current_setting('app.tenant_id', true), ''),
    true  -- مؤقتاً: السماح عند عدم تعيين السياق (توافق مع التطبيق الحالي)
  );
$$;

-- ── 2. سجل تدقيق ──
create table if not exists wathiq_audit_log (
  id          bigint primary key generated always as identity,
  tenant_id   text not null,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  text,
  changed_at  timestamptz default now()
);

create index if not exists idx_audit_tenant_date
  on wathiq_audit_log (tenant_id, changed_at desc);

-- ── 3. تفعيل RLS + سياسات allow_all على الجداول الناقصة ──
do $$
declare
  t text;
  tables text[] := array[
    'tenants','branches','employees',
    'finance_assets','finance_asset_depreciation','finance_asset_disposals','finance_asset_maintenance',
    'finance_attachments','finance_debit_notes','finance_debit_note_items',
    'finance_doc_sequences','finance_fiscal_periods','finance_accounts_backup','chart_of_accounts',
    'hr_employees','hr_payroll','hr_disciplinary','hr_violation_types',
    'hr_benefits','hr_job_offers','hr_payroll_runs','hr_project_cost',
    'wathiq_audit_log'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table %I enable row level security', t);

      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t and policyname = 'allow_all'
      ) then
        execute format(
          'create policy allow_all on %I for all to public using (true) with check (true)',
          t
        );
      end if;
    end if;
  end loop;
end $$;

-- ── 4. إزالة سياسات tenant_* القديمة على الأصول (تمنع الوصول بدون سياق) ──
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('finance_assets','finance_asset_depreciation','finance_asset_disposals','finance_asset_maintenance')
      and policyname <> 'allow_all'
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ── 5. حسابات مطلوبة لكل المستأجرين (معايير المرحلة 2+3) ──
insert into finance_accounts (tenant_id, code, name, name_en, account_type, account_class, normal_balance, is_parent, is_active, level)
select t.id::text, v.code, v.name, v.name_en, v.account_type, v.account_class, v.normal_balance, false, true, 4
from tenants t
cross join (values
  ('5210', 'رواتب وأجور',               'Salaries & Wages',        'مصروفات', 'دخل', 'مدين'),
  ('5220', 'تأمينات اجتماعية',          'GOSI Expense',            'مصروفات', 'دخل', 'مدين'),
  ('5230', 'بدلات وعلاوات',             'Allowances',              'مصروفات', 'دخل', 'مدين'),
  ('5240', 'مصروف مكافأة نهاية الخدمة', 'EOS Expense',             'مصروفات', 'دخل', 'مدين'),
  ('2120', 'ذمم الموظفين',              'Employee Payables',       'خصوم',   'ميزانية', 'دائن'),
  ('2160', 'تأمينات مستحقة',            'GOSI Payable',            'خصوم',   'ميزانية', 'دائن'),
  ('2420', 'مخصص مكافأة نهاية الخدمة',  'EOS Provision',           'خصوم',   'ميزانية', 'دائن')
) as v(code, name, name_en, account_type, account_class, normal_balance)
where not exists (
  select 1 from finance_accounts fa
  where fa.tenant_id::text = t.id::text and fa.code = v.code
);

-- ✅ انتهى
