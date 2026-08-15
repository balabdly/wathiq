export type DashboardSectionKey =
  | 'projects'
  | 'inventory'
  | 'qhse'
  | 'hr'
  | 'finance'
  | 'purchases'
  | 'assets'
  | 'fleet'
  | 'visits'
  | 'reports'
  | 'financialSummary'
  | 'quickKpis'
  | 'alerts'
  | 'deadlines'
  | 'recentInvoices'
  | 'quickLinks'

export type DashboardSections = Record<DashboardSectionKey, boolean>

export const DEFAULT_DASHBOARD_SECTIONS: DashboardSections = {
  projects: true,
  inventory: true,
  qhse: true,
  hr: true,
  finance: true,
  purchases: true,
  assets: true,
  fleet: true,
  visits: true,
  reports: true,
  financialSummary: true,
  quickKpis: true,
  alerts: true,
  deadlines: true,
  recentInvoices: true,
  quickLinks: true,
}

export const DASHBOARD_DEPARTMENT_SECTIONS: { key: DashboardSectionKey; label: string }[] = [
  { key: 'projects',  label: 'إدارة المشاريع' },
  { key: 'inventory', label: 'المخزون' },
  { key: 'qhse',      label: 'السلامة والجودة (QHSE)' },
  { key: 'hr',        label: 'الموارد البشرية' },
  { key: 'finance',   label: 'المالية والمحاسبة' },
  { key: 'purchases', label: 'المشتريات' },
  { key: 'assets',    label: 'الأصول الثابتة' },
  { key: 'fleet',     label: 'إدارة الأسطول' },
  { key: 'visits',    label: 'الزيارات الميدانية' },
  { key: 'reports',   label: 'التقارير' },
]

export const DASHBOARD_BLOCK_SECTIONS: { key: DashboardSectionKey; label: string }[] = [
  { key: 'financialSummary', label: 'الملخص المالي' },
  { key: 'quickKpis',        label: 'المؤشرات السريعة' },
  { key: 'alerts',           label: 'التنبيهات العاجلة' },
  { key: 'deadlines',        label: 'مواعيد التسليم' },
  { key: 'recentInvoices',   label: 'آخر الفواتير' },
  { key: 'quickLinks',       label: 'وصول سريع' },
]

export function mergeDashboardSections(partial?: Partial<DashboardSections>): DashboardSections {
  return { ...DEFAULT_DASHBOARD_SECTIONS, ...partial }
}

export function isDashboardSectionVisible(
  sections: DashboardSections | Partial<DashboardSections> | undefined,
  key: DashboardSectionKey,
): boolean {
  if (!sections) return true
  return sections[key] !== false
}

/** ربط صلاحية القسم بمفتاح اللوحة */
export type DashboardAccess = Partial<Record<DashboardSectionKey, boolean>>

export function canShowDashboardSection(
  access: DashboardAccess,
  sections: DashboardSections | Partial<DashboardSections> | undefined,
  key: DashboardSectionKey,
): boolean {
  const deptKeys: DashboardSectionKey[] = [
    'projects', 'inventory', 'qhse', 'hr', 'finance', 'purchases', 'assets', 'fleet', 'visits', 'reports',
  ]
  if (deptKeys.includes(key)) {
    if (key === 'purchases') {
      if (!access.purchases && !access.finance) return false
    } else if (access[key] === false) return false
  }
  if (key === 'financialSummary' || key === 'recentInvoices') {
    if (!access.finance) return false
  }
  if (key === 'deadlines' && !access.projects) return false
  return isDashboardSectionVisible(sections, key)
}
