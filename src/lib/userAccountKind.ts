/**
 * تصنيف حسابات الدخول — SaaS multi-tenant
 *
 * • مدير النظام (tenant owner): مالك الاشتراك — قد لا يكون موظف HR — لا يُحذف
 * • موظف: مربوط بـ hr_employees — الخدمة الذاتية والرواتب
 * • خارجي: محترف/تجربة — بدون HR — يُحذف بعد انتهاء العمل
 */

export const SYSTEM_OWNER_ROLE = 'مدير عام'

export type LoginAccountKind = 'owner' | 'staff' | 'external'

export type AccountBadge = {
  kind: LoginAccountKind
  label: string
  bg: string
  color: string
}

type EmpLike = {
  id?: number
  role?: string
  hr_employee_id?: number | null
  is_tenant_owner?: boolean | null
}

type HrLink = { employee_id?: number | null }

export function isTenantOwner(emp: EmpLike | null | undefined): boolean {
  if (!emp) return false
  if (emp.is_tenant_owner === true) return true
  return emp.role === SYSTEM_OWNER_ROLE
}

/** حساب دخول بدون ملف HR — وليس مدير النظام */
export function isExternalLoginUser(emp: EmpLike, hrRows: HrLink[] = []): boolean {
  if (isTenantOwner(emp)) return false
  if (emp.hr_employee_id) return false
  return !hrRows.some(h => h.employee_id === emp.id)
}

export function getLoginAccountKind(emp: EmpLike, hrRows: HrLink[] = []): LoginAccountKind {
  if (isTenantOwner(emp)) return 'owner'
  if (emp.hr_employee_id || hrRows.some(h => h.employee_id === emp.id)) return 'staff'
  return 'external'
}

export function getAccountBadge(emp: EmpLike, hrRows: HrLink[] = []): AccountBadge | null {
  const kind = getLoginAccountKind(emp, hrRows)
  if (kind === 'owner') {
    return { kind, label: 'مدير النظام', bg: '#fef3c7', color: '#b45309' }
  }
  if (kind === 'external') {
    return { kind, label: 'خارجي', bg: '#fee2e2', color: '#c81e1e' }
  }
  return null
}

export function canDeleteLoginAccount(
  target: EmpLike & { id: number },
  actorId?: number,
  hrRows: HrLink[] = [],
): { allowed: boolean; reason?: string } {
  if (isTenantOwner(target)) {
    return { allowed: false, reason: 'لا يمكن حذف مدير النظام — حساب مالك الاشتراك محمي' }
  }
  if (actorId && target.id === actorId) {
    return { allowed: false, reason: 'لا يمكنك حذف حسابك' }
  }
  if (!isExternalLoginUser(target, hrRows)) {
    return {
      allowed: false,
      reason: 'هذا المستخدم مربوط بملف HR — عطّله أو احذف ملف الموظف من HR',
    }
  }
  return { allowed: true }
}

export function canDisableLoginAccount(
  target: EmpLike & { id: number },
  actorId?: number,
): { allowed: boolean; reason?: string } {
  if (isTenantOwner(target)) {
    return { allowed: false, reason: 'لا يمكن تعطيل مدير النظام — حساب مالك الاشتراك محمي' }
  }
  if (actorId && target.id === actorId) {
    return { allowed: false, reason: 'لا يمكنك تعطيل حسابك' }
  }
  return { allowed: true }
}
