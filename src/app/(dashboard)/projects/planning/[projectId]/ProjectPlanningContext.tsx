'use client'
import { createContext, useContext } from 'react'
import type { ProjectPlanning } from '@/lib/project-planning-service'

export type ProjectPlanningDetail = {
  id: number
  name: string
  code?: string
  client_name?: string
  type?: string
  start_date?: string
  end_date?: string
  estimated_value?: number
  pmo_phase?: string
  description?: string
}

export type ProjectPlanningContextValue = {
  tenantId: string
  projectId: number
  project: ProjectPlanningDetail
  planning: ProjectPlanning | null
  reload: () => Promise<void>
  readOnly?: boolean
}

export const ProjectPlanningContext = createContext<ProjectPlanningContextValue | null>(null)

export function useProjectPlanning(): ProjectPlanningContextValue {
  const ctx = useContext(ProjectPlanningContext)
  if (!ctx) throw new Error('useProjectPlanning داخل صفحات تخطيط المشروع فقط')
  return ctx
}
