-- وضع الصيانة للشركات
alter table tenants
  add column if not exists maintenance_mode boolean not null default false;

alter table tenants
  add column if not exists maintenance_message text;
