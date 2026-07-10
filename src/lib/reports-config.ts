import type { LucideIcon } from 'lucide-react'
import {
  DollarSign, Users, FolderOpen, Package, Shield, ClipboardCheck, TrendingUp, BarChart3,
} from 'lucide-react'

export type ReportSectionMeta = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
  count: number
  /** تقارير مخططة — غير متاحة بعد */
  comingSoon?: boolean
  href: string
}

/** أعداد التقارير الفعلية — تُحدَّث مع كل قسم */
export const REPORT_COUNTS = {
  finance: 18,
  hr: 6,
  projects: 7,
  inventory: 7,
  visits: 5,
  qhse: 3, // مخططة — حوادث، تدقيق، شهادات
} as const

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    id: 'finance',
    label: 'المالية والمحاسبة',
    description: 'القوائم المالية، الذمم، الضريبة، ميزان المراجعة، دفتر الأستاذ',
    icon: DollarSign,
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
    count: REPORT_COUNTS.finance,
    href: '/reports/finance',
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    description: 'الكوادر، الرواتب، GOSI، الإجازات، الحضور، منتهيات الوثائق',
    icon: Users,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    count: REPORT_COUNTS.hr,
    href: '/reports/hr',
  },
  {
    id: 'projects',
    label: 'المشاريع',
    description: 'حسب النوع والحالة، القيمة، التقدم، المتأخرة، المهام، ربحية المشاريع',
    icon: FolderOpen,
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    count: REPORT_COUNTS.projects,
    href: '/reports/projects',
  },
  {
    id: 'inventory',
    label: 'المخزون',
    description: 'حركة المواد، الأرصدة، مواد المشاريع، الحجوزات، التحويلات',
    icon: Package,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    count: REPORT_COUNTS.inventory,
    href: '/reports/inventory',
  },
  {
    id: 'visits',
    label: 'الزيارات الميدانية',
    description: 'ملخص الزيارات، NCR مفتوحة/مغلقة، أداء المهندسين والمشاريع',
    icon: ClipboardCheck,
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    count: REPORT_COUNTS.visits,
    href: '/reports/visits',
  },
  {
    id: 'qhse',
    label: 'السلامة والجودة (QHSE)',
    description: 'حوادث، تدقيق، شهادات — قريباً. تقارير الزيارات وNCR في قسم الزيارات',
    icon: Shield,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    count: REPORT_COUNTS.qhse,
    comingSoon: true,
    href: '/reports/qhse',
  },
]

/** تقارير مميزة — خارج الأقسام الرئيسية */
export const FEATURED_REPORTS = [
  {
    id: 'executive',
    label: 'لوحة تنفيذية',
    description: 'مؤشرات الإدارة: ربحية، مشاريع متأخرة، NCR، مخزون',
    icon: BarChart3,
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
    href: '/reports/executive',
  },
  {
    id: 'project-profitability',
    label: 'ربحية المشاريع',
    description: 'إيراد − تكاليف لكل مشروع مع تفصيل المواد والعمالة',
    icon: TrendingUp,
    color: '#0ea77b',
    bg: '#ecfdf5',
    border: '#86efac',
    href: '/reports/project-profitability',
  },
]

export const VISIT_REPORTS = [
  { id: 'visits_summary', title: 'ملخص الزيارات', icon: '📊', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', desc: 'إجمالي الزيارات مصنفةً حسب النوع والنتيجة', filters: ['date_range', 'type'] as const },
  { id: 'ncr_open', title: 'NCR المفتوحة', icon: '⚠️', color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', desc: 'جميع المخالفات غير المغلقة مرتبةً بالأقدم', filters: ['type'] as const },
  { id: 'ncr_closed', title: 'NCR المغلقة', icon: '✅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', desc: 'المخالفات المغلقة مع وقت الإغلاق والمسؤول', filters: ['date_range'] as const },
  { id: 'by_engineer', title: 'تقرير الزيارات بالمهندس', icon: '👷', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'عدد الزيارات والمخالفات لكل مهندس', filters: ['date_range'] as const },
  { id: 'by_project', title: 'تقرير الزيارات بالمشروع', icon: '🏗️', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', desc: 'حالة الجودة والسلامة لكل مشروع', filters: ['date_range'] as const },
]

export const VISIT_TYPES = ['جودة', 'سلامة', 'كهربائية', 'ميدانية'] as const

export const QHSE_PLANNED_REPORTS = [
  { title: 'تقرير الحوادث', icon: '🚨', desc: 'حوادث العمل، الإصابات، LTIR/TRIR' },
  { title: 'تقرير التدقيق', icon: '📋', desc: 'تدقيق ISO وسلامة المواقع' },
  { title: 'تقرير الشهادات', icon: '📜', desc: 'شهادات منتهية أو قريبة من الانتهاء' },
]
