/**
 * journal.ts — دالة القيود المحاسبية المشتركة
 *
 * تُستخدم من: invoices, purchases, expenses, treasury, HR
 *
 * التحسينات مقارنة بالنسخ القديمة:
 *  1. batch query واحد لجلب كل account_ids بدل N queries
 *  2. يستخدم دالة SQL get_account_ids_by_codes() من قاعدة البيانات
 *  3. entry_source مدعوم (آلي / يدوي)
 *  4. أسطر بدون حساب تُتجاهل بدل إلغاء القيد كاملاً
 *  5. رقم القيد يُولَّد بشكل آمن
 */

import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { ACC } from '@/lib/account-codes'

// ════════════════════════════════════
// Types
// ════════════════════════════════════
export type JournalLine = {
  accountCode: string
  debit:       number
  credit:      number
  description?: string
  costCenterId?: number
}

export type CreateJournalParams = {
  tenantId:      string
  date:          string
  description:   string
  referenceType: string
  referenceId?:  number
  lines:         JournalLine[]
  source?:       'آلي' | 'يدوي'
}

export type JournalResult = {
  entryId:   number
  entryNumber: string
  skippedCodes: string[]   // أكواد لم يُعثر عليها في الشجرة
} | null

// ════════════════════════════════════
// ترقيم المستندات — ذرّي عبر قاعدة البيانات
// ════════════════════════════════════
/**
 * توليد رقم مستند تسلسلي آمن (JE / INV / VINV / CN / QT / PO / CUS / LN / TRF ...)
 * يعتمد على دالة SQL next_doc_number() — UPSERT ذرّي على finance_doc_sequences
 * يضمن: لا تكرار مع التزامن، لا فجوات بسبب الحذف، تسلسل متوافق مع ZATCA
 */
export async function nextDocNumber(tenantId: string, docType: string, prefix: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_doc_number', {
    p_tenant_id: tenantId,
    p_doc_type:  docType,
    p_prefix:    prefix,
  })
  if (error || !data) {
    console.error('[docNumber] فشل توليد الرقم:', error?.message)
    return null
  }
  return data as string
}

// ════════════════════════════════════
// ضابط الرصيد النقدي قبل الصرف
// ════════════════════════════════════
/** رصيد حساب نقدي من دفتر الأستاذ (القيود المعتمدة) — مصدر الحقيقة الوحيد */
export async function getCashLedgerBalance(tenantId: string, cashAccountId: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_cash_account_balances', { p_tenant_id: tenantId })
  if (error || !data) return null
  const row = (data as any[]).find(b => Number(b.cash_account_id) === Number(cashAccountId))
  return row ? Number(row.ledger_balance) : 0
}

/**
 * ضابط الصرف من حساب نقدي — الممارسة المحاسبية القياسية:
 * - صندوق نقدي: منع نهائي إذا الرصيد لا يكفي (لا يوجد كاش سالب فيزيائياً)
 * - حساب بنكي: تحذير مع سماح (سحب على المكشوف / Overdraft — يُعاد تصنيفه كالتزام في القوائم)
 * ترجع true للسماح بإتمام العملية
 */
export async function confirmCashSpend(
  tenantId: string,
  account: { id: number; name: string; account_type: string },
  amount: number
): Promise<boolean> {
  const balance = await getCashLedgerBalance(tenantId, account.id)
  if (balance === null) return true   // تعذر الفحص — لا نعطل العملية
  if (amount <= balance + 0.001) return true

  const isBox = account.account_type === 'صندوق' || account.account_type === 'نقدية'
  if (isBox) {
    const { default: toast } = await import('react-hot-toast')
    toast.error(`⛔ رصيد الصندوق "${account.name}" الحالي ${balance.toLocaleString()} ر.س لا يكفي لصرف ${amount.toLocaleString()} ر.س — الصندوق لا يقبل رصيداً سالباً`, { duration: 6000 })
    return false
  }
  return confirm(
    `⚠️ رصيد "${account.name}" الحالي: ${balance.toLocaleString()} ر.س\n` +
    `صرف ${amount.toLocaleString()} ر.س سيجعل الرصيد سالباً (سحب على المكشوف).\n\n` +
    `هل تريد المتابعة؟`
  )
}

/** نفس ضابط الصرف لكن بمعرّف الحساب فقط — يجلب بياناته بنفسه (للمودالات التي لا تملك قائمة الحسابات) */
export async function confirmCashSpendById(tenantId: string, cashAccountId: number, amount: number): Promise<boolean> {
  const { data } = await supabase.from('finance_cash_accounts')
    .select('id, name, account_type')
    .eq('id', cashAccountId).single()
  if (!data) return true
  return confirmCashSpend(tenantId, data as { id: number; name: string; account_type: string }, amount)
}

