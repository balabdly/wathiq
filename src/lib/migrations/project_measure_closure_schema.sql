-- مرحلة المقايسة (4_MEASURE) والإغلاق (5_CLOSE)

create table if not exists project_measure (
  id                          bigint generated always as identity primary key,
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  project_id                  bigint not null references projects(id) on delete cascade unique,
  measure_status              text not null default 'active' check (measure_status in ('active', 'closed')),
  execution_confirmed         boolean default false,
  as_built_confirmed          boolean default false,
  material_reconciled         boolean default false,
  material_reconciliation_notes text,
  variance_reviewed           boolean default false,
  interim_invoice_number      text,
  interim_invoice_date        date,
  interim_invoice_amount      numeric,
  interim_invoice_file_path   text,
  interim_invoice_file_name   text,
  measure_notes               text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index if not exists idx_project_measure_tenant on project_measure(tenant_id);
create index if not exists idx_project_measure_status on project_measure(tenant_id, measure_status);

create table if not exists project_closure (
  id                          bigint generated always as identity primary key,
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  project_id                  bigint not null references projects(id) on delete cascade unique,
  closure_status              text not null default 'active' check (closure_status in ('active', 'closed')),
  final_boq_confirmed         boolean default false,
  client_handover_date        date,
  client_handover_notes       text,
  as_built_drawings_confirmed boolean default false,
  final_invoice_number        text,
  final_invoice_date          date,
  final_invoice_amount        numeric,
  final_invoice_file_path     text,
  final_invoice_file_name     text,
  lessons_learned             text,
  closure_notes               text,
  closed_at                   timestamptz,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index if not exists idx_project_closure_tenant on project_closure(tenant_id);
create index if not exists idx_project_closure_status on project_closure(tenant_id, closure_status);
