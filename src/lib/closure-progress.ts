import type { ProjectClosure } from '@/lib/project-close-service'
import type { BillingModel } from '@/lib/sec-workflow'

export type ClosureProgress = {
  percent: number
  completed: number
  total: number
  label: string
  isComplete: boolean
}

export const CLOSURE_SECTIONS = 6

export function computeClosureProgress(
  closure: ProjectClosure | null | undefined,
  opts: {
    billingModel?: BillingModel | null
    docsComplete?: boolean
    tasksComplete?: boolean
    ncrClear?: boolean
  },
): ClosureProgress {
  if (!closure) {
    return { percent: 0, completed: 0, total: CLOSURE_SECTIONS, label: 'لم يبدأ', isComplete: false }
  }
  if (closure.closure_status === 'closed') {
    return { percent: 100, completed: CLOSURE_SECTIONS, total: CLOSURE_SECTIONS, label: 'مكتمل', isComplete: true }
  }

  const billing = opts.billingModel || 'SPLIT_50_50'
  const checks = [
    closure.final_boq_confirmed,
    !!closure.client_handover_date,
    closure.as_built_drawings_confirmed,
    billing === 'FULL_100' || !!(closure.final_invoice_number?.trim()),
    opts.docsComplete !== false,
    opts.tasksComplete !== false && opts.ncrClear !== false,
  ]
  const completed = checks.filter(Boolean).length
  const percent = Math.round((completed / CLOSURE_SECTIONS) * 100)
  return {
    percent,
    completed,
    total: CLOSURE_SECTIONS,
    label: percent === 100 ? 'مكتمل' : `${percent}%`,
    isComplete: percent === 100,
  }
}
