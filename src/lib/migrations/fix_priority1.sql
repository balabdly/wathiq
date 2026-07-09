-- ══════════════════════════════════════════════════════
-- إصلاحات الأولوية 1 — آمن للتشغيل في Supabase SQL Editor
-- إذا فشل سابقاً: شغّل هذا الملف كاملاً (يُعيد المحاولة بأمان)
-- ══════════════════════════════════════════════════════

-- ── 0. حذف الدوال القديمة لتجنب تعارض التوقيع ──
drop function if exists next_doc_number(uuid, text, text);
drop function if exists next_doc_number(uuid, text);
drop function if exists get_cash_account_balances(uuid);

-- ── 1. تسلسل أرقام المستندات (لا يعتمد على جداول جديدة) ──
create table if not exists finance_doc_sequences (
  id          bigint primary key generated always as identity,
  tenant_id   uuid not null,
  doc_type    text not null,
  prefix      text not null default '',
  last_number int not null default 0,
  unique(tenant_id, doc_type)
);

-- ── 2. الفترات المحاسبية ──
create table if not exists finance_fiscal_periods (
  id          bigint primary key generated always as identity,
  tenant_id   uuid not null,
  year        int not null,
  month       int not null,
  status      text default 'مقفلة',
  closed_at   timestamptz default now(),
  closed_by   text,
  unique(tenant_id, year, month)
);

-- ── 3. مسيرات الرواتب (بدون FK اختيارية لتجنب فشل الإنشاء) ──
create table if not exists hr_payroll_runs (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid not null,
  branch_id           bigint not null default 0,
  run_number          text not null,
  month               int not null,
  year                int not null,
  status              text default 'مسودة',
  employee_count      int default 0,
  total_basic         numeric default 0,
  total_allowances    numeric default 0,
  total_gosi_employee numeric default 0,
  total_gosi_employer numeric default 0,
  total_deductions    numeric default 0,
  total_gross         numeric default 0,
  total_net           numeric default 0,
  created_by          bigint,
  hr_head_id          bigint,
  approved_by         bigint,
  approved_at         timestamptz,
  posted_by           bigint,
  posted_at           timestamptz,
  journal_entry_id    bigint,
  created_at          timestamptz default now()
);

-- إصلاح جدول موجود من محاولة سابقة
do $$ begin
  alter table hr_payroll_runs add column if not exists total_gosi_employer numeric default 0;
  alter table hr_payroll_runs add column if not exists journal_entry_id bigint;
  alter table hr_payroll_runs add column if not exists posted_by bigint;
  alter table hr_payroll_runs add column if not exists posted_at timestamptz;
exception when others then null;
end $$;

-- فهرس فريد: branch_id=0 عند عدم تحديد فرع (يدعم upsert من التطبيق)
alter table hr_payroll_runs drop constraint if exists hr_payroll_runs_tenant_id_month_year_branch_id_key;
drop index if exists uq_hr_payroll_runs_period;
update hr_payroll_runs set branch_id = 0 where branch_id is null;
alter table hr_payroll_runs alter column branch_id set default 0;
do $$ begin
  alter table hr_payroll_runs alter column branch_id set not null;
exception when others then raise notice 'branch_id not null: %', sqlerrm;
end $$;
create unique index if not exists uq_hr_payroll_runs_period
  on hr_payroll_runs (tenant_id, month, year, branch_id);

-- ── 4. أعمدة إضافية على hr_payroll (بدون FK أولاً) ──
do $$ begin
  alter table hr_payroll add column if not exists gosi_employer_amount numeric default 0;
exception when undefined_table then
  raise notice 'جدول hr_payroll غير موجود — تخطي الأعمدة';
end $$;

do $$ begin
  alter table hr_payroll add column if not exists run_id bigint;
exception when undefined_table then null;
end $$;

do $$ begin
  alter table hr_payroll add column if not exists branch_id bigint;
exception when undefined_table then null;
end $$;

do $$ begin
  alter table hr_payroll add column if not exists working_days int default 26;
exception when undefined_table then null;
end $$;

do $$ begin
  alter table hr_payroll add column if not exists overtime_hours numeric default 0;
exception when undefined_table then null;
end $$;

