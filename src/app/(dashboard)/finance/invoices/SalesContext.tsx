// src/app/(dashboard)/finance/invoices/SalesContext.tsx
'use client'
import { createContext, useContext } from 'react'
import type { Client, Project, Company, CatalogItem } from '@/lib/sales-types'

export type SalesContextValue = {
  tenantId: string | null
  clients: Client[]
  projects: Project[]
  company: Company
  catalogItems: CatalogItem[]
  loading: boolean
  reloadShared: () => Promise<void>
  reloadKpis: () => Promise<void>
}

export const SalesContext = createContext<SalesContextValue | null>(null)

/** يُستخدم داخل أي صفحة تبويب: const { clients, projects, company, tenantId, reloadShared } = useSales() */
export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext)
  if (!ctx) throw new Error('useSales يجب أن يُستخدم داخل صفحات finance/invoices')
  return ctx
}
