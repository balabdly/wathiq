// src/lib/accounting-types.ts
// أنواع مشتركة لوحدة الحسابات العامة

export type Account = {
  id: number; tenant_id: string; code: string; name: string; name_en?: string
  account_type: string; account_class: string; parent_id?: number
  level: number; is_parent: boolean; normal_balance: string
  is_active: boolean; notes?: string
  children?: Account[]
  balance?: number
}
export type CostCenter = {
  id: number; tenant_id: string; code: string; name: string
  type: string; project_id?: number; is_active: boolean; notes?: string
  project?: { name: string }
}
export type JournalEntry = {
  id: number; tenant_id: string; entry_number: string; entry_date: string
  description: string; reference_type?: string; reference_id?: number
  total_debit: number; total_credit: number; status: string
  lines?: JournalLine[]
}
export type JournalLine = {
  id?: number; entry_id?: number; account_id: number; cost_center_id?: number
  debit: number; credit: number; description?: string
  account?: Account; cost_center?: CostCenter
}
export type AccountLedgerLine = {
  id: number
  entry_id: number
  entry_number: string
  entry_date: string
  description: string
  debit: number
  credit: number
  entry_source: string
  reference_type?: string
  reference_id?: number
  running_balance: number
}

export const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  'أصول': '#1a56db', 'خصوم': '#c81e1e', 'حقوق ملكية': '#0ea77b',
  'إيرادات': '#0ea77b', 'تكلفة': '#e6820a', 'مصروفات': '#6b7280'
}

export const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
