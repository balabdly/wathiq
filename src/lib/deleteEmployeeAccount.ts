import { supabase } from '@/lib/supabase'

/** جداول/أعمدة تشير إلى employees.id — تُفك قبل حذف حساب تجريبي */
const EMPLOYEE_FK_UNLINKS: { table: string; column: string }[] = [
  { table: 'hr_departments', column: 'manager_id' },
  { table: 'org_divisions', column: 'manager_id' },
  { table: 'hr_employees', column: 'employee_id' },
  { table: 'hr_employees', column: 'direct_manager' },
  { table: 'tasks', column: 'assigned_to' },
  { table: 'project_tasks', column: 'assigned_to' },
  { table: 'hr_leaves', column: 'approved_by' },
  { table: 'hr_leaves', column: 'direct_manager_id' },
  { table: 'hr_leaves', column: 'dept_manager_id' },
  { table: 'hr_disciplinary', column: 'issued_by' },
  { table: 'hr_terminations', column: 'employee_id' },
  { table: 'hr_payroll_runs', column: 'created_by' },
  { table: 'hr_payroll_runs', column: 'hr_head_id' },
  { table: 'hr_payroll_runs', column: 'approved_by' },
  { table: 'hr_payroll_runs', column: 'posted_by' },
]

/** إزالة كل الإشارات إلى المستخدم قبل الحذف (مدير قسم، مهام، إلخ) */
export async function unlinkEmployeeReferences(tenantId: string, employeeId: number): Promise<void> {
  for (const { table, column } of EMPLOYEE_FK_UNLINKS) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: null })
      .eq('tenant_id', tenantId)
      .eq(column, employeeId)

    if (error) {
      // بعض الأعمدة قد لا تكون موجودة في كل بيئة — نتجاهل فقط أخطاء العمود/الجدول
      const msg = error.message.toLowerCase()
      if (!msg.includes('column') && !msg.includes('does not exist') && !msg.includes('schema cache')) {
        console.warn(`[unlinkEmployee] ${table}.${column}:`, error.message)
      }
    }
  }
}

export async function deleteEmployeeAccount(
  tenantId: string,
  employeeId: number,
): Promise<{ ok: boolean; error?: string }> {
  await unlinkEmployeeReferences(tenantId, employeeId)

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
