/** مراحل حياة المشروع — 4 مراحل للمتابعة (UDS/PMO الداخلي) */

export type LifecyclePhase = 'initiation' | 'planning' | 'execution' | 'closure'

export type LifecyclePhaseDef = {
  id: LifecyclePhase
  label: string
  /** pmo_phase values mapped to this lifecycle stage */
  pmoPhases: string[]
  color: string
  bg: string
}

export const LIFECYCLE_PHASES: LifecyclePhaseDef[] = [
  { id: 'initiation', label: 'بدء المشروع', pmoPhases: ['1_RECEIPT'], color: '#6b7280', bg: '#f9fafb' },
  { id: 'planning', label: 'تخطيط المشروع', pmoPhases: ['2_PREP'], color: '#1a56db', bg: '#eff6ff' },
  { id: 'execution', label: 'تنفيذ المشروع', pmoPhases: ['3_EXEC', '4_MEASURE'], color: '#e6820a', bg: '#fffbeb' },
  { id: 'closure', label: 'إغلاق المشروع', pmoPhases: ['5_CLOSE'], color: '#0ea77b', bg: '#ecfdf5' },
]

export function pmoPhaseToLifecycle(pmo?: string | null): LifecyclePhase | null {
  if (!pmo) return null
  const hit = LIFECYCLE_PHASES.find(p => p.pmoPhases.includes(pmo))
  return hit?.id ?? null
}

export function lifecycleLabel(phase: LifecyclePhase): string {
  return LIFECYCLE_PHASES.find(p => p.id === phase)?.label ?? phase
}

export function lifecycleForPmoLabel(pmo?: string | null): string {
  const life = pmoPhaseToLifecycle(pmo)
  return life ? lifecycleLabel(life) : '—'
}

export function projectMatchesLifecycleFilter(filter: string, pmo?: string | null): boolean {
  if (!filter) return true
  const life = pmoPhaseToLifecycle(pmo)
  if (!life) return false
  return life === filter
}

export function lifecycleStyle(phase: LifecyclePhase | null) {
  const def = LIFECYCLE_PHASES.find(p => p.id === phase)
  return def ? { color: def.color, bg: def.bg, label: def.label } : { color: '#6b7280', bg: '#f3f4f6', label: '—' }
}
