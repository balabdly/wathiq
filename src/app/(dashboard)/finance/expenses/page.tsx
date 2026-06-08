'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, getExpenseAccountCode, getCashAccountCode } from '@/lib/journal'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Expense = {
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
type Account    = { id: number; code: string; name: string; account_type: string }
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

// getExpenseAccountCode مستوردة من @/lib/journal

// ════════════════════════════════════════
// مكوّن مشترك: اختيار حساب الدفع
// ════════════════════════════════════════
function CashAccountSelector({ paymentMethod, value, tenantId, onChange }: {
  paymentMethod: string; value: string; tenantId: string; onChange: (v: string) => void
}) {
  const [accounts, setAccounts] = useState<any[]>([])
  useEffect(() => {
    supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []))
  }, [tenantId])

  const banks    = accounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const boxes    = accounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')
  const selected = accounts.find(a => a.id === Number(value))

  if (paymentMethod === 'آجل') return (
    <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
      📅 سيُسجَّل كالتزام في الذمم الدائنة
    </div>
  )

  const list  = (paymentMethod === 'نقداً') ? boxes : banks
  const label = (paymentMethod === 'نقداً') ? 'الصندوق' : 'الحساب البنكي'

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text3)', marginBottom: '5px' }}>
        {label} <span style={{ color: '#c81e1e' }}>*</span>
      </label>
      {list.length === 0 ? (
        <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
          ⚠️ لا توجد {label === 'الصندوق' ? 'صناديق' : 'حسابات بنكية'} — أضفها من إعدادات الخزينة
        </div>
      ) : (
        <>
          <select value={value} onChange={e => onChange(e.target.value)} className="select">
            <option value="">— اختر {label} —</option>
            {list.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}{a.account_no ? ` (${a.account_no})` : ''}
              </option>
            ))}
          </select>
          {selected?.iban && (
            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'monospace' }}>IBAN: {selected.iban}</div>
          )}
        </>
      )}
    </div>
  )
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
    expense_number:  expense?.expense_number  || '',
    expense_date:    expense?.expense_date    || today,
    expense_type:    expense?.expense_type    || 'تشغيلي',
    category:        expense?.category        || '',
    description:     expense?.description     || '',
    amount:          expense?.amount          ? String(expense.amount) : '',
    vat_rate:        expense?.vat_rate        ?? 0,
    account_id:      expense?.account_id      ? String(expense.account_id) : '',
    cost_center_id:  expense?.cost_center_id  ? String(expense.cost_center_id) : '',
    project_id:      expense?.project_id      ? String(expense.project_id) : '',
    vendor_id:       expense?.vendor_id       ? String(expense.vendor_id) : '',
    vendor_name:     expense?.vendor_name     || '',
    receipt_no:      expense?.receipt_no      || '',
    payment_method:  expense?.payment_method  || 'نقداً',
    cash_account_id: expense?.cash_account_id ? String(expense.cash_account_id) : '',
    status:          expense?.status          || 'مدفوع',
    notes:           expense?.notes           || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { if (!expense) generateNumber() }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_expenses')
      .select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('expense_number', `EXP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  const amount    = Number(form.amount) || 0
  const vatAmount = Math.round(amount * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = amount + vatAmount

  function handleVendorSelect(vendorId: string) {
    set('vendor_id', vendorId)
    const vendor = vendors.find(v => v.id === Number(vendorId))
    if (vendor) set('vendor_name', vendor.name)
  }

  async function handleSave() {
    if (!form.expense_date)       { toast.error('التاريخ مطلوب'); return }
    if (!form.category)           { toast.error('الفئة مطلوبة'); return }
    if (!form.description.trim()) { toast.error('الوصف مطلوب'); return }
    if (!amount || amount <= 0)   { toast.error('المبلغ مطلوب'); return }
    if (form.payment_method !== 'آجل' && !form.cash_account_id) {
      toast.error('يجب اختيار حساب الدفع'); return
    }
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
    if (form.cost_center_id)  payload.cost_center_id  = Number(form.cost_center_id)
    if (form.project_id)      payload.project_id      = Number(form.project_id)
    if (form.vendor_id)       payload.vendor_id       = Number(form.vendor_id)
    if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)

    let newExpenseId: number | undefined

    if (expense) {
      const { error } = await supabase.from('finance_expenses').update(payload).eq('id', expense.id)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    } else {
      const { data: newExp, error } = await supabase.from('finance_expenses').insert(payload).select('id').single()
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      newExpenseId = newExp?.id
    }

    // ══ قيد محاسبي تلقائي — عند الإنشاء + الحالة مدفوع أو آجل ══
    if (!expense && newExpenseId && (payload.status === 'مدفوع' || payload.status === 'معلق')) {

      // الحساب المدين: حسب نوع وفئة المصروف
      const expAccountCode = getExpenseAccountCode(payload.expense_type, payload.category)

      // الحساب الدائن: الحساب البنكي / الصندوق المختار أو الذمم الدائنة للآجل
      let creditAccountCode = '1111'  // الصندوق الرئيسي (fallback)

      if (payload.status === 'معلق' || form.payment_method === 'آجل') {
        // مصروف آجل → الذمم الدائنة
        creditAccountCode = '2110'
      } else if (form.cash_account_id) {
        // نجلب كود الحساب البنكي المرتبط
        const { data: ca } = await supabase
          .from('finance_cash_accounts')
          .select('account_id')
          .eq('id', Number(form.cash_account_id))
          .single()
        if (ca?.account_id) {
          const { data: acc } = await supabase
            .from('finance_accounts')
            .select('code')
            .eq('id', ca.account_id)
            .single()
          if (acc?.code) creditAccountCode = acc.code
        }
      }

      // بناء أسطر القيد
      const journalLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
        // مدين: حساب المصروف (المبلغ صافي)
        {
          accountCode: expAccountCode,
          debit:       amount,
          credit:      0,
          description: `${payload.category} — ${payload.description}`,
        },
      ]

      // مدين: ضريبة المدخلات إن وجدت
      if (vatAmount > 0) {
        journalLines.push({
          accountCode: '2140',  // ضريبة القيمة المضافة القابلة للاسترداد
          debit:       vatAmount,
          credit:      0,
          description: `ضريبة المدخلات — ${payload.category}`,
        })
      }

      // دائن: الحساب النقدي / البنكي (الإجمالي شامل الضريبة)
      journalLines.push({
        accountCode: creditAccountCode,
        debit:       0,
        credit:      total,
        description: `${form.payment_method} — ${payload.category}`,
      })

      await createJournalEntry(tenantId, {
        date:          payload.expense_date,
        description:   `مصروف ${payload.expense_type} — ${payload.category} — ${payload.description}`,
        referenceType: 'مصروف',
        referenceId:   newExpenseId,
        source:        'آلي',
        lines:         journalLines,
      })
    }

    toast.success(expense ? 'تم التعديل ✅' : '✅ تم تسجيل المصروف والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  const catList = CATEGORIES[form.expense_type as keyof typeof CATEGORIES] || []
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '92vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {expense ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع المصروف */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['مشاريع', 'تشغيلي', 'إداري'] as const).map(t => {
              const tc = TYPE_COLOR[t]
              return (
                <button key={t} type="button" onClick={() => { set('expense_type', t); set('category', '') }}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', textAlign: 'center',
                    borderColor: form.expense_type === t ? tc.color : 'var(--border)',
                    background:  form.expense_type === t ? tc.bg : 'white',
                    color:       form.expense_type === t ? tc.color : 'var(--text3)' }}>
                  {t === 'مشاريع' ? '🏗️' : t === 'تشغيلي' ? '⚙️' : '🏢'} {t}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>رقم المصروف</label>
              <input value={form.expense_number} onChange={e => set('expense_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={lbl}>تاريخ المصروف *</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>الفئة *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">— اختر الفئة —</option>
                {catList.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>الوصف / البيان *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="وصف تفصيلي للمصروف..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المبلغ (قبل الضريبة) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>نسبة ضريبة القيمة المضافة</label>
              <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select">
                <option value={0}>0% — معفي</option>
                <option value={15}>15%</option>
              </select>
            </div>
            <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '10px 14px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e' }}>الإجمالي شامل الضريبة</div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#e6820a' }}>{total.toLocaleString()} ر.س</div>
              {vatAmount > 0 && <div style={{ fontSize: '0.7rem', color: '#92400e' }}>ضريبة: {vatAmount.toLocaleString()} ر.س</div>}
            </div>
          </div>

          {/* القيد المتوقع */}
          {amount > 0 && (
            <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '10px 14px', border: '1px solid #bbf7d0', fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>⚙️ القيد المحاسبي المتوقع:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div><span style={{ color: '#1a56db' }}>مدين</span> — {getExpenseAccountCode(form.expense_type, form.category)} ({form.category || form.expense_type}) = <strong>{amount.toLocaleString()} ر.س</strong></div>
                {vatAmount > 0 && <div><span style={{ color: '#1a56db' }}>مدين</span> — 2140 (ضريبة المدخلات) = <strong>{vatAmount.toLocaleString()} ر.س</strong></div>}
                <div><span style={{ color: '#c81e1e' }}>دائن</span> — {form.payment_method === 'آجل' ? '2110 (الذمم الدائنة)' : form.cash_account_id ? 'الحساب المختار' : '...'} = <strong>{total.toLocaleString()} ر.س</strong></div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— مصروف عام —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>مركز التكلفة</label>
              <select value={form.cost_center_id} onChange={e => set('cost_center_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الجهة / المورد</label>
              <select value={form.vendor_id} onChange={e => handleVendorSelect(e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {!form.vendor_id && (
                <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)}
                  className="input" style={{ marginTop: '6px' }} placeholder="أو اكتب اسم الجهة..." />
              )}
            </div>
            <div>
              <label style={lbl}>رقم الإيصال</label>
              <input value={form.receipt_no} onChange={e => set('receipt_no', e.target.value)} className="input" dir="ltr" placeholder="اختياري..." />
            </div>
          </div>

          {/* طريقة الدفع + الحساب */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>
              💳 طريقة الدفع وحساب الصرف
            </label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {[
                { val: 'نقداً',      icon: '💵' },
                { val: 'تحويل بنكي', icon: '🏦' },
                { val: 'شيك',        icon: '📝' },
                { val: 'بطاقة',      icon: '💳' },
                { val: 'آجل',        icon: '📅' },
              ].map(m => (
                <button key={m.val} type="button"
                  onClick={() => { set('payment_method', m.val); set('cash_account_id', '') }}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    borderColor: form.payment_method === m.val ? '#e6820a' : 'var(--border)',
                    background:  form.payment_method === m.val ? '#fffbeb' : 'white',
                    color:       form.payment_method === m.val ? '#e6820a' : 'var(--text3)' }}>
                  {m.icon} {m.val}
                </button>
              ))}
            </div>
            <CashAccountSelector
              paymentMethod={form.payment_method}
              value={form.cash_account_id}
              tenantId={tenantId}
              onChange={v => set('cash_account_id', v)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['مدفوع', 'معلق', 'ملغي'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Save style={{ width: '15px', height: '15px' }} />}
            {expense ? 'حفظ التعديل' : 'تسجيل المصروف'}
          </button>
        </div>
      </div>
    </div>
  )
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
        .select('*, project:projects(name), vendor:finance_vendors!finance_expenses_vendor_id_fkey(name)')
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

  const tabExpenses = expenses.filter(e => e.expense_type === activeTab)
  const filtered = tabExpenses.filter(e => {
    const matchSearch = !search || e.description.includes(search) || e.category.includes(search) || (e.vendor_name || '').includes(search)
    const matchStatus = filterStatus === 'الكل' || e.status === filterStatus
    return matchSearch && matchStatus
  })

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
          { label: 'إجمالي المصروفات',  value: totalAll,      color: '#374151', bg: '#f3f4f6' },
          { label: 'مصروفات المشاريع',  value: totalProjects, color: '#1a56db', bg: '#eff6ff' },
          { label: 'مصروفات تشغيلية',  value: totalOps,      color: '#e6820a', bg: '#fffbeb' },
          { label: 'إدارية وعمومية',    value: totalAdmin,    color: '#c81e1e', bg: '#fef2f2' },
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
            <span style={{ marginRight: '6px', fontSize: '0.72rem', opacity: 0.8 }}>({t.total.toLocaleString()} ر.س)</span>
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
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="input" style={{ paddingRight: '32px', width: '240px' }} />
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
                  {['التاريخ', 'الفئة', 'الوصف', 'المشروع/م.التكلفة', 'الجهة', 'طريقة الدفع', 'صافي', 'ض.ق.م', 'الإجمالي', 'الحالة', ''].map(h => (
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
                    <td style={{ padding: '10px 12px', maxWidth: '160px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</div>
                      {exp.receipt_no && <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>إيصال: {exp.receipt_no}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text3)' }}>
                      {exp.project?.name || exp.cost_center?.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{exp.vendor?.name || exp.vendor_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>
                        {exp.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {Number(exp.amount).toLocaleString()} ر.س
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#e6820a', whiteSpace: 'nowrap' }}>
                      {Number(exp.vat_amount) > 0 ? Number(exp.vat_amount).toLocaleString() + ' ر.س' : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>
                      {Number(exp.total_amount).toLocaleString()} ر.س
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={'badge ' + (STATUS_COLOR[exp.status] || 'badge-gray')}>{exp.status}</span>
                    </td>
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
                  <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length} مصروف)</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{filtered.reduce((s,e)=>s+Number(e.amount),0).toLocaleString()} ر.س</td>
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
