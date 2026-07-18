-- ══ SEC Workflow — مراحل PMO + O&M + العقد الإطاري ══

-- ── projects: مسار العمل والتحصيل ──
alter table projects add column if not exists workflow_type text
  check (workflow_type is null or workflow_type in ('FULL_SEC', 'O&M_WITH_WO', 'O&M_PRE_WO'));
alter table projects add column if not exists billing_model text
  check (billing_model is null or billing_model in ('FULL_100', 'SPLIT_50_50'));
alter table projects add column if not exists pmo_phase text
  check (pmo_phase is null or pmo_phase in (
    '1_RECEIPT', '2_PREP', '3_EXEC', '4_MEASURE', '5_CLOSE',
    'O&M_OPEN', 'O&M_EXEC', 'O&M_CLOSED'
  ));
alter table projects add column if not exists wo_number text;
alter table projects add column if not exists wo_source text
  check (wo_source is null or wo_source in ('UDS', 'SAP', 'VERBAL'));
alter table projects add column if not exists sec_contract_no text;
alter table projects add column if not exists field_memo_id bigint;

alter table projects add column if not exists client_id bigint;
alter table projects add column if not exists client_name text;
alter table projects add column if not exists estimated_value numeric;
alter table projects add column if not exists actual_value numeric;
alter table projects add column if not exists location text;
alter table projects add column if not exists description text;
alter table projects add column if not exists notes text;

create index if not exists idx_projects_wo on projects(tenant_id, wo_number) where wo_number is not null;
create index if not exists idx_projects_workflow on projects(tenant_id, workflow_type);
create index if not exists idx_projects_pmo_phase on projects(tenant_id, pmo_phase);

-- ── العقد الإطاري SEC ──
create table if not exists framework_contracts (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  contract_no  text not null,
  name         text not null,
  client_name  text default 'الشركة السعودية للكهرباء',
  start_date   date,
  end_date     date,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, contract_no)
);

-- ── بنود Unit Rate من العقد ──
create table if not exists framework_boq_items (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  contract_id     bigint references framework_contracts(id) on delete cascade not null,
  item_code       text not null,
  description_ar  text,
  description_en  text,
  unit            text not null default 'EA',
  unit_price      numeric not null default 0,
  line_type       text default 'Breakdown',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (tenant_id, contract_id, item_code)
);

create index if not exists idx_framework_boq_code on framework_boq_items(tenant_id, item_code);
create index if not exists idx_framework_boq_contract on framework_boq_items(contract_id);

-- ── مذكرات تنفيذ O&M (قبل WO) ──
create table if not exists field_work_memos (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid references tenants(id) on delete cascade not null,
  branch_id           bigint references branches(id),
  internal_ref        text not null,
  work_type           text not null default 'صيانة',
  location            text,
  description         text not null,
  assigned_at         timestamptz,
  executed_at         timestamptz,
  team_id             bigint references teams(id),
  assignee_name       text,
  sec_contact_name    text,
  sec_contact_phone   text,
  sec_contact_dept    text,
  follow_up_status    text not null default 'awaiting_wo'
    check (follow_up_status in ('awaiting_wo', 'contacted', 'escalated', 'wo_linked')),
  last_follow_up_at   timestamptz,
  next_follow_up_at   date,
  wo_number           text,
  wo_linked_at        timestamptz,
  project_id          bigint references projects(id) on delete set null,
  status              text not null default 'draft'
    check (status in ('draft', 'in_progress', 'executed', 'awaiting_wo', 'wo_linked', 'invoiced', 'closed', 'cancelled')),
  estimated_amount    numeric default 0,
  boq_lines           jsonb default '[]',
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, internal_ref)
);

create index if not exists idx_field_memos_status on field_work_memos(tenant_id, status);
create index if not exists idx_field_memos_follow on field_work_memos(tenant_id, follow_up_status)
  where status in ('executed', 'awaiting_wo');
create index if not exists idx_field_memos_wo on field_work_memos(tenant_id, wo_number) where wo_number is not null;

-- ── سجل متابعة المشرف مع SEC ──
create table if not exists field_work_memo_followups (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  memo_id     bigint references field_work_memos(id) on delete cascade not null,
  follow_up_at timestamptz not null default now(),
  note        text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_memo_followups_memo on field_work_memo_followups(memo_id);

-- ── مستخلصات المشروع ──
create table if not exists project_extracts (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  project_id      bigint references projects(id) on delete cascade not null,
  extract_type    text not null
    check (extract_type in ('INTERIM_50', 'FINAL_50', 'FULL_100')),
  percentage      numeric not null default 100,
  amount          numeric not null default 0,
  boq_version_id  bigint references project_boq_versions(id) on delete set null,
  extract_ref     text,
  status          text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'invoiced', 'paid', 'cancelled')),
  notes           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_project_extracts_project on project_extracts(project_id);

-- ── FK: projects.field_memo_id ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_field_memo_id_fkey'
  ) then
    alter table projects add constraint projects_field_memo_id_fkey
      foreign key (field_memo_id) references field_work_memos(id) on delete set null;
  end if;
end $$;

-- ── RLS ──
alter table framework_contracts enable row level security;
alter table framework_boq_items enable row level security;
alter table field_work_memos enable row level security;
alter table field_work_memo_followups enable row level security;
alter table project_extracts enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'framework_contracts', 'framework_boq_items',
    'field_work_memos', 'field_work_memo_followups', 'project_extracts'
  ] loop
    execute format('drop policy if exists sec_wf_select on %I', t);
    execute format('drop policy if exists sec_wf_insert on %I', t);
    execute format('drop policy if exists sec_wf_update on %I', t);
    execute format('drop policy if exists sec_wf_delete on %I', t);
    execute format('create policy sec_wf_select on %I for select using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy sec_wf_insert on %I for insert with check (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy sec_wf_update on %I for update using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy sec_wf_delete on %I for delete using (wathiq_tenant_match(tenant_id::text))', t);
  end loop;
end;
$$;
