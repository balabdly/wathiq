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

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'project_consultants' and policyname = 'project_consultants_tenant_all'
  ) then
    create policy project_consultants_tenant_all on project_consultants
      for all using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  end if;
end $$;
