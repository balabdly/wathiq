export type PermissionItem = { id: string; label: string; icon: string }
export type PermissionGroup = { label: string; color: string; perms: PermissionItem[] }

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'عام', color: '#6b7280', perms: [{ id: 'dashboard', label: 'لوحة التحكم', icon: '📊' }] },
  { label: 'المشاريع', color: '#1a56db', perms: [{ id: 'projects_view', label: 'عرض المشاريع', icon: '👁️' }, { id: 'projects_edit', label: 'تعديل المشاريع', icon: '✏️' }, { id: 'pmo', label: 'إدارة PMO', icon: '📋' }] },
  { label: 'الزيارات', color: '#0ea77b', perms: [{ id: 'visits', label: 'كل الزيارات', icon: '🔎' }, { id: 'visits_quality', label: 'زيارات الجودة', icon: '✅' }, { id: 'visits_safety', label: 'زيارات السلامة', icon: '🦺' }, { id: 'visits_electrical', label: 'زيارات كهربائية', icon: '⚡' }, { id: 'visits_field', label: 'زيارات ميدانية', icon: '🏗️' }] },
  { label: 'QHSE', color: '#e6820a', perms: [{ id: 'qhse', label: 'QHSE', icon: '🛡️' }] },
  { label: 'المخزون والمشتريات', color: '#7c3aed', perms: [{ id: 'inventory', label: 'المخزون', icon: '📦' }, { id: 'purchases', label: 'المشتريات', icon: '🛒' }] },
  { label: 'الموارد البشرية', color: '#9333ea', perms: [{ id: 'hr', label: 'HR', icon: '👥' }, { id: 'employees', label: 'الموظفون', icon: '👤' }, { id: 'hr_self', label: 'الخدمة الذاتية', icon: '🙋' }] },
  { label: 'المالية', color: '#0f766e', perms: [{ id: 'finance', label: 'المالية', icon: '💰' }] },
  { label: 'التقارير', color: '#64748b', perms: [{ id: 'reports', label: 'التقارير', icon: '📈' }] },
]

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.id))

export const DEFAULT_ROLES_PERMS: Record<string, string[]> = {
  'مدير عام':     ALL_PERMISSION_IDS,
  'مدير مشروع':  ['dashboard','projects_view','projects_edit','visits','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','reports','pmo','hr_self'],
  'مهندس جودة':  ['dashboard','projects_view','visits_quality','qhse','reports','hr_self'],
  'مهندس سلامة': ['dashboard','projects_view','visits_safety','qhse','reports','hr_self'],
  'مهندس كهرباء':['dashboard','projects_view','visits_electrical','visits_field','inventory','reports','hr_self'],
  'مهندس ميداني':['dashboard','projects_view','visits_field','reports','hr_self'],
  'مشرف':        ['dashboard','projects_view','visits_field','reports','hr_self'],
  'محاسب':       ['dashboard','finance','purchases','reports','hr_self'],
  'مدير HR':     ['dashboard','hr','employees','reports'],
  'مدير المالية':['dashboard','finance','purchases','reports','employees'],
}
