import type { ProjectStatus } from '@/types'

export type WorkflowType = 'FULL_SEC' | 'O&M_WITH_WO' | 'O&M_PRE_WO'
export type BillingModel = 'FULL_100' | 'SPLIT_50_50'
export type WoSource = 'UDS' | 'SAP' | 'VERBAL'
export type PmoPhase =
  | '1_RECEIPT' | '2_PREP' | '3_EXEC' | '4_MEASURE' | '5_CLOSE'
  | 'O&M_OPEN' | 'O&M_EXEC' | 'O&M_CLOSED'

export type MemoStatus =
  | 'draft' | 'in_progress' | 'executed' | 'awaiting_wo'
  | 'wo_linked' | 'invoiced' | 'closed' | 'cancelled'

export type FollowUpStatus = 'awaiting_wo' | 'contacted' | 'escalated' | 'wo_linked'
export type ExtractType = 'INTERIM_50' | 'FINAL_50' | 'FULL_100'

export const WORKFLOW_TYPES: { id: WorkflowType; label: string; icon: string; desc: string }[] = [
  { id: 'FULL_SEC',    label: 'إنشاء / توزيع (UDS)', icon: '🏗️', desc: 'المراحل الخمس — حجز مواد، تصريح، GIS' },
  { id: 'O&M_WITH_WO', label: 'O&M — WO موجود',      icon: '🔧', desc: 'تنفيذ → فوترة 100%' },
  { id: 'O&M_PRE_WO',  label: 'O&M — WO لاحق',       icon: '📞', desc: 'شفهي/هاتف → تنفيذ → متابعة → WO → فوترة' },
]

export const BILLING_MODELS: { id: BillingModel; label: string }[] = [
  { id: 'FULL_100',     label: 'تحصيل كامل 100%' },
  { id: 'SPLIT_50_50',  label: '50% بعد المقايسة + 50% بعد الإغلاق' },
]

export const WO_SOURCES: { id: WoSource; label: string }[] = [
  { id: 'UDS',     label: 'نظام التوزيع الموحد (UDS)' },
  { id: 'SAP',     label: 'SAP — عمليات وصيانة' },
  { id: 'VERBAL',  label: 'شفهي / هاتف' },
]

export const PMO_PHASES_FULL: { id: PmoPhase; label: string; order: number; color: string; bg: string }[] = [
  { id: '1_RECEIPT', label: '1 — استلام أمر العمل',   order: 1, color: '#6b7280', bg: '#f9fafb' },
  { id: '2_PREP',    label: '2 — الاستعداد',          order: 2, color: '#1a56db', bg: '#eff6ff' },
  { id: '3_EXEC',    label: '3 — التنفيذ',            order: 3, color: '#e6820a', bg: '#fffbeb' },
  { id: '4_MEASURE', label: '4 — المقايسة والتسوية', order: 4, color: '#7c3aed', bg: '#f5f3ff' },
  { id: '5_CLOSE',   label: '5 — الإغلاق والتسليم',   order: 5, color: '#0ea77b', bg: '#ecfdf5' },
]

export const PMO_PHASES_OM: { id: PmoPhase; label: string; order: number; color: string; bg: string }[] = [
  { id: 'O&M_OPEN',  label: 'استلام / فتح', order: 1, color: '#1a56db', bg: '#eff6ff' },
  { id: 'O&M_EXEC',  label: 'التنفيذ',      order: 2, color: '#e6820a', bg: '#fffbeb' },
  { id: 'O&M_CLOSED', label: 'مغلق / مُفوَّت', order: 3, color: '#0ea77b', bg: '#ecfdf5' },
]

export const MEMO_STATUSES: Record<MemoStatus, { label: string; color: string; bg: string }> = {
  draft:        { label: 'مسودة',              color: '#6b7280', bg: '#f9fafb' },
  in_progress:  { label: 'قيد التنفيذ',        color: '#1a56db', bg: '#eff6ff' },
  executed:     { label: 'منفّذ',              color: '#e6820a', bg: '#fffbeb' },
  awaiting_wo:  { label: 'بانتظار WO',         color: '#c81e1e', bg: '#fef2f2' },
  wo_linked:    { label: 'WO مرتبط',           color: '#0ea77b', bg: '#ecfdf5' },
  invoiced:     { label: 'مُفوَّت',            color: '#0ea77b', bg: '#ecfdf5' },
  closed:       { label: 'مغلق',               color: '#374151', bg: '#f3f4f6' },
  cancelled:    { label: 'ملغي',               color: '#9ca3af', bg: '#f3f4f6' },
}

export const FOLLOW_UP_STATUSES: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
  awaiting_wo: { label: 'بانتظار WO',     color: '#c81e1e', bg: '#fef2f2' },
  contacted:   { label: 'تم التواصل',     color: '#1a56db', bg: '#eff6ff' },
  escalated:   { label: 'يحتاج تصعيد',    color: '#e6820a', bg: '#fffbeb' },
  wo_linked:   { label: 'WO صادر',        color: '#0ea77b', bg: '#ecfdf5' },
}

export const WORK_TYPES = ['صيانة', 'إصلاح كابل', 'فحص معدة', 'طوارئ', 'أخرى'] as const

export const DEFAULT_SEC_CONTRACT = '4400023458'

/** مراحle افتراضية حسب نوع المسار */
export function defaultPmoPhase(wf: WorkflowType): PmoPhase {
  if (wf === 'FULL_SEC') return '1_RECEIPT'
  return 'O&M_OPEN'
}

/** نموذج تحصيل افتراضي */
export function defaultBillingModel(wf: WorkflowType): BillingModel {
  if (wf === 'FULL_SEC') return 'SPLIT_50_50'
  return 'FULL_100'
}

/** مصدر WO افتراضي */
export function defaultWoSource(wf: WorkflowType): WoSource {
  if (wf === 'FULL_SEC') return 'UDS'
  if (wf === 'O&M_WITH_WO') return 'SAP'
  return 'VERBAL'
}

/** حالة مشروع مرتبطة بالمرحلة */
export function statusForPhase(phase: PmoPhase): ProjectStatus {
  switch (phase) {
    case '1_RECEIPT':
    case '2_PREP':
    case 'O&M_OPEN':
      return 'تحت التخطيط'
    case '3_EXEC':
    case 'O&M_EXEC':
      return 'قيد التنفيذ'
    case '4_MEASURE':
      return 'قيد التنفيذ'
    case '5_CLOSE':
      return 'قيد الإغلاق'
    case 'O&M_CLOSED':
      return 'مكتمل'
    default:
      return 'تحت التخطيط'
  }
}

export function phasesForWorkflow(wf: WorkflowType) {
  return wf === 'FULL_SEC' ? PMO_PHASES_FULL : PMO_PHASES_OM
}

export function phaseLabel(phase: PmoPhase | null | undefined, wf?: WorkflowType): string {
  if (!phase) return '—'
  const list = wf ? phasesForWorkflow(wf) : [...PMO_PHASES_FULL, ...PMO_PHASES_OM]
  return list.find(p => p.id === phase)?.label || phase
}

/** أيام انتظار WO — للتنبيه */
export function daysWaitingSince(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (86400000))
}
