'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Expense = {
  id: number; expense_number: string; expense_date: string
  category: string; description: string
  amount: number; vat_amount: number; total_amount: number; vat_rate: number
  expense_type: string; account_id?: number; cost_center_id?: number
  project_id?: number; vendor_id?: number; vendor_name?: string
  receipt_no?: string; payment_method: string; status: string; notes?: string
  account?: { code: string; name: string }
  cost_center?: { name: string }
  project?: { name: string }
  vendor?: { name: string }
}

type Account   = { id: number; code: string; name: string; account_type: string }
type CostCenter = { id: number; code: string; name: string }
type Project    = { id: number; name: string }
type Vendor     = { id: number; name: string }

// تصنيفات المصروفات حسب النوع
const CATEGORIES: Record<string, string[]> = {
  'مشاريع': [
    'مواد ومستلزمات الموقع', 'عمالة مباشرة', 'مقاولون فرعيون',
    'نقل ومواصلات الموقع', 'معدات وآلات', 'مصروفات موقع أخرى'
  ],
  'تشغيلي': [
    'رواتب وأجور', 'إيجار مكتب', 'كهرباء وماء',
    'اتصالات وإنترنت', 'صيانة وإصلاح', 'تأمينات اجتماعية',
    'مصروفات سيارات', 'وقود', 'مصروفات تشغيلية أخرى'
  ],
  'إداري': [
    'قرطاسية ومستلزمات مكتبية', 'ضيافة وعلاقات عامة',
    'رسوم ترخيص واشتراكات', 'تدريب وتطوير', 'سفر وانتقالات',
    'مصروفات بنكية', 'غرامات وجزاءات', 'مصروفات إدارية أخرى'
  ]
}

const STATUS_COLOR: Record<string, string> = {
  'مدفوع': 'badge-green', 'معلق': 'badge-amber', 'ملغي': 'badge-red'
}

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  'مشاريع': { bg: '#eff6ff', color: '#1a56db' },
  'تشغيلي': { bg: '#fffbeb', color: '#e6820a' },
  'إداري':  { bg: '#fef2f2', color: '#c81e1e' },
}

