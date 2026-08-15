-- قائمة الاستشاريين لمرحلة بدء المشروع
create table if not exists project_consultants (
  id         bigint primary key generated always as identity,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz default now(),
  unique (tenant_id, name)
);

create index if not exists idx_project_consultants_tenant on project_consultants(tenant_id);

alter table project_consultants enable row level security;

drop policy if exists project_consultants_tenant_all on project_consultants;
drop policy if exists project_consultants_select on project_consultants;
drop policy if exists project_consultants_insert on project_consultants;
drop policy if exists project_consultants_update on project_consultants;
drop policy if exists project_consultants_delete on project_consultants;

create policy project_consultants_select on project_consultants
  for select to authenticated
  using (wathiq_tenant_match(tenant_id::text));

create policy project_consultants_insert on project_consultants
  for insert to authenticated
  with check (wathiq_tenant_match(tenant_id::text));

create policy project_consultants_update on project_consultants
  for update to authenticated
  using (wathiq_tenant_match(tenant_id::text))
  with check (wathiq_tenant_match(tenant_id::text));

create policy project_consultants_delete on project_consultants
  for delete to authenticated
  using (wathiq_tenant_match(tenant_id::text));
