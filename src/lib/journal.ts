import { supabase } from './supabase'

export type JournalLineInput = {
  accountCode: string
  debit: number
  credit: number
  description?: string
}

export type CreateJournalEntryParams = {
  date: string
  description: string
  referenceType: string
  referenceId: number
  source?: string
  lines: JournalLineInput[]
  /** تجنّب تكرار القيد لنفس المرجع (افتراضي: true) */
  skipIfExists?: boolean
}

export type JournalEntryResult = {
  success: boolean
  entryId?: number
  skipped?: boolean
  error?: string
}

export async function getAccountId(tenantId: string, code: string): Promise<number | null> {
  const { data } = await supabase
    .from('finance_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .maybeSingle()
  return data?.id ?? null
}

export async function getCashAccountCode(tenantId: string, cashAccountId: number): Promise<string> {
  const { data: ca } = await supabase
    .from('finance_cash_accounts')
    .select('account_id')
    .eq('id', cashAccountId)
    .maybeSingle()
  if (!ca?.account_id) return '1111'
  const { data: acc } = await supabase
    .from('finance_accounts')
    .select('code')
    .eq('id', ca.account_id)
    .maybeSingle()
  return acc?.code || '1111'
}

export async function journalEntryExists(
  tenantId: string,
  referenceType: string,
  referenceId: number
): Promise<boolean> {
  const { count } = await supabase
    .from('finance_journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('status', 'معتمد')
  return (count || 0) > 0
}

/** رصيد الحركة الصافية حسب طبيعة الحساب (مدين / دائن) */
export function signedAccountBalance(
  debit: number,
  credit: number,
  normalBalance: string
): number {
  const d = Number(debit || 0)
  const c = Number(credit || 0)
  return normalBalance === 'دائن' ? c - d : d - c
}

/** حساب المصروف المدين حسب النوع والفئة */
export function resolveExpenseAccountCode(expenseType: string, category: string): string {
  const cat = category || ''
  if (expenseType === 'مشاريع') {
    if (cat.includes('عمالة')) return '5110'
    if (cat.includes('مقاول')) return '5130'
    if (cat.includes('موقع')) return '5140'
    return '5120'
  }
  if (expenseType === 'إداري') {
    if (cat.includes('إيجار')) return '5310'
    if (cat.includes('تسويق')) return '5340'
    if (cat.includes('صيانة')) return '5330'
    return '5320'
  }
  if (expenseType === 'تشغيلي') {
    if (cat.includes('مركبة') || cat.includes('سيارة')) return '5410'
    if (cat.includes('بنك')) return '5510'
    return '5320'
  }
  return '5800'
}

export async function createJournalEntry(
  tenantId: string,
  params: CreateJournalEntryParams
): Promise<JournalEntryResult> {
  const activeLines = params.lines.filter(l => l.debit > 0 || l.credit > 0)
  if (activeLines.length < 2) {
    return { success: false, error: 'القيد يتطلب طرفين على الأقل' }
  }

  if (params.skipIfExists !== false) {
    const exists = await journalEntryExists(tenantId, params.referenceType, params.referenceId)
    if (exists) return { success: true, skipped: true }
  }

  const lineIds = await Promise.all(
    activeLines.map(async l => ({
      ...l,
      account_id: await getAccountId(tenantId, l.accountCode),
    }))
  )

  const missing = lineIds.filter(l => !l.account_id)
  if (missing.length > 0) {
    const codes = missing.map(l => l.accountCode).join('، ')
    return { success: false, error: `حسابات غير موجودة في شجرة الحسابات: ${codes}` }
  }

  const totalDebit  = Math.round(lineIds.reduce((s, l) => s + l.debit,  0) * 100) / 100
  const totalCredit = Math.round(lineIds.reduce((s, l) => s + l.credit, 0) * 100) / 100

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `القيد غير متوازن — مدين ${totalDebit.toLocaleString()} ≠ دائن ${totalCredit.toLocaleString()}`,
    }
  }

  const { count } = await supabase
    .from('finance_journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const entryNumber = `JE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

  const { data: entry, error } = await supabase
    .from('finance_journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_number: entryNumber,
      entry_date: params.date,
      description: params.description,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'معتمد',
      entry_source: params.source || 'آلي',
    })
    .select('id')
    .single()

  if (error || !entry) {
    return { success: false, error: error?.message || 'فشل إنشاء القيد المحاسبي' }
  }

  const { error: linesError } = await supabase.from('finance_journal_lines').insert(
    lineIds.map(l => ({
      entry_id: entry.id,
      account_id: l.account_id!,
      debit: l.debit,
      credit: l.credit,
      description: l.description || null,
    }))
  )

  if (linesError) {
    return { success: false, error: linesError.message }
  }

  return { success: true, entryId: entry.id }
}