// ════════════════════════════════════
// الفترات المحاسبية
// ════════════════════════════════════
/** هل الفترة الشهرية لتاريخ معين مفتوحة للترحيل؟ (الفترة مفتوحة ما لم يوجد صف يقفلها) */
export async function isPeriodOpen(tenantId: string, date: string): Promise<boolean> {
  const d = new Date(date)
  const { data } = await supabase.from('finance_fiscal_periods')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('year', d.getFullYear())
    .eq('month', d.getMonth() + 1)
    .eq('status', 'مقفلة')
    .maybeSingle()
  return !data
}

// ════════════════════════════════════
// الدالة الرئيسية
// ════════════════════════════════════
export async function createJournalEntry(
  params: CreateJournalParams
): Promise<JournalResult> {

  const { tenantId, date, description, referenceType, referenceId, lines, source = 'آلي' } = params

  // ══ 1. جلب كل account_ids بـ query واحد (بدل N queries) ══
  const uniqueCodes = Array.from(new Set(lines.map(l => l.accountCode)))

  const { data: accountRows, error: accError } = await supabase
    .rpc('get_account_ids_by_codes', {
      p_tenant_id: tenantId,
      p_codes:     uniqueCodes,
    })

  if (accError) {
    console.error('[journal] خطأ في جلب الحسابات:', accError.message)
    return null
  }

  // بناء Map: code → account_id
  const codeMap = new Map<string, number>(
    (accountRows || []).map((r: { code: string; account_id: number }) => [r.code, r.account_id])
  )

  // تحديد الأكواد غير الموجودة — رفض القيد بدل التجاهل الصامت
  const skippedCodes = uniqueCodes.filter(c => !codeMap.has(c))
  if (skippedCodes.length > 0) {
    console.error('[journal] أكواد حسابات غير موجودة:', skippedCodes)
    const { default: toast } = await import('react-hot-toast')
    toast.error(`⛔ لا يمكن إنشاء القيد — الحسابات التالية غير موجودة في شجرة الحسابات: ${skippedCodes.join('، ')}`, { duration: 7000 })
    return null
  }

  // رفض الترحيل على حسابات تجميعية (is_parent)
  const { data: parentAccounts } = await supabase
    .from('finance_accounts')
    .select('code, name')
    .eq('tenant_id', tenantId)
    .in('code', uniqueCodes)
    .eq('is_parent', true)

  if (parentAccounts && parentAccounts.length > 0) {
    const { default: toast } = await import('react-hot-toast')
    const labels = parentAccounts.map(a => `${a.code} (${a.name})`).join('، ')
    toast.error(`⛔ لا يمكن الترحيل على حسابات تجميعية: ${labels}`, { duration: 7000 })
    return null
  }

  // فلترة الأسطر ذات المبالغ فقط
  const validLines = lines.filter(l => l.debit > 0 || l.credit > 0)

  if (validLines.length < 2) {
    console.error('[journal] أسطر غير كافية للقيد')
    const { default: toast } = await import('react-hot-toast')
    toast.error('⛔ القيد يحتاج سطرين على الأقل بمبالغ موجبة', { duration: 5000 })
    return null
  }

  const totalDebit  = validLines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = validLines.reduce((s, l) => s + l.credit, 0)

  // تحقق التوازن (تسامح 0.01 للكسور)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error('[journal] قيد غير متوازن:', { totalDebit, totalCredit })
    return null
  }

  // ══ 1.5 فحص الفترة المحاسبية — رسالة واضحة قبل الوصول لحارس قاعدة البيانات ══
  if (!(await isPeriodOpen(tenantId, date))) {
    const d = new Date(date)
    const { default: toast } = await import('react-hot-toast')
    toast.error(`🔒 الفترة المحاسبية ${d.getMonth() + 1}/${d.getFullYear()} مقفلة — لا يمكن الترحيل فيها. افتحها من المحاسبة ← الفترات المحاسبية`, { duration: 7000 })
    return null
  }

  // ══ 2. توليد رقم القيد — ذرّي عبر sequence في قاعدة البيانات ══
  // لا race conditions ولا تكرار: UPSERT ذرّي على finance_doc_sequences
  const entryNumber = await nextDocNumber(tenantId, 'JE', 'JE')
  if (!entryNumber) {
    console.error('[journal] فشل توليد رقم القيد')
    return null
  }

  // ══ 3. إدراج رأس القيد ══
  const { data: entry, error: entryError } = await supabase
    .from('finance_journal_entries')
    .insert({
      tenant_id:      tenantId,
      entry_number:   entryNumber,
      entry_date:     date,
      description,
      reference_type: referenceType,
      reference_id:   referenceId ?? null,
      total_debit:    totalDebit,
      total_credit:   totalCredit,
      status:         'معتمد',
      entry_source:   source,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    console.error('[journal] خطأ في إنشاء القيد:', entryError?.message)
    return null
  }

  // ══ 4. إدراج أسطر القيد (batch insert واحد) ══
  const { error: linesError } = await supabase
    .from('finance_journal_lines')
    .insert(
      validLines.map(l => ({
        entry_id:       entry.id,
        account_id:     codeMap.get(l.accountCode)!,
        debit:          l.debit,
        credit:         l.credit,
        description:    l.description || null,
        cost_center_id: l.costCenterId ?? null,
      }))
    )

  if (linesError) {
    console.error('[journal] خطأ في إدراج الأسطر:', linesError.message)
    // القيد أُنشئ لكن الأسطر فشلت — نحذفه للحفاظ على التوازن
    await supabase.from('finance_journal_entries').delete().eq('id', entry.id)
    return null
  }

  await logAudit({
    tenantId: tenantId,
    tableName: 'finance_journal_entries',
    recordId: entry.id,
    action: 'INSERT',
    newData: { entry_number: entryNumber, description, total_debit: totalDebit, total_credit: totalCredit },
  })

  return {
    entryId:      entry.id,
    entryNumber,
    skippedCodes,
  }
}

