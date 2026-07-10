import { supabase } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/expenses-types'

const CANCELLED_INVOICE = new Set(['ملغاة', 'ملغى'])
const DRAFT_INVOICE = new Set(['مسودة'])
const CANCELLED_EXP = new Set(['ملغي', 'ملغى'])
const CANCELLED_VENDOR = new Set(['ملغي', 'ملغى', 'ملغاة'])

const CAT_MATERIALS = 'مواد ومستلزمات الموقع'
const CAT_LABOR = 'عمالة مباشرة'
const CAT_SUBCON = 'مقاولون فرعيون'

export type ProjectProfitRow = {
  projectId: number
  projectName: string
  status: string
  type: string
  estimatedValue: number
  progress: number
  revenue: number
  creditNotes: number
  netRevenue: number
  vendorPurchases: number
  expenseMaterials: number
  expenseLabor: number
  expenseSubcontractors: number
  expenseOther: number
  totalExpenses: number
  totalCosts: number
  netProfit: number
  profitMargin: number
  collected: number
  uncollected: number
  invoiceCount: number
}

function sumAmount(rows: { total_amount?: number | null; amount?: number | null }[], field: 'total_amount' | 'amount' = 'total_amount') {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0)
}

export async function fetchProjectsProfitability(
  tenantId: string,
  branchId?: number | null,
): Promise<ProjectProfitRow[]> {
  let projQ = supabase
    .from('projects')
    .select('id, name, status, type, progress, value, estimated_value, actual_value')
    .eq('tenant_id', tenantId)
    .order('name')
  if (branchId) projQ = projQ.eq('branch_id', branchId)

  const [projRes, invRes, expRes, viRes, treRes, cnRes] = await Promise.all([
    projQ,
    supabase.from('finance_invoices').select('id, project_id, total_amount, status').eq('tenant_id', tenantId).not('project_id', 'is', null),
    supabase.from('finance_expenses').select('project_id, total_amount, category, status, expense_type').eq('tenant_id', tenantId).not('project_id', 'is', null),
    supabase.from('finance_vendor_invoices').select('project_id, total_amount, status').eq('tenant_id', tenantId).not('project_id', 'is', null),
    supabase.from('finance_treasury').select('project_id, amount, type').eq('tenant_id', tenantId).not('project_id', 'is', null),
    supabase.from('finance_credit_notes').select('original_invoice_id, total_amount, status').eq('tenant_id', tenantId),
  ])

  const projects = projRes.data || []
  if (!projects.length) return []

  const invoices = (invRes.data || []).filter(i => !CANCELLED_INVOICE.has(i.status || ''))
  const expenses = (expRes.data || []).filter(e => !CANCELLED_EXP.has(e.status || ''))
  const vendorInv = (viRes.data || []).filter(v => !CANCELLED_VENDOR.has(v.status || ''))
  const treasury = treRes.data || []
  const creditNotes = (cnRes.data || []).filter(c => c.status !== 'ملغي' && c.status !== 'ملغى')

  const invoiceProject = new Map<number, number>()
  invoices.forEach(i => {
    if (!i.project_id) return
    invoiceProject.set(i.id, i.project_id)
  })

  const cnByProject = new Map<number, number>()
  creditNotes.forEach(cn => {
    const pid = cn.original_invoice_id ? invoiceProject.get(cn.original_invoice_id) : undefined
    if (!pid) return
    cnByProject.set(pid, (cnByProject.get(pid) || 0) + Number(cn.total_amount || 0))
  })

  const projectCats = new Set(CATEGORIES['مشاريع'] || [])

  return projects.map(p => {
    const pid = p.id
    const invRows = invoices.filter(i => i.project_id === pid)
    const expRows = expenses.filter(e => e.project_id === pid && e.expense_type === 'مشاريع')
    const viRows = vendorInv.filter(v => v.project_id === pid)
    const rcvRows = treasury.filter(t => t.project_id === pid && t.type === 'قبض')

    const revenue = sumAmount(invRows)
    const credit = cnByProject.get(pid) || 0
    const netRevenue = revenue - credit
    const vendorPurchases = sumAmount(viRows)
    const expenseMaterials = sumAmount(expRows.filter(e => e.category === CAT_MATERIALS))
    const expenseLabor = sumAmount(expRows.filter(e => e.category === CAT_LABOR))
    const expenseSubcontractors = sumAmount(expRows.filter(e => e.category === CAT_SUBCON))
    const expenseOther = sumAmount(expRows.filter(e =>
      e.category !== CAT_MATERIALS && e.category !== CAT_LABOR && e.category !== CAT_SUBCON &&
      (projectCats.has(e.category || '') || e.expense_type === 'مشاريع')
    ))
    const totalExpenses = sumAmount(expRows)
    const totalCosts = vendorPurchases + totalExpenses
    const netProfit = netRevenue - totalCosts
    const collected = sumAmount(rcvRows, 'amount')
    const estimatedValue = Number(p.estimated_value ?? p.value ?? 0)

    return {
      projectId: pid,
      projectName: p.name,
      status: p.status || '—',
      type: p.type || '—',
      estimatedValue,
      progress: Number(p.progress ?? 0),
      revenue,
      creditNotes: credit,
      netRevenue,
      vendorPurchases,
      expenseMaterials,
      expenseLabor,
      expenseSubcontractors,
      expenseOther,
      totalExpenses,
      totalCosts,
      netProfit,
      profitMargin: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0,
      collected,
      uncollected: netRevenue - collected,
      invoiceCount: invRows.length,
    }
  })
}

export type ProfitabilitySummary = {
  projectCount: number
  activeCount: number
  totalRevenue: number
  totalCosts: number
  totalProfit: number
  profitProjects: number
  lossProjects: number
  avgMargin: number
}

export function summarizeProfitability(rows: ProjectProfitRow[]): ProfitabilitySummary {
  const active = rows.filter(r => !['مكتمل', 'ملغى', 'ملغاة'].includes(r.status))
  const totalRevenue = rows.reduce((s, r) => s + r.netRevenue, 0)
  const totalCosts = rows.reduce((s, r) => s + r.totalCosts, 0)
  const totalProfit = rows.reduce((s, r) => s + r.netProfit, 0)
  const profitProjects = rows.filter(r => r.netProfit > 0).length
  const lossProjects = rows.filter(r => r.netProfit < 0 && r.totalCosts + r.netRevenue > 0).length
  const withRevenue = rows.filter(r => r.netRevenue > 0)
  const avgMargin = withRevenue.length
    ? withRevenue.reduce((s, r) => s + r.profitMargin, 0) / withRevenue.length
    : 0

  return {
    projectCount: rows.length,
    activeCount: active.length,
    totalRevenue,
    totalCosts,
    totalProfit,
    profitProjects,
    lossProjects,
    avgMargin,
  }
}

export const fmtMoney = (n: number) =>
  Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
