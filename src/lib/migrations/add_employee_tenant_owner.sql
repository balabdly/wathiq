-- ══════════════════════════════════════════════════════
-- مالك المستأجر (مدير النظام) — حساب محمي لا يُحذف
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

alter table employees
  add column if not exists is_tenant_owner boolean not null default false;

-- أول مدير عام لكل شركة = مالك الاشتراك
update employees e
set is_tenant_owner = true
from (
  select distinct on (tenant_id) id
  from employees
  where role = 'مدير عام'
  order by tenant_id, id asc
) owner_row
where e.id = owner_row.id
  and e.is_tenant_owner is distinct from true;

create index if not exists idx_employees_tenant_owner
  on employees (tenant_id)
  where is_tenant_owner = true;
