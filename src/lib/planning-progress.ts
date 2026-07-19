import type { ProjectPlanning } from '@/lib/project-planning-service'

export type PlanningProgress = {
  percent: number
  completed: number
  total: number
  label: string
  isComplete: boolean
}

export const PLANNING_SECTIONS = 7

export function computePlanningProgress(
  planning: ProjectPlanning | null | undefined,
  costItemsCount = 0,
): PlanningProgress {
  if (!planning) {
    return { percent: 0, completed: 0, total: PLANNING_SECTIONS, label: 'لم يبدأ', isComplete: false }
  }
  if (planning.planning_status === 'closed') {
    return { percent: 100, completed: PLANNING_SECTIONS, total: PLANNING_SECTIONS, label: 'مكتمل', isComplete: true }
  }

  const checks = [
    !!(planning.material_reservation_date && planning.material_reservation_number && planning.material_availability),
    !!(planning.permit_number),
    !!(planning.timeline_start && planning.timeline_end),
    planning.safe_work_content === 'done',
    planning.risks_assessment_content === 'done',
    !!(planning.quality_plan_content?.trim()),
    costItemsCount > 0 || !!(planning.cost_plan_notes?.trim()),
  ]
  const completed = checks.filter(Boolean).length
  const percent = Math.round((completed / PLANNING_SECTIONS) * 100)
  return {
    percent,
    completed,
    total: PLANNING_SECTIONS,
    label: percent === 100 ? 'مكتمل' : `${percent}%`,
    isComplete: percent === 100,
  }
}
