-- سجل دخول/خروج مشروع من مراحل الحياة الأربع

create table if not exists project_phase_history (
  id              bigint primary key generated always as identity,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  project_id      bigint not null references projects(id) on delete cascade,
  lifecycle_phase text not null check (lifecycle_phase in ('initiation', 'planning', 'execution', 'closure')),
  pmo_phase       text,
  entered_at      timestamptz not null default now(),
  exited_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_project_phase_history_project
  on project_phase_history(tenant_id, project_id, entered_at);

create index if not exists idx_project_phase_history_open
  on project_phase_history(tenant_id, project_id)
  where exited_at is null;
