/** ثوابت ومساعدات مهام المشاريع — موحّدة عبر الواجهة */

export const TASK_STATUS_STEPS = [
  'لم تبدأ',
  'قيد التنفيذ',
  'معلقة',
  'مكتملة',
  'ملغاة',
] as const

export type TaskStatus = typeof TASK_STATUS_STEPS[number]

const DONE_STATUSES = new Set(['مكتملة', 'مغلقة'])
const LEGACY_DONE = new Set(['مغلقة'])

/** هل المهمة ما زالت تمنع إغلاق المشروع؟ */
export function isTaskOpen(status: string | undefined | null): boolean {
  if (!status) return true
  if (status === 'ملغاة') return false
  return !DONE_STATUSES.has(status) && !LEGACY_DONE.has(status)
}

/** متطلبات مرفقات الإغلاق — تطابق الأسماء المرحلية أو المختصرة */
export const CLOSURE_DOC_REQUIREMENTS: { key: string; label: string; patterns: string[] }[] = [
  { key: 'مخططات',      label: '📐 مخططات',       patterns: ['مخططات'] },
  { key: 'رخصة بلدية',  label: '📋 رخصة بلدية',   patterns: ['رخصة بلدية', 'تصريح الحفر', 'أعمال البلدية'] },
  { key: 'إخلاء بلدية', label: '📋 إخلاء بلدية',  patterns: ['إخلاء بلدية', 'إخلاء طرف'] },
  { key: 'مستخلصات',    label: '📄 مستخلص',       patterns: ['مستخلص'] },
  { key: 'فواتير',      label: '🧾 فواتير',       patterns: ['فواتير', 'فاتورة'] },
]

function categoryMatches(uploaded: string, patterns: string[]): boolean {
  return patterns.some(p => uploaded.includes(p))
}

/** فئات المرفقات الناقصة لإغلاق المشروع */
export function getMissingClosureDocs(uploadedCategories: string[]): string[] {
  return CLOSURE_DOC_REQUIREMENTS
    .filter(req => !uploadedCategories.some(cat => categoryMatches(cat, req.patterns)))
    .map(req => req.key)
}

export function formatMissingClosureDocs(keys: string[]): string {
  const labels = Object.fromEntries(CLOSURE_DOC_REQUIREMENTS.map(r => [r.key, r.label]))
  return keys.map(k => labels[k] || k).join('، ')
}
