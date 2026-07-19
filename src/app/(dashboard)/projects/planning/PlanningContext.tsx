'use client'
import { createContext, useContext } from 'react'
import type { PlanningProject } from '@/lib/project-planning-service'

export type PlanningContextValue = {
  tenantId: string | null
  activeProjects: PlanningProject[]
  closedProjects: PlanningProject[]
  loading: boolean
  reloadActive: () => Promise<void>
  reloadClosed: () => Promise<void>
  reloadKpis: () => Promise<void>
  kpis: { active: number; withPlans: number; closed: number }
}

export const PlanningContext = createContext<PlanningContextValue | null>(null)

export function usePlanning(): PlanningContextValue {
  const ctx = useContext(PlanningContext)
  if (!ctx) throw new Error('usePlanning يجب أن يُستخدم داخل صفحات projects/planning')
  return ctx
}
