/** خطط المستأجرين والوحدات — مصدر واحد لـ Super Admin والـ Sidebar */

export type TenantPlanKey = 'basic' | 'advanced' | 'complete'

export type TenantModuleKey =
  | 'projects' | 'inventory' | 'purchases' | 'employees' | 'visits'
  | 'qhse' | 'finance' | 'reports' | 'fleet' | 'assets' | 'pmo' | 'hr'

export type TenantModules = Record<TenantModuleKey, boolean>

export const MODULE_LABELS: Record<TenantModuleKey, string> = {
  projects:  '📁 المشاريع',
  inventory: '📦 المخزون',
  purchases: '🛒 المشتريات',
  employees: '👤 مستخدمو النظام',
  visits:    '✅ الزيارات',
  qhse:      '🛡️ السلامة والجودة',
  finance:   '💰 المالية',
  reports:   '📊 التقارير',
  fleet:     '🚛 الأسطول',
  assets:    '🏗️ الأصول',
  pmo:       '📋 PMO',
  hr:        '👥 الموارد البشرية',
}

export const ALL_MODULE_KEYS = Object.keys(MODULE_LABELS) as TenantModuleKey[]

const ALL_FALSE = Object.fromEntries(ALL_MODULE_KEYS.map(k => [k, false])) as TenantModules
const ALL_TRUE = Object.fromEntries(ALL_MODULE_KEYS.map(k => [k, true])) as TenantModules

export const PLANS: Record<TenantPlanKey, {
  label: string
  price: number
  color: string
  bg: string
  maxUsers: number
  modules: TenantModules
}> = {
  basic: {
    label: 'أساسي',
    price: 299,
    color: '#4b5563',
    bg: '#f3f4f6',
    maxUsers: 3,
    modules: {
      ...ALL_FALSE,
      projects: true,
      inventory: true,
    },
  },
  advanced: {
    label: 'متقدم',
    price: 599,
    color: '#1a56db',
    bg: '#eff6ff',
    maxUsers: 10,
    modules: {
      ...ALL_FALSE,
      projects: true,
      inventory: true,
      purchases: true,
      employees: true,
      finance: true,
      reports: true,
      fleet: true,
      assets: true,
    },
  },
  complete: {
    label: 'متكامل',
    price: 999,
    color: '#7c3aed',
    bg: '#f5f3ff',
    maxUsers: 999,
    modules: { ...ALL_TRUE },
  },
}

/** توحيد القيم القديمة (pro → complete) */
export function normalizePlan(plan?: string | null): TenantPlanKey {
  if (!plan) return 'basic'
  if (plan === 'pro') return 'complete'
  if (plan in PLANS) return plan as TenantPlanKey
  return 'basic'
}

export function planMaxUsers(plan?: string | null): number {
  return PLANS[normalizePlan(plan)].maxUsers
}

export function defaultModulesForPlan(plan?: string | null): TenantModules {
  return { ...PLANS[normalizePlan(plan)].modules }
}

/** دمج modules محفوظة مع الافتراضيات — يضمن مفاتيح الوحدات الجديدة */
export function mergeTenantModules(stored?: Record<string, boolean> | null, plan?: string | null): TenantModules {
  const base = defaultModulesForPlan(plan)
  if (!stored) return base
  const merged = { ...base }
  for (const key of ALL_MODULE_KEYS) {
    if (typeof stored[key] === 'boolean') merged[key] = stored[key]
  }
  return merged
}

export function isModuleEnabled(modules: Record<string, boolean> | null | undefined, key: TenantModuleKey): boolean {
  if (!modules) return true
  return modules[key] !== false
}
