// src/app/(dashboard)/finance/purchases/PurchasesContext.tsx
'use client'
import { createContext, useContext } from 'react'
import type { Vendor, Project, Warehouse } from '@/lib/purchases-types'

export type PurchasesContextValue = {
  tenantId: string | null
  vendors: Vendor[]
  projects: Project[]
  warehouses: Warehouse[]
  loading: boolean
  reloadShared: () => Promise<void>
  reloadKpis: () => Promise<void>
}

export const PurchasesContext = createContext<PurchasesContextValue | null>(null)

/** يُستخدم داخل أي صفحة تبويب: const { vendors, projects, warehouses, tenantId, reloadShared } = usePurchases() */
export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext)
  if (!ctx) throw new Error('usePurchases يجب أن يُستخدم داخل صفحات finance/purchases')
  return ctx
}
