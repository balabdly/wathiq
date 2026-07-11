// src/app/(dashboard)/finance/expenses/list/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import { createJournalEntry, getCashAccountCode, journalExpense, nextDocNumber, confirmCashSpendById } from '@/lib/journal'
import { useExpenses } from '../ExpensesContext'
import type { Expense, Account, CostCenter, Project, Vendor } from '@/lib/expenses-types'
import { CATEGORIES, STATUS_COLOR, TYPE_COLOR, fmt } from '@/lib/expenses-types'

// ════════════════════════════════════════
// مكوّن: اختيار حساب الدفع (بنك / صندوق / عهدة)
// ════════════════════════════════════════
function CashAccountSelector({ paymentMethod, value, tenantId, onChange }: {
  paymentMethod: string; value: string; tenantId: string; onChange: (v: string) => void
}) {
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [custodies,    setCustodies]    = useState<any[]>([])

  useEffect(() => {
    supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setCashAccounts(data || []))
    // جلب العهد المفتوحة
    supabase.from('finance_employee_custody')
      .select('id, custody_no, employee_name, amount, settled_amount')
      .eq('tenant_id', tenantId)
      .eq('custody_type', 'عهدة نقدية')
      .in('status', ['مفتوحة', 'جزئية'])
      .order('custody_date', { ascending: false })
      .then(({ data }) => setCustodies(data || []))
  }, [tenantId])

  const banks  = cashAccounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const boxes  = cashAccounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')

  if (paymentMethod === 'تحويل بنكي' || paymentMethod === 'شيك' || paymentMethod === 'بطاقة ائتمانية') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="select">
        <option value="">— اختر البنك —</option>
        {banks.map(a => <option key={a.id} value={`cash:${a.id}`}>🏦 {a.name}</option>)}
      </select>
    )
  }

  if (paymentMethod === 'نقداً') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="select">
        <option value="">— اختر الصندوق —</option>
        {boxes.map(a => <option key={a.id} value={`cash:${a.id}`}>💰 {a.name}</option>)}
      </select>
    )
  }

  if (paymentMethod === 'عهدة موظف') {
    return custodies.length === 0 ? (
      <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.78rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
        ⚠️ لا توجد عهد مفتوحة — أصدر عهدة أولاً من صفحة الخزينة
      </div>
    ) : (
      <select value={value} onChange={e => onChange(e.target.value)} className="select">
        <option value="">— اختر العهدة —</option>
        {custodies.map(c => {
          const remaining = Number(c.amount) - Number(c.settled_amount)
          return (
            <option key={c.id} value={`custody:${c.id}`}>
              💼 {c.employee_name} — متبقي: {remaining.toLocaleString()} ر.س
            </option>
          )
        })}
      </select>
    )
  }

  return <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text3)' }}>—</div>
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
function ExpenseModal({ expense, defaultType, accounts, costCenters, projects, vendors, tenantId, onClose, onSave }: {
  expense: Expense | null; defaultType?: 'مشاريع' | 'تشغيلي' | 'إداري'; accounts: Account[]; costCenters: CostCenter[]
  projects: Project[]; vendors: Vendor[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const initialType = expense?.expense_type || defaultType || 'مشاريع'

  const [form, setForm] = useState({
    expense_date:    expense?.expense_date    || today,
    expense_type:    initialType,
    category:        expense?.category        || (CATEGORIES[initialType]?.[0] || CATEGORIES['مشاريع'][0]),
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
    // ══ ضابط الرصيد عند الدفع من حساب نقدي (منع للصندوق، تحذير Overdraft للبنك) ══
    // عند الإنشاء: يفحص المبلغ كاملاً. عند التعديل: يفحص فقط إذا تغيّر حساب الدفع (المبلغ كاملاً على الحساب الجديد)
    // أو زاد المبلغ على نفس الحساب (فرق الزيادة فقط — الأصل محسوب أصلاً بالدفتر)
    if (form.cash_account_id && form.cash_account_id.startsWith('cash:')) {
      const cid = Number(form.cash_account_id.replace('cash:', ''))
      const originalCashId = expense?.id ? Number(expense.cash_account_id || 0) : null
      const accountChanged = expense?.id ? originalCashId !== cid : true
      let checkAmount = totalAmount
      if (expense?.id && !accountChanged) {
        const delta = totalAmount - Number(expense.amount || 0)
        if (delta <= 0) checkAmount = 0   // نفس الحساب وبنفس المبلغ أو أقل — لا حاجة لإعادة الفحص
        else checkAmount = delta
      }
      if (cid && checkAmount > 0 && !(await confirmCashSpendById(tenantId, cid, checkAmount))) return
    }
    setSaving(true)
    try {
      // ══ الرقم النهائي — ذرّي عبر sequence (لا تكرار ولا race conditions) ══
      const expenseNumber = expense?.expense_number || (await nextDocNumber(tenantId, 'EXP', 'EXP'))!

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
      // استخراج cash_account_id الحقيقي (بدون prefix)
      if (form.cash_account_id && form.cash_account_id.startsWith('cash:')) {
        payload.cash_account_id = Number(form.cash_account_id.replace('cash:', ''))
      }
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

      // قيد محاسبي — حسب طريقة الدفع
      if (!expense?.id && savedId && form.account_id && form.cash_account_id) {
        const selectedAcc = leafAccounts.find(a => String(a.id) === form.account_id)
        if (selectedAcc?.code) {
          let creditCode: string | null = null

          if (form.payment_method === 'عهدة موظف' && form.cash_account_id.startsWith('custody:')) {
            // دائن حـ/ عهد المشاريع والمهندسين 1112 (النظام الخماسي المباشر)
            creditCode = '1112'
            // تحديث رصيد العهدة
            const custodyId = Number(form.cash_account_id.replace('custody:', ''))
            const { data: cus } = await supabase.from('finance_employee_custody')
              .select('settled_amount, amount').eq('id', custodyId).single()
            if (cus) {
              const newSettled = Number(cus.settled_amount) + totalAmount
              await supabase.from('finance_employee_custody').update({
                settled_amount: newSettled,
                status: newSettled >= Number(cus.amount) ? 'مُسوَّاة' : 'جزئية',
              }).eq('id', custodyId)
            }
          } else if (form.cash_account_id.startsWith('cash:')) {
            const cashId = Number(form.cash_account_id.replace('cash:', ''))
            creditCode = await getCashAccountCode(cashId)
          }

          if (creditCode) {
            const jr = await journalExpense({
              tenantId,
              date:               form.expense_date,
              description:        form.description,
              category:           form.expense_type,
              expenseId:          savedId,
              amount:             netAmount,
              vatAmount,
              total:              totalAmount,
              expenseAccountCode: selectedAcc.code,
              creditAccountCode:  creditCode,
              costCenterId:       form.cost_center_id ? Number(form.cost_center_id) : undefined,
            })
            if (!jr) {
              toast.error('⚠️ المصروف حُفظ لكن القيد المحاسبي فشل — راجع شجرة الحسابات', { duration: 8000 })
              onSave(); setSaving(false); return
            }
          }
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
              <select value={form.payment_method} onChange={e => { set('payment_method', e.target.value); set('cash_account_id', '') }} className="select">
                {['تحويل بنكي', 'نقداً', 'عهدة موظف'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>حساب الدفع</label>
              <CashAccountSelector paymentMethod={form.payment_method} value={form.cash_account_id} tenantId={tenantId} onChange={v => set('cash_account_id', v)} />
            </div>
          </div>

          {costCenters.length > 0 && (
            <div>
              <label style={lbl}>مركز التكلفة</label>
              <select value={form.cost_center_id} onChange={e => set('cost_center_id', e.target.value)} className="select">
                <option value="">— بدون —</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
          )}

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
// الصفحة
// ════════════════════════════════════════
export default function ExpensesListPage() {
  const { tenantId, accounts, costCenters, projects, vendors } = useExpenses()
  const [expenseTab, setExpenseTab] = useState<'مشاريع' | 'تشغيلي' | 'إداري'>('مشاريع')
  const pagination = usePagination(50)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [showExpModal, setShowExpModal] = useState(false)
  const [editExpense, setEditExpense]   = useState<Expense | null>(null)

  useEffect(() => { if (tenantId) loadExpenses(1, expenseTab, search) }, [tenantId])

  async function loadExpenses(page = 1, tab = expenseTab, q = search) {
    if (!tenantId) return
    setLoading(true)
    const from = (page - 1) * 50, to = from + 49
    let query = supabase.from('finance_expenses')
      .select('*, project:projects(name), vendor:finance_vendors!finance_expenses_vendor_id_fkey(name)', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('expense_type', tab)
      .order('expense_date', { ascending: false }).range(from, to)
    if (q) query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    const { data, count } = await query
    setExpenses(data || [])
    pagination.setTotal(count || 0)
    setLoading(false)
  }

  async function handleDeleteExpense(id: number) {
    if (!confirm('حذف هذا المصروف؟')) return
    await supabase.from('finance_expenses').delete().eq('id', id)
    setExpenses(p => p.filter(e => e.id !== id))
    toast.success('تم الحذف')
  }

  const totalExp = expenses.reduce((s, e) => s + Number(e.total_amount), 0)

  const EXP_TABS = [
    { id: 'مشاريع', label: '🏗️ مصروفات المشاريع', color: '#1a56db' },
    { id: 'تشغيلي', label: '⚙️ مصروفات تشغيلية',  color: '#e6820a' },
    { id: 'إداري',  label: '🏢 إدارية وعمومية',    color: '#c81e1e' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setEditExpense(null); setShowExpModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> تسجيل مصروف
        </button>
      </div>

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

      {showExpModal && (
        <ExpenseModal expense={editExpense} defaultType={expenseTab} accounts={accounts} costCenters={costCenters} projects={projects} vendors={vendors} tenantId={tenantId!}
          onClose={() => { setShowExpModal(false); setEditExpense(null) }}
          onSave={() => { setShowExpModal(false); setEditExpense(null); loadExpenses(pagination.page, expenseTab, search) }} />
      )}
    </div>
  )
}
