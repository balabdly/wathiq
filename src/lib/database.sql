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

-- ══════════════════════════════════════════════════════
-- مناطق المستودع
-- ══════════════════════════════════════════════════════
create table if not exists warehouse_zones (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  branch_id    bigint references branches(id) not null,
  warehouse_id bigint references warehouses(id) on delete cascade not null,
  name         text not null,
  zone_type    text,
  color        text default '#1a56db',
  notes        text,
  created_at   timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- تصحيحات الزيارات
-- ══════════════════════════════════════════════════════
create table if not exists visit_corrections (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  visit_id    bigint references visits(id) on delete cascade not null,
  field_name  text not null,
  old_value   text,
  new_value   text,
  corrected_by text,
  corrected_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- المرفقات العامة
-- ══════════════════════════════════════════════════════
create table if not exists attachments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade not null,
  entity_type text not null,
  entity_id   text not null,
  file_name   text not null,
  file_url    text not null,
  file_size   bigint,
  mime_type   text,
  uploaded_by text,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- المهام العامة
-- ══════════════════════════════════════════════════════
create table if not exists tasks (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  title       text not null,
  description text,
  assigned_to bigint references employees(id),
  due_date    date,
  priority    text default 'متوسط',
  status      text default 'معلقة',
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- إدارة المشاريع — تفاصيل إضافية
-- ══════════════════════════════════════════════════════
create table if not exists project_types (
  id        bigint primary key generated always as identity,
  tenant_id uuid references tenants(id) on delete cascade not null,
  name      text not null,
  created_at timestamptz default now()
);

create table if not exists project_tasks (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  title       text not null,
  description text,
  assigned_to bigint references employees(id),
  due_date    date,
  priority    text default 'متوسط',
  status      text default 'معلقة',
  progress    int default 0,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists project_risks (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  project_id      bigint references projects(id) on delete cascade not null,
  risk_code       text,
  title           text not null,
  category        text,
  probability     text default 'متوسطة',
  impact          text default 'متوسط',
  risk_score      int default 0,
  status          text default 'مفتوح',
  owner           text,
  response_plan   text,
  review_date     date,
  created_at      timestamptz default now()
);

create table if not exists project_materials (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  material_id bigint references materials(id),
  name        text not null,
  unit        text,
  qty_planned numeric default 0,
  qty_used    numeric default 0,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists project_material_adjustments (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  material_id bigint references materials(id),
  qty         numeric not null,
  reason      text,
  adjusted_by text,
  created_at  timestamptz default now()
);

create table if not exists project_progress_logs (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  progress    int not null,
  note        text,
  logged_by   text,
  created_at  timestamptz default now()
);

create table if not exists project_lessons (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  title       text not null,
  category    text,
  description text,
  outcome     text,
  added_by    text,
  created_at  timestamptz default now()
);

create table if not exists project_attachments (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  project_id  bigint references projects(id) on delete cascade not null,
  file_name   text not null,
  file_url    text not null,
  file_size   bigint,
  mime_type   text,
  uploaded_by text,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- الموارد البشرية — HR
-- ══════════════════════════════════════════════════════

-- الأقسام
create table if not exists hr_departments (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  manager_id  bigint references employees(id),
  notes       text,
  created_at  timestamptz default now()
);

-- المسميات الوظيفية
create table if not exists hr_job_titles (
  id             bigint primary key generated always as identity,
  tenant_id      uuid references tenants(id) on delete cascade not null,
  name           text not null,
  department_id  bigint references hr_departments(id),
  grade_id       bigint,
  notes          text,
  created_at     timestamptz default now()
);

-- درجات المسميات الوظيفية
create table if not exists org_job_grades (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  grade_code  text not null,
  grade_name  text not null,
  min_salary  numeric default 0,
  max_salary  numeric default 0,
  notes       text,
  created_at  timestamptz default now()
);

-- تقسيمات الهيكل التنظيمي
create table if not exists org_divisions (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  parent_id   bigint,
  notes       text,
  created_at  timestamptz default now()
);

-- الوصف الوظيفي
create table if not exists org_job_descriptions (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  job_title_id bigint references hr_job_titles(id),
  title        text not null,
  responsibilities jsonb default '[]',
  requirements     jsonb default '[]',
  created_at   timestamptz default now()
);

-- موظفو HR (تفاصيل كاملة)
create table if not exists hr_employees (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  employee_id       bigint references employees(id),
  employee_number   text,
  name              text,
  first_name        text,
  father_name       text,
  grandfather_name  text,
  family_name       text,
  first_name_en     text,
  family_name_en    text,
  national_id       text,
  nationality       text default 'سعودي',
  birth_date        date,
  gender            text default 'ذكر',
  marital_status    text default 'أعزب',
  hire_date         date,
  contract_type     text default 'دوام كامل',
  job_title         text,
  department        text,
  work_location     text,
  direct_manager    bigint references employees(id),
  basic_salary      numeric default 0,
  housing_allow     numeric default 0,
  transport_allow   numeric default 0,
  other_allow       numeric default 0,
  gosi_enrolled     boolean default true,
  gosi_pct          numeric default 10,
  bank_name         text,
  iban              text,
  iqama_number      text,
  iqama_expiry      date,
  passport_number   text,
  passport_expiry   date,
  phone             text,
  mobile            text,
  email             text,
  notes             text,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique(tenant_id, employee_number)
);

-- جهات الاتصال الطارئة
create table if not exists hr_emergency_contacts (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  hr_employee_id bigint references hr_employees(id) on delete cascade not null,
  name        text not null,
  relation    text,
  phone       text,
  created_at  timestamptz default now()
);

-- الحضور والغياب
create table if not exists hr_attendance (
  id             bigint primary key generated always as identity,
  tenant_id      uuid references tenants(id) on delete cascade not null,
  employee_id    bigint references hr_employees(id) on delete cascade not null,
  date           date not null,
  status         text not null default 'حضور',
  check_in       time,
  check_out      time,
  hours_worked   numeric,
  overtime_hours numeric default 0,
  notes          text,
  created_at     timestamptz default now(),
  unique(employee_id, date)
);

-- الإجازات
create table if not exists hr_leaves (
  id             bigint primary key generated always as identity,
  tenant_id      uuid references tenants(id) on delete cascade not null,
  employee_id    bigint references hr_employees(id) on delete cascade not null,
  leave_type     text not null,
  start_date     date not null,
  end_date       date not null,
  days           numeric not null,
  status         text default 'بانتظار الموافقة',
  reason         text,
  sick_pay_info  text,
  approved_by    bigint references employees(id),
  notes          text,
  created_at     timestamptz default now()
);

-- أنواع المخالفات
create table if not exists hr_violation_types (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade,
  code            text,
  name            text not null,
  category        text not null,
  is_default      boolean default false,
  first_penalty   text,
  second_penalty  text,
  third_penalty   text,
  notes           text,
  created_at      timestamptz default now()
);

-- الإجراءات التأديبية
create table if not exists hr_disciplinary (
  id                    bigint primary key generated always as identity,
  tenant_id             uuid references tenants(id) on delete cascade not null,
  employee_id           bigint references hr_employees(id) on delete cascade not null,
  violation_type_id     bigint references hr_violation_types(id),
  violation_name        text not null,
  category              text,
  incident_date         date not null,
  penalty_degree        int default 1,
  penalty_type          text,
  penalty_details       text,
  salary_deduct_days    numeric default 0,
  notes                 text,
  status                text default 'نافذ',
  issued_by             bigint references employees(id),
  deduct_applied        boolean default false,
  deduct_applied_month  int,
  deduct_applied_year   int,
  created_at            timestamptz default now()
);

-- وثائق الموظفين
create table if not exists hr_documents (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  hr_employee_id  bigint references hr_employees(id) on delete cascade not null,
  doc_type        text not null,
  doc_number      text,
  issue_date      date,
  expiry_date     date,
  file_url        text,
  file_name       text,
  notes           text,
  created_at      timestamptz default now()
);

-- إنهاء الخدمة
create table if not exists hr_terminations (
  id                 bigint primary key generated always as identity,
  tenant_id          uuid references tenants(id) on delete cascade not null,
  employee_id        bigint references employees(id),
  hr_employee_id     bigint references hr_employees(id) on delete cascade not null,
  termination_type   text not null,
  termination_date   date not null,
  last_working_day   date not null,
  years_of_service   numeric default 0,
  gratuity_amount    numeric default 0,
  notes              text,
  status             text default 'نهائي',
  created_at         timestamptz default now()
);

-- تسوية نهاية الخدمة
create table if not exists hr_settlements (
  id                       bigint primary key generated always as identity,
  tenant_id                uuid references tenants(id) on delete cascade not null,
  employee_id              bigint references hr_employees(id) on delete cascade not null,
  termination_id           bigint references hr_terminations(id),
  termination_date         date,
  last_working_day         date,
  termination_type         text,
  gratuity_amount          numeric default 0,
  month_salary_days        numeric default 0,
  month_salary_amount      numeric default 0,
  leave_balance_days       numeric default 0,
  leave_compensation       numeric default 0,
  other_entitlements       numeric default 0,
  other_entitlements_note  text,
  advances_deduct          numeric default 0,
  other_deduct             numeric default 0,
  other_deduct_note        text,
  total_entitlements       numeric default 0,
  total_deductions         numeric default 0,
  net_settlement           numeric default 0,
  status                   text default 'مسودة',
  notes                    text,
  created_at               timestamptz default now()
);

-- مكافأة إجازة
create table if not exists hr_leave_compensations (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  employee_id       bigint references hr_employees(id) on delete cascade not null,
  compensation_date date not null,
  leave_days        numeric not null,
  daily_salary      numeric not null,
  total_amount      numeric not null,
  reason            text,
  status            text default 'معلق',
  notes             text,
  created_at        timestamptz default now()
);

-- مسير الرواتب
create table if not exists hr_payroll (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  employee_id       bigint references hr_employees(id) on delete cascade not null,
  month             int not null,
  year              int not null,
  basic_salary      numeric default 0,
  housing_allow     numeric default 0,
  transport_allow   numeric default 0,
  other_allow       numeric default 0,
  overtime_pay      numeric default 0,
  bonuses           numeric default 0,
  gosi_deduction    numeric default 0,
  absence_deduct    numeric default 0,
  other_deduct      numeric default 0,
  gross_salary      numeric default 0,
  net_salary        numeric default 0,
  present_days      int default 26,
  absent_days       int default 0,
  notes             text,
  status            text default 'مسودة',
  created_at        timestamptz default now(),
  unique(tenant_id, employee_id, month, year)
);

-- الوظائف والتوظيف
create table if not exists hr_jobs (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  title        text not null,
  department   text,
  location     text,
  job_type     text default 'دوام كامل',
  description  text,
  requirements text,
  salary_range text,
  status       text default 'مفتوح',
  deadline     date,
  created_at   timestamptz default now()
);

create table if not exists hr_applicants (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  job_id       bigint references hr_jobs(id),
  name         text not null,
  email        text,
  phone        text,
  nationality  text,
  resume_url   text,
  status       text default 'جديد',
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists hr_job_offers (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  applicant_id    bigint references hr_applicants(id),
  job_id          bigint references hr_jobs(id),
  basic_salary    numeric default 0,
  housing_allow   numeric default 0,
  transport_allow numeric default 0,
  other_allow     numeric default 0,
  start_date      date,
  status          text default 'مرسل',
  notes           text,
  created_at      timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- المحاسبة — Finance
-- ══════════════════════════════════════════════════════

-- شجرة الحسابات
create table if not exists finance_accounts (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  code            text not null,
  name            text not null,
  name_en         text,
  account_type    text not null,
  account_class   text not null,
  parent_id       bigint references finance_accounts(id),
  level           int default 1,
  is_parent       boolean default false,
  normal_balance  text not null default 'مدين',
  is_active       boolean default true,
  notes           text,
  created_at      timestamptz default now(),
  unique(tenant_id, code)
);

-- دليل الحسابات (قديم — يُستخدم في accounts.ts)
create table if not exists chart_of_accounts (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade,
  code            text not null,
  name            text not null,
  account_type    text,
  parent_id       bigint,
  level           int default 1,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- مراكز التكلفة
create table if not exists finance_cost_centers (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  code        text not null,
  name        text not null,
  type        text,
  project_id  bigint references projects(id),
  is_active   boolean default true,
  notes       text,
  created_at  timestamptz default now(),
  unique(tenant_id, code)
);

-- الحسابات النقدية والبنكية
create table if not exists finance_cash_accounts (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  name            text not null,
  account_type    text not null default 'صندوق',
  account_id      bigint references finance_accounts(id),
  bank_name       text,
  account_no      text,
  iban            text,
  opening_balance numeric default 0,
  is_active       boolean default true,
  notes           text,
  created_at      timestamptz default now()
);

-- رأس القيد المحاسبي
create table if not exists finance_journal_entries (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  entry_number    text not null,
  entry_date      date not null,
  description     text,
  reference_type  text,
  reference_id    bigint,
  total_debit     numeric default 0,
  total_credit    numeric default 0,
  status          text default 'معتمد',
  entry_source    text default 'آلي',
  created_at      timestamptz default now(),
  unique(tenant_id, entry_number)
);

-- أسطر القيد المحاسبي
create table if not exists finance_journal_lines (
  id              bigint primary key generated always as identity,
  entry_id        bigint references finance_journal_entries(id) on delete cascade not null,
  account_id      bigint references finance_accounts(id) not null,
  cost_center_id  bigint references finance_cost_centers(id),
  debit           numeric default 0,
  credit          numeric default 0,
  description     text,
  created_at      timestamptz default now()
);

-- العملاء (وحدة المالية)
create table if not exists finance_clients (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  name            text not null,
  name_en         text,
  vat_number      text,
  cr_number       text,
  client_type     text default 'شركة',
  city            text,
  district        text,
  street          text,
  postal_code     text,
  country         text default 'السعودية',
  phone           text,
  email           text,
  contact_person  text,
  is_active       boolean default true,
  notes           text,
  created_at      timestamptz default now()
);

-- كتالوج المنتجات والخدمات
create table if not exists finance_catalog_items (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  item_type   text not null default 'خدمة',
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  is_active   boolean default true,
  notes       text,
  created_at  timestamptz default now()
);

-- الفواتير
create table if not exists finance_invoices (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  invoice_number    text not null,
  invoice_date      date not null,
  due_date          date,
  client_id         bigint references finance_clients(id),
  client_name       text not null,
  client_vat        text,
  client_cr         text,
  client_address    text,
  project_id        bigint references projects(id),
  extract_ref       text,
  subtotal          numeric default 0,
  vat_rate          numeric default 15,
  vat_amount        numeric default 0,
  total_amount      numeric default 0,
  status            text default 'مسودة',
  notes             text,
  created_at        timestamptz default now(),
  unique(tenant_id, invoice_number)
);

create table if not exists finance_invoice_items (
  id          bigint primary key generated always as identity,
  invoice_id  bigint references finance_invoices(id) on delete cascade not null,
  description text not null,
  quantity    numeric default 1,
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

-- إشعارات دائن
create table if not exists finance_credit_notes (
  id                    bigint primary key generated always as identity,
  tenant_id             uuid references tenants(id) on delete cascade not null,
  note_number           text not null,
  note_date             date not null,
  note_type             text default 'إشعار دائن',
  original_invoice_id   bigint references finance_invoices(id),
  client_id             bigint references finance_clients(id),
  client_name           text not null,
  client_vat            text,
  subtotal              numeric default 0,
  vat_rate              numeric default 15,
  vat_amount            numeric default 0,
  total_amount          numeric default 0,
  reason                text,
  status                text default 'مسودة',
  notes                 text,
  created_at            timestamptz default now(),
  unique(tenant_id, note_number)
);

create table if not exists finance_credit_note_items (
  id          bigint primary key generated always as identity,
  note_id     bigint references finance_credit_notes(id) on delete cascade not null,
  description text not null,
  quantity    numeric default 1,
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

-- عروض الأسعار
create table if not exists finance_quotations (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  quote_number  text not null,
  quote_date    date not null,
  valid_until   date,
  client_id     bigint references finance_clients(id),
  client_name   text not null,
  client_vat    text,
  project_id    bigint references projects(id),
  subtotal      numeric default 0,
  vat_rate      numeric default 15,
  vat_amount    numeric default 0,
  total_amount  numeric default 0,
  status        text default 'مسودة',
  notes         text,
  terms         text,
  created_at    timestamptz default now(),
  unique(tenant_id, quote_number)
);

create table if not exists finance_quotation_items (
  id            bigint primary key generated always as identity,
  quotation_id  bigint references finance_quotations(id) on delete cascade not null,
  description   text not null,
  quantity      numeric default 1,
  unit          text default 'وحدة',
  unit_price    numeric default 0,
  total         numeric default 0,
  created_at    timestamptz default now()
);

-- الموردون
create table if not exists finance_vendors (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  name            text not null,
  vat_number      text,
  cr_number       text,
  city            text,
  phone           text,
  email           text,
  iban            text,
  bank_name       text,
  contact_person  text,
  is_active       boolean default true,
  notes           text,
  created_at      timestamptz default now()
);

-- أوامر الشراء
create table if not exists finance_purchase_orders (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  po_number     text not null,
  po_date       date not null,
  vendor_id     bigint references finance_vendors(id),
  vendor_name   text,
  project_id    bigint references projects(id),
  subtotal      numeric default 0,
  vat_rate      numeric default 15,
  vat_amount    numeric default 0,
  total_amount  numeric default 0,
  status        text default 'مسودة',
  notes         text,
  created_at    timestamptz default now(),
  unique(tenant_id, po_number)
);

create table if not exists finance_purchase_order_items (
  id          bigint primary key generated always as identity,
  po_id       bigint references finance_purchase_orders(id) on delete cascade not null,
  description text not null,
  quantity    numeric default 1,
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

-- فواتير الموردين
create table if not exists finance_vendor_invoices (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  invoice_number  text not null,
  invoice_date    date not null,
  due_date        date,
  vendor_id       bigint references finance_vendors(id),
  vendor_name     text,
  po_id           bigint references finance_purchase_orders(id),
  project_id      bigint references projects(id),
  subtotal        numeric default 0,
  vat_rate        numeric default 15,
  vat_amount      numeric default 0,
  total_amount    numeric default 0,
  status          text default 'مسودة',
  notes           text,
  created_at      timestamptz default now(),
  unique(tenant_id, invoice_number)
);

create table if not exists finance_vendor_invoice_items (
  id          bigint primary key generated always as identity,
  invoice_id  bigint references finance_vendor_invoices(id) on delete cascade not null,
  description text not null,
  quantity    numeric default 1,
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

-- مردودات المشتريات
create table if not exists finance_purchase_returns (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  return_number   text not null,
  return_date     date not null,
  vendor_id       bigint references finance_vendors(id),
  vendor_name     text,
  original_invoice_id bigint references finance_vendor_invoices(id),
  subtotal        numeric default 0,
  vat_rate        numeric default 15,
  vat_amount      numeric default 0,
  total_amount    numeric default 0,
  reason          text,
  status          text default 'مسودة',
  notes           text,
  created_at      timestamptz default now(),
  unique(tenant_id, return_number)
);

create table if not exists finance_purchase_return_items (
  id          bigint primary key generated always as identity,
  return_id   bigint references finance_purchase_returns(id) on delete cascade not null,
  description text not null,
  quantity    numeric default 1,
  unit        text default 'وحدة',
  unit_price  numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);

-- المصروفات
create table if not exists finance_expenses (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  expense_number  text not null,
  expense_date    date not null,
  category        text not null,
  description     text,
  expense_type    text not null default 'تشغيلي',
  amount          numeric default 0,
  vat_rate        numeric default 15,
  vat_amount      numeric default 0,
  total_amount    numeric default 0,
  account_id      bigint references finance_accounts(id),
  cost_center_id  bigint references finance_cost_centers(id),
  project_id      bigint references projects(id),
  vendor_id       bigint references finance_vendors(id),
  vendor_name     text,
  receipt_no      text,
  payment_method  text default 'تحويل بنكي',
  cash_account_id bigint references finance_cash_accounts(id),
  status          text default 'مدفوع',
  notes           text,
  created_at      timestamptz default now(),
  unique(tenant_id, expense_number)
);

-- الخزينة والمعاملات النقدية
create table if not exists finance_treasury (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  transaction_no    text not null,
  transaction_date  date not null,
  type              text not null,
  amount            numeric not null,
  description       text,
  cash_account_id   bigint references finance_cash_accounts(id),
  payment_method    text default 'تحويل بنكي',
  reference_type    text,
  reference_no      text,
  account_id        bigint references finance_accounts(id),
  cost_center_id    bigint references finance_cost_centers(id),
  project_id        bigint references projects(id),
  party_name        text,
  status            text default 'معتمد',
  notes             text,
  created_at        timestamptz default now(),
  unique(tenant_id, transaction_no)
);

-- عهد الموظفين
create table if not exists finance_employee_custody (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  custody_no      text not null,
  custody_date    date not null,
  employee_id     bigint references hr_employees(id),
  employee_name   text not null,
  custody_type    text not null,
  amount          numeric not null,
  purpose         text,
  project_id      bigint references projects(id),
  due_date        date,
  settled_amount  numeric default 0,
  settled_date    date,
  status          text default 'مفتوحة',
  notes           text,
  created_at      timestamptz default now(),
  unique(tenant_id, custody_no)
);

-- الأصول الثابتة
create table if not exists finance_assets (
  id                      bigint primary key generated always as identity,
  tenant_id               uuid references tenants(id) on delete cascade not null,
  asset_no                text not null,
  name                    text not null,
  category                text not null,
  description             text,
  serial_no               text,
  purchase_date           date not null,
  purchase_value          numeric default 0,
  installation_cost       numeric default 0,
  total_cost              numeric default 0,
  salvage_value           numeric default 0,
  useful_life_years       int default 5,
  depreciation_method     text default 'قسط ثابت',
  monthly_depreciation    numeric default 0,
  accumulated_depreciation numeric default 0,
  book_value              numeric default 0,
  last_depreciation_date  date,
  asset_account_id        bigint references finance_accounts(id),
  accum_account_id        bigint references finance_accounts(id),
  expense_account_id      bigint references finance_accounts(id),
  project_id              bigint references projects(id),
  cash_account_id         bigint references finance_cash_accounts(id),
  payment_method          text,
  status                  text default 'نشط',
  disposal_date           date,
  disposal_value          numeric,
  disposal_type           text,
  notes                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique(tenant_id, asset_no)
);

-- صيانة الأصول
create table if not exists finance_asset_maintenance (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  asset_id        bigint references finance_assets(id) on delete cascade not null,
  maintenance_date date not null,
  description     text not null,
  cost            numeric default 0,
  vat_amount      numeric default 0,
  total_cost      numeric default 0,
  vendor_name     text,
  cash_account_id bigint references finance_cash_accounts(id),
  payment_method  text,
  notes           text,
  created_at      timestamptz default now()
);

-- استبعاد الأصول
create table if not exists finance_asset_disposals (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  asset_id        bigint references finance_assets(id) on delete cascade not null,
  disposal_date   date not null,
  disposal_type   text not null,
  disposal_value  numeric default 0,
  book_value      numeric default 0,
  gain_loss       numeric default 0,
  cash_account_id bigint references finance_cash_accounts(id),
  notes           text,
  created_at      timestamptz default now()
);

-- إهلاك الأصول
create table if not exists finance_asset_depreciation (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  asset_id          bigint references finance_assets(id) on delete cascade not null,
  depreciation_date date not null,
  amount            numeric not null,
  accumulated_after numeric not null,
  book_value_after  numeric not null,
  notes             text,
  created_at        timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- QHSE — السلامة والجودة والبيئة
-- ══════════════════════════════════════════════════════

-- الحوادث
create table if not exists qhse_incidents (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  branch_id         bigint references branches(id),
  incident_no       text not null,
  incident_date     date not null,
  title             text not null,
  incident_type     text not null,
  severity          text default 'متوسط',
  status            text default 'مفتوح',
  injured_name      text,
  location          text,
  project_id        bigint references projects(id),
  description       text,
  immediate_action  text,
  corrective_action text,
  reported_by       text,
  lost_time_days    numeric default 0,
  created_at        timestamptz default now()
);

-- المخاطر
create table if not exists qhse_risks (
  id                bigint primary key generated always as identity,
  tenant_id         uuid references tenants(id) on delete cascade not null,
  branch_id         bigint references branches(id),
  risk_no           text not null,
  title             text not null,
  risk_category     text,
  likelihood        int default 1,
  severity          int default 1,
  risk_score        int default 1,
  risk_level        text,
  control_measures  text,
  responsible_name  text,
  status            text default 'مفتوح',
  review_date       date,
  created_at        timestamptz default now()
);

-- التدقيق والمراجعة
create table if not exists qhse_audits (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  branch_id     bigint references branches(id),
  audit_no      text,
  audit_date    date not null,
  title         text not null,
  audit_type    text,
  auditor       text,
  status        text default 'مجدول',
  findings      jsonb default '[]',
  notes         text,
  created_at    timestamptz default now()
);

-- الإجراءات التصحيحية والوقائية
create table if not exists qhse_capa (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  branch_id       bigint references branches(id),
  capa_no         text,
  title           text not null,
  capa_type       text default 'تصحيحي',
  source          text,
  description     text,
  root_cause      text,
  action_plan     text,
  responsible     text,
  due_date        date,
  status          text default 'مفتوح',
  closed_date     date,
  notes           text,
  created_at      timestamptz default now()
);

-- إجراءات العمل الآمن
create table if not exists qhse_safe_work_procedures (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  branch_id     bigint references branches(id),
  proc_no       text,
  title         text not null,
  work_type     text,
  description   text,
  steps         jsonb default '[]',
  ppe_required  jsonb default '[]',
  hazards       text,
  precautions   text,
  version       text default '1.0',
  approved_by   text,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- التدريبات QHSE
create table if not exists qhse_trainings (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  branch_id       bigint references branches(id),
  training_no     text,
  title           text not null,
  training_date   date not null,
  trainer         text,
  duration_hours  numeric,
  status          text default 'مجدول',
  attendees       jsonb default '[]',
  location        text,
  notes           text,
  created_at      timestamptz default now()
);

-- المعتمدون
create table if not exists qhse_approvers (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  section     text not null,
  name        text not null,
  role        text,
  signature_url text,
  created_at  timestamptz default now()
);

-- الشهادات QHSE
create table if not exists qhse_certificates (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  branch_id     bigint references branches(id),
  name          text not null,
  cert_number   text,
  issue_date    date,
  expiry_date   date,
  issued_by     text,
  status        text default 'ساري',
  file_url      text,
  notes         text,
  created_at    timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- الجودة
-- ══════════════════════════════════════════════════════
create table if not exists quality_suppliers (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  name        text not null,
  category    text,
  contact     text,
  phone       text,
  email       text,
  status      text default 'نشط',
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists quality_supplier_evaluations (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  supplier_id   bigint references quality_suppliers(id) on delete cascade,
  eval_date     date not null,
  quality_score int default 0,
  delivery_score int default 0,
  price_score   int default 0,
  total_score   int default 0,
  grade         text,
  notes         text,
  created_at    timestamptz default now()
);

create table if not exists quality_kpis (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  title       text not null,
  category    text,
  target      numeric,
  actual      numeric,
  unit        text,
  period      text,
  status      text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists quality_customer_feedback (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  client_name text,
  project_id  bigint references projects(id),
  feedback_date date not null,
  score       int default 0,
  category    text,
  comments    text,
  follow_up   text,
  status      text default 'جديد',
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- البيئة
-- ══════════════════════════════════════════════════════
create table if not exists env_emissions (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  record_date date not null,
  source      text,
  type        text,
  value       numeric,
  unit        text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists env_waste (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  record_date date not null,
  waste_type  text,
  quantity    numeric,
  unit        text,
  disposal    text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists env_water (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  record_date date not null,
  source      text,
  consumption numeric,
  unit        text default 'م3',
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists env_chemicals (
  id          bigint primary key generated always as identity,
  tenant_id   uuid references tenants(id) on delete cascade not null,
  branch_id   bigint references branches(id),
  name        text not null,
  cas_number  text,
  hazard_class text,
  quantity    numeric,
  unit        text,
  location    text,
  sds_url     text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists env_incidents (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  branch_id       bigint references branches(id),
  incident_date   date not null,
  title           text not null,
  description     text,
  impact          text,
  corrective_action text,
  status          text default 'مفتوح',
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists env_inspections (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  branch_id       bigint references branches(id),
  inspection_date date not null,
  title           text not null,
  inspector       text,
  findings        text,
  status          text default 'مكتمل',
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists env_training (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  branch_id       bigint references branches(id),
  training_date   date not null,
  title           text not null,
  trainer         text,
  attendees       jsonb default '[]',
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists env_certificates (
  id            bigint primary key generated always as identity,
  tenant_id     uuid references tenants(id) on delete cascade not null,
  branch_id     bigint references branches(id),
  name          text not null,
  cert_number   text,
  issue_date    date,
  expiry_date   date,
  issued_by     text,
  file_url      text,
  status        text default 'ساري',
  notes         text,
  created_at    timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- فهارس إضافية للأداء
-- ══════════════════════════════════════════════════════
create index if not exists idx_hr_employees_tenant on hr_employees(tenant_id);
create index if not exists idx_hr_attendance_employee_date on hr_attendance(employee_id, date);
create index if not exists idx_hr_leaves_tenant on hr_leaves(tenant_id, employee_id);
create index if not exists idx_hr_payroll_tenant on hr_payroll(tenant_id, year, month);
create index if not exists idx_finance_accounts_tenant on finance_accounts(tenant_id, code);
create index if not exists idx_finance_journal_entries_tenant on finance_journal_entries(tenant_id, entry_date);
create index if not exists idx_finance_journal_lines_entry on finance_journal_lines(entry_id);
create index if not exists idx_finance_journal_lines_account on finance_journal_lines(account_id);
create index if not exists idx_finance_invoices_tenant on finance_invoices(tenant_id, invoice_date);
create index if not exists idx_finance_invoices_client on finance_invoices(client_id);
create index if not exists idx_finance_expenses_tenant on finance_expenses(tenant_id, expense_date);
create index if not exists idx_finance_assets_tenant on finance_assets(tenant_id);
create index if not exists idx_project_tasks_project on project_tasks(project_id);
create index if not exists idx_qhse_incidents_tenant on qhse_incidents(tenant_id);
create index if not exists idx_warehouse_zones_warehouse on warehouse_zones(warehouse_id);

-- ══════════════════════════════════════════════════════
-- تريجر updated_at للجداول الإضافية
-- ══════════════════════════════════════════════════════
create trigger hr_employees_updated_at
  before update on hr_employees
  for each row execute function update_updated_at();

create trigger finance_assets_updated_at
  before update on finance_assets
  for each row execute function update_updated_at();

create trigger project_tasks_updated_at
  before update on project_tasks
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════
-- دوال RPC
-- ══════════════════════════════════════════════════════

-- دالة: جلب معرّفات الحسابات من قائمة الأكواد (batch)
create or replace function get_account_ids_by_codes(
  p_tenant_id uuid,
  p_codes     text[]
)
returns table(code text, account_id bigint)
language sql stable as $$
  select code, id as account_id
  from finance_accounts
  where tenant_id = p_tenant_id
    and code = any(p_codes)
    and is_active = true;
$$;

-- دالة: توليد رقم موظف تلقائي
create or replace function generate_employee_number(p_tenant_id uuid)
returns text
language plpgsql as $$
declare
  v_count int;
begin
  select coalesce(max(cast(regexp_replace(employee_number, '\D', '', 'g') as int)), 0)
  into v_count
  from hr_employees
  where tenant_id = p_tenant_id
    and employee_number ~ '^\d+$';
  return lpad((v_count + 1)::text, 5, '0');
end;
$$;

-- ══════════════════════════════════════════════════════
-- أعمدة إضافية على الجداول الموجودة
-- ══════════════════════════════════════════════════════

-- تفضيلات العرض للموظف
alter table employees
  add column if not exists display_preferences jsonb default '{}';
