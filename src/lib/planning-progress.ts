import type { ProjectPlanning } from '@/lib/project-planning-service'

export type PlanningProgress = {
  percent: number
  completed: number
  total: number
  label: string
  isComplete: boolean
  /** مقايسة الأعمال جاهزة (المواد اختيارية) */
  boqReady: boolean
}

export const PLANNING_SECTIONS = 7

export type BoqCategoryCounts = { materials: number; works: number }

function sectionResolved(
  planning: ProjectPlanning,
  skippedKey: keyof ProjectPlanning,
  filled: boolean,
): boolean {
  return !!(planning[skippedKey] as boolean | null | undefined) || filled
}

export function computePlanningProgress(
  planning: ProjectPlanning | null | undefined,
  costItemsCount = 0,
  _materialLinesCount = 0,
  boqCounts: BoqCategoryCounts = { materials: 0, works: 0 },
): PlanningProgress {
  if (!planning) {
    return { percent: 0, completed: 0, total: PLANNING_SECTIONS, label: 'لم يبدأ', isComplete: false, boqReady: false }
  }
  if (planning.planning_status === 'closed') {
    return { percent: 100, completed: PLANNING_SECTIONS, total: PLANNING_SECTIONS, label: 'مكتمل', isComplete: true, boqReady: true }
  }

  const boqReady = boqCounts.works > 0

  const checks = [
    boqReady,
    sectionResolved(planning, 'permit_skipped', !!(planning.permit_number)),
    sectionResolved(planning, 'timeline_skipped', !!(planning.timeline_start && planning.timeline_end)),
    sectionResolved(planning, 'safe_work_skipped', planning.safe_work_content === 'done'),
    sectionResolved(planning, 'risks_skipped', planning.risks_assessment_content === 'done'),
    sectionResolved(planning, 'quality_skipped', !!(planning.quality_plan_content?.trim())),
    sectionResolved(planning, 'costs_skipped', costItemsCount > 0 || !!(planning.cost_plan_notes?.trim())),
  ]
  const completed = checks.filter(Boolean).length
  const percent = Math.round((completed / PLANNING_SECTIONS) * 100)

  return {
    percent,
    completed,
    total: PLANNING_SECTIONS,
    label: boqReady ? (percent === 100 ? 'مكتمل' : 'جاهز للاعتماد') : `${percent}%`,
    isComplete: boqReady,
    boqReady,
  }
}