// ════════════════════════════════════
// دوال مساعدة للقيود الشائعة
// ════════════════════════════════════

/**
 * قيد فاتورة مبيعات
 * مدين: ذمم العملاء (1210) بالإجمالي
 * دائن: الإيرادات (4110) بالصافي + ضريبة المحصّلة (2320)
 */
export async function journalSalesInvoice(params: {
  tenantId:      string
  date:          string
  invoiceNumber: string
  clientName:    string
  invoiceId:     number
  subtotal:      number
  vatAmount:     number
  total:         number
}): Promise<JournalResult> {
  const lines: JournalLine[] = [
    { accountCode: ACC.CUSTOMER_RECEIVABLE, debit: params.total,    credit: 0,              description: `فاتورة ${params.invoiceNumber}` },
    { accountCode: ACC.SALES_REVENUE,       debit: 0,               credit: params.subtotal, description: `إيرادات ${params.invoiceNumber}` },
  ]
  if (params.vatAmount > 0) {
    lines.push({ accountCode: ACC.VAT_OUTPUT, debit: 0, credit: params.vatAmount, description: 'ضريبة القيمة المضافة المحصّلة' })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `فاتورة مبيعات ${params.invoiceNumber} — ${params.clientName}`,
    referenceType: 'فاتورة مبيعات',
    referenceId:   params.invoiceId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد تحصيل فاتورة مبيعات
 * مدين: البنك / الصندوق
 * دائن: الذمم المدينة (1120)
 */
export async function journalSalesCollection(params: {
  tenantId:       string
  date:           string
  invoiceNumber:  string
  clientName:     string
  invoiceId:      number
  amount:         number
  cashAccountCode: string   // كود الحساب البنكي / الصندوق
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `تحصيل فاتورة ${params.invoiceNumber} — ${params.clientName}`,
    referenceType: 'تحصيل فاتورة',
    referenceId:   params.invoiceId,
    lines: [
      { accountCode: params.cashAccountCode, debit: params.amount, credit: 0,              description: `تحصيل ${params.invoiceNumber}` },
      { accountCode: ACC.CUSTOMER_RECEIVABLE, debit: 0,             credit: params.amount,  description: `إقفال ذمة ${params.clientName}` },
    ],
    source: 'آلي',
  })
}

/**
 * قيد فاتورة مورد
 * مدين: المخزون/التكلفة/الأصل حسب وجهة التسليم
 * دائن: الذمم الدائنة (2110) بالإجمالي
 */
export async function journalVendorInvoice(params: {
  tenantId:         string
  date:             string
  invoiceNumber:    string
  vendorName:       string
  invoiceId:        number
  subtotal:         number
  vatAmount:        number
  total:            number
  debitAccountCode: string   // 1310 مخزون / 5120 تكلفة / 15xx أصول
}): Promise<JournalResult> {
  const lines: JournalLine[] = [
    { accountCode: params.debitAccountCode, debit: params.subtotal,   credit: 0,            description: `فاتورة ${params.invoiceNumber}` },
    { accountCode: ACC.SUPPLIER_PAYABLE,    debit: 0,                 credit: params.total,  description: `مستحق للمورد ${params.vendorName}` },
  ]
  if (params.vatAmount > 0) {
    lines.splice(1, 0, { accountCode: ACC.VAT_INPUT, debit: params.vatAmount, credit: 0, description: 'ضريبة المدخلات' })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `فاتورة مورد ${params.invoiceNumber} — ${params.vendorName}`,
    referenceType: 'فاتورة مورد',
    referenceId:   params.invoiceId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد سداد فاتورة مورد
 * مدين: الذمم الدائنة (2110)
 * دائن: البنك / الصندوق
 */
export async function journalVendorPayment(params: {
  tenantId:        string
  date:            string
  invoiceNumber:   string
  vendorName:      string
  invoiceId:       number
  amount:          number
  cashAccountCode: string
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `سداد فاتورة مورد ${params.invoiceNumber} — ${params.vendorName}`,
    referenceType: 'سداد فاتورة مورد',
    referenceId:   params.invoiceId,
    lines: [
      { accountCode: ACC.SUPPLIER_PAYABLE,    debit: params.amount, credit: 0,             description: `سداد ${params.invoiceNumber}` },
      { accountCode: params.cashAccountCode,  debit: 0,             credit: params.amount, description: `دفع عبر ${params.vendorName}` },
    ],
    source: 'آلي',
  })
}

/**
 * قيد مصروف
 * مدين: حساب المصروف
 * مدين: ضريبة المدخلات (إن وجدت)
 * دائن: البنك / الصندوق / الذمم الدائنة
 */
export async function journalExpense(params: {
  tenantId:           string
  date:               string
  description:        string
  category:           string
  expenseId:          number
  amount:             number
  vatAmount:          number
  total:              number
  expenseAccountCode: string
  creditAccountCode:  string   // بنك / صندوق / 2110
  costCenterId?:      number
}): Promise<JournalResult> {
  const cc = params.costCenterId
  const lines: JournalLine[] = [
    { accountCode: params.expenseAccountCode, debit: params.amount, credit: 0, description: params.description, costCenterId: cc },
  ]
  if (params.vatAmount > 0) {
    lines.push({ accountCode: ACC.VAT_INPUT, debit: params.vatAmount, credit: 0, description: `ضريبة مدخلات — ${params.category}`, costCenterId: cc })
  }
  lines.push({
    accountCode: params.creditAccountCode,
    debit:       0,
    credit:      params.total,
    description: `صرف مصروف ${params.category}`,
  })
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `مصروف — ${params.category} — ${params.description}`,
    referenceType: 'مصروف',
    referenceId:   params.expenseId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد إشعار دائن
 * مدين: الإيرادات (4110) بالصافي
 * مدين: ضريبة مستردة (2320)
 * دائن: ذمم العملاء (1210) بالإجمالي
 */
export async function journalCreditNote(params: {
  tenantId:   string
  date:       string
  noteNumber: string
  noteType:   string
  clientName: string
  noteId:     number
  subtotal:   number
  vatAmount:  number
  total:      number
}): Promise<JournalResult> {
  const lines: JournalLine[] = [
    { accountCode: ACC.SALES_REVENUE, debit: params.subtotal,  credit: 0,           description: `${params.noteType} ${params.noteNumber}` },
  ]
  if (params.vatAmount > 0) {
    lines.push({ accountCode: ACC.VAT_OUTPUT, debit: params.vatAmount, credit: 0, description: 'ضريبة مستردة' })
  }
  lines.push({ accountCode: ACC.CUSTOMER_RECEIVABLE, debit: 0, credit: params.total, description: `إشعار للعميل ${params.clientName}` })

  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `${params.noteType} ${params.noteNumber} — ${params.clientName}`,
    referenceType: params.noteType,
    referenceId:   params.noteId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد مسير رواتب معتمد
 * مدين: رواتب أساسية (5210) + بدلات (5230) + تأمينات شركة (5220)
 * دائن: رواتب مستحقة (2120) + تأمينات مستحقة (2160)
 */
export async function journalPayroll(params: {
  tenantId:          string
  date:              string
  runId:             number
  monthLabel:        string
  totalBasic:        number
  totalAllowances:   number
  totalGosiEmployee: number
  totalGosiEmployer: number
  totalDeductions:   number
  totalNet:          number
}): Promise<JournalResult> {
  const lines: JournalLine[] = []
  const salaryDebit = params.totalBasic - params.totalDeductions
  if (salaryDebit > 0) {
    lines.push({ accountCode: ACC.SALARIES_EXPENSE, debit: salaryDebit, credit: 0, description: `رواتب أساسية — ${params.monthLabel}` })
  }
  if (params.totalAllowances > 0) {
    lines.push({ accountCode: ACC.ALLOWANCES_EXPENSE, debit: params.totalAllowances, credit: 0, description: `بدلات وعلاوات — ${params.monthLabel}` })
  }
  if (params.totalGosiEmployer > 0) {
    lines.push({ accountCode: ACC.GOSI_EXPENSE, debit: params.totalGosiEmployer, credit: 0, description: 'حصة الشركة — التأمينات الاجتماعية' })
  }
  if (params.totalNet > 0) {
    lines.push({ accountCode: ACC.EMPLOYEE_PAYABLE, debit: 0, credit: params.totalNet, description: `صافي رواتب مستحقة — ${params.monthLabel}` })
  }
  const gosiPayable = params.totalGosiEmployee + params.totalGosiEmployer
  if (gosiPayable > 0) {
    lines.push({ accountCode: ACC.GOSI_PAYABLE, debit: 0, credit: gosiPayable, description: 'تأمينات مستحقة (حصة الموظف + الشركة)' })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `مسير رواتب ${params.monthLabel}`,
    referenceType: 'رواتب',
    referenceId:   params.runId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد دفع الرواتب من الخزينة
 * مدين: رواتب مستحقة (2120) + تأمينات مستحقة (2160)
 * دائن: البنك / الصندوق
 */
export async function journalPayrollPayment(params: {
  tenantId:        string
  date:            string
  runId:           number
  monthLabel:      string
  netAmount:       number
  gosiAmount:      number
  cashAccountCode: string
}): Promise<JournalResult> {
  const lines: JournalLine[] = []
  const total = params.netAmount + params.gosiAmount
  if (params.netAmount > 0) {
    lines.push({ accountCode: ACC.EMPLOYEE_PAYABLE, debit: params.netAmount, credit: 0, description: `سداد رواتب — ${params.monthLabel}` })
  }
  if (params.gosiAmount > 0) {
    lines.push({ accountCode: ACC.GOSI_PAYABLE, debit: params.gosiAmount, credit: 0, description: `سداد تأمينات — ${params.monthLabel}` })
  }
  if (total > 0) {
    lines.push({ accountCode: params.cashAccountCode, debit: 0, credit: total, description: `صرف رواتب وتأمينات — ${params.monthLabel}` })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `دفع رواتب ${params.monthLabel}`,
    referenceType: 'رواتب',
    referenceId:   params.runId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد تسوية نهاية خدمة
 * مدين: تصفية مخصص نهاية الخدمة المتراكم (21412) + مصروف رواتب مستحقة أخرى (521)
 * دائن: صافي مستحق للموظف (21413)
 */
export async function journalSettlement(params: {
  tenantId:       string
  date:           string
  settlementId:   number
  employeeName:   string
  gratuityAmount: number
  salaryAmount:   number
  leaveAmount:    number
  netAmount:      number
}): Promise<JournalResult> {
  const lines: JournalLine[] = []
  if (params.gratuityAmount > 0) {
    // تُستهلك من المخصص المتراكم شهرياً (21412) لا كمصروف جديد — يفترض أن journalPayroll كوّنها تدريجياً
    lines.push({ accountCode: ACC.EOS_PROVISION, debit: params.gratuityAmount, credit: 0, description: `تصفية مخصص نهاية خدمة — ${params.employeeName}` })
  }
  const otherEnt = params.salaryAmount + params.leaveAmount
  if (otherEnt > 0) {
    lines.push({ accountCode: ACC.SALARIES_EXPENSE, debit: otherEnt, credit: 0, description: `مستحقات نهاية خدمة — ${params.employeeName}` })
  }
  if (params.netAmount > 0) {
    lines.push({ accountCode: ACC.EMPLOYEE_PAYABLE, debit: 0, credit: params.netAmount, description: `تسوية مستحقة — ${params.employeeName}` })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `تسوية نهاية خدمة — ${params.employeeName}`,
    referenceType: 'تسوية نهاية خدمة',
    referenceId:   params.settlementId,
    lines,
    source:        'آلي',
  })
}

/**
 * قيد تعويض إجازة نقداً
 * مدين: مصروف رواتب (5210) | دائن: بنك أو مستحقات (2120)
 */
export async function journalLeaveCompensation(params: {
  tenantId:        string
  date:            string
  compensationId:  number
  employeeName:    string
  amount:          number
  cashAccountCode?: string
}): Promise<JournalResult> {
  const creditCode = params.cashAccountCode || ACC.EMPLOYEE_PAYABLE
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `تعويض إجازة — ${params.employeeName}`,
    referenceType: 'تعويض إجازة',
    referenceId:   params.compensationId,
    lines: [
      { accountCode: ACC.SALARIES_EXPENSE, debit: params.amount, credit: 0, description: `تعويض إجازة — ${params.employeeName}` },
      { accountCode: creditCode, debit: 0, credit: params.amount, description: `صرف تعويض إجازة — ${params.employeeName}` },
    ],
    source: 'آلي',
  })
}

/**
 * قيد مخصص مكافأة نهاية الخدمة الشهري (IAS 19)
 * مدين: مصروف مكافأة (5240) | دائن: مخصص نهاية خدمة (2420)
 */
export async function journalEOSProvision(params: {
  tenantId:    string
  date:        string
  monthLabel:  string
  totalAmount: number
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `مخصص مكافأة نهاية خدمة — ${params.monthLabel}`,
    referenceType: 'مخصص نهاية خدمة',
    lines: [
      { accountCode: ACC.EOS_EXPENSE, debit: params.totalAmount, credit: 0, description: `مصروف مخصص — ${params.monthLabel}` },
      { accountCode: ACC.EOS_PROVISION, debit: 0, credit: params.totalAmount, description: `مخصص نهاية خدمة — ${params.monthLabel}` },
    ],
    source: 'آلي',
  })
}

/**
 * قيد إهلاك أصول — أسطر متعددة بأكواد حسابات
 */
export async function journalDepreciation(params: {
  tenantId:    string
  date:        string
  monthLabel:  string
  lines:       { expenseCode: string; accumCode: string; amount: number; description: string; costCenterId?: number }[]
}): Promise<JournalResult> {
  const journalLines: JournalLine[] = []
  for (const l of params.lines) {
    if (l.amount <= 0) continue
    const cc = l.costCenterId
    journalLines.push({ accountCode: l.expenseCode, debit: l.amount, credit: 0, description: l.description, costCenterId: cc })
    journalLines.push({ accountCode: l.accumCode,   debit: 0, credit: l.amount, description: `مجمع — ${l.description}` })
  }
  const total = params.lines.reduce((s, l) => s + l.amount, 0)
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   `إهلاك أصول — ${params.monthLabel}`,
    referenceType: 'إهلاك',
    lines:         journalLines,
    source:        'آلي',
  })
}

// ════════════════════════════════════
// دالة مساعدة: جلب كود حساب من cash_account_id
// ════════════════════════════════════
export async function getCashAccountCode(
  cashAccountId: number
): Promise<string> {
  const { data } = await supabase
    .from('finance_cash_accounts')
    .select('account_id')
    .eq('id', cashAccountId)
    .single()

  if (!data?.account_id) return ACC.CASH_LOCAL  // fallback: الصندوق الرئيسي

  const { data: acc } = await supabase
    .from('finance_accounts')
    .select('code')
    .eq('id', data.account_id)
    .single()

  return acc?.code || ACC.CASH_LOCAL
}

/**
 * getExpenseAccountCode — خريطة الفئة → كود الحساب
 * مُصدَّرة للاستخدام في expenses page
 * مُحدَّثة على النظام الخماسي المباشر (يوليو 2026) — كل قيمة عبر ACC.* لا نصاً ثابتاً
 */
export function getExpenseAccountCode(expenseType: string, category: string): string {
  const cat = category || ''
  const typ = expenseType || ''

  if (typ === 'مشاريع') {
    if (cat.includes('عمالة'))                           return ACC.DIRECT_LABOR
    if (cat.includes('مقاول'))                           return ACC.SUBCONTRACT
    if (cat.includes('موقع') || cat.includes('معدة') || cat.includes('آلة')) return ACC.SITE_EQUIPMENT
    return ACC.RAW_MATERIALS_DEFAULT
  }
  if (typ === 'تشغيلي') {
    if (cat.includes('راتب') || cat.includes('أجور'))    return ACC.SALARIES_EXPENSE
    if (cat.includes('تأمين'))                           return ACC.GOSI_EXPENSE
    if (cat.includes('إيجار'))                           return ACC.RENT_EXPENSE
    if (cat.includes('كهرب') || cat.includes('ماء') || cat.includes('اتصال') || cat.includes('إنترنت')) return ACC.UTILITIES_EXPENSE
    if (cat.includes('صيانة'))                           return ACC.MAINTENANCE_EXPENSE
    if (cat.includes('سيارة') || cat.includes('سيارات') || cat.includes('مركبة') || cat.includes('وقود')) return ACC.VEHICLE_EXPENSE
    if (cat.includes('بنك'))                             return ACC.BANK_FEES
    if (cat.includes('غرامة') || cat.includes('جزاء'))  return ACC.PENALTIES
    return ACC.UTILITIES_EXPENSE
  }
  if (typ === 'إداري') {
    if (cat.includes('قرطاسية') || cat.includes('مستلزمات')) return ACC.UTILITIES_EXPENSE
    if (cat.includes('ضيافة') || cat.includes('علاقات'))     return ACC.HOSPITALITY
    if (cat.includes('رسوم') || cat.includes('ترخيص'))       return ACC.UTILITIES_EXPENSE
    if (cat.includes('سفر') || cat.includes('انتقال'))        return ACC.VEHICLE_EXPENSE
    if (cat.includes('بنك'))                                  return ACC.BANK_FEES
    if (cat.includes('غرامة') || cat.includes('جزاء'))       return ACC.PENALTIES
    return ACC.UTILITIES_EXPENSE
  }
  return ACC.OTHER_EXPENSE
}

// ════════════════════════════════════
// عكس القيود + قيود متخصصة
// ════════════════════════════════════

export async function getAccountCodeById(accountId: number): Promise<string | null> {
  const { data } = await supabase.from('finance_accounts').select('code').eq('id', accountId).single()
  return data?.code ?? null
}

/** عكس قيد موجود — مدين↔دائن */
export async function reverseJournalEntry(params: {
  tenantId: string
  date: string
  originalEntryId: number
  description: string
  referenceType: string
  referenceId?: number
}): Promise<JournalResult> {
  const { data: lines, error } = await supabase
    .from('finance_journal_lines')
    .select('debit, credit, description, cost_center_id, account:finance_accounts(code)')
    .eq('entry_id', params.originalEntryId)

  if (error || !lines?.length) {
    const { default: toast } = await import('react-hot-toast')
    toast.error('تعذر العثور على قيد للعكس')
    return null
  }

  const reversed: JournalLine[] = []
  for (const raw of lines) {
    const l = raw as { debit: number; credit: number; description?: string; cost_center_id?: number; account?: { code: string } | { code: string }[] }
    const acc = Array.isArray(l.account) ? l.account[0] : l.account
    const code = acc?.code
    if (!code) continue
    reversed.push({
      accountCode: code,
      debit:       Number(l.credit || 0),
      credit:      Number(l.debit || 0),
      description: `عكس: ${l.description || ''}`,
      costCenterId: l.cost_center_id ?? undefined,
    })
  }

  if (reversed.length < 2) return null

  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: params.referenceType,
    referenceId:   params.referenceId,
    lines:         reversed,
    source:        'آلي',
  })
}

