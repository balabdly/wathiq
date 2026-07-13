-- ══════════════════════════════════════════════════════════════
-- إدارة الأسطول — المرحلة 1
-- آمن لإعادة التشغيل (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ══════════════════════════════════════════════════════════════

-- ── 1. وحدات الأسطول ──
create table if not exists fleet_units (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  fleet_no          text not null,
  name              text not null,
  category          text not null,          -- معدات ثقيلة | شاحنة | سيارة
  sub_category      text,                   -- حفر | نقل | رفع | فحص | تمديد | تركيب
  asset_id          bigint references finance_assets(id),
  plate_no          text,
  chassis_no        text,
  make              text,
  model             text,
  model_year        int,
  primary_meter     text default 'ساعات',   -- ساعات | كم
  hour_meter        numeric default 0,
  km_reading        numeric default 0,
  operational_status text default 'متاح',   -- متاح | مخصص | صيانة | معطل | مستبعد
  workshop_location text default 'ورشة مركزية',
  notes             text,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (tenant_id, fleet_no)
);

-- ── 2. قوالب فحص ما قبل التشغيل (DVIR) ──
create table if not exists fleet_dvir_templates (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  category    text not null,
  name        text not null,
  checklist   jsonb not null default '[]',
  is_active   boolean default true,
  unique (tenant_id, category)
);

-- ── 3. تخصيصات المشاريع ──
create table if not exists fleet_assignments (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade not null,
  project_id      bigint references projects(id),
  operator_id     bigint references hr_employees(id),
  start_date      date not null,
  end_date        date,
  start_hour_meter numeric,
  start_km         numeric,
  end_hour_meter   numeric,
  end_km           numeric,
  status          text default 'نشط',      -- نشط | مكتمل | ملغي
  notes           text,
  created_at      timestamptz default now()
);

-- ── 4. سجلات الفحص اليومي ──
create table if not exists fleet_dvir_logs (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid references tenants(id) on delete cascade not null,
  unit_id             bigint references fleet_units(id) on delete cascade not null,
  assignment_id       bigint references fleet_assignments(id),
  operator_id         bigint references hr_employees(id),
  check_date          date not null default current_date,
  result              text not null,        -- سليم | ملاحظة | موقوف
  checklist_responses jsonb default '[]',
  hour_meter          numeric,
  km_reading          numeric,
  notes               text,
  qhse_incident_id    bigint references qhse_incidents(id),
  created_at          timestamptz default now()
);

-- ── 5. يوميات التشغيل ──
create table if not exists fleet_daily_logs (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade not null,
  assignment_id   bigint references fleet_assignments(id),
  operator_id     bigint references hr_employees(id),
  log_date        date not null default current_date,
  work_type       text,                     -- حفر | نقل | رفع | فحص | تمديد | تركيب | أخرى
  start_hour_meter numeric,
  end_hour_meter   numeric,
  start_km         numeric,
  end_km           numeric,
  hours_worked     numeric default 0,
  km_driven        numeric default 0,
  fuel_liters      numeric default 0,
  downtime_minutes int default 0,
  notes            text,
  created_at       timestamptz default now(),
  unique (tenant_id, unit_id, log_date)
);

-- ── 6. سجل الوقود ──
create table if not exists fleet_fuel_logs (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade not null,
  operator_id     bigint references hr_employees(id),
  project_id      bigint references projects(id),
  fill_date       date not null default current_date,
  liters          numeric not null,
  cost            numeric default 0,
  hour_meter      numeric,
  km_reading      numeric,
  payment_method  text,
  notes           text,
  created_at      timestamptz default now()
);

-- ── 7. خطط الصيانة الوقائية ──
create table if not exists fleet_pm_plans (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade,
  category        text,
  trigger_type    text not null,            -- ساعات | كم | تقويم
  interval_value  numeric not null,
  last_done_date  date,
  last_meter      numeric default 0,
  next_due_meter  numeric,
  next_due_date   date,
  task_description text not null,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ── 8. أوامر العمل ──
create table if not exists fleet_work_orders (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  wo_no             text not null,
  unit_id           bigint references fleet_units(id) on delete cascade not null,
  wo_type           text not null,          -- PM | CM
  source            text default 'داخلي',   -- داخلي | خارجي
  status            text default 'مفتوح',   -- مفتوح | قيد التنفيذ | مكتمل | ملغي
  priority          text default 'عادي',    -- عادي | عاجل
  opened_at         timestamptz default now(),
  completed_at      timestamptz,
  description       text not null,
  vendor_name       text,
  labor_hours       numeric default 0,
  parts_cost        numeric default 0,
  external_cost     numeric default 0,
  total_cost        numeric default 0,
  hour_meter_at_open numeric,
  project_id        bigint references projects(id),
  reporter_id       bigint references hr_employees(id),
  dvir_log_id       bigint references fleet_dvir_logs(id),
  pm_plan_id        bigint references fleet_pm_plans(id),
  notes             text,
  created_at        timestamptz default now(),
  unique (tenant_id, wo_no)
);

-- ── 9. قطع غيار أوامر العمل ──
create table if not exists fleet_wo_parts (
  id              bigint primary key generated always as identity,
  work_order_id   bigint references fleet_work_orders(id) on delete cascade not null,
  description     text not null,
  quantity        numeric default 1,
  unit_cost       numeric default 0,
  total           numeric default 0,
  created_at      timestamptz default now()
);

-- ── 10. وثائق الامتثال ──
create table if not exists fleet_compliance_docs (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade not null,
  doc_type        text not null,            -- استمارة | تأمين | فحص دوري | شهادة رفع | أخرى
  doc_number      text,
  issuer          text,
  issue_date      date,
  expiry_date     date,
  status          text default 'ساري',      -- ساري | منتهي | قريب الانتهاء
  notes           text,
  created_at      timestamptz default now()
);

-- ── 11. سجل قراءات العداد (تدقيق) ──
create table if not exists fleet_meter_readings (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  unit_id         bigint references fleet_units(id) on delete cascade not null,
  reading_date    timestamptz default now(),
  hour_meter      numeric,
  km_reading      numeric,
  source          text,                     -- DVIR | يومية | وقود | يدوي
  created_at      timestamptz default now()
);

-- ── فهارس ──
create index if not exists idx_fleet_units_tenant on fleet_units(tenant_id, operational_status);
create index if not exists idx_fleet_assignments_unit on fleet_assignments(tenant_id, unit_id, status);
create index if not exists idx_fleet_dvir_logs_unit on fleet_dvir_logs(tenant_id, unit_id, check_date);
create index if not exists idx_fleet_daily_logs_unit on fleet_daily_logs(tenant_id, unit_id, log_date);
create index if not exists idx_fleet_fuel_logs_unit on fleet_fuel_logs(tenant_id, unit_id, fill_date);
create index if not exists idx_fleet_work_orders_unit on fleet_work_orders(tenant_id, unit_id, status);
create index if not exists idx_fleet_compliance_expiry on fleet_compliance_docs(tenant_id, expiry_date);

-- ── قوالب DVIR افتراضية (تُدرج لكل tenant عند أول استخدام من التطبيق) ──

-- ── RLS ──
alter table fleet_units enable row level security;
alter table fleet_dvir_templates enable row level security;
alter table fleet_assignments enable row level security;
alter table fleet_dvir_logs enable row level security;
alter table fleet_daily_logs enable row level security;
alter table fleet_fuel_logs enable row level security;
alter table fleet_pm_plans enable row level security;
alter table fleet_work_orders enable row level security;
alter table fleet_wo_parts enable row level security;
alter table fleet_compliance_docs enable row level security;
alter table fleet_meter_readings enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'fleet_units','fleet_dvir_templates','fleet_assignments','fleet_dvir_logs',
    'fleet_daily_logs','fleet_fuel_logs','fleet_pm_plans','fleet_work_orders',
    'fleet_compliance_docs','fleet_meter_readings'
  ] loop
    execute format('drop policy if exists fleet_tenant_select on %I', t);
    execute format('drop policy if exists fleet_tenant_insert on %I', t);
    execute format('drop policy if exists fleet_tenant_update on %I', t);
    execute format('drop policy if exists fleet_tenant_delete on %I', t);
    execute format('create policy fleet_tenant_select on %I for select using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy fleet_tenant_insert on %I for insert with check (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy fleet_tenant_update on %I for update using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy fleet_tenant_delete on %I for delete using (wathiq_tenant_match(tenant_id::text))', t);
  end loop;
end;
$$;

-- fleet_wo_parts — عبر work_order
alter table fleet_wo_parts enable row level security;
drop policy if exists fleet_wo_parts_select on fleet_wo_parts;
drop policy if exists fleet_wo_parts_insert on fleet_wo_parts;
drop policy if exists fleet_wo_parts_update on fleet_wo_parts;
drop policy if exists fleet_wo_parts_delete on fleet_wo_parts;
create policy fleet_wo_parts_select on fleet_wo_parts for select using (
  exists (select 1 from fleet_work_orders wo where wo.id = work_order_id and wathiq_tenant_match(wo.tenant_id::text))
);
create policy fleet_wo_parts_insert on fleet_wo_parts for insert with check (
  exists (select 1 from fleet_work_orders wo where wo.id = work_order_id and wathiq_tenant_match(wo.tenant_id::text))
);
create policy fleet_wo_parts_update on fleet_wo_parts for update using (
  exists (select 1 from fleet_work_orders wo where wo.id = work_order_id and wathiq_tenant_match(wo.tenant_id::text))
);
create policy fleet_wo_parts_delete on fleet_wo_parts for delete using (
  exists (select 1 from fleet_work_orders wo where wo.id = work_order_id and wathiq_tenant_match(wo.tenant_id::text))
);
