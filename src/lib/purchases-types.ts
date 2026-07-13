// src/lib/purchases-types.ts
// أنواع مشتركة لوحدة المشتريات — تُستورد من layout.tsx وكل صفحات التبويبات
// أي تعديل هنا ينعكس على كل الصفحات فوراً

export type Vendor = {
  id: number; tenant_id: string; name: string; name_en?: string
  vat_number?: string; cr_number?: string; vendor_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country: string; phone?: string; email?: string
  contact_person?: string; iban?: string; is_active: boolean; notes?: string
}

export type POItem = {
  id?: number; description: string; quantity: number; unit: string; unit_price: number; total: number
}

export type PurchaseOrder = {
  id: number; po_number: string; po_date: string; expected_date?: string
  vendor_id?: number; vendor_name: string; vendor_vat?: string
  project_id?: number; delivery_to: string; warehouse_id?: number
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string; has_invoice?: boolean; created_by?: string
  source_module?: string; fleet_work_order_id?: number
  vendor?: Vendor; project?: { name: string }
  fleet_wo?: { wo_no: string; service_confirmed_at?: string | null }
}

export type VendorInvoice = {
  id: number; invoice_number: string; invoice_date: string; due_date?: string
  vendor_id?: number; vendor_name: string; vendor_vat?: string
  po_id?: number; project_id?: number; delivery_to: string; warehouse_id?: number
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string; created_by?: string
  vendor?: Vendor; project?: { name: string }
  po?: { po_number: string }
}

export type PurchaseReturn = {
  id: number; return_number: string; return_date: string; return_type: string
  original_invoice_id?: number; vendor_id?: number; vendor_name: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  reason?: string; status: string; notes?: string; created_by?: string
}

export type DebitNote = {
  id: number; note_number: string; note_date: string
  original_invoice_id?: number; invoice_number?: string
  vendor_id?: number; vendor_name: string; vendor_vat?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  reason?: string; status: string; notes?: string; created_by?: string
}

export type Project    = { id: number; name: string }
export type Warehouse   = { id: number; name: string; wh_type: string }
export type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string
  account_id?: number; account_code?: string
}

export const PO_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسل': 'badge-blue', 'مفتوحة': 'badge-blue',
  'مستلم جزئياً': 'badge-amber', 'مستلم': 'badge-green', 'ملغي': 'badge-red'
}
export const INV_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'معتمدة': 'badge-blue', 'مدفوعة': 'badge-green',
  'متأخرة': 'badge-red', 'ملغاة': 'badge-red', 'مرتجعة': 'badge-gray', 'مدفوعة جزئياً': 'badge-amber'
}
