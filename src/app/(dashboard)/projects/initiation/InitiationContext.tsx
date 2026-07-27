'use client'
import { createContext, useContext } from 'react'
import type { ProjectTypeRow } from '@/components/projects/ManageProjectTypesModal'

export type InitiationProject = {
  id: number
  name: string
  code?: string
  client_id?: number | null
  client_name?: string
  type?: string
  status?: string
  pmo_phase?: string
  estimated_value?: number
  responsible_consultant?: string
  start_date?: string
  end_date?: string
  description?: string
  created_at?: string
  hasBoq?: boolean
  cancellation_reason?: string | null
  cancelled_at?: string | null
}

export type FrameworkBoqRow = {
  id: number
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
}

export type InitiationContextValue = {
  tenantId: string | null
  branchId: number | null
  projects: InitiationProject[]
  projectTypes: ProjectTypeRow[]
  frameworkItems: FrameworkBoqRow[]
  loading: boolean
  reloadShared: () => Promise<void>
  reloadKpis: () => Promise<void>
}

export const InitiationContext = createContext<InitiationContextValue | null>(null)

export function useInitiation(): InitiationContextValue {
  const ctx = useContext(InitiationContext)
  if (!ctx) throw new Error('useInitiation يجب أن يُستخدم داخل صفحات projects/initiation')
  return ctx
}
