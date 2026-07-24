-- بنود المواد المحجوزة يدوياً في خطة التخطيط (بديل/مكمّل لـ BOQ)

create table if not exists project_planning_material_lines (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  project_id      bigint not null references projects(id) on delete cascade,
  line_no         int not null default 1,
  description     text not null,
  unit            text not null default 'قطعة',
  catalog_no      text,
  qty_planned     numeric not null default 0,
  notes           text,
  sort_order      int not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_planning_mat_lines_project
  on project_planning_material_lines(tenant_id, project_id);
