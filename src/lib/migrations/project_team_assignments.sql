-- تسلسل فرق التنفيذ على المشروع (ميداني ← كهربائي ...)
create table if not exists project_team_assignments (
  id bigserial primary key,
  tenant_id uuid not null,
  project_id bigint not null references projects(id) on delete cascade,
  team_id bigint not null references teams(id),
  sequence_order int not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed')),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  progress_at_handoff numeric,
  handoff_notes text,
  unique (tenant_id, project_id, sequence_order),
  unique (tenant_id, project_id, team_id)
);

create index if not exists idx_project_team_assignments_project
  on project_team_assignments(tenant_id, project_id, sequence_order);
