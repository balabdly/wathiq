-- مرحلة تخطيط المشروع (2_PREP)

create table if not exists project_planning (
  id                          bigint generated always as identity primary key,
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  project_id                  bigint not null references projects(id) on delete cascade unique,
  planning_status             text not null default 'active' check (planning_status in ('active', 'closed')),
  permit_number               text,
  permit_start                date,
  permit_end                  date,
  permit_file_path            text,
  permit_file_name            text,
  work_completion_number      text,
  work_completion_file_path   text,
  work_completion_file_name   text,
  clearance_number            text,
  clearance_file_path         text,
  clearance_file_name         text,
  timeline_start              date,
  timeline_end                date,
  timeline_revised_end        date,
  timeline_revision_reason    text,
  safe_work_content           text,
  safe_work_file_path         text,
  safe_work_file_name         text,
  safe_work_template_id       bigint references qhse_safe_work_procedures(id) on delete set null,
  safe_work_steps             jsonb default '[]',
  quality_plan_content        text,
  quality_plan_file_path      text,
  quality_plan_file_name      text,
  cost_plan_notes             text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index if not exists idx_project_planning_tenant on project_planning(tenant_id);
create index if not exists idx_project_planning_status on project_planning(tenant_id, planning_status);

create table if not exists project_planning_cost_items (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  project_id      bigint not null references projects(id) on delete cascade,
  item_name       text not null,
  category        text,
  planned_amount  numeric default 0,
  actual_amount   numeric default 0,
  notes           text,
  sort_order      int default 0,
  created_at      timestamptz default now()
);

create index if not exists idx_planning_cost_project on project_planning_cost_items(project_id);
