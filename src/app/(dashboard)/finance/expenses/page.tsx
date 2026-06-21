'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Receipt, ArrowUpRight, ArrowDownRight, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import { createJournalEntry, getExpenseAccountCode, getCashAccountCode, journalExpense } from '@/lib/journal'

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

type Transaction = {
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

type Account    = { id: number; code: string; name: string; account_type: string }
type CostCenter = { id: number; code: string; name: string }
type Project    = { id: number; name: string }
type Vendor     = { id: number; name: string }
type Client     = { id: number; name: string }
type CashAccount = { id: number; name: string; account_type: string; account_id?: number }

// تصنيفات المصروفات
const CATEGORIES: Record<string, string[]> = {
  'مشاريع': ['مواد ومستلزمات الموقع', 'عمالة مباشرة', 'مقاولون فرعيون', 'نقل ومواصلات الموقع', 'معدات وآلات', 'مصروفات موقع أخرى'],
  'تشغيلي': ['رواتب وأجور', 'إيجار مكتب', 'كهرباء وماء', 'اتصالات وإنترنت', 'صيانة وإصلاح', 'تأمينات اجتماعية', 'مصروفات سيارات', 'وقود', 'مصروفات تشغيلية أخرى'],
  'إداري':  ['قرطاسية ومستلزمات مكتبية', 'ضيافة وعلاقات عامة', 'رسوم ترخيص واشتراكات', 'تدريب وتطوير', 'سفر وانتقالات', 'مصروفات بنكية', 'غرامات وجزاءات', 'مصروفات إدارية أخرى'],
}

const STATUS_COLOR: Record<string, string> = { 'مدفوع': 'badge-green', 'معلق': 'badge-amber', 'ملغي': 'badge-red', 'معتمد': 'badge-green' }
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  'مشاريع': { bg: '#eff6ff', color: '#1a56db' },
  'تشغيلي': { bg: '#fffbeb', color: '#e6820a' },
  'إداري':  { bg: '#fef2f2', color: '#c81e1e' },
}

const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// ════════════════════════════════════════
// مكوّن: اختيار حساب الدفع
// ════════════════════════════════════════
function CashAccountSelector({ paymentMethod, value, tenantId, onChange }: {
  paymentMethod: string; value: string; tenantId: string; onChange: (v: string) => void
}) {
  const [accounts, setAccounts] = useState<any[]>([])
  useEffect(() => {
    supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []))
  }, [tenantId])

  if (paymentMethod === 'آجل') return (
    <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
      📅 سيُسجَّل كالتزام في الذمم الدائنة
    </div>
  )
  const banks = accounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const boxes = accounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="select">
      <option value="">— اختر الحساب —</option>
      {banks.length > 0 && <optgroup label="🏦 حسابات بنكية">{banks.map(a => <option key={a.id} value={a.id}>🏦 {a.name}</option>)}</optgroup>}
      {boxes.length > 0 && <optgroup label="💰 صناديق نقدية">{boxes.map(a => <option key={a.id} value={a.id}>💰 {a.name}</option>)}</optgroup>}
    </select>
  )
}