/** عكس قيد بالمرجع (reference_type + reference_id) */
export async function reverseJournalByReference(params: {
  tenantId: string
  date: string
  referenceType: string
  referenceId: number
  reverseReferenceType: string
  description: string
}): Promise<JournalResult | null> {
  const { data: entry } = await supabase
    .from('finance_journal_entries')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('reference_type', params.referenceType)
    .eq('reference_id', params.referenceId)
    .maybeSingle()

  if (!entry) return null

  return reverseJournalEntry({
    tenantId:        params.tenantId,
    date:            params.date,
    originalEntryId: entry.id,
    description:     params.description,
    referenceType:   params.reverseReferenceType,
    referenceId:     params.referenceId,
  })
}

/** تحويل داخلي بين حسابين نقديين */
export async function journalInternalTransfer(params: {
  tenantId: string
  date: string
  description: string
  amount: number
  toAccountCode: string
  fromAccountCode: string
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'تحويل',
    lines: [
      { accountCode: params.toAccountCode,   debit: params.amount, credit: 0,              description: params.description },
      { accountCode: params.fromAccountCode, debit: 0,             credit: params.amount, description: params.description },
    ],
    source: 'آلي',
  })
}

/** صرف عهدة / سلفة: مدين حساب الموظف / دائن نقدية */
export async function journalCustodyIssue(params: {
  tenantId: string
  date: string
  description: string
  referenceType: string
  amount: number
  custodyAccountCode: string
  cashAccountCode: string
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: params.referenceType,
    lines: [
      { accountCode: params.custodyAccountCode, debit: params.amount, credit: 0,              description: params.description },
      { accountCode: params.cashAccountCode,    debit: 0,             credit: params.amount, description: params.description },
    ],
    source: 'آلي',
  })
}

