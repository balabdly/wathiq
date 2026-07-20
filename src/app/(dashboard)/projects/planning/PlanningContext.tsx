'use client'
import { createContext, useContext } from 'react'
import type { PlanningProject } from '@/lib/project-planning-service'

export type PlanningContextValue = {
  tenantId: string | null
  projects: PlanningProject[]
  loading: boolean
  reload: () => Promise<void>
  reloadKpis: () => Promise<void>
  kpis: { total: number; complete: number; inProgress: number }
}

export const PlanningContext = createContext<PlanningContextValue | null>(null)

export function usePlanning(): PlanningContextValue {
  const ctx = useContext(PlanningContext)
  if (!ctx) throw new Error('usePlanning يجب أن يُستخدم داخل صفحات projects/planning')
  return ctx
}
