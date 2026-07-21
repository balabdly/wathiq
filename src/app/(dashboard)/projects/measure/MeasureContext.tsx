'use client'
import { createContext, useContext } from 'react'
import type { MeasureProject } from '@/lib/project-measure-service'

export type MeasureContextValue = {
  tenantId: string | null
  branchId: number | null
  projects: MeasureProject[]
  loading: boolean
  reload: () => Promise<void>
  kpis: { total: number; ready: number; inProgress: number }
}

export const MeasureContext = createContext<MeasureContextValue | null>(null)

export function useMeasure() {
  const ctx = useContext(MeasureContext)
  if (!ctx) throw new Error('useMeasure must be used within MeasureLayout')
  return ctx
}
