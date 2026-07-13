-- وقود الأسطول: إعدادات المستأجر + تكامل الدريس (اختياري)

alter table tenants
  add column if not exists fleet_settings jsonb default '{"fuel_mode":"manual"}'::jsonb;

alter table fleet_units
  add column if not exists drees_card_no text,
  add column if not exists fuel_type text default 'ديزل';

alter table fleet_fuel_logs
  add column if not exists source text default 'manual',
  add column if not exists external_ref text,
  add column if not exists drees_card_no text,
  add column if not exists station_name text,
  add column if not exists fuel_product text,
  add column if not exists import_batch_id bigint;

create table if not exists fleet_fuel_import_batches (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  file_name       text,
  period_label    text,
  imported_at     timestamptz default now(),
  row_count       int default 0,
  matched_count   int default 0,
  unmatched_count int default 0,
  duplicate_count int default 0,
  total_liters    numeric default 0,
  total_cost      numeric default 0,
  imported_by     text,
  notes           text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fleet_fuel_logs_import_batch_fkey'
  ) then
    alter table fleet_fuel_logs
      add constraint fleet_fuel_logs_import_batch_fkey
      foreign key (import_batch_id) references fleet_fuel_import_batches(id);
  end if;
end $$;

create unique index if not exists idx_fuel_external_ref
  on fleet_fuel_logs(tenant_id, external_ref)
  where external_ref is not null;

create index if not exists idx_fleet_units_drees_card
  on fleet_units(tenant_id, drees_card_no)
  where drees_card_no is not null;

create index if not exists idx_fuel_import_batch
  on fleet_fuel_logs(import_batch_id)
  where import_batch_id is not null;

alter table fleet_fuel_import_batches enable row level security;

drop policy if exists fleet_fuel_batches_select on fleet_fuel_import_batches;
drop policy if exists fleet_fuel_batches_insert on fleet_fuel_import_batches;
drop policy if exists fleet_fuel_batches_update on fleet_fuel_import_batches;
drop policy if exists fleet_fuel_batches_delete on fleet_fuel_import_batches;

create policy fleet_fuel_batches_select on fleet_fuel_import_batches
  for select using (wathiq_tenant_match(tenant_id::text));
create policy fleet_fuel_batches_insert on fleet_fuel_import_batches
  for insert with check (wathiq_tenant_match(tenant_id::text));
create policy fleet_fuel_batches_update on fleet_fuel_import_batches
  for update using (wathiq_tenant_match(tenant_id::text));
create policy fleet_fuel_batches_delete on fleet_fuel_import_batches
  for delete using (wathiq_tenant_match(tenant_id::text));

update tenants set fleet_settings = coalesce(fleet_settings, '{"fuel_mode":"manual"}'::jsonb)
  where fleet_settings is null;
