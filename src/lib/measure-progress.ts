import type { ProjectMeasure } from '@/lib/project-measure-service'
import type { BillingModel } from '@/lib/sec-workflow'

export type MeasureProgress = {
  percent: number
  completed: number
  total: number
  label: string
  isComplete: boolean
}

export const MEASURE_SECTIONS = 5

export function computeMeasureProgress(
  measure: ProjectMeasure | null | undefined,
  opts: { projectProgress?: number; billingModel?: BillingModel | null; hasAsBuiltBoq?: boolean },
): MeasureProgress {
  if (!measure) {
    return { percent: 0, completed: 0, total: MEASURE_SECTIONS, label: 'لم يبدأ', isComplete: false }
  }
  if (measure.measure_status === 'closed') {
    return { percent: 100, completed: MEASURE_SECTIONS, total: MEASURE_SECTIONS, label: 'مكتمل', isComplete: true }
  }

  const billing = opts.billingModel || 'SPLIT_50_50'
  const checks = [
    measure.execution_confirmed || (opts.projectProgress ?? 0) >= 100,
    measure.as_built_confirmed || !!opts.hasAsBuiltBoq,
    measure.material_reconciled,
    measure.variance_reviewed,
    billing === 'FULL_100' || !!(measure.interim_invoice_number?.trim()),
  ]
  const completed = checks.filter(Boolean).length
  const percent = Math.round((completed / MEASURE_SECTIONS) * 100)
  return {
    percent,
    completed,
    total: MEASURE_SECTIONS,
    label: percent === 100 ? 'مكتمل' : `${percent}%`,
    isComplete: percent === 100,
  }
}
