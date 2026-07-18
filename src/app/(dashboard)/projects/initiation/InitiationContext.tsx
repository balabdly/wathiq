'use client'
import { createContext, useContext } from 'react'

export type InitiationProject = {
  id: number
  name: string
  code?: string
  wo_number?: string
  wo_source?: string
  type?: string
  status?: string
  pmo_phase?: string
  location?: string
  estimated_value?: number
  created_at?: string
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
  projects: InitiationProject[]
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
