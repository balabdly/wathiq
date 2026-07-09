-- ══════════════════════════════════════════════════════
-- المرحلة 3 (تكملة) — Auth JWT + عزل tenant + حذف chart_of_accounts
-- ══════════════════════════════════════════════════════

-- ── 1. دوال JWT ──
create or replace function wathiq_jwt_tenant_id()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')
  );
$$;

create or replace function wathiq_jwt_employee_id()
returns bigint
language sql stable security definer set search_path = public as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'employee_id', '')::bigint;
$$;

create or replace function wathiq_tenant_match(p_tenant_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select wathiq_jwt_tenant_id() is not null
     and p_tenant_id::text = wathiq_jwt_tenant_id();
$$;

-- ── 2. دالة تدقيق ──
create or replace function wathiq_log_audit(
  p_tenant_id text,
  p_table_name text,
  p_record_id text,
  p_action text,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_changed_by text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into wathiq_audit_log (tenant_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (p_tenant_id, p_table_name, p_record_id, p_action, p_old_data, p_new_data, p_changed_by);
end;
$$;

-- ── 3. استبدال سياسات allow_all بعزل tenant ──
do $$
declare
  t text;
  pol record;
  tables text[] := array[
    'finance_accounts','finance_accounts_backup','finance_asset_depreciation','finance_asset_disposals',
    'finance_asset_maintenance','finance_assets','finance_attachments','finance_cash_accounts',
    'finance_catalog_items','finance_clients','finance_cost_centers','finance_credit_notes',
    'finance_debit_notes','finance_doc_sequences','finance_employee_custody','finance_expenses',
    'finance_fiscal_periods','finance_invoices','finance_journal_entries','finance_purchase_orders',
    'finance_purchase_returns','finance_quotations','finance_treasury','finance_vendor_invoices',
    'finance_vendors','hr_applicants','hr_attendance','hr_benefits','hr_departments','hr_disciplinary',
    'hr_documents','hr_emergency_contacts','hr_employees','hr_job_offers','hr_job_titles','hr_jobs',
    'hr_leave_balance','hr_leave_compensations','hr_leaves','hr_payroll','hr_payroll_runs',
    'hr_performance','hr_project_cost','hr_requests','hr_settlements','hr_terminations',
    'hr_violation_types','wathiq_audit_log','branches','employees','projects','visits',
    'materials','clients','warehouses'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_id'
    ) then continue;
    end if;

    execute format('alter table %I enable row level security', t);

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on %I', pol.policyname, t);
    end loop;

    execute format(
      'create policy tenant_isolation on %I for all to authenticated using (wathiq_tenant_match(tenant_id::text)) with check (wathiq_tenant_match(tenant_id::text))',
      t
    );
  end loop;
end $$;

-- ── 4. tenants: قراءة المستأجر الخاص فقط ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants') then
    alter table tenants enable row level security;
    drop policy if exists allow_all on tenants;
    drop policy if exists tenant_isolation on tenants;
    create policy tenant_isolation on tenants for all to authenticated
      using (id::text = wathiq_jwt_tenant_id())
      with check (id::text = wathiq_jwt_tenant_id());
  end if;
end $$;

-- ── 5. جداول فرعية بدون tenant_id — عزل عبر الجدول الأب ──
do $$
declare
  child_tables jsonb := '[
    {"child":"finance_journal_lines","parent":"finance_journal_entries","fk":"entry_id"},
    {"child":"finance_invoice_items","parent":"finance_invoices","fk":"invoice_id"},
    {"child":"finance_credit_note_items","parent":"finance_credit_notes","fk":"note_id"},
    {"child":"finance_debit_note_items","parent":"finance_debit_notes","fk":"note_id"},
    {"child":"finance_quotation_items","parent":"finance_quotations","fk":"quote_id"},
    {"child":"finance_purchase_order_items","parent":"finance_purchase_orders","fk":"po_id"},
    {"child":"finance_purchase_return_items","parent":"finance_purchase_returns","fk":"return_id"},
    {"child":"finance_vendor_invoice_items","parent":"finance_vendor_invoices","fk":"invoice_id"}
  ]'::jsonb;
  item jsonb;
  child_t text;
  parent_t text;
  fk_col text;
  pol record;
begin
  for item in select * from jsonb_array_elements(child_tables) loop
    child_t := item->>'child';
    parent_t := item->>'parent';
    fk_col := item->>'fk';

    if not exists (select 1 from information_schema.tables where table_name = child_t) then continue; end if;
    if not exists (select 1 from information_schema.tables where table_name = parent_t) then continue; end if;

    execute format('alter table %I enable row level security', child_t);
    for pol in select policyname from pg_policies where tablename = child_t loop
      execute format('drop policy if exists %I on %I', pol.policyname, child_t);
    end loop;

    execute format(
      'create policy tenant_via_parent on %I for all to authenticated using (
        exists (
          select 1 from %I p
          where p.id = %I.%I
            and wathiq_tenant_match(p.tenant_id::text)
        )
      ) with check (
        exists (
          select 1 from %I p
          where p.id = %I.%I
            and wathiq_tenant_match(p.tenant_id::text)
        )
      )',
      child_t, parent_t, child_t, fk_col, parent_t, child_t, fk_col
    );
  end loop;
end $$;

-- ── 6. صفحات عامة (الوظائف) — قراءة وتقديم بدون تسجيل دخول ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'hr_jobs') then
    drop policy if exists public_jobs_read on hr_jobs;
    create policy public_jobs_read on hr_jobs for select to anon
      using (status is distinct from 'مغلق');
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'tenants') then
    drop policy if exists public_tenant_read on tenants;
    create policy public_tenant_read on tenants for select to anon using (true);
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'hr_applicants') then
    drop policy if exists public_apply on hr_applicants;
    create policy public_apply on hr_applicants for insert to anon with check (true);
  end if;
end $$;

-- ── 7. حذف chart_of_accounts القديم ──
drop table if exists chart_of_accounts cascade;

-- ✅ انتهى
