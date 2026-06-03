// src/components/inventory/types.ts

export type InventoryMaterial = {
  id: number
  catalog_no: string
  sec_number?: string
  sku?: string
  name: string
  unit: string
  qty: number
  reorder: number
  warehouse_id: number
  source: 'كهرباء' | 'خاص'
  notes?: string
  location?: string
  tenant_id: string
  branch_id: number
}

export type InventoryWarehouse = {
  id: number
  name: string
  location?: string
  stock_type?: string
  wh_type?: 'projects' | 'returns' | 'scrap' | 'private' | string
  sections?: string[]
  tenant_id: string
  branch_id: number
}

export type InventoryLedger = {
  id: number
  tenant_id: string
  branch_id: number
  type: string
  mat_name: string
  unit: string
  qty: number
  qty_before: number
  qty_after: number
  wh_name: string
  project_name?: string
  vendor_name?: string
  dispatch_note?: string
  doc_code?: string
  clearance_no?: string
  is_loan?: boolean
  created_at: string
}

export const WH_TYPES = [
  { type: 'projects', label: 'مستودع المشاريع (SEC)', icon: '⚡', color: '#1a56db', desc: 'مواد عهدة من شركة الكهرباء' },
  { type: 'returns',  label: 'مستودع الرجيع',         icon: '↩️', color: '#0ea77b', desc: 'مواد فائضة سليمة للإرجاع' },
  { type: 'scrap',    label: 'مستودع السكراب',         icon: '🗑️', color: '#e6820a', desc: 'مواد تالفة لإرجاع للكهرباء' },
  { type: 'private',  label: 'المستودع الخاص',          icon: '🏢', color: '#6b7280', desc: 'مواد السلامة والبناء والمعدات' },
] as const

export const TX_COLORS: Record<string, string> = {
  'توريد':            'badge-green',
  'صرف':              'badge-red',
  'إرجاع للكهرباء':  'badge-amber',
  'تحويل لمشروع':    'badge-green',
  'نقل مخزني':       'badge-blue',
}

export const PAGE_SIZE = 25
