import { supabase } from '@/lib/supabase'
import { ACC } from '@/lib/account-codes'

/** فئات الأصول في سجل الأصول */
export const ASSET_CATEGORIES = [
  'سيارات ومركبات',
  'معدات وآلات',
  'أجهزة وحاسبات',
  'أثاث ومفروشات',
  'أصول أخرى',
] as const

export type AssetCategory = typeof ASSET_CATEGORIES[number]

/** أكواد الشجرة الخماسية لكل فئة */
export function getCategoryCoaCodes(category: string, linkedToProject = false) {
  const expense = linkedToProject ? ACC.EQUIPMENT_MAINTENANCE : ACC.ADMIN_ASSET_DEPRECIATION
  const map: Record<string, { asset: string; accum: string; expense: string }> = {
    'سيارات ومركبات': { asset: ACC.FIXED_ASSET_VEHICLE,   accum: ACC.ACCUM_DEPRECIATION, expense },
    'معدات وآلات':    { asset: ACC.FIXED_ASSET_MACHINERY, accum: ACC.ACCUM_DEPRECIATION, expense },
    'أجهزة وحاسبات':  { asset: ACC.FIXED_ASSET_MACHINERY, accum: ACC.ACCUM_DEPRECIATION, expense },
    'أثاث ومفروشات':  { asset: ACC.FIXED_ASSET_FURN,      accum: ACC.ACCUM_DEPRECIATION, expense },
    'أصول أخرى':      { asset: ACC.FIXED_ASSET_TOOLS,     accum: ACC.ACCUM_DEPRECIATION, expense },
  }
  return map[category] || map['أصول أخرى']
}

/** نوع الأصل في فاتورة المورد → فئة سجل الأصول */
export function purchaseAssetTypeToCategory(assetType?: string): AssetCategory {
  if (assetType === 'مركبات') return 'سيارات ومركبات'
  if (assetType === 'أثاث')   return 'أثاث ومفروشات'
  if (assetType === 'معدات') return 'معدات وآلات'
  return 'أصول أخرى'
}

const FIXED_ASSET_CODES = new Set([
  ACC.FIXED_ASSET_MACHINERY,
  ACC.FIXED_ASSET_VEHICLE,
  ACC.FIXED_ASSET_TOOLS,
  ACC.FIXED_ASSET_FURN,
])

export function isFixedAssetAccount(code: string) {
  return FIXED_ASSET_CODES.has(code)
}

export function filterAssetLeafAccounts<T extends { code: string; is_parent?: boolean }>(accounts: T[]) {
  return accounts.filter(a => !a.is_parent && isFixedAssetAccount(a.code))
}

export function filterAccumAccounts<T extends { code: string; is_parent?: boolean }>(accounts: T[]) {
  return accounts.filter(a => !a.is_parent && a.code === ACC.ACCUM_DEPRECIATION)
}

export function filterDepreciationExpenseAccounts<T extends { code: string; is_parent?: boolean }>(accounts: T[]) {
  return accounts.filter(a => !a.is_parent && (a.code === ACC.ADMIN_ASSET_DEPRECIATION || a.code === ACC.EQUIPMENT_MAINTENANCE))
}

export function filterMaintenanceExpenseAccounts<T extends { code: string; is_parent?: boolean }>(accounts: T[]) {
  return accounts.filter(a =>
    !a.is_parent &&
    (a.code === ACC.EQUIPMENT_MAINTENANCE || a.code === ACC.EQUIPMENT_FUEL || a.code === ACC.ADMIN_ASSET_DEPRECIATION || a.code === ACC.MAINTENANCE_EXPENSE)
  )
}