/** شراء أصل ثابت — دائن: نقد/بنك أو ذمم موردين */
export async function journalAssetPurchase(params: {
  tenantId: string
  date: string
  description: string
  referenceId: number
  amount: number
  assetAccountCode: string
  creditAccountCode: string
  paymentLabel?: string
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'أصل',
    referenceId:   params.referenceId,
    lines: [
      { accountCode: params.assetAccountCode, debit: params.amount, credit: 0,               description: params.description },
      { accountCode: params.creditAccountCode,  debit: 0,             credit: params.amount,  description: params.paymentLabel || params.description },
    ],
    source: 'آلي',
  })
}

/** استبعاد أصل ثابت */
export async function journalAssetDisposal(params: {
  tenantId: string
  date: string
  description: string
  referenceId?: number
  assetAccountCode: string
  accumAccountCode: string
  totalCost: number
  accumDep: number
  disposalValue: number
  isSale: boolean
  gainLoss: number
  cashAccountCode?: string
}): Promise<JournalResult> {
  const lines: JournalLine[] = []
  if (params.accumDep > 0) {
    lines.push({ accountCode: params.accumAccountCode, debit: params.accumDep, credit: 0, description: 'استنزال مجمع الإهلاك' })
  }
  if (params.isSale && params.cashAccountCode && params.disposalValue > 0) {
    lines.push({ accountCode: params.cashAccountCode, debit: params.disposalValue, credit: 0, description: 'عائد البيع' })
  }
  if (params.gainLoss < 0) {
    lines.push({ accountCode: ACC.LOSS_ON_ASSET, debit: Math.abs(params.gainLoss), credit: 0, description: 'خسارة بيع أصل' })
  }
  lines.push({ accountCode: params.assetAccountCode, debit: 0, credit: params.totalCost, description: params.description })
  if (params.gainLoss > 0) {
    lines.push({ accountCode: ACC.GAIN_ON_ASSET, debit: 0, credit: params.gainLoss, description: 'ربح بيع أصل' })
  }
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'استبعاد',
    referenceId:   params.referenceId,
    lines,
    source:        'آلي',
  })
}

