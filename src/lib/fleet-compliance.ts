import { supabase } from '@/lib/supabase'
import { nextDocNumber } from '@/lib/journal'
import { fetchActiveVendors } from '@/lib/fleet-procurement'
import type { Vendor } from '@/lib/purchases-types'

export { fetchActiveVendors }

export type RenewalPath = 'مشتريات' | 'مصروفات'

/** وجهة التسليم لطلبات تجديد الامتثال — تُرحّل على 5142 */
export const FLEET_COMPLIANCE_PO_DELIVERY = 'امتثال أسطول'

/** أنواع الوثائق التي يُحفظ فيها رقم الوثيقة والجهة عند إتمام التجديد */
export const COMPLIANCE_STATIC_RENEWAL_TYPES = ['استمارة'] as const

/** أيام التنبيه قبل الانتهاء حسب النوع */
export const COMPLIANCE_ALERT_DAYS: Record<string, number> = {
  'استمارة': 30,
  'تأمين': 30,
  'فحص دوري': 30,
  'شهادة فحص طرف ثالث': 60,
  'شهادة رفع': 45,
  'أخرى': 30,
}

export type ComplianceDocRow = {
  id: number
  unit_id: number
  doc_type: string
  doc_number?: string | null
  issuer?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  status: string
  is_active?: boolean
  replaces_id?: number | null
  po_id?: number | null
  expense_id?: number | null
  renewal_path?: string | null
  vendor_id?: number | null
  notes?: string | null
}

export function complianceAlertDays(docType: string): number {
  return COMPLIANCE_ALERT_DAYS[docType] ?? 30
}

export function complianceStatusFromExpiry(expiryDate?: string | null, docType?: string): string {
  if (!expiryDate) return 'ساري'
  const exp = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (exp.getTime() - today.getTime()) / 86400000
  if (diff < 0) return 'منتهي'
  const alertDays = complianceAlertDays(docType || '')
  if (diff <= alertDays) return 'قريب الانتهاء'
  return 'ساري'
}

/** المسار المقترح حسب نوع الوثيقة */
export function suggestedRenewalPath(docType: string): RenewalPath {
  if (['شهادة فحص طرف ثالث', 'تأمين', 'شهادة رفع'].includes(docType)) return 'مشتريات'
  return 'مصروفات'
}

export function keepsStaticDataOnRenewal(docType: string): boolean {
  return (COMPLIANCE_STATIC_RENEWAL_TYPES as readonly string[]).includes(docType)
}

/** الوثائق المطلوبة حسب فئة المعدة */
export function requiredComplianceTypes(category: string, subCategory?: string | null): string[] {
  const base: Record<string, string[]> = {
    'معدات ثقيلة': ['استمارة', 'شهادة فحص طرف ثالث'],
    'شاحنة': ['استمارة', 'تأمين', 'فحص دوري'],
    'سيارة': ['استمارة', 'تأمين', 'فحص دوري'],
  }
  const req = [...(base[category] || ['استمارة'])]
  if (subCategory === 'رفع') req.push('شهادة رفع')
  return req
}

export type ComplianceCheckResult = {
  ok: boolean
  missing: string[]
  expired: string[]
  message?: string
}

export function checkUnitCompliance(
  category: string,
  subCategory: string | null | undefined,
  activeDocs: ComplianceDocRow[],
): ComplianceCheckResult {
  const required = requiredComplianceTypes(category, subCategory)
  const missing: string[] = []
  const expired: string[] = []

  for (const docType of required) {
    const doc = activeDocs.find(d => d.doc_type === docType && d.is_active !== false)
    if (!doc) {
      missing.push(docType)
      continue
    }
    const st = complianceStatusFromExpiry(doc.expiry_date, doc.doc_type)
    if (st === 'منتهي' || doc.status === 'قيد التجديد') {
      expired.push(docType)
    }
  }

  if (missing.length === 0 && expired.length === 0) return { ok: true, missing, expired }

  const parts: string[] = []
  if (missing.length) parts.push(`ناقص: ${missing.join('، ')}`)
  if (expired.length) parts.push(`منتهي/قيد التجديد: ${expired.join('، ')}`)
  return { ok: false, missing, expired, message: parts.join(' — ') }
}

export function resolveRenewalPath(doc: ComplianceDocRow): RenewalPath | null {
  if (doc.renewal_path === 'مشتريات' || doc.renewal_path === 'مصروفات') return doc.renewal_path
  if (doc.po_id) return 'مشتريات'
  if (doc.expense_id) return 'مصروفات'
  return null
}

export function canCompleteComplianceRenewal(
  doc: ComplianceDocRow,
  po?: { status: string } | null,
  expense?: { status: string } | null,
): { ok: boolean; message?: string } {
  if (doc.status !== 'قيد التجديد') {
    return { ok: false, message: 'الوثيقة ليست قيد التجديد' }
  }
  const path = resolveRenewalPath(doc)
  if (path === 'مشتريات') {
    if (!po || po.status === 'مسودة') {
      return { ok: false, message: 'يجب اعتماد طلب الشراء في المشتريات أولاً' }
    }
    return { ok: true }
  }
  if (path === 'مصروفات') {
    if (!expense || expense.status !== 'مدفوع') {
      return { ok: false, message: 'يجب اعتماد ودفع المصروف في قسم المصروفات (الحالة: مدفوع)' }
    }
    return { ok: true }
  }
  return { ok: false, message: 'مسار التجديد غير محدد' }
}

