// src/app/(dashboard)/finance/treasury/TreasuryContext.tsx
'use client'
import { createContext, useContext } from 'react'
import type { CashAccount, Project, Employee } from '@/lib/treasury-types'

export type TreasuryContextValue = {
  tenantId: string | null
  cashAccounts: CashAccount[]
  projects: Project[]
  employees: Employee[]
  loading: boolean
  reloadAll: () => Promise<void>
}

export const TreasuryContext = createContext<TreasuryContextValue | null>(null)

/** يُستخدم داخل أي صفحة تبويب: const { cashAccounts, projects, employees, tenantId, reloadAll } = useTreasury() */
export function useTreasury(): TreasuryContextValue {
  const ctx = useContext(TreasuryContext)
  if (!ctx) throw new Error('useTreasury يجب أن يُستخدم داخل صفحات finance/treasury')
  return ctx
}
