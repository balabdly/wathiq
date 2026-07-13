-- إعدادات المنصة (Super Admin) — تُقرأ بالخادم فقط عبر service_role
create table if not exists platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

-- لا سياسات عامة — الوصول عبر service_role فقط من API routes

insert into platform_settings (key, value)
values ('super_admin_password', '123456')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
