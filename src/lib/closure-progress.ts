import type { ProjectClosure } from '@/lib/project-close-service'

export type ClosureProgress = {
  percent: number
  completed: number
  total: number
  label: string
  isComplete: boolean
}

export const CLOSURE_SECTIONS = 8

function invoicesComplete(closure: ProjectClosure): boolean {
  const finalOk = !!(closure.final_invoice_number?.trim() && closure.final_invoice_date)
  if (!finalOk) return false
  if (closure.partial_invoice_skipped) return true
  return !!(closure.partial_invoice_number?.trim() && closure.partial_invoice_date)
}

export function computeClosureProgress(
  closure: ProjectClosure | null | undefined,
  opts: {
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

  const checks = [
    !!closure.assets_handover_date,
    !!closure.gis_mapping_date,
    !!closure.client_handover_date,
    !!closure.completion_certificate_date && !!closure.completion_certificate_file_path,
    !!(closure.work_completion_date && closure.work_completion_number?.trim()),
    !!(closure.clearance_date && closure.clearance_number?.trim() && closure.clearance_file_path),
    invoicesComplete(closure),
    opts.tasksComplete !== false && opts.ncrClear !== false,
  ]
  const completed = checks.filter(Boolean).length
  const percent = Math.round((completed / CLOSURE_SECTIONS) * 100)
  return {
    percent,
    completed,
    total: CLOSURE_SECTIONS,
    label: percent === 100 ? 'جاهز للاعتماد' : `${percent}%`,
    isComplete: percent === 100,
  }
}
