/**
 * ربط فواتير/مرتجعات المشتريات (مستودع) بحركة المخزون — حساب 1310
 */
import { supabase } from '@/lib/supabase'

export type PurchaseLineItem = {
  description: string
  quantity:   number
  unit:       string
}

async function getWarehouseName(warehouseId: number): Promise<string> {
  const { data } = await supabase.from('warehouses').select('name').eq('id', warehouseId).maybeSingle()
  return data?.name || ''
}

async function alreadyPosted(
  tenantId: string,
  docCode: string,
  movementCategory: string
): Promise<boolean> {
  const { count } = await supabase.from('stock_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('doc_code', docCode)
    .eq('movement_category', movementCategory)
  return (count || 0) > 0
}

/** استلام مواد للمستودع عند اعتماد فاتورة مورد (delivery_to = مستودع) */
export async function receiveVendorInvoiceToWarehouse(params: {
  tenantId:       string
  branchId:       number
  warehouseId:    number
  invoiceNumber:  string
  vendorName:     string
  items:          PurchaseLineItem[]
  invoiceDate:    string
}): Promise<{ ok: boolean; error?: string }> {
  const validItems = params.items.filter(i => i.description.trim() && Number(i.quantity) > 0)
  if (!validItems.length) return { ok: true }

  if (await alreadyPosted(params.tenantId, params.invoiceNumber, 'استلام_مورد')) {
    return { ok: true }
  }

  const whName = await getWarehouseName(params.warehouseId)
  const { data: voucherNo, error: numErr } = await supabase.rpc('generate_txn_number', { p_type: 'استلام' })
  if (numErr || !voucherNo) return { ok: false, error: 'تعذر توليد رقم إذن الاستلام' }

  for (const item of validItems) {
    const qty = Number(item.quantity)
    const name = item.description.trim()

    const { data: existing } = await supabase.from('materials').select('id, qty')
      .eq('tenant_id', params.tenantId)
      .eq('warehouse_id', params.warehouseId)
      .eq('name', name)
      .maybeSingle()

    let qtyBefore = 0
    if (existing) {
      qtyBefore = Number(existing.qty)
      const { error } = await supabase.from('materials').update({ qty: qtyBefore + qty }).eq('id', existing.id)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await supabase.from('materials').insert({
        tenant_id:    params.tenantId,
        branch_id:    params.branchId,
        warehouse_id: params.warehouseId,
        name,
        unit:         item.unit || 'وحدة',
        qty,
        reorder:      0,
        source:       'مورد',
      })
      if (error) return { ok: false, error: error.message }
    }

    const { error: ledErr } = await supabase.from('stock_ledger').insert({
      tenant_id:         params.tenantId,
      branch_id:           params.branchId,
      txn_number:          voucherNo,
      type:                'استلام',
      movement_category:   'استلام_مورد',
      mat_name:            name,
      unit:                item.unit || 'وحدة',
      qty,
      qty_before:          qtyBefore,
      qty_after:           qtyBefore + qty,
      wh_name:             whName,
      vendor_name:         params.vendorName,
      doc_code:            params.invoiceNumber,
      dispatch_note:       `استلام من فاتورة مورد ${params.invoiceNumber}`,
    })
    if (ledErr) return { ok: false, error: ledErr.message }
  }

  return { ok: true }
}

/** صرف من المستودع عند اعتماد مرتجع مشتريات (delivery_to = مستودع) */
export async function issuePurchaseReturnFromWarehouse(params: {
  tenantId:      string
  branchId:      number
  warehouseId:   number
  returnNumber:  string
  vendorName:    string
  items:         PurchaseLineItem[]
  returnDate:    string
}): Promise<{ ok: boolean; error?: string }> {
  const validItems = params.items.filter(i => i.description.trim() && Number(i.quantity) > 0)
  if (!validItems.length) return { ok: true }

  if (await alreadyPosted(params.tenantId, params.returnNumber, 'مرتجع_مورد')) {
    return { ok: true }
  }

  const whName = await getWarehouseName(params.warehouseId)
  const { data: voucherNo, error: numErr } = await supabase.rpc('generate_txn_number', { p_type: 'صرف' })
  if (numErr || !voucherNo) return { ok: false, error: 'تعذر توليد رقم إذن الصرف' }

  for (const item of validItems) {
    const qty = Number(item.quantity)
    const name = item.description.trim()

    const { data: mat } = await supabase.from('materials').select('id, qty, unit')
      .eq('tenant_id', params.tenantId)
      .eq('warehouse_id', params.warehouseId)
      .eq('name', name)
      .maybeSingle()

    if (!mat) return { ok: false, error: `المادة "${name}" غير موجودة في المستودع` }

    const qtyBefore = Number(mat.qty)
    if (qty > qtyBefore + 0.001) {
      return { ok: false, error: `رصيد "${name}" (${qtyBefore}) لا يكفي للمرتجع (${qty})` }
    }

    const qtyAfter = qtyBefore - qty
    const { error: updErr } = await supabase.from('materials').update({ qty: qtyAfter }).eq('id', mat.id)
    if (updErr) return { ok: false, error: updErr.message }

    const { error: ledErr } = await supabase.from('stock_ledger').insert({
      tenant_id:         params.tenantId,
      branch_id:           params.branchId,
      txn_number:          voucherNo,
      type:                'صرف',
      movement_category:   'مرتجع_مورد',
      mat_name:            name,
      unit:                item.unit || mat.unit || 'وحدة',
      qty,
      qty_before:          qtyBefore,
      qty_after:           qtyAfter,
      wh_name:             whName,
      vendor_name:         params.vendorName,
      doc_code:            params.returnNumber,
      dispatch_note:       `مرتجع مشتريات ${params.returnNumber}`,
    })
    if (ledErr) return { ok: false, error: ledErr.message }
  }

  return { ok: true }
}
