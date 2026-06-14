/**
 * loadHREmployees.ts
 * دالة مساعدة تُستدعى بعد الـ login لتحميل موظفي HR في الـ store
 * استخدامها: import { loadHREmployees } from '@/lib/loadHREmployees'
 *            await loadHREmployees(tenantId)
 */
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'

export async function loadHREmployees(tenantId: string): Promise<void> {
  const { data } = await supabase
    .from('hr_employees')
    .select('id, tenant_id, employee_id, employee_number, name, first_name, father_name, grandfather_name, family_name, job_title, department, nationality, is_active, basic_salary, housing_allow, transport_allow, other_allow, hire_date, iqama_expiry')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('employee_number', { ascending: true })

  // بناء الاسم المدمج إذا لم يكن موجوداً
  const employees = (data || []).map(e => ({
    ...e,
    name: e.name || [e.first_name, e.father_name, e.grandfather_name, e.family_name].filter(Boolean).join(' ') || '—',
  }))

  useStore.getState().setHREmployees(employees)
}
