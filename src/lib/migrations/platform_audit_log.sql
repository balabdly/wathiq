-- سجل عمليات Super Admin
create table if not exists platform_audit_log (
  id          bigint primary key generated always as identity,
  action      text not null,
  tenant_id   uuid references tenants(id) on delete set null,
  tenant_name text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_platform_audit_created on platform_audit_log(created_at desc);
create index if not exists idx_platform_audit_tenant on platform_audit_log(tenant_id);

alter table platform_audit_log enable row level security;

-- آخر دخول للمستخدمين (للوحة Super Admin)
alter table employees
  add column if not exists last_login_at timestamptz;