/** تعديل قيمة أصل — فرق التكلفة */
export async function journalAssetCostAdjustment(params: {
  tenantId: string
  date: string
  assetId: number
  description: string
  assetAccountCode: string
  delta: number
}): Promise<JournalResult> {
  const amt = Math.abs(params.delta)
  if (amt < 0.01) return null
  const isIncrease = params.delta > 0
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'تعديل أصل',
    referenceId:   params.assetId,
    lines: isIncrease
      ? [
          { accountCode: params.assetAccountCode, debit: amt, credit: 0, description: params.description },
          { accountCode: ACC.PAID_IN_CAPITAL,     debit: 0,   credit: amt, description: 'تسوية تعديل أصل' },
        ]
      : [
          { accountCode: ACC.PAID_IN_CAPITAL,     debit: amt, credit: 0, description: 'تسوية تعديل أصل' },
          { accountCode: params.assetAccountCode, debit: 0,   credit: amt, description: params.description },
        ],
    source: 'آلي',
  })
}

/** صيانة أسطول (داخلي): مدين 5142 / دائن نقدية */
export async function journalFleetMaintenance(params: {
  tenantId: string
  workOrderId: number
  date: string
  description: string
  amount: number
  cashAccountCode: string
  expenseAccountCode?: string
}): Promise<JournalResult> {
  const expenseCode = params.expenseAccountCode || ACC.EQUIPMENT_MAINTENANCE
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'صيانة أسطول',
    referenceId:   params.workOrderId,
    lines: [
      { accountCode: expenseCode, debit: params.amount, credit: 0,              description: params.description },
      { accountCode: params.cashAccountCode, debit: 0, credit: params.amount, description: params.description },
    ],
    source: 'آلي',
  })
}

/** صيانة أصل: مدين مصروف / دائن نقدية */
export async function journalAssetMaintenance(params: {
  tenantId: string
  date: string
  description: string
  amount: number
  expenseAccountCode: string
  cashAccountCode: string
}): Promise<JournalResult> {
  return createJournalEntry({
    tenantId:      params.tenantId,
    date:          params.date,
    description:   params.description,
    referenceType: 'صيانة',
    lines: [
      { accountCode: params.expenseAccountCode, debit: params.amount, credit: 0,              description: params.description },
      { accountCode: params.cashAccountCode,    debit: 0,             credit: params.amount, description: params.description },
    ],
    source: 'آلي',
  })
}

