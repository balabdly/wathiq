// ══════════════════════════════════════════════════
// نظام الصلاحيات المركزي — وثيق RBAC
// ══════════════════════════════════════════════════

export type Permission =
  | 'dashboard'
  | 'projects_view'
  | 'projects_edit'
  | 'visits'
  | 'visits_quality'
  | 'visits_safety'
  | 'visits_electrical'
  | 'visits_field'
  | 'inventory'
  | 'purchases'
  | 'qhse'
  | 'employees'
  | 'reports'
  | 'finance'
  | 'pmo'
  | 'hr'

// ── خريطة الصفحات والصلاحيات المطلوبة ──
export const PAGE_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard':          ['dashboard'],
  '/projects':           ['projects_view'],
  '/visits':             ['visits', 'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field'],
  '/qhse':               ['qhse'],
  '/inventory':          ['inventory'],
  '/purchases':          ['purchases'],
  '/hr':                 ['hr', 'employees'],
  '/finance':            ['finance'],
  '/reports':            ['reports'],
  '/pmo':                ['pmo'],
}

// ── خريطة أنواع الزيارات والصلاحيات ──
export const VISIT_TYPE_PERMISSIONS: Record<string, Permission> = {
  'جودة':      'visits_quality',
  'سلامة':     'visits_safety',
  'كهربائية':  'visits_electrical',
  'ميدانية':   'visits_field',
}

// ── قائمة الأدوار وإعداداتها ──
export const ROLES: Record<string, {
  label: string; color: string; icon: string
  permissions: Permission[]
}> = {
  'مدير عام': {
    label: 'مدير عام', color: '#7c3aed', icon: '👑',
    permissions: ['dashboard','projects_view','projects_edit','visits','visits_quality',
      'visits_safety','visits_electrical','visits_field','inventory','purchases',
      'qhse','employees','reports','finance','pmo','hr'],
  },
  'مدير مشروع': {
    label: 'مدير مشروع', color: '#1a56db', icon: '📋',
    permissions: ['dashboard','projects_view','projects_edit','visits','visits_quality',
      'visits_safety','visits_electrical','visits_field','inventory','purchases','reports','pmo'],
  },
  'مهندس جودة': {
    label: 'مهندس جودة', color: '#0ea77b', icon: '🔍',
    permissions: ['dashboard','projects_view','visits_quality','qhse','reports'],
  },
  'مهندس سلامة': {
    label: 'مهندس سلامة', color: '#e6820a', icon: '🦺',
    permissions: ['dashboard','projects_view','visits_safety','qhse','reports'],
  },
  'مهندس كهرباء': {
    label: 'مهندس كهرباء', color: '#0891b2', icon: '⚡',
    permissions: ['dashboard','projects_view','visits_electrical','visits_field','inventory','reports'],
  },
  'مهندس ميداني': {
    label: 'مهندس ميداني', color: '#6366f1', icon: '🏗️',
    permissions: ['dashboard','projects_view','visits_field','reports'],
  },
  'مشرف': {
    label: 'مشرف', color: '#64748b', icon: '👷',
    permissions: ['dashboard','projects_view','visits_field','reports'],
  },
  'محاسب': {
    label: 'محاسب', color: '#0f766e', icon: '💰',
    permissions: ['dashboard','finance','purchases','reports'],
  },
  'مدير HR': {
    label: 'مدير HR', color: '#9333ea', icon: '👥',
    permissions: ['dashboard','hr','employees','reports'],
  },
  'مدير المالية': {
    label: 'مدير المالية', color: '#0f766e', icon: '📊',
    permissions: ['dashboard','finance','purchases','reports','employees'],
  },
  'مدير الموارد البشريه': {
    label: 'مدير الموارد البشرية', color: '#9333ea', icon: '👥',
    permissions: ['dashboard','hr','employees','reports'],
  },
}

// ── دوال التحقق ──

/** هل يملك المستخدم صلاحية معينة؟ */
export function hasPermission(
  userPermissions: string[] | null | undefined,
  permission: Permission
): boolean {
  if (!userPermissions) return false
  return userPermissions.includes(permission)
}

/** هل يملك المستخدم أي صلاحية من القائمة؟ */
export function hasAnyPermission(
  userPermissions: string[] | null | undefined,
  permissions: Permission[]
): boolean {
  if (!userPermissions) return false
  return permissions.some(p => userPermissions.includes(p))
}

/** هل يستطيع المستخدم الوصول لصفحة معينة؟ */
export function canAccessPage(
  userPermissions: string[] | null | undefined,
  path: string
): boolean {
  const required = PAGE_PERMISSIONS[path]
  if (!required) return true // صفحة غير محمية
  return hasAnyPermission(userPermissions, required)
}

/** جلب صلاحيات الدور الافتراضية */
export function getRolePermissions(role: string): Permission[] {
  return ROLES[role]?.permissions || ['dashboard']
}

/** فلترة أنواع الزيارات حسب الصلاحيات */
export function getVisitTypesForUser(
  userPermissions: string[] | null | undefined
): string[] {
  if (!userPermissions) return []
  // مدير عام أو من يملك visits يرى الكل
  if (userPermissions.includes('visits')) {
    return ['جودة', 'سلامة', 'كهربائية', 'ميدانية']
  }
  return Object.entries(VISIT_TYPE_PERMISSIONS)
    .filter(([, perm]) => userPermissions.includes(perm))
    .map(([type]) => type)
}

/** بناء قائمة Sidebar حسب الصلاحيات */
export function getSidebarItems(
  userPermissions: string[] | null | undefined
): string[] {
  if (!userPermissions) return []
  const items: string[] = []
  if (hasPermission(userPermissions, 'dashboard'))     items.push('dashboard')
  if (hasAnyPermission(userPermissions, ['projects_view','projects_edit'])) items.push('projects')
  if (hasAnyPermission(userPermissions, ['visits','visits_quality','visits_safety','visits_electrical','visits_field'])) items.push('visits')
  if (hasPermission(userPermissions, 'qhse'))          items.push('qhse')
  if (hasPermission(userPermissions, 'inventory'))     items.push('inventory')
  if (hasPermission(userPermissions, 'purchases'))     items.push('purchases')
  if (hasAnyPermission(userPermissions, ['hr','employees'])) items.push('hr')
  if (hasPermission(userPermissions, 'finance'))       items.push('finance')
  if (hasPermission(userPermissions, 'reports'))       items.push('reports')
  if (hasPermission(userPermissions, 'pmo'))           items.push('pmo')
  return items
}