/** إتمام التجديد — سجل جديد + أرشفة (بعد المشتريات/المصروفات) */
export async function renewComplianceDocDirect(params: {
  tenantId: string
  oldDoc: ComplianceDocRow
  issueDate?: string | null
  expiryDate?: string | null
  docNumber?: string | null
  issuer?: string | null
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { oldDoc } = params
  const docNumber = keepsStaticDataOnRenewal(oldDoc.doc_type)
    ? (oldDoc.doc_number || params.docNumber)
    : (params.docNumber ?? oldDoc.doc_number)
  const issuer = keepsStaticDataOnRenewal(oldDoc.doc_type)
    ? (oldDoc.issuer || params.issuer)
    : (params.issuer ?? oldDoc.issuer)

  const expiryDate = params.expiryDate || null
  const status = complianceStatusFromExpiry(expiryDate, oldDoc.doc_type)

  const { data: newDoc, error: insErr } = await supabase
    .from('fleet_compliance_docs')
    .insert({
      tenant_id: params.tenantId,
      unit_id: oldDoc.unit_id,
      doc_type: oldDoc.doc_type,
      doc_number: docNumber || null,
      issuer: issuer || null,
      issue_date: params.issueDate || null,
      expiry_date: expiryDate,
      status,
      is_active: true,
      replaces_id: oldDoc.id,
      notes: params.notes || oldDoc.notes || null,
    })
    .select('id')
    .single()

  if (insErr || !newDoc) return { ok: false, error: insErr?.message || 'فشل الإنشاء' }

  await supabase.from('fleet_compliance_docs').update({
    is_active: false,
    status: 'مُجدَّد',
    replaced_by_id: newDoc.id,
  }).eq('id', oldDoc.id)

  return { ok: true }
}

export async function completeComplianceRenewal(params: {
  tenantId: string
  oldDoc: ComplianceDocRow
  po?: { status: string } | null
  expense?: { status: string } | null
  issueDate?: string | null
  expiryDate?: string | null
  docNumber?: string | null
  issuer?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const gate = canCompleteComplianceRenewal(params.oldDoc, params.po, params.expense)
  if (!gate.ok) return { ok: false, error: gate.message }

  return renewComplianceDocDirect({
    tenantId: params.tenantId,
    oldDoc: params.oldDoc,
    issueDate: params.issueDate,
    expiryDate: params.expiryDate,
    docNumber: params.docNumber,
    issuer: params.issuer ?? params.oldDoc.issuer,
    notes: params.oldDoc.notes,
  })
}

/** طلب تجديد عبر المشتريات (PO مسودة) */
export async function startCompliancePurchaseRenewal(params: {
  tenantId: string
  doc: ComplianceDocRow
  vendorId: number
  vendorName: string
  unitLabel: string
  estimatedAmount?: number
  createdBy?: string | null
}): Promise<{ poId: number; poNumber: string } | null> {
  const today = new Date().toISOString().split('T')[0]
  const poNumber = (await nextDocNumber(params.tenantId, 'PO', 'PO')) ||
    `PO-${new Date().getFullYear()}-0001`

  const amount = params.estimatedAmount ?? 0
  const vatRate = 15
  const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100
  const itemDesc = `تجديد ${params.doc.doc_type} — ${params.unitLabel} — ${params.doc.doc_number || 'بدون رقم'}`

  const { data: po, error } = await supabase
    .from('finance_purchase_orders')
    .insert({
      tenant_id: params.tenantId,
      po_number: poNumber,
      po_date: today,
      vendor_id: params.vendorId,
      vendor_name: params.vendorName,
      delivery_to: FLEET_COMPLIANCE_PO_DELIVERY,
      subtotal: amount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: amount + vatAmount,
      status: 'مسودة',
      source_module: 'fleet_compliance',
      fleet_compliance_doc_id: params.doc.id,
      notes: `تجديد وثيقة امتثال #${params.doc.id}`,
      created_by: params.createdBy || null,
    })
    .select('id, po_number')
    .single()

  if (error || !po) return null

  await supabase.from('finance_purchase_order_items').insert({
    po_id: po.id,
    description: itemDesc,
    quantity: 1,
    unit: 'مقطوعة',
    unit_price: amount,
    total: amount,
  })

  await supabase.from('fleet_compliance_docs').update({
    status: 'قيد التجديد',
    renewal_path: 'مشتريات',
    po_id: po.id,
    vendor_id: params.vendorId,
  }).eq('id', params.doc.id)

  return { poId: po.id, poNumber: po.po_number }
}

/** طلب تجديد عبر المصروفات (مصروف معلّق) */
export async function startComplianceExpenseRenewal(params: {
  tenantId: string
  doc: ComplianceDocRow
  unitLabel: string
  payeeName?: string
  estimatedAmount?: number
  createdBy?: string | null
}): Promise<{ expenseId: number; expenseNumber: string } | null> {
  const today = new Date().toISOString().split('T')[0]
  const expenseNumber = (await nextDocNumber(params.tenantId, 'EXP', 'EXP')) ||
    `EXP-${new Date().getFullYear()}-0001`

  const amount = params.estimatedAmount ?? 0
  const vatRate = 15
  const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100
  const total = amount + vatAmount
  const payee = params.payeeName?.trim() || 'رسوم حكومية / مرور'

  const { data: exp, error } = await supabase
    .from('finance_expenses')
    .insert({
      tenant_id: params.tenantId,
      expense_number: expenseNumber,
      expense_date: today,
      category: 'امتثال أسطول',
      expense_type: 'تشغيلي',
      description: `تجديد ${params.doc.doc_type} — ${params.unitLabel}`,
      amount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: total,
      vendor_name: payee,
      status: 'معلق',
      payment_method: 'تحويل بنكي',
      source_module: 'fleet_compliance',
      fleet_compliance_doc_id: params.doc.id,
      notes: `طلب تجديد وثيقة امتثال #${params.doc.id} — ${params.doc.doc_type}${params.createdBy ? ` — طلب: ${params.createdBy}` : ''}`,
    })
    .select('id, expense_number')
    .single()

  if (error || !exp) return null

  await supabase.from('fleet_compliance_docs').update({
    status: 'قيد التجديد',
    renewal_path: 'مصروفات',
    expense_id: exp.id,
  }).eq('id', params.doc.id)

  return { expenseId: exp.id, expenseNumber: exp.expense_number }
}

/** بدء طلب تجديد (مسار واحد) */
export async function startComplianceRenewalRequest(params: {
  tenantId: string
  doc: ComplianceDocRow
  path: RenewalPath
  unitLabel: string
  createdBy?: string | null
  vendorId?: number
  vendorName?: string
  payeeName?: string
  estimatedAmount?: number
}): Promise<{ ok: boolean; refNumber?: string; error?: string }> {
  if (params.path === 'مشتريات') {
    if (!params.vendorId || !params.vendorName) {
      return { ok: false, error: 'اختر المورد' }
    }
    const r = await startCompliancePurchaseRenewal({
      tenantId: params.tenantId,
      doc: params.doc,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      unitLabel: params.unitLabel,
      estimatedAmount: params.estimatedAmount,
      createdBy: params.createdBy,
    })
    if (!r) return { ok: false, error: 'فشل إنشاء طلب الشراء' }
    return { ok: true, refNumber: r.poNumber }
  }

  const r = await startComplianceExpenseRenewal({
    tenantId: params.tenantId,
    doc: params.doc,
    unitLabel: params.unitLabel,
    payeeName: params.payeeName,
    estimatedAmount: params.estimatedAmount,
    createdBy: params.createdBy,
  })
  if (!r) return { ok: false, error: 'فشل إنشاء طلب المصروف' }
  return { ok: true, refNumber: r.expenseNumber }
}

export async function hasActiveComplianceDoc(
  tenantId: string,
  unitId: number,
  docType: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('fleet_compliance_docs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('unit_id', unitId)
    .eq('doc_type', docType)
    .eq('is_active', true)
  return (count || 0) > 0
}

export async function deleteComplianceDoc(doc: ComplianceDocRow): Promise<{ ok: boolean; error?: string }> {
  if (doc.status === 'قيد التجديد') {
    return {
      ok: false,
      error: 'لا يمكن الحذف — الوثيقة قيد التجديد. ألغِ طلب الشراء أو المصروف في المالية أولاً.',
    }
  }

  const { error } = await supabase.from('fleet_compliance_docs').delete().eq('id', doc.id)
  if (error) return { ok: false, error: error.message }

  if (doc.replaces_id) {
    await supabase.from('fleet_compliance_docs')
      .update({ replaced_by_id: null, is_active: true, status: 'ساري' })
      .eq('id', doc.replaces_id)
  }

  return { ok: true }
}

export async function loadActiveComplianceForUnit(
  tenantId: string,
  unitId: number,
): Promise<ComplianceDocRow[]> {
  const { data } = await supabase
    .from('fleet_compliance_docs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('unit_id', unitId)
    .eq('is_active', true)
  return (data || []) as ComplianceDocRow[]
}

export async function loadActiveComplianceForUnits(
  tenantId: string,
  unitIds: number[],
): Promise<Map<number, ComplianceDocRow[]>> {
  if (unitIds.length === 0) return new Map()
  const { data } = await supabase
    .from('fleet_compliance_docs')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('unit_id', unitIds)
    .eq('is_active', true)

  const map = new Map<number, ComplianceDocRow[]>()
  for (const row of (data || []) as ComplianceDocRow[]) {
    const list = map.get(row.unit_id) || []
    list.push(row)
    map.set(row.unit_id, list)
  }
  return map
}
