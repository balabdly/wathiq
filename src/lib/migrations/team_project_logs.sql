-- ══ سجل العمل اليومي — فريق × مشروع (تاب المشاريع المسندة) ══

create table if not exists team_project_logs (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  team_id     bigint references teams(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  author_id   bigint references hr_employees(id),
  author_name text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists team_project_log_files (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  log_id      bigint references team_project_logs(id) on delete cascade not null,
  file_name   text not null,
  file_path   text not null,
  file_type   text,
  file_size   bigint default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_team_project_logs_project on team_project_logs(project_id, created_at desc);
create index if not exists idx_team_project_logs_team on team_project_logs(team_id, created_at desc);

alter table team_project_logs enable row level security;
alter table team_project_log_files enable row level security;

drop policy if exists team_project_logs_tenant on team_project_logs;
create policy team_project_logs_tenant on team_project_logs
  for all using (wathiq_tenant_match(tenant_id::text));

drop policy if exists team_project_log_files_tenant on team_project_log_files;
create policy team_project_log_files_tenant on team_project_log_files
  for all using (wathiq_tenant_match(tenant_id::text));
