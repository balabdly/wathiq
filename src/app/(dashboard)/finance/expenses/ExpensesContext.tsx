// src/app/(dashboard)/finance/expenses/ExpensesContext.tsx
'use client'
import { createContext, useContext } from 'react'
import type { Account, CostCenter, Project, Vendor, Client, CashAccount } from '@/lib/expenses-types'

export type ExpensesContextValue = {
  tenantId: string | null
  accounts: Account[]
  costCenters: CostCenter[]
  projects: Project[]
  vendors: Vendor[]
  clients: Client[]
  cashAccounts: CashAccount[]
  loading: boolean
  reloadShared: () => Promise<void>
}

export const ExpensesContext = createContext<ExpensesContextValue | null>(null)

/** يُستخدم داخل أي صفحة تبويب: const { accounts, projects, vendors, tenantId } = useExpenses() */
export function useExpenses(): ExpensesContextValue {
  const ctx = useContext(ExpensesContext)
  if (!ctx) throw new Error('useExpenses يجب أن يُستخدم داخل صفحات finance/expenses')
  return ctx
}
