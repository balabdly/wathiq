-- ══ إدارة فرق المشاريع — Phase A ══

create table if not exists teams (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id) not null,
  name        text not null,
  team_type   text not null default 'ميداني',
  lead_id     bigint references hr_employees(id),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists team_members (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  team_id       bigint references teams(id) on delete cascade not null,
  employee_id   bigint references hr_employees(id) on delete cascade not null,
  role_in_team  text not null default 'عضو',
  is_active     boolean not null default true,
  joined_at     timestamptz not null default now(),
  unique (team_id, employee_id)
);

alter table projects add column if not exists team_id bigint references teams(id);
alter table projects add column if not exists lead_id bigint references hr_employees(id);

create index if not exists idx_teams_tenant_branch on teams(tenant_id, branch_id);
create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_employee on team_members(employee_id);
create index if not exists idx_projects_team on projects(team_id);

-- ── RLS ──
alter table teams enable row level security;
alter table team_members enable row level security;

do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members'] loop
    execute format('drop policy if exists teams_tenant_select on %I', t);
    execute format('drop policy if exists teams_tenant_insert on %I', t);
    execute format('drop policy if exists teams_tenant_update on %I', t);
    execute format('drop policy if exists teams_tenant_delete on %I', t);
    execute format('create policy teams_tenant_select on %I for select using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy teams_tenant_insert on %I for insert with check (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy teams_tenant_update on %I for update using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy teams_tenant_delete on %I for delete using (wathiq_tenant_match(tenant_id::text))', t);
  end loop;
end;
$$;
