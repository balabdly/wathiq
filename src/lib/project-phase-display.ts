import type { PmoPhase } from '@/lib/sec-workflow'

export const SEC_PMO_PHASES: PmoPhase[] = ['1_RECEIPT', '2_PREP', '3_EXEC', '4_MEASURE', '5_CLOSE']

/** مراحل تظهر في لوحة المتابعة (بعد اعتماد التخطيط) */
export const MONITOR_PMO_PHASES: PmoPhase[] = ['3_EXEC', '4_MEASURE', '5_CLOSE']

export function isMonitorPhase(phase?: string | null): boolean {
  return !!phase && (MONITOR_PMO_PHASES as string[]).includes(phase)
}

export type PhaseDisplay = { label: string; color: string; bg: string }

/** تسمية مرحلة المشروع للعرض في قائمة البدء */
export function projectPhaseDisplay(phase?: string | null): PhaseDisplay {
  switch (phase) {
    case '1_RECEIPT':
      return { label: 'بدء المشروع', color: '#6b7280', bg: '#f9fafb' }
    case '2_PREP':
      return { label: 'التخطيط', color: '#1a56db', bg: '#eff6ff' }
    case '3_EXEC':
    case '4_MEASURE':
      return { label: 'التنفيذ', color: '#e6820a', bg: '#fffbeb' }
    case '5_CLOSE':
      return { label: 'مرحلة الإغلاق', color: '#0ea77b', bg: '#ecfdf5' }
    default:
      return { label: '—', color: '#6b7280', bg: '#f3f4f6' }
  }
}
