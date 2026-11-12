/**
 * Pure financial statement calculations.
 * Balances are signed debit-minus-credit. Contra accounts must keep their sign.
 */
export type FinancialAccount = {
  code: string
  account_type: string
  is_parent: boolean
  balance: number
  balanceAsOf: number
}

const sum = <T>(items: T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0)

export function buildIncomeStatement<T extends FinancialAccount>(accounts: T[]) {
  const leaves = accounts.filter(a => !a.is_parent)
  const revenues = leaves.filter(a => a.account_type === 'إيرادات')
  // The standard Wathiq chart stores project costs (51*) as مصروفات.
  const costAccounts = leaves.filter(a =>
    a.account_type === 'تكلفة' || (a.account_type === 'مصروفات' && a.code.startsWith('51')))
  const otherExpenses = leaves.filter(a =>
    a.account_type === 'مصروفات' && a.code.startsWith('58'))
  const opexAccounts = leaves.filter(a =>
    a.account_type === 'مصروفات' && !a.code.startsWith('51') && !a.code.startsWith('58'))
  const totalRevenue = -sum(revenues, a => a.balance)
  const totalCost = sum(costAccounts, a => a.balance)
  const totalOpex = sum(opexAccounts, a => a.balance)
  const totalOther = sum(otherExpenses, a => a.balance)
  const grossProfit = totalRevenue - totalCost
  const operatingProfit = grossProfit - totalOpex
  const netProfit = operatingProfit - totalOther
  return {
    revenues, costAccounts, opexAccounts, otherExpenses,
    totalRevenue, totalCost, totalOpex, totalOther,
    grossProfit, operatingProfit, netProfit,
  }
}

export function buildBalanceSheet<T extends FinancialAccount>(accounts: T[]) {
  const leaves = accounts.filter(a => !a.is_parent)
  const assets = leaves.filter(a => a.account_type === 'أصول' && a.balanceAsOf !== 0)
  const liabilities = leaves.filter(a => a.account_type === 'خصوم' && a.balanceAsOf !== 0)
  const equity = leaves.filter(a => a.account_type === 'حقوق ملكية' && a.balanceAsOf !== 0)
  const currentAssets = assets.filter(a => a.code.startsWith('11'))
  const nonCurrentAssets = assets.filter(a => !a.code.startsWith('11'))
  const currentLiab = liabilities.filter(a => a.code.startsWith('21'))
  const nonCurrentLiab = liabilities.filter(a => !a.code.startsWith('21'))

  // All amounts here retain their debit/credit direction (no Math.abs).
  const totalCurrentAssets = sum(currentAssets, a => a.balanceAsOf)
  const totalNonCurrentAssets = sum(nonCurrentAssets, a => a.balanceAsOf)
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets
  const totalCurrentLiab = -sum(currentLiab, a => a.balanceAsOf)
  const totalNonCurrentLiab = -sum(nonCurrentLiab, a => a.balanceAsOf)
  const totalLiab = totalCurrentLiab + totalNonCurrentLiab
  // Income statement accounts already closed to retained earnings have net zero.
  const rawProfit = -sum(leaves.filter(a => a.account_type === 'إيرادات'), a => a.balanceAsOf)
    - sum(leaves.filter(a => a.account_type === 'مصروفات' || a.account_type === 'تكلفة'), a => a.balanceAsOf)
  // Avoid displaying a negative zero after a complete year-end close.
  const netProfit = rawProfit === 0 ? 0 : rawProfit
  const totalEquity = -sum(equity, a => a.balanceAsOf) + netProfit
  const totalLiabEq = totalLiab + totalEquity
  const isBalanced = Math.abs(totalAssets - totalLiabEq) < 0.01
  return {
    currentAssets, nonCurrentAssets, currentLiab, nonCurrentLiab, equity,
    netProfit, totalCurrentAssets, totalNonCurrentAssets, totalAssets,
    totalCurrentLiab, totalNonCurrentLiab, totalLiab, totalEquity, totalLiabEq, isBalanced,
  }
}

export type DatedJournalLine = {
  account_id: number
  debit: number | string | null
  credit: number | string | null
  entry_date: string
  reference_type?: string | null
}

/**
 * Movement for the chosen date range is for income; lifetime through date is
 * required for the balance sheet and trial balance.
 */
export function summarizeJournalLines(lines: DatedJournalLine[], from: string, to: string) {
  const period = new Map<number, { debit: number; credit: number }>()
  const asOf = new Map<number, { debit: number; credit: number }>()
  for (const line of lines) {
    if (line.entry_date > to) continue
    const debit = Number(line.debit || 0)
    const credit = Number(line.credit || 0)
    const overall = asOf.get(line.account_id) || { debit: 0, credit: 0 }
    overall.debit += debit
    overall.credit += credit
    asOf.set(line.account_id, overall)
    // The close is a balance-sheet transfer, not operating performance.
    if (line.entry_date >= from && line.reference_type !== 'إقفال سنوي') {
      const within = period.get(line.account_id) || { debit: 0, credit: 0 }
      within.debit += debit
      within.credit += credit
      period.set(line.account_id, within)
    }
  }
  return { period, asOf }
}
