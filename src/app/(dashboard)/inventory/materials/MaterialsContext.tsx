// src/app/(dashboard)/inventory/materials/MaterialsContext.tsx
'use client'
import { createContext, useContext } from 'react'
import type { Warehouse } from './opsShared'

export type ProjectLite = { id: number; name: string; status?: string }

export type MaterialsContextValue = {
  tenantId: string | null
  branchId: number | null
  warehouses: Warehouse[]
  projects: ProjectLite[]
  loading: boolean
  reloadShared: () => Promise<void>
  reloadKpis: () => Promise<void>
}

export const MaterialsContext = createContext<MaterialsContextValue | null>(null)

/** يُستخدم داخل أي صفحة تبويب: const { warehouses, projects, tenantId, branchId, reloadShared } = useMaterials() */
export function useMaterials(): MaterialsContextValue {
  const ctx = useContext(MaterialsContext)
  if (!ctx) throw new Error('useMaterials يجب أن يُستخدم داخل صفحات inventory/materials')
  return ctx
}
