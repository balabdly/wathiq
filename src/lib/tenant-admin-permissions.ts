import type { TenantModules } from '@/lib/tenant-plans'

/** صلاحيات مدير الشركة (مالك المستأجر) حسب الوحدات المفعّلة */
export function permissionsForTenantOwner(modules: TenantModules): string[] {
  const perms = new Set<string>(['dashboard', 'hr_self'])

  if (modules.projects !== false) {
    perms.add('projects_view')
    perms.add('projects_edit')
    perms.add('visits_quality')
    perms.add('visits_safety')
    perms.add('visits_electrical')
    perms.add('visits_field')
  }
  if (modules.inventory !== false) perms.add('inventory')
  if (modules.purchases !== false) perms.add('purchases')
  if (modules.employees !== false) perms.add('employees')
  if (modules.qhse !== false) perms.add('qhse')
  if (modules.finance !== false) perms.add('finance')
  if (modules.reports !== false) perms.add('reports')
  if (modules.fleet !== false) {
    perms.add('fleet')
    perms.add('assets')
  }
  if (modules.assets !== false) perms.add('assets')
  if (modules.pmo !== false) perms.add('pmo')
  if (modules.hr !== false) {
    perms.add('hr')
    perms.add('employees')
  }

  return Array.from(perms)
}