// ════════════════════════════════════════
// مودال: إضافة / تعديل مصروف
// ════════════════════════════════════════
function ExpenseModal({ expense, accounts, costCenters, projects, vendors, tenantId, onClose, onSave }: {
  expense: Expense | null
  accounts: Account[]; costCenters: CostCenter[]
  projects: Project[]; vendors: Vendor[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    expense_number: expense?.expense_number || '',
    expense_date:   expense?.expense_date   || today,
    expense_type:   expense?.expense_type   || 'تشغيلي',
    category:       expense?.category       || '',
    description:    expense?.description    || '',
    amount:         expense?.amount         ? String(expense.amount) : '',
    vat_rate:       expense?.vat_rate       ?? 0,
    account_id:     expense?.account_id     ? String(expense.account_id) : '',
    cost_center_id: expense?.cost_center_id ? String(expense.cost_center_id) : '',
    project_id:     expense?.project_id     ? String(expense.project_id) : '',
    vendor_id:      expense?.vendor_id      ? String(expense.vendor_id) : '',
    vendor_name:    expense?.vendor_name    || '',
    receipt_no:     expense?.receipt_no     || '',
    payment_method: expense?.payment_method || 'نقداً',
    status:         expense?.status         || 'مدفوع',
    notes:          expense?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!expense) generateNumber()
  }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_expenses').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('expense_number', `EXP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  // حساب الضريبة تلقائياً
  const amount    = Number(form.amount) || 0
  const vatAmount = Math.round(amount * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = amount + vatAmount

  // عند اختيار المورد نملأ اسمه
  function handleVendorSelect(vendorId: string) {
    set('vendor_id', vendorId)
    const vendor = vendors.find(v => v.id === Number(vendorId))
    if (vendor) set('vendor_name', vendor.name)
  }

  async function handleSave() {
    if (!form.expense_date)    { toast.error('التاريخ مطلوب'); return }
    if (!form.category)        { toast.error('الفئة مطلوبة'); return }
    if (!form.description.trim()) { toast.error('الوصف مطلوب'); return }
    if (!amount || amount <= 0)   { toast.error('المبلغ مطلوب'); return }
    setSaving(true)

    const payload: Record<string, any> = {
      tenant_id:      tenantId,
      expense_number: form.expense_number,
      expense_date:   form.expense_date,
      expense_type:   form.expense_type,
      category:       form.category,
      description:    form.description.trim(),
      amount,
      vat_amount:     vatAmount,
      total_amount:   total,
      vat_rate:       Number(form.vat_rate),
      payment_method: form.payment_method,
      status:         form.status,
      notes:          form.notes || null,
      receipt_no:     form.receipt_no || null,
      vendor_name:    form.vendor_name || null,
    }

    if (form.account_id)     payload.account_id     = Number(form.account_id)
    if (form.cost_center_id) payload.cost_center_id = Number(form.cost_center_id)
    if (form.project_id)     payload.project_id     = Number(form.project_id)
    if (form.vendor_id)      payload.vendor_id      = Number(form.vendor_id)

    let newExpenseId: number | undefined
    if (expense) {
      const { error } = await supabase.from('finance_expenses').update(payload).eq('id', expense.id)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    } else {
      const { data: newExp, error } = await supabase.from('finance_expenses').insert(payload).select('id').single()
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      newExpenseId = newExp?.id
    }

    // ══ قيد محاسبي تلقائي للمصروف المدفوع ══
    if (payload.status === 'مدفوع' && !expense) {
      // تحديد الحساب المدين حسب نوع المصروف
      const expAccountCode = payload.account_id
        ? null  // إذا اختار المستخدم حساباً محدداً نستخدمه
        : payload.expense_type === 'مشاريع' ? '5012'   // تكلفة المواد المباشرة
        : payload.expense_type === 'تشغيلي' ? '5100'   // رواتب وأجور (افتراضي)
        : '5300'                                        // مصروفات إدارية

      if (expAccountCode && newExpenseId) {
        await createJournalEntry(tenantId, {
          date:          payload.expense_date,
          description:   `مصروف ${payload.category} — ${payload.description}`,
          referenceType: 'مصروف',
          referenceId:   newExpenseId,
          lines: [
            // مدين: حساب المصروف
            { accountCode: expAccountCode, debit: payload.total_amount, credit: 0,                    description: payload.description },
            // دائن: الصندوق/البنك
            { accountCode: '1111',         debit: 0,                    credit: payload.total_amount, description: `صرف مصروف ${payload.category}` },
          ]
        })
      }
    }

    toast.success(expense ? 'تم التعديل ✅' : '✅ تم تسجيل المصروف')
    onSave(); setSaving(false)
  }

  // حسابات مناسبة حسب النوع
  const relevantAccounts = accounts.filter(a => {
    if (form.expense_type === 'مشاريع') return a.account_type === 'تكلفة'
    return a.account_type === 'مصروفات'
  })

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {expense ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع المصروف */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع المصروف *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(CATEGORIES).map(type => (
                <button key={type} type="button" onClick={() => { set('expense_type', type); set('category', '') }}
                  style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
                    borderColor: form.expense_type === type ? TYPE_COLOR[type].color : 'var(--border)',
                    background: form.expense_type === type ? TYPE_COLOR[type].bg : 'white',
                    color: form.expense_type === type ? TYPE_COLOR[type].color : 'var(--text3)' }}>
                  {type === 'مشاريع' ? '🏗️ مشاريع' : type === 'تشغيلي' ? '⚙️ تشغيلي' : '🏢 إداري'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المصروف</label>
              <input value={form.expense_number} onChange={e => set('expense_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ *</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الإيصال</label>
              <input value={form.receipt_no} onChange={e => set('receipt_no', e.target.value)} className="input" dir="ltr" placeholder="اختياري" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الفئة *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">— اختر الفئة —</option>
                {CATEGORIES[form.expense_type]?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحساب المحاسبي</label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="select">
                <option value="">— اختر الحساب —</option>
                {relevantAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف / البيان *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="مثال: فاتورة كهرباء مكتب شهر يناير" />
          </div>

          {/* المبلغ والضريبة */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ (قبل الضريبة) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة ضريبة القيمة المضافة</label>
              <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select">
                <option value={0}>0% — بدون ضريبة</option>
                <option value={15}>15% — خاضع للضريبة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجمالي</label>
              <div style={{ padding: '9px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontWeight: 700, color: '#e6820a', fontSize: '1rem' }}>
                {total.toLocaleString()} ر.س
              </div>
            </div>
          </div>

          {/* الربط */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {form.expense_type === 'مشاريع' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مركز التكلفة</label>
              <select value={form.cost_center_id} onChange={e => set('cost_center_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* المورد وطريقة الدفع */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد / الجهة</label>
              <select value={form.vendor_id} onChange={e => handleVendorSelect(e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">أو أدخل الاسم يدوياً</label>
              <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="input" placeholder="اسم الجهة" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
                {['نقداً', 'تحويل بنكي', 'شيك', 'بطاقة ائتمانية', 'آجل'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['مدفوع', 'معلق', 'ملغي'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {expense ? 'حفظ التعديل' : 'تسجيل المصروف'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// دوال مساعدة للقيود المحاسبية
// ════════════════════════════════════════
async function getAccountId(tenantId: string, code: string): Promise<number | null> {
  const { data } = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', code).single()
  return data?.id || null
}

async function createJournalEntry(tenantId: string, params: {
  date: string; description: string
  referenceType: string; referenceId: number
  lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
  const lineIds = await Promise.all(params.lines.map(async l => ({ ...l, account_id: await getAccountId(tenantId, l.accountCode) })))
  if (lineIds.some(l => !l.account_id)) { console.warn('حسابات غير موجودة — تخطي القيد'); return null }
  const totalDebit  = lineIds.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lineIds.reduce((s, l) => s + l.credit, 0)
  const { count } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const entryNumber = `JE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: entry, error } = await supabase.from('finance_journal_entries').insert({
    tenant_id: tenantId, entry_number: entryNumber, entry_date: params.date,
    description: params.description, reference_type: params.referenceType,
    reference_id: params.referenceId, total_debit: totalDebit, total_credit: totalCredit, status: 'معتمد',
  }).select('id').single()
  if (error || !entry) return null
  await supabase.from('finance_journal_lines').insert(lineIds.map(l => ({ entry_id: entry.id, account_id: l.account_id, debit: l.debit, credit: l.credit, description: l.description || null })))
  return entry.id
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceExpensesPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'مشاريع' | 'تشغيلي' | 'إداري'>('مشاريع')
  const [expenses,    setExpenses]    = useState<Expense[]>([])
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [vendors,     setVendors]     = useState<Vendor[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterStatus, setFilterStatus] = useState('الكل')
  const [showModal,   setShowModal]   = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [expRes, accRes, ccRes, projRes, venRes] = await Promise.all([
      supabase.from('finance_expenses')
        .select('*, account:finance_accounts(code,name), cost_center:finance_cost_centers(name), project:projects(name), vendor:finance_vendors(name)')
        .eq('tenant_id', tenant.id)
        .order('expense_date', { ascending: false }),
      supabase.from('finance_accounts').select('id,code,name,account_type').eq('tenant_id', tenant.id).eq('is_parent', false).order('code'),
      supabase.from('finance_cost_centers').select('id,code,name').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_vendors').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    setExpenses(expRes.data || [])
    setAccounts(accRes.data || [])
    setCostCenters(ccRes.data || [])
    setProjects(projRes.data || [])
    setVendors(venRes.data || [])
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا المصروف؟')) return
    await supabase.from('finance_expenses').delete().eq('id', id)
    setExpenses(p => p.filter(e => e.id !== id))
    toast.success('تم الحذف')
  }

  // فلترة حسب التاب
  const tabExpenses = expenses.filter(e => e.expense_type === activeTab)
  const filtered = tabExpenses.filter(e => {
    const matchSearch = !search || e.description.includes(search) || e.category.includes(search) || (e.vendor_name || '').includes(search)
    const matchStatus = filterStatus === 'الكل' || e.status === filterStatus
    return matchSearch && matchStatus
  })

  // إحصائيات
  const totalAll      = expenses.reduce((s, e) => s + Number(e.total_amount), 0)
  const totalProjects = expenses.filter(e => e.expense_type === 'مشاريع').reduce((s, e) => s + Number(e.total_amount), 0)
  const totalOps      = expenses.filter(e => e.expense_type === 'تشغيلي').reduce((s, e) => s + Number(e.total_amount), 0)
  const totalAdmin    = expenses.filter(e => e.expense_type === 'إداري').reduce((s, e) => s + Number(e.total_amount), 0)
  const totalTab      = filtered.reduce((s, e) => s + Number(e.total_amount), 0)

  const TABS = [
    { id: 'مشاريع', label: '🏗️ مصروفات المشاريع',  color: '#1a56db', total: totalProjects },
    { id: 'تشغيلي', label: '⚙️ مصروفات تشغيلية',   color: '#e6820a', total: totalOps },
    { id: 'إداري',  label: '🏢 إدارية وعمومية',     color: '#c81e1e', total: totalAdmin },
  ]

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            المصروفات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>مصروفات المشاريع — التشغيلية — الإدارية والعمومية</p>
        </div>
        <button onClick={() => { setEditExpense(null); setShowModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> تسجيل مصروف
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي المصروفات',   value: totalAll,      color: '#374151', bg: '#f3f4f6' },
          { label: 'مصروفات المشاريع',   value: totalProjects, color: '#1a56db', bg: '#eff6ff' },
          { label: 'مصروفات تشغيلية',   value: totalOps,      color: '#e6820a', bg: '#fffbeb' },
          { label: 'إدارية وعمومية',     value: totalAdmin,    color: '#c81e1e', bg: '#fef2f2' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label} — ريال</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); setSearch(''); setFilterStatus('الكل') }}
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['الكل', 'مدفوع', 'معلق', 'ملغي'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                borderColor: filterStatus === s ? 'var(--primary)' : 'var(--border)',
                background: filterStatus === s ? 'var(--primary)' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text3)' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '220px' }} placeholder="بحث..." />
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Receipt style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>لا توجد مصروفات في هذا التصنيف</p>
          <button onClick={() => { setEditExpense(null); setShowModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#e6820a' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول مصروف
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التاريخ', 'الفئة', 'الوصف', 'الحساب', 'المشروع / م.التكلفة', 'الجهة', 'طريقة الدفع', 'المبلغ', 'ض.ق.م', 'الإجمالي', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{exp.expense_date}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                        background: TYPE_COLOR[exp.expense_type]?.bg || '#f3f4f6',
                        color: TYPE_COLOR[exp.expense_type]?.color || '#6b7280' }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: '180px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</div>
                      {exp.receipt_no && <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>إيصال: {exp.receipt_no}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text3)' }}>
                      {exp.account ? <span style={{ fontFamily: 'monospace' }}>{exp.account.code}</span> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                      {exp.project?.name || exp.cost_center?.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{exp.vendor_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{exp.payment_method}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{Number(exp.amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#e6820a' }}>
                      {Number(exp.vat_amount) > 0 ? Number(exp.vat_amount).toLocaleString() + ' ر.س' : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>{Number(exp.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 12px' }}><span className={'badge ' + (STATUS_COLOR[exp.status] || 'badge-gray')}>{exp.status}</span></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { setEditExpense(exp); setShowModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={7} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length} مصروف)</td>
                  <td style={{ padding: '10px 12px' }}>{filtered.reduce((s,e)=>s+Number(e.amount),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 12px', color: '#e6820a' }}>{filtered.reduce((s,e)=>s+Number(e.vat_amount),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 12px', color: '#e6820a' }}>{totalTab.toLocaleString()} ر.س</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ExpenseModal
          expense={editExpense}
          accounts={accounts}
          costCenters={costCenters}
          projects={projects}
          vendors={vendors}
          tenantId={tenant!.id}
          onClose={() => { setShowModal(false); setEditExpense(null) }}
          onSave={() => { setShowModal(false); setEditExpense(null); loadAll() }}
        />
      )}
    </div>
  )
}
