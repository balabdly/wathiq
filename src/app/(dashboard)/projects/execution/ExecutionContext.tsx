'use client'
import { createContext, useContext } from 'react'
import type { ExecutionProject } from '@/lib/project-execution-service'

export type ExecutionContextValue = {
  tenantId: string | null
  branchId: number | null
  projects: ExecutionProject[]
  loading: boolean
  reload: () => Promise<void>
  kpis: { total: number; assigned: number; unassigned: number }
}

export const ExecutionContext = createContext<ExecutionContextValue | null>(null)

export function useExecution() {
  const ctx = useContext(ExecutionContext)
  if (!ctx) throw new Error('useExecution must be used within ExecutionLayout')
  return ctx
}
