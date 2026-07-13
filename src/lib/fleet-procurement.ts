import { supabase } from '@/lib/supabase'
import { nextDocNumber, journalFleetMaintenance } from '@/lib/journal'
import { ACC } from '@/lib/account-codes'
import type { Vendor } from '@/lib/purchases-types'

/** وجهة التسليم لأوامر شراء صيانة الأسطول — تُرحّل على 5142 */
export const FLEET_PO_DELIVERY = 'صيانة أسطول'

/** معدل ساعة الورشة الداخلية (ر.س) */
export const FLEET_INTERNAL_LABOR_RATE = 50

export function calcWorkOrderTotal(wo: {
  labor_hours?: number
  parts_cost?: number
  external_cost?: number
}): number {
  return (
    Number(wo.labor_hours || 0) * FLEET_INTERNAL_LABOR_RATE +
    Number(wo.parts_cost || 0) +
    Number(wo.external_cost || 0)
  )
}

/** مبلغ القيد الداخلي — يستثني قطع الغيار المُفوترة عبر المشتريات لتجنب التكرار */
export function calcInternalJournalAmount(wo: {
  labor_hours?: number
  parts_cost?: number
  external_cost?: number
  vendor_invoice_id?: number | null
}): number {
  let total = calcWorkOrderTotal(wo)
  if (wo.vendor_invoice_id) {
    total -= Number(wo.external_cost || 0)
  }
  return Math.max(0, total)
}

export function workOrderNeedsPartsPo(wo: { source: string; po_id?: number | null; status: string }): boolean {
  return !wo.po_id && wo.status !== 'مكتمل' && wo.status !== 'ملغي'
}

export function workOrderNeedsServiceConfirm(wo: { source: string; po_id?: number | null; service_confirmed_at?: string | null }): boolean {
  return wo.source === 'خارجي' && !!wo.po_id && !wo.service_confirmed_at
}

export async function fetchActiveVendors(tenantId: string): Promise<Vendor[]> {
  const { data } = await supabase
    .from('finance_vendors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  return (data || []) as Vendor[]
}

export async function createDraftPOFromWorkOrder(params: {
  tenantId: string
  workOrderId: number
  woNo: string
  vendorId: number
  vendorName: string
  description: string
  unitLabel: string
  projectId?: number | null
  estimatedAmount?: number
  createdBy?: string | null
}): Promise<{ poId: number; poNumber: string } | null> {
  const today = new Date().toISOString().split('T')[0]
  let poNumber = (await nextDocNumber(params.tenantId, 'PO', 'PO')) ||
    `PO-${new Date().getFullYear()}-0001`

  const amount = params.estimatedAmount ?? 0
  const vatRate = 15
  const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100
  const total = amount + vatAmount

  const itemDesc = `صيانة أسطول — ${params.unitLabel} — ${params.woNo}: ${params.description}`

  const { data: po, error } = await supabase
    .from('finance_purchase_orders')
    .insert({
      tenant_id: params.tenantId,
      po_number: poNumber,
      po_date: today,
      vendor_id: params.vendorId,
      vendor_name: params.vendorName,
      project_id: params.projectId || null,
      delivery_to: FLEET_PO_DELIVERY,
      subtotal: amount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: total,
      status: 'مسودة',
      source_module: 'fleet',
      fleet_work_order_id: params.workOrderId,
      notes: `مرتبط بأمر عمل ${params.woNo}`,
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

  await supabase.from('fleet_work_orders').update({ po_id: po.id }).eq('id', params.workOrderId)

  if (params.vendorId) {
    await supabase.from('fleet_work_orders').update({
      vendor_id: params.vendorId,
      vendor_name: params.vendorName,
    }).eq('id', params.workOrderId)
  }

  return { poId: po.id, poNumber: po.po_number }
}

export async function confirmWorkOrderService(workOrderId: number): Promise<boolean> {
  const { error } = await supabase
    .from('fleet_work_orders')
    .update({ service_confirmed_at: new Date().toISOString() })
    .eq('id', workOrderId)
  return !error
}

export async function syncFleetWorkOrderFromApprovedInvoice(params: {
  poId?: number | null
  invoiceId: number
}): Promise<void> {
  let woId: number | null = null

  if (params.poId) {
    const { data: po } = await supabase
      .from('finance_purchase_orders')
      .select('fleet_work_order_id')
      .eq('id', params.poId)
      .maybeSingle()
    woId = po?.fleet_work_order_id ?? null
  }

  if (!woId) {
    const { data: inv } = await supabase
      .from('finance_vendor_invoices')
      .select('fleet_work_order_id')
      .eq('id', params.invoiceId)
      .maybeSingle()
    woId = inv?.fleet_work_order_id ?? null
  }

  if (!woId) return

  await supabase.from('fleet_work_orders').update({
    vendor_invoice_id: params.invoiceId,
    journal_posted_at: new Date().toISOString(),
  }).eq('id', woId)
}

export async function postInternalWorkOrderJournal(params: {
  tenantId: string
  workOrderId: number
  woNo: string
  unitName: string
  description: string
  amount: number
  cashAccountId: number
  cashAccountCode: string
  date?: string
}): Promise<boolean> {
  if (params.amount <= 0) return true

  const jr = await journalFleetMaintenance({
    tenantId: params.tenantId,
    workOrderId: params.workOrderId,
    date: params.date || new Date().toISOString().split('T')[0],
    description: `صيانة أسطول — ${params.unitName} — ${params.woNo}: ${params.description}`,
    amount: params.amount,
    cashAccountCode: params.cashAccountCode,
    expenseAccountCode: ACC.EQUIPMENT_MAINTENANCE,
  })

  if (!jr) return false

  await supabase.from('fleet_work_orders').update({
    cash_account_id: params.cashAccountId,
    journal_posted_at: new Date().toISOString(),
  }).eq('id', params.workOrderId)

  return true
}

export async function getFleetWorkOrderForPo(poId: number): Promise<{
  id: number
  wo_no: string
  service_confirmed_at: string | null
} | null> {
  const { data: po } = await supabase
    .from('finance_purchase_orders')
    .select('fleet_work_order_id')
    .eq('id', poId)
    .maybeSingle()

  if (!po?.fleet_work_order_id) return null

  const { data: wo } = await supabase
    .from('fleet_work_orders')
    .select('id, wo_no, service_confirmed_at')
    .eq('id', po.fleet_work_order_id)
    .maybeSingle()

  return wo
}
