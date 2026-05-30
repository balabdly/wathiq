-- ══════════════════════════════════════════════════
-- وثيق Wathiq — قاعدة البيانات الكاملة
-- نفّذ هذا في Supabase SQL Editor
-- ══════════════════════════════════════════════════

-- ── المستأجرون (الشركات) ──
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_en     text,
  logo_url    text,
  phone       text,
  email       text,
  address     text,
  cr_number   text,
  sec_contractor_id text,
  footer_text text,
  plan        text default 'basic' check (plan in ('basic','pro')),
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ── الفروع ──
create table if not exists branches (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  location    text,
  description text,
  color       text default '#1a56db',
  created_at  timestamptz default now()
);

-- ── الموظفون ──
create table if not exists employees (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  code        text,
  name        text not null,
  role        text not null,
  username    text not null,
  password    text not null,
  phone       text,
  email       text,
  permissions jsonb default '[]',
  is_active   boolean default true,
  created_at  timestamptz default now(),
  unique(tenant_id, username)
);

-- ── المشاريع ──
create table if not exists projects (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id) not null,
  code        text,
  name        text not null,
  type        text,
  status      text default 'تحت التخطيط',
  progress    int default 0,
  engineer    text,
  value       numeric default 0,
  start_date  date,
  end_date    date,
  stages      jsonb default '[]',
  attachments jsonb default '[]',
  timeline    jsonb default '[]',
  history     jsonb default '[]',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── الزيارات ──
create table if not exists visits (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid references tenants(id) on delete cascade not null,
  branch_id           bigint references branches(id) not null,
  project_id          bigint references projects(id),
  location            text,
  type                text,
  date                date,
  engineer            text,
  status              text,
  specs               text,
  corrective          text,
  notes               text,
  attachments         jsonb default '[]',
  resolved_report     text,
  resolved_date       date,
  resolved_by         text,
  resolved_files      jsonb default '[]',
  resolved_attachment text,
  created_at          timestamptz default now()
);

-- ── المستودعات ──
create table if not exists warehouses (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id) not null,
  name        text not null,
  capacity    text,
  location    text,
  created_at  timestamptz default now()
);

-- ── المواد ──
create table if not exists materials (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  branch_id    bigint references branches(id) not null,
  warehouse_id bigint references warehouses(id),
  sku          text,
  catalog_no   text not null,
  name         text not null,
  unit         text default 'وحدة',
  qty          numeric default 0,
  reorder      numeric default 10,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── سجل الحركات ──
create table if not exists stock_ledger (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  branch_id     bigint references branches(id) not null,
  doc_code      text,
  clearance_no  text,
  vendor_name   text,
  type          text,
  mat_name      text,
  unit          text,
  qty           numeric,
  wh_name       text,
  project_name  text,
  dispatch_note text,
  client_name   text,
  qty_before    numeric,
  qty_after     numeric,
  created_at    timestamptz default now()
);

-- ── المشتريات ──
create table if not exists purchases (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id) not null,
  code        text,
  vendor      text,
  items       text,
  date        date,
  status      text default 'تحت المراجعة المالية',
  created_at  timestamptz default now()
);

-- ── العملاء ──
create table if not exists clients (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  type        text,
  created_at  timestamptz default now()
);

-- ── وثائق QHSE ──
create table if not exists qhse_docs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id) on delete cascade not null,
  branch_id    bigint references branches(id) not null,
  section      text not null check (section in ('safety','quality','env')),
  category     text not null,
  name         text not null,
  doc_number   text,
  issue_date   date,
  expiry_date  date,
  notes        text,
  file_url     text,
  file_name    text,
  added_by     text,
  created_at   timestamptz default now()
);

-- ── الهيكل التنظيمي QHSE ──
create table if not exists qhse_org_charts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id) not null,
  section     text not null,
  file_url    text,
  file_name   text,
  uploaded_at timestamptz default now(),
  unique(tenant_id, branch_id, section)
);

-- ── الإشعارات ──
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade not null,
  for_role    text,
  for_user_id bigint,
  title       text not null,
  body        text,
  type        text default 'info',
  project_id  bigint,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ══ Indexes للأداء ══
create index if not exists idx_projects_tenant_branch on projects(tenant_id, branch_id);
create index if not exists idx_visits_tenant_branch on visits(tenant_id, branch_id);
create index if not exists idx_materials_tenant_branch on materials(tenant_id, branch_id);
create index if not exists idx_materials_name on materials(name);
create index if not exists idx_materials_catalog on materials(catalog_no);
create index if not exists idx_ledger_tenant_branch on stock_ledger(tenant_id, branch_id);
create index if not exists idx_ledger_created on stock_ledger(created_at desc);
create index if not exists idx_qhse_tenant_branch on qhse_docs(tenant_id, branch_id, section);
create index if not exists idx_notifications_tenant on notifications(tenant_id, for_role, is_read);

-- ══ Row Level Security ══
alter table tenants         enable row level security;
alter table branches        enable row level security;
alter table employees       enable row level security;
alter table projects        enable row level security;
alter table visits          enable row level security;
alter table warehouses      enable row level security;
alter table materials       enable row level security;
alter table stock_ledger    enable row level security;
alter table purchases       enable row level security;
alter table clients         enable row level security;
alter table qhse_docs       enable row level security;
alter table qhse_org_charts enable row level security;
alter table notifications   enable row level security;

-- ══ Policies — كل مستأجر يرى بياناته فقط ══
-- (نستخدم service_role من الـ backend لتجاوز RLS)
-- للتطوير الآن: نعطل RLS مؤقتاً

alter table tenants         disable row level security;
alter table branches        disable row level security;
alter table employees       disable row level security;
alter table projects        disable row level security;
alter table visits          disable row level security;
alter table warehouses      disable row level security;
alter table materials       disable row level security;
alter table stock_ledger    disable row level security;
alter table purchases       disable row level security;
alter table clients         disable row level security;
alter table qhse_docs       disable row level security;
alter table qhse_org_charts disable row level security;
alter table notifications   disable row level security;

-- ══ دالة تحديث updated_at تلقائياً ══
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger materials_updated_at
  before update on materials
  for each row execute function update_updated_at();

-- ══ SEC API Views (للربط المستقبلي مع شركة الكهرباء) ══
create or replace view sec_inventory_view as
select
  t.name        as contractor_name,
  t.sec_contractor_id,
  b.name        as branch_name,
  m.catalog_no,
  m.sku,
  m.name        as material_name,
  m.unit,
  m.qty,
  w.name        as warehouse_name,
  m.updated_at
from materials m
join tenants t on t.id = m.tenant_id
join branches b on b.id = m.branch_id
join warehouses w on w.id = m.warehouse_id
where t.is_active = true;
