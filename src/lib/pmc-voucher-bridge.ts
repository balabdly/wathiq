import type { OwnershipType, PostInventoryVoucherPayload, VoucherType } from '@/lib/pmc-types'
import { postInventoryVoucher } from '@/lib/pmc-service'

export type OpType = 'استلام' | 'صرف' | 'إرجاع' | 'تحويل'

export type OperationFormInput = {
  warehouse_id: string
  to_warehouse_id?: string
  project_id: string
  project_name: string
  vendor_name?: string
  doc_code?: string
  booking_no?: string
  client_name_recv?: string
  exit_permit_no?: string
  return_type?: string
  reservation_id?: string
}

export type OperationRow = { mat_id: string | number; qty: string | number; note?: string }

/** يحدد نوع الإذن وملكية المادة من نوع العملية وسياق المستودع */
export function resolveVoucherMapping(
  type: OpType,
  isProjectWh: boolean,
  projectId: string,
  returnType?: string,
): { voucherType: VoucherType; ownership: OwnershipType; movementCategory: string; requiresReservation: boolean } {
  const hasProject = !!projectId

  if (type === 'تحويل') {
    return { voucherType: 'TRANSFER', ownership: 'COMPANY', movementCategory: 'تحويل', requiresReservation: false }
  }
  if (type === 'استلام') {
    if (isProjectWh && hasProject) {
      return { voucherType: 'RECEIVE', ownership: 'CUSTODY', movementCategory: 'استلام_عهدة', requiresReservation: true }
    }
    return { voucherType: 'RECEIVE', ownership: 'COMPANY', movementCategory: 'استلام_عام', requiresReservation: false }
  }
  if (type === 'صرف') {
    if (isProjectWh && hasProject) {
      return { voucherType: 'ISSUE', ownership: 'CUSTODY', movementCategory: 'صرف_عهدة', requiresReservation: true }
    }
    return { voucherType: 'ISSUE', ownership: 'COMPANY', movementCategory: 'صرف_عام', requiresReservation: false }
  }
  // إرجاع
  if (isProjectWh && hasProject) {
    return { voucherType: 'RETURN_CLIENT', ownership: 'CUSTODY', movementCategory: 'ارجاع_عميل', requiresReservation: true }
  }
  if (returnType === 'فائض') {
    return { voucherType: 'RECEIVE', ownership: 'COMPANY', movementCategory: 'ارجاع_مستودع', requiresReservation: false }
  }
  return { voucherType: 'RETURN_CLIENT', ownership: 'COMPANY', movementCategory: 'ارجاع_عميل', requiresReservation: false }
}

/** هل العملية تدعم RPC الذرّي؟ (كل الأنواع عدا السكراب بدون مشروع) */
export function canUseAtomicVoucher(type: OpType, isProjectWh: boolean, projectId: string, returnType?: string): boolean {
  if (type === 'إرجاع' && returnType === 'سكراب' && !(isProjectWh && projectId)) return false
  return true
}

export function buildVoucherPayload(
  type: OpType,
  tenantId: string,
  branchId: number,
  form: OperationFormInput,
  rows: OperationRow[],
  opts: { isProjectWh: boolean; whName?: string; attachmentUrl?: string | null },
): PostInventoryVoucherPayload {
  const mapping = resolveVoucherMapping(type, opts.isProjectWh, form.project_id, form.return_type)
  return {
    tenant_id: tenantId,
    branch_id: branchId,
    voucher_type: mapping.voucherType,
    ownership_type: mapping.ownership,
    warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
    to_warehouse_id: form.to_warehouse_id ? Number(form.to_warehouse_id) : undefined,
    project_id: form.project_id ? Number(form.project_id) : undefined,
    reservation_id: form.reservation_id ? Number(form.reservation_id) : undefined,
    movement_category: mapping.movementCategory,
    booking_no: form.booking_no || undefined,
    doc_code: form.doc_code || undefined,
    client_name: form.client_name_recv || undefined,
    exit_permit_no: form.exit_permit_no || undefined,
    vendor_name: form.vendor_name || undefined,
    return_type: type === 'إرجاع' ? form.return_type : undefined,
    project_name: form.project_name || undefined,
    wh_name: opts.whName,
    attachment_url: opts.attachmentUrl || undefined,
    lines: rows.map(r => ({
      material_id: Number(r.mat_id),
      qty: Number(r.qty),
      note: r.note || undefined,
    })),
  }
}

/** ترحيل عملية مخزنية عبر RPC ذرّي */
export async function submitOperationVoucher(
  type: OpType,
  tenantId: string,
  branchId: number,
  form: OperationFormInput,
  rows: OperationRow[],
  opts: { isProjectWh: boolean; whName?: string; attachmentUrl?: string | null },
) {
  const mapping = resolveVoucherMapping(type, opts.isProjectWh, form.project_id, form.return_type)

  if (mapping.requiresReservation && !form.reservation_id) {
    return { data: null, error: { message: 'يجب اختيار حجز المواد (رقم الحجز) لعمليات عهدة SEC' } }
  }

  const payload = buildVoucherPayload(type, tenantId, branchId, form, rows, opts)
  return postInventoryVoucher(payload)
}

/** مرتجع موقع → RETURN_WH */
export async function submitSiteReturnVoucher(
  tenantId: string,
  branchId: number,
  opts: {
    warehouseId: number
    whName?: string
    projectId: number
    projectName: string
    reservationId?: number
    bookingNo?: string
    notes?: string
    lines: { material_id: number; qty: number; note?: string }[]
  },
) {
  if (!opts.reservationId) {
    return { data: null, error: { message: 'يجب اختيار حجز المواد لمرتجع الموقع' } }
  }
  return postInventoryVoucher({
    tenant_id: tenantId,
    branch_id: branchId,
    voucher_type: 'RETURN_WH',
    ownership_type: 'CUSTODY',
    warehouse_id: opts.warehouseId,
    wh_name: opts.whName,
    project_id: opts.projectId,
    project_name: opts.projectName,
    reservation_id: opts.reservationId,
    booking_no: opts.bookingNo,
    movement_category: 'مرتجع_موقع',
    notes: opts.notes,
    lines: opts.lines,
  })
}
