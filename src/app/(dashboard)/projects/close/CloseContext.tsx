'use client'
import { createContext, useContext } from 'react'
import type { CloseProject } from '@/lib/project-close-service'

export type CloseContextValue = {
  tenantId: string | null
  branchId: number | null
  projects: CloseProject[]
  loading: boolean
  reload: () => Promise<void>
  kpis: { total: number; ready: number; blocked: number }
}

export const CloseContext = createContext<CloseContextValue | null>(null)

export function useClose() {
  const ctx = useContext(CloseContext)
  if (!ctx) throw new Error('useClose must be used within CloseLayout')
  return ctx
}