-- ── 5. إضافة FK اختيارية فقط إذا الجداول المرجعية موجودة ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants') then
    alter table finance_doc_sequences drop constraint if exists finance_doc_sequences_tenant_id_fkey;
    alter table finance_doc_sequences
      add constraint finance_doc_sequences_tenant_id_fkey
      foreign key (tenant_id) references tenants(id) on delete cascade;
  end if;
exception when others then raise notice 'FK finance_doc_sequences: %', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants') then
    alter table finance_fiscal_periods drop constraint if exists finance_fiscal_periods_tenant_id_fkey;
    alter table finance_fiscal_periods
      add constraint finance_fiscal_periods_tenant_id_fkey
      foreign key (tenant_id) references tenants(id) on delete cascade;
  end if;
exception when others then raise notice 'FK finance_fiscal_periods: %', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants') then
    alter table hr_payroll_runs drop constraint if exists hr_payroll_runs_tenant_id_fkey;
    alter table hr_payroll_runs
      add constraint hr_payroll_runs_tenant_id_fkey
      foreign key (tenant_id) references tenants(id) on delete cascade;
  end if;
exception when others then raise notice 'FK hr_payroll_runs tenant: %', sqlerrm;
end $$;

-- branch_id بدون FK — القيمة 0 تعني "بدون فرع" ولا يوجد فرع بمعرّف 0

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'finance_journal_entries') then
    alter table hr_payroll_runs drop constraint if exists hr_payroll_runs_journal_entry_id_fkey;
    alter table hr_payroll_runs
      add constraint hr_payroll_runs_journal_entry_id_fkey
      foreign key (journal_entry_id) references finance_journal_entries(id);
  end if;
exception when others then raise notice 'FK journal_entry: %', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'hr_payroll_runs')
     and exists (select 1 from information_schema.tables where table_name = 'hr_payroll') then
    alter table hr_payroll drop constraint if exists hr_payroll_run_id_fkey;
    alter table hr_payroll
      add constraint hr_payroll_run_id_fkey
      foreign key (run_id) references hr_payroll_runs(id);
  end if;
exception when others then raise notice 'FK hr_payroll run_id: %', sqlerrm;
end $$;

-- ── 6. دالة توليد رقم مستند ذرّي ──
create or replace function next_doc_number(
  p_tenant_id uuid,
  p_doc_type  text,
  p_prefix    text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into finance_doc_sequences (tenant_id, doc_type, prefix, last_number)
  values (p_tenant_id, p_doc_type, coalesce(p_prefix, ''), 1)
  on conflict (tenant_id, doc_type)
  do update set
    last_number = finance_doc_sequences.last_number + 1,
    prefix      = excluded.prefix
  returning last_number into v_next;

  if coalesce(p_prefix, '') = '' then
    return lpad(v_next::text, 6, '0');
  end if;
  return p_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

-- ── 7. دالة أرصدة الحسابات النقدية ──
create or replace function get_cash_account_balances(p_tenant_id uuid)
returns table(cash_account_id bigint, ledger_balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    ca.id as cash_account_id,
    coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0) as ledger_balance
  from finance_cash_accounts ca
  left join finance_journal_lines jl on jl.account_id = ca.account_id
  left join finance_journal_entries je on je.id = jl.entry_id
    and je.tenant_id::text = p_tenant_id::text
    and je.status = 'معتمد'
  where ca.tenant_id::text = p_tenant_id::text
    and ca.is_active = true
  group by ca.id;
$$;

-- ── 8. فهارس ──
create index if not exists idx_hr_payroll_runs_tenant on hr_payroll_runs(tenant_id, year, month);

do $$ begin
  create index if not exists idx_hr_payroll_run_id on hr_payroll(run_id);
exception when undefined_table then null;
end $$;

create index if not exists idx_finance_fiscal_periods on finance_fiscal_periods(tenant_id, year, month);

-- ── 9. منح صلاحيات RPC لـ Supabase ──
grant execute on function next_doc_number(uuid, text, text) to anon, authenticated, service_role;
grant execute on function get_cash_account_balances(uuid) to anon, authenticated, service_role;

-- ✅ انتهى — يجب أن تظهر رسالة Success