// ════════════════════════════════════════
// مكوّن: بحث الحساب المحاسبي
// ════════════════════════════════════════
function AccountSearch({ accounts, value, onChange, required }: {
  accounts: Account[]; value: string; onChange: (v: string) => void; required?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const selected = accounts.find(a => String(a.id) === value)

  const filtered = query.length < 1 ? [] : accounts.filter(a =>
    a.name.includes(query) || a.code.startsWith(query)
  ).slice(0, 8)

  return (
    <div style={{ position: 'relative' }}>
      {selected && !open ? (
        <div onClick={() => { setOpen(true); setQuery('') }}
          style={{ padding: '9px 12px', border: `1px solid ${required ? '#fde68a' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong style={{ fontFamily: 'monospace', color: 'var(--primary)', marginLeft: '6px' }}>{selected.code}</strong>{selected.name}</span>
          <X style={{ width: '12px', height: '12px', color: '#9ca3af' }} onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }} />
        </div>
      ) : (
        <input
          value={query} autoFocus={open}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="input"
          placeholder="ابحث بالاسم أو رقم الحساب..."
          style={{ borderColor: required && !value ? '#f59e0b' : undefined }}
        />
      )}
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 100, background: 'white', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px', overflow: 'hidden' }}>
          {filtered.map(a => (
            <div key={a.id} onMouseDown={() => { onChange(String(a.id)); setQuery(''); setOpen(false) }}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', gap: '10px', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', minWidth: '48px' }}>{a.code}</span>
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      )}
      {required && !value && (
        <div style={{ fontSize: '0.68rem', color: '#e6820a', marginTop: '3px' }}>⚠️ الحساب المحاسبي إلزامي</div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// مودال المصروف
// ════════════════════════════════════════
function ExpenseModal({ expense, accounts, costCenters, projects, vendors, tenantId, onClose, onSave }: {
  expense: Expense | null; accounts: Account[]; costCenters: CostCenter[]
  projects: Project[]; vendors: Vendor[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    expense_date:    expense?.expense_date    || today,
    expense_type:    expense?.expense_type    || 'مشاريع',
    category:        expense?.category        || (CATEGORIES['مشاريع'][0]),
    description:     expense?.description     || '',
    amount:          expense?.amount          ? String(expense.amount) : '',
    vat_rate:        expense?.vat_rate        ? String(expense.vat_rate) : '15',
    payment_method:  expense?.payment_method  || 'تحويل بنكي',
    cash_account_id: expense?.cash_account_id ? String(expense.cash_account_id) : '',
    account_id:      expense?.account_id      ? String(expense.account_id) : '',
    cost_center_id:  expense?.cost_center_id  ? String(expense.cost_center_id) : '',
    project_id:      expense?.project_id      ? String(expense.project_id) : '',
    vendor_id:       expense?.vendor_id       ? String(expense.vendor_id) : '',
    vendor_name:     expense?.vendor_name     || '',
    receipt_no:      expense?.receipt_no      || '',
    status:          expense?.status          || 'مدفوع',
    notes:           expense?.notes           || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // هل النوع مشاريع؟
  const isProject = form.expense_type === 'مشاريع'

  const netAmount   = Number(form.amount) || 0
  const vatAmount   = form.payment_method !== 'آجل' ? Math.round(netAmount * (Number(form.vat_rate) / 100) * 100) / 100 : 0
  const totalAmount = netAmount + vatAmount

  // فلترة الحسابات المحاسبية — فروع فقط (is_parent = false)
  // فقط حسابات المصروفات والتكلفة الفرعية — قاعدة محاسبية صارمة
  const leafAccounts = accounts.filter(a =>
    !(a as any).is_parent &&
    ['مصروفات', 'تكلفة'].includes((a as any).account_type)
  )

  async function handleSave() {
    if (!form.description.trim()) { toast.error('البيان مطلوب'); return }
    if (!form.amount || netAmount <= 0) { toast.error('المبلغ مطلوب'); return }
    if (!form.account_id) { toast.error('الحساب المحاسبي إلزامي'); return }
    setSaving(true)
    try {
      const { count } = await supabase.from('finance_expenses').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const expenseNumber = expense?.expense_number || `EXP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

      // الفئة: فقط لمصروفات المشاريع
      const payload: Record<string, any> = {
        tenant_id: tenantId, expense_number: expenseNumber,
        expense_date: form.expense_date, expense_type: form.expense_type,
        category: null, description: form.description.trim(),
        amount: netAmount, vat_rate: Number(form.vat_rate),
        vat_amount: vatAmount, total_amount: totalAmount,
        payment_method: form.payment_method,
        vendor_name: form.vendor_name.trim() || null,
        receipt_no: form.receipt_no.trim() || null,
        status: form.status, notes: form.notes || null,
      }
      if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)
      if (form.cost_center_id)  payload.cost_center_id  = Number(form.cost_center_id)
      if (form.vendor_id)       payload.vendor_id        = Number(form.vendor_id)
      // المشروع فقط لنوع مشاريع
      if (isProject && form.project_id) payload.project_id = Number(form.project_id)

      let savedId: number | null = null
      if (expense?.id) {
        const { error } = await supabase.from('finance_expenses').update(payload).eq('id', expense.id)
        if (error) throw error
        savedId = expense.id
      } else {
        const { data, error } = await supabase.from('finance_expenses').insert(payload).select('id').single()
        if (error) throw error
        savedId = data?.id
      }

      // قيد محاسبي — يستخدم الحساب المحاسبي المختار مباشرة
      if (!expense?.id && savedId && form.payment_method !== 'آجل' && form.cash_account_id && form.account_id) {
        const selectedAcc = leafAccounts.find(a => String(a.id) === form.account_id)
        const cashAccCode = await getCashAccountCode(Number(form.cash_account_id))
        if (selectedAcc?.code && cashAccCode) {
          await journalExpense({
            tenantId,
            date:               form.expense_date,
            description:        form.description,
            category:           form.expense_type,
            expenseId:          savedId,
            amount:             netAmount,
            vatAmount,
            total:              totalAmount,
            expenseAccountCode: selectedAcc.code,
            creditAccountCode:  cashAccCode,
          })
        }
      }
      toast.success(expense ? 'تم التعديل ✅' : 'تم الحفظ ✅')
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  const TYPE_COLOR: Record<string, string> = {
    'مشاريع': '#1a56db', 'تشغيلي': '#e6820a', 'إداري': '#6b7280'
  }
  const typeColor = TYPE_COLOR[form.expense_type] || '#374151'

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {expense ? 'تعديل مصروف' : 'تسجيل مصروف'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* النوع والتاريخ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>نوع المصروف *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {Object.keys(TYPE_COLOR).map(t => (
                  <button key={t} type="button"
                    onClick={() => { set('expense_type', t); set('category', CATEGORIES[t]?.[0] || ''); set('project_id', ''); set('account_id', '') }}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                      borderColor: form.expense_type === t ? TYPE_COLOR[t] : 'var(--border)',
                      background:  form.expense_type === t ? TYPE_COLOR[t] + '15' : 'white',
                      color:       form.expense_type === t ? TYPE_COLOR[t] : 'var(--text3)' }}>
                    {t === 'مشاريع' ? '🏗️' : t === 'تشغيلي' ? '⚙️' : '🏢'} {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* المشروع — فقط لمصروفات المشاريع */}
          {isProject && (
            <div>
              <label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون مشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* البيان */}
          <div>
            <label style={lbl}>البيان / الوصف *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input"
              placeholder={isProject ? 'مثال: شراء أسفلت للمشروع...' : 'مثال: فاتورة إيجار المكتب...'} autoFocus />
          </div>

          {/* الحساب المحاسبي — إلزامي — بحث ذكي */}
          <div>
            <label style={lbl}>
              الحساب المحاسبي *
              <span style={{ marginRight: '6px', fontSize: '0.68rem', color: '#9ca3af', fontWeight: 400 }}>ابحث بالاسم أو الرقم</span>
            </label>
            <AccountSearch
              accounts={leafAccounts}
              value={form.account_id}
              onChange={v => set('account_id', v)}
              required={true}
            />
          </div>

          {/* المبلغ والضريبة */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div>
              <label style={lbl}>المبلغ (قبل الضريبة) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>نسبة ض.ق.م %</label>
              <select value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)} className="select">
                {['0', '5', '15'].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الإجمالي</label>
              <div style={{ padding: '9px 12px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 700, color: '#e6820a', fontSize: '0.95rem' }}>
                {fmt(totalAmount)} ر.س
              </div>
            </div>
          </div>

          {/* الدفع */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
                {['تحويل بنكي', 'نقداً', 'شيك', 'بطاقة ائتمانية', 'آجل'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>حساب الدفع</label>
              <CashAccountSelector paymentMethod={form.payment_method} value={form.cash_account_id} tenantId={tenantId} onChange={v => set('cash_account_id', v)} />
            </div>
          </div>

          {/* المورد */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المورد / الجهة</label>
              <select value={form.vendor_id} onChange={e => { set('vendor_id', e.target.value); const v = vendors.find(x => x.id === Number(e.target.value)); if (v) set('vendor_name', v.name) }} className="select">
                <option value="">— اختر أو اكتب —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="input" style={{ marginTop: '6px' }} placeholder="أو اكتب اسم الجهة..." />
            </div>
            <div>
              <label style={lbl}>رقم الإيصال</label>
              <input value={form.receipt_no} onChange={e => set('receipt_no', e.target.value)} className="input" dir="ltr" style={{ marginTop: '0' }} />
              <label style={{ ...lbl, marginTop: '10px' }}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['مدفوع', 'معلق', 'ملغي'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال سند القبض / الصرف
// ════════════════════════════════════════
function VoucherModal({ type, cashAccounts, accounts, costCenters, clients, vendors, projects, tenantId, onClose, onSave }: {
  type: 'قبض' | 'صرف'
  cashAccounts: CashAccount[]; accounts: Account[]; costCenters: CostCenter[]
  clients: Client[]; vendors: Vendor[]; projects: Project[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    transaction_date: today,
    amount: '',
    description: '',
    cash_account_id: cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    payment_method: 'تحويل بنكي',
    reference_no: '',
    account_id: '',
    cost_center_id: '',
    project_id: '',
    party_name: '',
    status: 'معتمد',
    notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const isReceipt = type === 'قبض'

  useEffect(() => { generateNumber() }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_treasury').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const prefix = isReceipt ? 'RCV' : 'PAY'
    set('reference_no', `${prefix}-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('المبلغ مطلوب'); return }
    if (!form.description.trim()) { toast.error('البيان مطلوب'); return }
    setSaving(true)
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      transaction_no: form.reference_no,
      transaction_date: form.transaction_date,
      type, amount: Number(form.amount),
      description: form.description.trim(),
      payment_method: form.payment_method,
      reference_no: form.reference_no,
      party_name: form.party_name || null,
      status: form.status,
      notes: form.notes || null,
    }
    if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)
    if (form.account_id)      payload.account_id      = Number(form.account_id)
    if (form.cost_center_id)  payload.cost_center_id  = Number(form.cost_center_id)
    if (form.project_id)      payload.project_id      = Number(form.project_id)

    const { data: trxData, error } = await supabase.from('finance_treasury').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    if (trxData) {
      const selectedCash = cashAccounts.find(ca => ca.id === Number(form.cash_account_id))
      const cashCode = selectedCash?.account_id ? await getCashAccountCode(selectedCash.id) : '1111'
      const otherCode = form.account_id ? null : (isReceipt ? '1120' : '2110')
      if (otherCode && cashCode) {
        await createJournalEntry({
          tenantId,
          date: form.transaction_date,
          description: `${type} — ${form.description}`,
          referenceType: type, referenceId: trxData.id,
          source: 'آلي',
          lines: isReceipt ? [
            { accountCode: cashCode,  debit: Number(form.amount), credit: 0,                    description: form.description },
            { accountCode: otherCode, debit: 0,                   credit: Number(form.amount),  description: form.party_name || form.description },
          ] : [
            { accountCode: otherCode, debit: Number(form.amount), credit: 0,                    description: form.description },
            { accountCode: cashCode,  debit: 0,                   credit: Number(form.amount),  description: form.party_name || form.description },
          ]
        })
      }
    }
    toast.success(isReceipt ? '✅ تم تسجيل المقبوض والقيد' : '✅ تم تسجيل المدفوع والقيد')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isReceipt
              ? <ArrowUpRight style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
              : <ArrowDownRight style={{ width: '18px', height: '18px', color: '#c81e1e' }} />}
            {isReceipt ? 'سند قبض' : 'سند صرف'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>رقم السند</label>
              <input value={form.reference_no} onChange={e => set('reference_no', e.target.value)} className="input" dir="ltr" />
            </div>
          </div>
          <div>
            <label style={lbl}>البيان *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input"
              placeholder={isReceipt ? 'مثال: تحصيل دفعة مشروع' : 'مثال: سداد فاتورة مورد'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: isReceipt ? '#ecfdf5' : '#fef2f2', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label style={lbl}>المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00"
                style={{ borderColor: isReceipt ? '#bbf7d0' : '#fecaca', background: 'white' }} />
            </div>
            <div>
              <label style={lbl}>{isReceipt ? '💰 استلم في' : '💰 صرف من'}</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                <optgroup label="🏦 حسابات بنكية">
                  {cashAccounts.filter(a => a.account_type === 'بنك').map(a => <option key={a.id} value={a.id}>🏦 {a.name}</option>)}
                </optgroup>
                <optgroup label="💰 صناديق نقدية">
                  {cashAccounts.filter(a => a.account_type === 'صندوق').map(a => <option key={a.id} value={a.id}>💰 {a.name}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>{isReceipt ? 'المُدفِع (العميل)' : 'المُدفَع له (المورد)'}</label>
              <select value={form.party_name} onChange={e => set('party_name', e.target.value)} className="select">
                <option value="">— اختر أو اكتب —</option>
                {(isReceipt ? clients : vendors).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <input value={form.party_name} onChange={e => set('party_name', e.target.value)} className="input" style={{ marginTop: '6px' }}
                placeholder={isReceipt ? 'أو اكتب اسم العميل...' : 'أو اكتب اسم المورد...'} />
            </div>
            <div>
              <label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون مشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
                {['تحويل بنكي', 'نقداً', 'شيك', 'بطاقة ائتمانية'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الحساب المحاسبي</label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="select">
                <option value="">— تلقائي —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>مركز التكلفة</label>
              <select value={form.cost_center_id} onChange={e => set('cost_center_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['معتمد', 'معلق', 'ملغي'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary"
            style={{ background: isReceipt ? '#0ea77b' : '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : (isReceipt ? <ArrowUpRight style={{ width: '15px', height: '15px' }} /> : <ArrowDownRight style={{ width: '15px', height: '15px' }} />)}
            {isReceipt ? 'تسجيل سند القبض' : 'تسجيل سند الصرف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// تاب: تحليل المشاريع
// ════════════════════════════════════════
function ProjectAnalysisTab({ tenantId, projects }: { tenantId: string; projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function loadAnalysis(projectId: string) {
    if (!projectId) { setAnalysis(null); return }
    setLoading(true)
    const pid = Number(projectId)

    const [invRes, expRes, poRes, rcvRes, payRes] = await Promise.all([
      // فواتير البيع
      supabase.from('finance_invoices').select('total_amount, vat_amount, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // المصروفات
      supabase.from('finance_expenses').select('total_amount, expense_type, category, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // أوامر الشراء
      supabase.from('finance_purchase_orders').select('total_amount, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // سندات القبض
      supabase.from('finance_treasury').select('amount, type')
        .eq('tenant_id', tenantId).eq('project_id', pid).eq('type', 'قبض'),
      // سندات الصرف
      supabase.from('finance_treasury').select('amount, type')
        .eq('tenant_id', tenantId).eq('project_id', pid).eq('type', 'صرف'),
    ])

    const invoices  = invRes.data  || []
    const expenses  = expRes.data  || []
    const purchases = poRes.data   || []
    const receipts  = rcvRes.data  || []
    const payments  = payRes.data  || []

    const totalInvoices    = invoices.filter(i => i.status !== 'ملغاة').reduce((s, i) => s + Number(i.total_amount), 0)
    const totalCollected   = receipts.reduce((s, r) => s + Number(r.amount), 0)
    const totalExpenses    = expenses.filter(e => e.status !== 'ملغي').reduce((s, e) => s + Number(e.total_amount), 0)
    const totalPurchases   = purchases.filter(p => p.status !== 'ملغي').reduce((s, p) => s + Number(p.total_amount), 0)
    const totalPaid        = payments.reduce((s, p) => s + Number(p.amount), 0)
    const totalCosts       = totalExpenses + totalPurchases
    const netProfit        = totalInvoices - totalCosts
    const profitMargin     = totalInvoices > 0 ? (netProfit / totalInvoices * 100) : 0
    const uncollected      = totalInvoices - totalCollected

    // تفصيل المصروفات
    const expByType: Record<string, number> = {}
    expenses.filter(e => e.status !== 'ملغي').forEach(e => {
      expByType[e.expense_type] = (expByType[e.expense_type] || 0) + Number(e.total_amount)
    })

    setAnalysis({ totalInvoices, totalCollected, uncollected, totalExpenses, totalPurchases, totalCosts, totalPaid, netProfit, profitMargin, expByType, invoiceCount: invoices.length, expenseCount: expenses.length, purchaseCount: purchases.length })
    setLoading(false)
  }

  const project = projects.find(p => p.id === Number(selectedProject))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* اختيار المشروع */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <BarChart2 style={{ width: '22px', height: '22px', color: '#7c3aed' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>اختر مشروعاً لعرض تحليله المالي:</span>
          <select value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value); loadAnalysis(e.target.value) }}
            className="select" style={{ minWidth: '280px', flex: 1 }}>
            <option value="">— اختر مشروع —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && !analysis && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <BarChart2 style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>اختر مشروعاً لعرض التحليل المالي</p>
        </div>
      )}

      {!loading && analysis && project && (
        <>
          {/* عنوان */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '4px', height: '28px', background: '#7c3aed', borderRadius: '2px' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a2e' }}>التحليل المالي — {project.name}</h2>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
              background: analysis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
              color: analysis.netProfit >= 0 ? '#0ea77b' : '#c81e1e'
            }}>
              {analysis.netProfit >= 0 ? '▲ ربح' : '▼ خسارة'}
            </span>
          </div>

          {/* KPIs الرئيسية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'إجمالي الإيرادات', value: analysis.totalInvoices, color: '#0ea77b', bg: '#ecfdf5', icon: '📄', sub: `${analysis.invoiceCount} فاتورة` },
              { label: 'إجمالي التكاليف',  value: analysis.totalCosts,    color: '#c81e1e', bg: '#fef2f2', icon: '💸', sub: `مصروفات + مشتريات` },
              { label: analysis.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة', value: Math.abs(analysis.netProfit), color: analysis.netProfit >= 0 ? '#0ea77b' : '#c81e1e', bg: analysis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2', icon: analysis.netProfit >= 0 ? '✅' : '⚠️', sub: `هامش ${analysis.profitMargin.toFixed(1)}%` },
              { label: 'نسبة الهامش',      value: analysis.profitMargin.toFixed(1) + '%', color: '#7c3aed', bg: '#f5f3ff', icon: '📊', sub: 'من الإيرادات', isText: true },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '6px' }}>{kpi.icon} {kpi.label}</div>
                <div style={{ fontSize: (kpi as any).isText ? '1.6rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>
                  {(kpi as any).isText ? kpi.value : fmt(Number(kpi.value)) + ' ر.س'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* تفصيل الإيرادات والتحصيل */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem', color: '#0ea77b' }}>💰 الإيرادات والتحصيل</div>
              {[
                { label: 'إجمالي الفواتير',    value: analysis.totalInvoices,  color: '#0ea77b' },
                { label: 'المحصّل (سندات قبض)', value: analysis.totalCollected,  color: '#1a56db' },
                { label: 'غير المحصّل',          value: analysis.uncollected,    color: '#e6820a' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{fmt(row.value)} ر.س</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem', color: '#c81e1e' }}>💸 التكاليف والمدفوعات</div>
              {[
                { label: 'مصروفات المشروع',      value: analysis.totalExpenses,  color: '#e6820a' },
                { label: 'مشتريات المشروع',       value: analysis.totalPurchases, color: '#c81e1e' },
                { label: 'المدفوع (سندات صرف)',   value: analysis.totalPaid,      color: '#1a56db' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{fmt(row.value)} ر.س</span>
                </div>
              ))}
            </div>
          </div>

          {/* تفصيل المصروفات حسب النوع */}
          {Object.keys(analysis.expByType).length > 0 && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem' }}>📋 تفصيل المصروفات حسب النوع</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {Object.entries(analysis.expByType).map(([type, amount]) => (
                  <div key={type} style={{ padding: '12px', background: TYPE_COLOR[type]?.bg || '#f3f4f6', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: TYPE_COLOR[type]?.color || '#374151', fontWeight: 700, marginBottom: '4px' }}>{type}</div>
                    <div style={{ fontWeight: 800, color: TYPE_COLOR[type]?.color || '#374151', fontSize: '0.95rem' }}>{fmt(Number(amount))} ر.س</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceExpensesPage() {
  const { tenant } = useStore()
  type MainTab = 'expenses' | 'receipts' | 'payments' | 'analysis'
  const [mainTab, setMainTab] = useState<MainTab>('expenses')
  const [expenseTab, setExpenseTab] = useState<'مشاريع' | 'تشغيلي' | 'إداري'>('مشاريع')
  const pagination = usePagination(50)

  // بيانات مشتركة
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [vendors,     setVendors]     = useState<Vendor[]>([])
  const [clients,     setClients]     = useState<Client[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])

  // بيانات المصروفات
  const [expenses,    setExpenses]    = useState<Expense[]>([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [showExpModal, setShowExpModal] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)

  // بيانات السندات
  const [vouchers,     setVouchers]     = useState<Transaction[]>([])
  const [voucherLoad,  setVoucherLoad]  = useState(false)
  const [showVoucher,  setShowVoucher]  = useState(false)
  const [voucherType,  setVoucherType]  = useState<'قبض' | 'صرف'>('قبض')

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])
  useEffect(() => {
    if (tenant && (mainTab === 'receipts' || mainTab === 'payments')) loadVouchers()
  }, [mainTab, tenant?.id])

  async function loadAll() {
    if (!tenant) return
    const [accRes, ccRes, projRes, venRes, cliRes, cashRes] = await Promise.all([
      supabase.from('finance_accounts').select('id,code,name,account_type,is_parent').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('finance_cost_centers').select('id,code,name').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_vendors').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('finance_clients').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setAccounts(accRes.data || [])
    setCostCenters(ccRes.data || [])
    setProjects(projRes.data || [])
    setVendors(venRes.data || [])
    setClients(cliRes.data || [])
    setCashAccounts(cashRes.data || [])
    await loadExpenses(1, expenseTab, '')
  }

  async function loadExpenses(page = 1, tab = expenseTab, q = search) {
    if (!tenant) return
    setLoading(true)
    const from = (page - 1) * 50, to = from + 49
    let query = supabase.from('finance_expenses')
      .select('*, project:projects(name), vendor:finance_vendors!finance_expenses_vendor_id_fkey(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id).eq('expense_type', tab)
      .order('expense_date', { ascending: false }).range(from, to)
    if (q) query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    const { data, count } = await query
    setExpenses(data || [])
    pagination.setTotal(count || 0)
    setLoading(false)
  }

  async function loadVouchers() {
    if (!tenant) return
    setVoucherLoad(true)
    const type = mainTab === 'receipts' ? 'قبض' : 'صرف'
    const { data } = await supabase.from('finance_treasury')
      .select('*, cash_account:finance_cash_accounts(name), project:projects(name)')
      .eq('tenant_id', tenant.id).eq('type', type)
      .order('transaction_date', { ascending: false }).limit(100)
    setVouchers(data || [])
    setVoucherLoad(false)
  }

  async function handleDeleteExpense(id: number) {
    if (!confirm('حذف هذا المصروف؟')) return
    await supabase.from('finance_expenses').delete().eq('id', id)
    setExpenses(p => p.filter(e => e.id !== id))
    toast.success('تم الحذف')
  }

  async function handleDeleteVoucher(id: number) {
    if (!confirm('حذف هذا السند؟')) return
    await supabase.from('finance_treasury').delete().eq('id', id)
    setVouchers(p => p.filter(v => v.id !== id))
    toast.success('تم الحذف')
  }

  const totalExp = expenses.reduce((s, e) => s + Number(e.total_amount), 0)
  const totalVouchers = vouchers.reduce((s, v) => s + Number(v.amount), 0)

  const MAIN_TABS = [
    { id: 'expenses', label: '💸 المصروفات',    color: '#e6820a' },
    { id: 'receipts', label: '💵 سندات القبض',  color: '#0ea77b' },
    { id: 'payments', label: '💸 سندات الصرف',  color: '#c81e1e' },
    { id: 'analysis', label: '📊 تحليل المشاريع', color: '#7c3aed' },
  ]
  const EXP_TABS = [
    { id: 'مشاريع', label: '🏗️ مصروفات المشاريع', color: '#1a56db' },
    { id: 'تشغيلي', label: '⚙️ مصروفات تشغيلية',  color: '#e6820a' },
    { id: 'إداري',  label: '🏢 إدارية وعمومية',    color: '#c81e1e' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            المصروفات والمقبوضات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>المصروفات — سندات القبض والصرف — تحليل ربحية المشاريع</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {mainTab === 'expenses' && (
            <button onClick={() => { setEditExpense(null); setShowExpModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> تسجيل مصروف
            </button>
          )}
          {mainTab === 'receipts' && (
            <button onClick={() => { setVoucherType('قبض'); setShowVoucher(true) }} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> سند قبض
            </button>
          )}
          {mainTab === 'payments' && (
            <button onClick={() => { setVoucherType('صرف'); setShowVoucher(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> سند صرف
            </button>
          )}
        </div>
      </div>

      {/* التابات الرئيسية */}
      <div style={{ display: 'flex', gap: '4px', background: '#e5e7eb', padding: '5px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id as MainTab)}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: mainTab === t.id ? t.color : 'transparent',
              color: mainTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: mainTab === t.id ? `0 2px 8px ${t.color}44` : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ تاب المصروفات ══ */}
      {mainTab === 'expenses' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'إجمالي الصفحة',    value: totalExp, color: '#374151', bg: '#f3f4f6' },
              { label: 'مصروفات المشاريع', value: expenseTab === 'مشاريع' ? totalExp : 0, color: '#1a56db', bg: '#eff6ff' },
              { label: 'مصروفات تشغيلية', value: expenseTab === 'تشغيلي' ? totalExp : 0, color: '#e6820a', bg: '#fffbeb' },
              { label: 'إدارية وعمومية',   value: expenseTab === 'إداري'  ? totalExp : 0, color: '#c81e1e', bg: '#fef2f2' },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{fmt(kpi.value)}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label} — ريال</div>
              </div>
            ))}
          </div>

          {/* تابات فرعية */}
          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
            {EXP_TABS.map(t => (
              <button key={t.id} onClick={() => { setExpenseTab(t.id as any); setSearch(''); loadExpenses(1, t.id as any, '') }}
                style={{ padding: '7px 14px', borderRadius: '9px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: expenseTab === t.id ? t.color : 'transparent',
                  color: expenseTab === t.id ? 'white' : 'var(--text3)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* بحث */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); loadExpenses(1, expenseTab, e.target.value) }}
              placeholder="بحث في المصروفات..." className="input" style={{ paddingRight: '32px' }} />
          </div>

          {/* جدول المصروفات */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : expenses.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Receipt style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا توجد مصروفات في هذا التصنيف</p>
              <button onClick={() => { setEditExpense(null); setShowExpModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#e6820a' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول مصروف
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['التاريخ', 'الفئة', 'الوصف', 'المشروع', 'الجهة', 'طريقة الدفع', 'صافي', 'ض.ق.م', 'الإجمالي', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{exp.expense_date}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: TYPE_COLOR[exp.expense_type]?.bg || '#f3f4f6', color: TYPE_COLOR[exp.expense_type]?.color || '#6b7280' }}>{exp.category}</span>
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: '160px' }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</div>
                          {exp.receipt_no && <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>إيصال: {exp.receipt_no}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#1a56db', fontWeight: 600 }}>{exp.project?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{exp.vendor?.name || exp.vendor_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>{exp.payment_method}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(exp.amount)} ر.س</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#e6820a', whiteSpace: 'nowrap' }}>{Number(exp.vat_amount) > 0 ? fmt(exp.vat_amount) + ' ر.س' : '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>{fmt(exp.total_amount)} ر.س</td>
                        <td style={{ padding: '10px 12px' }}><span className={'badge ' + (STATUS_COLOR[exp.status] || 'badge-gray')}>{exp.status}</span></td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditExpense(exp); setShowExpModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                      <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({expenses.length} مصروف)</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{fmt(expenses.reduce((s,e)=>s+Number(e.amount),0))} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a' }}>{fmt(expenses.reduce((s,e)=>s+Number(e.vat_amount),0))} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a' }}>{fmt(totalExp)} ر.س</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {pagination.total > 50 && <div className="card"><pagination.PaginationBar color="#e6820a" /></div>}
        </>
      )}

      {/* ══ تاب سندات القبض / الصرف ══ */}
      {(mainTab === 'receipts' || mainTab === 'payments') && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: mainTab === 'receipts' ? 'إجمالي المقبوضات' : 'إجمالي المدفوعات', value: totalVouchers, color: mainTab === 'receipts' ? '#0ea77b' : '#c81e1e', bg: mainTab === 'receipts' ? '#ecfdf5' : '#fef2f2' },
              { label: 'عدد السندات', value: vouchers.length, color: '#374151', bg: '#f3f4f6', isCount: true },
              { label: 'معتمدة', value: vouchers.filter(v => v.status === 'معتمد').length, color: '#0ea77b', bg: '#ecfdf5', isCount: true },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>
                  {(kpi as any).isCount ? kpi.value : fmt(Number(kpi.value)) + ' ر.س'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {voucherLoad ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: mainTab === 'receipts' ? '#0ea77b' : '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              {mainTab === 'receipts'
                ? <ArrowUpRight style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
                : <ArrowDownRight style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />}
              <p style={{ color: '#9ca3af' }}>لا توجد سندات {mainTab === 'receipts' ? 'قبض' : 'صرف'} بعد</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['رقم السند', 'التاريخ', 'البيان', mainTab === 'receipts' ? 'المُدفِع' : 'المُدفَع له', 'المشروع', 'الحساب', 'المبلغ', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#1a56db', fontWeight: 700 }}>{v.transaction_no}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{v.transaction_date}</td>
                        <td style={{ padding: '10px 12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{v.party_name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#1a56db', fontWeight: 600 }}>{(v as any).project?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(v as any).cash_account?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: mainTab === 'receipts' ? '#0ea77b' : '#c81e1e', whiteSpace: 'nowrap' }}>
                          {mainTab === 'receipts' ? '+' : '-'}{fmt(v.amount)} ر.س
                        </td>
                        <td style={{ padding: '10px 12px' }}><span className={'badge ' + (STATUS_COLOR[v.status] || 'badge-gray')}>{v.status}</span></td>
                        <td style={{ padding: '10px 8px' }}>
                          <button onClick={() => handleDeleteVoucher(v.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                      <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({vouchers.length} سند)</td>
                      <td style={{ padding: '10px 12px', color: mainTab === 'receipts' ? '#0ea77b' : '#c81e1e' }}>{fmt(totalVouchers)} ر.س</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ تاب تحليل المشاريع ══ */}
      {mainTab === 'analysis' && tenant && (
        <ProjectAnalysisTab tenantId={tenant.id} projects={projects} />
      )}

      {/* مودال المصروف */}
      {showExpModal && (
        <ExpenseModal
          expense={editExpense}
          accounts={accounts} costCenters={costCenters}
          projects={projects} vendors={vendors}
          tenantId={tenant!.id}
          onClose={() => { setShowExpModal(false); setEditExpense(null) }}
          onSave={() => { setShowExpModal(false); setEditExpense(null); loadAll() }}
        />
      )}

      {/* مودال السند */}
      {showVoucher && (
        <VoucherModal
          type={voucherType}
          cashAccounts={cashAccounts} accounts={accounts}
          costCenters={costCenters} clients={clients}
          vendors={vendors} projects={projects}
          tenantId={tenant!.id}
          onClose={() => setShowVoucher(false)}
          onSave={() => { setShowVoucher(false); loadVouchers() }}
        />
      )}
    </div>
  )
}
