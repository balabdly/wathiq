// PMC — SEC Project Material Control types

export type OwnershipType = 'CUSTODY' | 'COMPANY'
export type ReservationStatus = 'OPEN' | 'PARTIAL' | 'RECONCILED' | 'CLOSED'
export type BoqVersionType = 'INITIAL' | 'VARIATION' | 'AS_BUILT'
export type BoqVersionStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'CLOSED'
export type VoucherType = 'RECEIVE' | 'ISSUE' | 'RETURN_WH' | 'RETURN_CLIENT' | 'TRANSFER'
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'

export type MaterialReservation = {
  id: number
  tenant_id: string
  project_id: number
  reservation_no: string
  ownership_type: OwnershipType
  boq_version_id?: number | null
  client_name?: string | null
  status: ReservationStatus
  opened_at: string
  closed_at?: string | null
  notes?: string | null
  created_by?: string | null
  project?: { id: number; name: string }
}

export type ProjectBoqVersion = {
  id: number
  tenant_id: string
  project_id: number
  version_type: BoqVersionType
  version_no: number
  parent_version_id?: number | null
  status: BoqVersionStatus
  variation_ref?: string | null
  effective_date?: string | null
  notes?: string | null
  lines?: ProjectBoqLine[]
}

export type ProjectBoqLine = {
  id?: number
  tenant_id?: string
  boq_version_id?: number
  line_no: number
  material_id?: number | null
  catalog_no?: string | null
  description: string
  unit: string
  qty_planned: number
  notes?: string | null
  line_category?: 'MATERIAL' | 'WORK' | null
}

export type InventoryVoucherLine = {
  material_id: number
  qty: number
  note?: string
}

export type PostInventoryVoucherPayload = {
  tenant_id: string
  branch_id: number
  voucher_type: VoucherType
  ownership_type?: OwnershipType
  warehouse_id?: number
  to_warehouse_id?: number
  project_id?: number
  reservation_id?: number
  movement_category?: string
  booking_no?: string
  doc_code?: string
  client_name?: string
  exit_permit_no?: string
  vendor_name?: string
  return_type?: string
  project_name?: string
  wh_name?: string
  notes?: string
  attachment_url?: string
  lines: InventoryVoucherLine[]
}

export type ReservationReconciliation = {
  tenant_id: string
  project_id: number
  reservation_id: number
  reservation_no: string
  reservation_status: ReservationStatus
  material_id: number
  material_name: string
  unit: string
  ownership_type: OwnershipType
  qty_received: number
  qty_issued: number
  qty_returned_wh: number
  qty_returned_client: number
  qty_on_hand: number
  qty_net_consumed: number
}

export type BoqVariationOrder = {
  id: number
  tenant_id: string
  project_id: number
  variation_no: string
  adjustment_request_id?: string | null
  parent_boq_version_id?: number | null
  new_boq_version_id?: number | null
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'REJECTED'
  reason?: string | null
  sec_reference?: string | null
  approved_at?: string | null
  notes?: string | null
  created_at: string
  parent_version?: ProjectBoqVersion
  new_version?: ProjectBoqVersion
}

export type MaterialReconciliation = {
  id: number
  tenant_id: string
  project_id: number
  reservation_id: number
  boq_version_id?: number | null
  status: 'DRAFT' | 'FINAL' | 'CLOSED'
  reconciled_at?: string | null
  notes?: string | null
  lines?: MaterialReconciliationLine[]
}

export type MaterialReconciliationLine = {
  id: number
  material_id?: number | null
  material_name: string
  unit?: string | null
  qty_boq: number
  qty_received: number
  qty_issued: number
  qty_returned_client: number
  qty_on_hand: number
  qty_surplus: number
  variance: number
}

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  RECEIVE: 'استلام',
  ISSUE: 'صرف',
  RETURN_WH: 'إرجاع للمستودع',
  RETURN_CLIENT: 'إرجاع للعميل',
  TRANSFER: 'تحويل',
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  OPEN: 'مفتوح',
  PARTIAL: 'جزئي',
  RECONCILED: 'مطابق',
  CLOSED: 'مغلق',
}

export const BOQ_VERSION_TYPE_LABELS: Record<BoqVersionType, string> = {
  INITIAL: 'مقايسة أولية',
  VARIATION: 'أمر تغيير',
  AS_BUILT: 'كما بُني',
}

export const VARIATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  APPROVED: 'معتمد',
  APPLIED: 'مُطبَّق',
  REJECTED: 'مرفوض',
}
