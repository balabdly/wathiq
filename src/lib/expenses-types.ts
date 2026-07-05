// src/lib/expenses-types.ts
export type Expense = {
  id: number; expense_number: string; expense_date: string
  category: string; description: string
  amount: number; vat_amount: number; total_amount: number; vat_rate: number
  expense_type: string; account_id?: number; cost_center_id?: number
  project_id?: number; vendor_id?: number; vendor_name?: string
  receipt_no?: string; payment_method: string; cash_account_id?: number; status: string; notes?: string
  account?: { code: string; name: string }
  cost_center?: { name: string }
  project?: { name: string }
  vendor?: { name: string }
}
export type Transaction = {
  id: number; transaction_no: string; transaction_date: string
  type: string; amount: number; description: string
  cash_account_id?: number; payment_method: string
  reference_type?: string; reference_no?: string
  account_id?: number; cost_center_id?: number
  project_id?: number
  party_name?: string; status: string; notes?: string
  cash_account?: { name: string }
  account?: { code: string; name: string }
  project?: { name: string }
}
export type Account     = { id: number; code: string; name: string; account_type: string }
export type CostCenter  = { id: number; code: string; name: string }
export type Project     = { id: number; name: string }
export type Vendor      = { id: number; name: string }
export type Client      = { id: number; name: string }
export type CashAccount = { id: number; name: string; account_type: string; account_id?: number }

// تصنيفات المصروفات
export const CATEGORIES: Record<string, string[]> = {
  'مشاريع': ['مواد ومستلزمات الموقع', 'عمالة مباشرة', 'مقاولون فرعيون', 'نقل ومواصلات الموقع', 'معدات وآلات', 'مصروفات موقع أخرى'],
  'تشغيلي': ['رواتب وأجور', 'إيجار مكتب', 'كهرباء وماء', 'اتصالات وإنترنت', 'صيانة وإصلاح', 'تأمينات اجتماعية', 'مصروفات سيارات', 'وقود', 'مصروفات تشغيلية أخرى'],
  'إداري':  ['قرطاسية ومستلزمات مكتبية', 'ضيافة وعلاقات عامة', 'رسوم ترخيص واشتراكات', 'تدريب وتطوير', 'سفر وانتقالات', 'مصروفات بنكية', 'غرامات وجزاءات', 'مصروفات إدارية أخرى'],
}

export const STATUS_COLOR: Record<string, string> = { 'مدفوع': 'badge-green', 'معلق': 'badge-amber', 'ملغي': 'badge-red', 'معتمد': 'badge-green' }
export const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  'مشاريع': { bg: '#eff6ff', color: '#1a56db' },
  'تشغيلي': { bg: '#fffbeb', color: '#e6820a' },
  'إداري':  { bg: '#fef2f2', color: '#c81e1e' },
}

export const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