/** ربط حسابات الفئة على نموذج الأصل */
export function resolveAccountIds(
  accounts: { id: number; code: string }[],
  category: string,
  linkedToProject = false,
) {
  const codes = getCategoryCoaCodes(category, linkedToProject)
  const asset  = accounts.find(a => a.code === codes.asset)
  const accum  = accounts.find(a => a.code === codes.accum)
  const expense = accounts.find(a => a.code === codes.expense)
  return {
    assetAccountId:   asset?.id,
    accumAccountId:   accum?.id,
    expenseAccountId: expense?.id,
  }
}

/** مركز تكلفة مرتبط بمشروع */
export async function getCostCenterIdForProject(tenantId: string, projectId?: number | null): Promise<number | undefined> {
  if (!projectId) return undefined
  const { data } = await supabase
    .from('finance_cost_centers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.id
}

/** كود حساب الأصل → فئة سجل الأصول */
export function assetCodeToCategory(code: string): AssetCategory {
  if (code === ACC.FIXED_ASSET_VEHICLE)   return 'سيارات ومركبات'
  if (code === ACC.FIXED_ASSET_FURN)      return 'أثاث ومفروشات'
  if (code === ACC.FIXED_ASSET_TOOLS)     return 'أصول أخرى'
  if (code === ACC.FIXED_ASSET_MACHINERY) return 'معدات وآلات'
  return 'معدات وآلات'
}

export type RegisterAssetFromInvoiceParams = {
  tenantId: string
  invoiceId: number
  invoiceNumber: string
  invoiceDate: string
  vendorName: string
  subtotal: number
  assetType?: string
  assetAccountCode?: string
  projectId?: number | null
  description?: string
}

/** إنشاء سجل أصل من فاتورة مورد (القيد المحاسبي مُسجَّل مسبقاً عبر فاتورة المورد) */
export async function registerAssetFromVendorInvoice(params: RegisterAssetFromInvoiceParams): Promise<number | null> {
  const { tenantId, invoiceId, subtotal, assetType, projectId } = params
  if (subtotal <= 0) return null

  const { data: existing } = await supabase
    .from('finance_assets')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('notes', `%فاتورة مورد ${params.invoiceNumber}%`)
    .maybeSingle()
  if (existing?.id) return existing.id

  const category = params.assetType
    ? purchaseAssetTypeToCategory(params.assetType)
    : (params.assetAccountCode ? assetCodeToCategory(params.assetAccountCode) : 'معدات وآلات')
  const linkedToProject = Boolean(projectId)

  const { data: accRows } = await supabase
    .from('finance_accounts')
    .select('id, code')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const ids = resolveAccountIds(accRows || [], category, linkedToProject)
  if (!ids.assetAccountId || !ids.accumAccountId || !ids.expenseAccountId) return null

  const { count } = await supabase
    .from('finance_assets')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const assetNo = `AST-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  const name = params.description?.trim() || `أصل من فاتورة ${params.invoiceNumber} — ${params.vendorName}`
  const usefulLife = category === 'سيارات ومركبات' ? 5 : 7
  const monthlyDep = subtotal / (usefulLife * 12)

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    asset_no: assetNo,
    name,
    category,
    description: `مُسجَّل آلياً من فاتورة مورد ${params.invoiceNumber}`,
    purchase_date: params.invoiceDate,
    purchase_value: subtotal,
    installation_cost: 0,
    total_cost: subtotal,
    salvage_value: 0,
    useful_life_years: usefulLife,
    depreciation_method: 'قسط ثابت',
    monthly_depreciation: Math.round(monthlyDep * 100) / 100,
    accumulated_depreciation: 0,
    book_value: subtotal,
    asset_account_id: ids.assetAccountId,
    accum_account_id: ids.accumAccountId,
    expense_account_id: ids.expenseAccountId,
    payment_method: 'آجل — مورد',
    status: 'نشط',
    notes: `مصدر: فاتورة مورد ${params.invoiceNumber} (id:${invoiceId})`,
  }
  if (projectId) payload.project_id = projectId

  const { data, error } = await supabase.from('finance_assets').insert(payload).select('id').single()
  if (error || !data) return null
  return data.id
}
