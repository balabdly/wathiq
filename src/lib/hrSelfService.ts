import type { Employee } from '@/types'

export type HrEmployeeProfile = {
  id: number
  employee_id?: number
  name?: string
  job_title?: string
  department?: string
  hire_date?: string
  direct_manager?: number
}

export function resolveHrEmployeeId(
  currentUser: (Employee & { hr_employee_id?: number }) | null,
  hrEmployees: HrEmployeeProfile[],
): number | null {
  if (!currentUser) return null
  if (currentUser.hr_employee_id) return currentUser.hr_employee_id
  const linked = hrEmployees.find(e => e.employee_id === currentUser.id)
  return linked?.id ?? null
}

export function canAccessSelfService(
  permissions: string[] | undefined,
  hrEmployeeId: number | null,
  role?: string,
): boolean {
  if (role === 'مدير عام') return !!hrEmployeeId
  if (!hrEmployeeId) return false
  const perms = permissions || []
  return perms.includes('hr_self') || perms.includes('hr') || perms.includes('employees')
}

export const PENDING_LEAVE_STATUSES = [
  'بانتظار الموافقة',
  'قيد موافقة المدير المباشر',
  'قيد موافقة مدير الإدارة',
] as const
