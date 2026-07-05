// src/lib/sales-types.ts
// أنواع مشتركة لوحدة المبيعات — تُستورد من layout.tsx وكل صفحات التبويبات

export type Client = {
  id: number; tenant_id: string; name: string; name_en?: string
  vat_number?: string; cr_number?: string; client_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country: string; phone?: string; email?: string; contact_person?: string
  is_active: boolean; notes?: string
}

export type InvoiceItem = {
  id?: number; description: string; quantity: number; unit: string; unit_price: number; total: number
}

export type CatalogItem = {
  id: number; name: string; item_type: string; unit: string; unit_price: number; is_active: boolean
}

export type Invoice = {
  id: number; invoice_number: string; invoice_date: string; due_date?: string
  client_id?: number; client_name: string; client_vat?: string; client_cr?: string; client_address?: string
  project_id?: number; extract_ref?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string; created_by?: string
  client?: Client; project?: { name: string }
}

export type CreditNote = {
  id: number; note_number: string; note_date: string; note_type: string
  original_invoice_id?: number; client_id?: number; client_name: string; client_vat?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  reason?: string; status: string; notes?: string; created_by?: string
  original_invoice?: { invoice_number: string }
}

export type Quotation = {
  id: number; quote_number: string; quote_date: string; valid_until?: string
  client_id?: number; client_name: string; client_vat?: string
  project_id?: number; subtotal: number; vat_amount: number; total_amount: number
  vat_rate: number; status: string; notes?: string; terms?: string; created_by?: string
  client?: Client; project?: { name: string }
}

export type Company = {
  name: string; name_en?: string; vat_number?: string; cr_number?: string
  city?: string; district?: string; street?: string; postal_code?: string
  phone?: string; email?: string; iban?: string; ceo_name?: string
}

export type Project     = { id: number; name: string }
export type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string; account_id?: string; account_code?: string
}

export const INV_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مدفوعة': 'badge-green',
  'ملغاة': 'badge-red', 'متأخرة': 'badge-red', 'إشعار جزئي': 'badge-amber', 'مسدد بإشعار': 'badge-red'
}
export const QUOTE_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مقبولة': 'badge-green',
  'مرفوضة': 'badge-red', 'منتهية': 'badge-gray'
}
