-- ══════════════════════════════════════════════════════
-- مزامنة username = employee_number للحسابات المربوطة بـ HR
-- يستثني مدير النظام · يصلح الربط المكرر
-- ══════════════════════════════════════════════════════

-- 1) فك ربط HR خاطئ (حساب مكرر لا يطابق hr.employee_id)
UPDATE employees e
SET hr_employee_id = NULL,
    is_active = false
FROM hr_employees hr
WHERE e.hr_employee_id = hr.id
  AND e.tenant_id = hr.tenant_id
  AND hr.employee_id IS NOT NULL
  AND hr.employee_id <> e.id
  AND NOT e.is_tenant_owner;

-- 2) مزامنة hr_employee_id من hr.employee_id
UPDATE employees e
SET hr_employee_id = hr.id
FROM hr_employees hr
WHERE hr.employee_id = e.id
  AND hr.tenant_id = e.tenant_id
  AND e.hr_employee_id IS DISTINCT FROM hr.id
  AND NOT e.is_tenant_owner;

-- 3) username = الرقم الوظيفي (الربط الصحيح فقط)
UPDATE employees e
SET username = trim(hr.employee_number)
FROM hr_employees hr
WHERE hr.employee_id = e.id
  AND hr.tenant_id = e.tenant_id
  AND trim(hr.employee_number) <> ''
  AND NOT e.is_tenant_owner
  AND e.username IS DISTINCT FROM trim(hr.employee_number)
  AND NOT EXISTS (
    SELECT 1 FROM employees e2
    WHERE e2.tenant_id = e.tenant_id
      AND e2.id <> e.id
      AND lower(e2.username) = lower(trim(hr.employee_number))
  );
