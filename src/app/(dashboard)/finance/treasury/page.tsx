'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Wallet, ArrowUpRight, ArrowDownRight, Building2, Users } from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string
  opening_balance: number; is_active: boolean; notes?: string
  balance?: number
}

type Transaction = {
  id: number; transaction_no: string; transaction_date: string
  type: string; amount: number; description: string
  cash_account_id?: number; payment_method: string
  reference_type?: string; reference_no?: string
  account_id?: number; cost_center_id?: number
  party_name?: string; status: string; notes?: string
  cash_account?: { name: string }
  account?: { code: string; name: string }
}

type Custody = {
  id: number; custody_no: string; custody_date: string
  employee_id?: number; employee_name: string
  custody_type: string; amount: number; purpose: string
  project_id?: number; due_date?: string
  settled_amount: number; settled_date?: string
  status: string; notes?: string
  project?: { name: string }
  employee?: { name: string }
}

type Account    = { id: number; code: string; name: string }
type CostCenter = { id: number; name: string }
type Project    = { id: number; name: string }
type Employee   = { id: number; name: string }

// ════════════════════════════════════════
// مودال: إضافة حساب نقدي
// ════════════════════════════════════════
function CashAccountModal({ account, tenantId, onClose, onSave }: {
  account: CashAccount | null; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:            account?.name            || '',
    account_type:    account?.account_type    || 'بنك',
    bank_name:       account?.bank_name       || '',
    account_no:      account?.account_no      || '',
    iban:            account?.iban            || '',
    opening_balance: account?.opening_balance ? String(account.opening_balance) : '0',
    is_active:       account?.is_active       ?? true,
    notes:           account?.notes           || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم الحساب مطلوب'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, name: form.name.trim(),
      account_type: form.account_type,
      bank_name: form.bank_name || null,
      account_no: form.account_no || null,
      iban: form.iban || null,
      opening_balance: Number(form.opening_balance) || 0,
      is_active: form.is_active,
      notes: form.notes || null,
    }
    if (account) {
  await supabase.from('finance_cash_accounts').update(payload).eq('id', account.id)
} else {
  const { data: newAcc } = await supabase.from('finance_cash_accounts').insert(payload).select('id').single()
  if (newAcc) {
    const { data: parent } = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', '1110').single()
    if (parent) {
      const { count } = await supabase.from('finance_accounts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('parent_id', parent.id)
      await supabase.from('finance_accounts').insert({
        tenant_id: tenantId,
        code: `111${(count || 0) + 1}`,
        name: form.name.trim(),
        name_en: form.bank_name || form.name.trim(),
        account_type: 'أصول',
        account_class: 'ميزانية',
        parent_id: parent.id,
        level: 4,
        is_parent: false,
        normal_balance: 'مدين',
        is_active: true,
      })
    }
  }
}
toast.success(account ? 'تم التعديل ✅' : '✅ تمت الإضافة وأُنشئ الحساب في الشجرة')
onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {account ? 'تعديل حساب نقدي' : 'إضافة حساب نقدي'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['صندوق', 'بنك'].map(t => (
              <button key={t} type="button" onClick={() => set('account_type', t)}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
                  borderColor: form.account_type === t ? 'var(--primary)' : 'var(--border)',
                  background: form.account_type === t ? 'var(--primary-light)' : 'white',
                  color: form.account_type === t ? 'var(--primary)' : 'var(--text3)' }}>
                {t === 'صندوق' ? '💰 صندوق نقدي' : '🏦 حساب بنكي'}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: الصندوق الرئيسي" />
          </div>
          {form.account_type === 'بنك' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم البنك</label>
                  <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" placeholder="بنك الراجحي" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الحساب</label>
                  <input value={form.account_no} onChange={e => set('account_no', e.target.value)} className="input" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN</label>
                <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} className="input" dir="ltr" placeholder="SA..." />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الرصيد الافتتاحي</label>
            <input type="number" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} className="input" dir="ltr" min="0" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {account ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إضافة حركة (قبض / صرف)
// ════════════════════════════════════════
function TransactionModal({ type, cashAccounts, accounts, costCenters, tenantId, onClose, onSave }: {
  type: 'قبض' | 'صرف'; cashAccounts: CashAccount[]
  accounts: Account[]; costCenters: CostCenter[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    transaction_date: today,
    amount:           '',
    description:      '',
    cash_account_id:  cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    payment_method:   type === 'قبض' ? 'تحويل بنكي' : 'تحويل بنكي',
    reference_no:     '',
    reference_type:   '',
    account_id:       '',
    cost_center_id:   '',
    party_name:       '',
    status:           'معتمد',
    notes:            '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { generateNumber() }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_treasury').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const prefix = type === 'قبض' ? 'RCV' : 'PAY'
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

    const { data: trxData, error } = await supabase.from('finance_treasury').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    // ══ قيد محاسبي تلقائي للحركة ══
    if (trxData) {
      const cashAccountCode = '1111' // الصندوق الرئيسي (افتراضي)
      const otherAccountCode = form.account_id
        ? null // المستخدم اختار الحساب
        : type === 'قبض' ? '1120'  // ذمم مدينة (افتراضي للقبض)
        : '2110'                    // ذمم دائنة (افتراضي للصرف)

      if (otherAccountCode) {
        await createJournalEntry(tenantId, {
          date:          form.transaction_date,
          description:   `${type} — ${form.description}`,
          referenceType: type,
          referenceId:   trxData.id,
          lines: type === 'قبض' ? [
            // قبض: مدين الصندوق، دائن الحساب الآخر
            { accountCode: cashAccountCode,  debit: Number(form.amount), credit: 0,                   description: form.description },
            { accountCode: otherAccountCode, debit: 0,                   credit: Number(form.amount), description: form.party_name || form.description },
          ] : [
            // صرف: مدين الحساب الآخر، دائن الصندوق
            { accountCode: otherAccountCode, debit: Number(form.amount), credit: 0,                   description: form.description },
            { accountCode: cashAccountCode,  debit: 0,                   credit: Number(form.amount), description: form.party_name || form.description },
          ]
        })
      }
    }

    toast.success(type === 'قبض' ? '✅ تم تسجيل المقبوض والقيد' : '✅ تم تسجيل المدفوع والقيد')
    onSave(); setSaving(false)
  }

  const isReceipt = type === 'قبض'

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isReceipt
              ? <ArrowUpRight style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
              : <ArrowDownRight style={{ width: '18px', height: '18px', color: '#c81e1e' }} />}
            {isReceipt ? 'إضافة مقبوض' : 'إضافة مدفوع'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ *</label>
              <input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المرجع</label>
              <input value={form.reference_no} onChange={e => set('reference_no', e.target.value)} className="input" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">البيان *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input"
              placeholder={isReceipt ? 'مثال: تحصيل فاتورة رقم INV-2026-0001' : 'مثال: سداد فاتورة مورد رقم VINV-2026-0001'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: isReceipt ? '#ecfdf5' : '#fef2f2', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00"
                style={{ borderColor: isReceipt ? '#bbf7d0' : '#fecaca', background: 'white' }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحساب النقدي</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{isReceipt ? 'المُدفِع' : 'المُدفَع له'}</label>
              <input value={form.party_name} onChange={e => set('party_name', e.target.value)} className="input"
                placeholder={isReceipt ? 'اسم العميل أو الجهة' : 'اسم المورد أو الجهة'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
                {['تحويل بنكي', 'نقداً', 'شيك', 'بطاقة ائتمانية'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحساب المحاسبي</label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مركز التكلفة</label>
              <select value={form.cost_center_id} onChange={e => set('cost_center_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['معتمد', 'معلق', 'ملغي'].map(s => <option key={s}>{s}</option>)}
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
          <button onClick={handleSave} disabled={saving} className="btn btn-primary"
            style={{ background: isReceipt ? '#0ea77b' : '#c81e1e' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isReceipt ? '💵' : '💸')}
            {isReceipt ? 'تسجيل المقبوض' : 'تسجيل المدفوع'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عهدة موظف
// ════════════════════════════════════════
function CustodyModal({ custody, employees, projects, cashAccounts, tenantId, onClose, onSave }: {
  custody: Custody | null; employees: Employee[]; projects: Project[]
  cashAccounts: CashAccount[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    custody_date:   custody?.custody_date   || today,
    employee_id:    custody?.employee_id    ? String(custody.employee_id) : '',
    employee_name:  custody?.employee_name  || '',
    custody_type:   custody?.custody_type   || 'عهدة نقدية',
    amount:         custody?.amount         ? String(custody.amount) : '',
    purpose:        custody?.purpose        || '',
    project_id:     custody?.project_id     ? String(custody.project_id) : '',
    due_date:       custody?.due_date       || '',
    cash_account_id: cashAccounts[0]?.id    ? String(cashAccounts[0].id) : '',
    notes:          custody?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleEmployeeSelect(empId: string) {
    set('employee_id', empId)
    const emp = employees.find(e => e.id === Number(empId))
    if (emp) set('employee_name', emp.name)
  }

  async function handleSave() {
    if (!form.employee_name.trim()) { toast.error('اسم الموظف مطلوب'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('المبلغ مطلوب'); return }
    if (!form.purpose.trim()) { toast.error('الغرض مطلوب'); return }
    setSaving(true)

    // رقم العهدة
    const { count } = await supabase.from('finance_employee_custody').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const custodyNo = `CUS-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

    const payload: Record<string, any> = {
      tenant_id: tenantId, custody_no: custodyNo,
      custody_date: form.custody_date,
      employee_name: form.employee_name.trim(),
      custody_type: form.custody_type,
      amount: Number(form.amount),
      purpose: form.purpose.trim(),
      due_date: form.due_date || null,
      settled_amount: 0, status: 'مفتوحة',
      notes: form.notes || null,
    }
    if (form.employee_id) payload.employee_id = Number(form.employee_id)
    if (form.project_id)  payload.project_id  = Number(form.project_id)

    const { error } = await supabase.from('finance_employee_custody').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    // حركة صرف من الصندوق
    if (form.cash_account_id) {
      await supabase.from('finance_treasury').insert({
        tenant_id: tenantId,
        transaction_no: `PAY-CUS-${custodyNo}`,
        transaction_date: form.custody_date,
        type: 'صرف',
        amount: Number(form.amount),
        description: `عهدة نقدية — ${form.employee_name} — ${form.purpose}`,
        cash_account_id: Number(form.cash_account_id),
        payment_method: 'نقداً',
        reference_type: 'عهدة',
        party_name: form.employee_name,
        status: 'معتمد',
      })
    }

    toast.success('✅ تم إصدار العهدة وتسجيل حركة الصرف')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {custody ? 'تعديل عهدة' : 'إصدار عهدة موظف'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع العهدة */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['عهدة نقدية', 'سلفة راتب'].map(t => (
              <button key={t} type="button" onClick={() => set('custody_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                  borderColor: form.custody_type === t ? '#e6820a' : 'var(--border)',
                  background: form.custody_type === t ? '#fffbeb' : 'white',
                  color: form.custody_type === t ? '#e6820a' : 'var(--text3)' }}>
                {t === 'عهدة نقدية' ? '💼 عهدة نقدية' : '💳 سلفة راتب'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف *</label>
              <select value={form.employee_id} onChange={e => handleEmployeeSelect(e.target.value)} className="select">
                <option value="">— اختر الموظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">أو أدخل الاسم يدوياً</label>
              <input value={form.employee_name} onChange={e => set('employee_name', e.target.value)} className="input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار *</label>
              <input type="date" value={form.custody_date} onChange={e => set('custody_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الصرف من</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الغرض *</label>
            <input value={form.purpose} onChange={e => set('purpose', e.target.value)} className="input" placeholder="مثال: مصروفات موقع مشروع الراشد" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— اختياري —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1e40af' }}>
            ℹ️ سيُسجَّل تلقائياً حركة صرف من الحساب النقدي المحدد
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            إصدار العهدة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تسوية عهدة
// ════════════════════════════════════════
function SettleCustodyModal({ custody, cashAccounts, tenantId, onClose, onSave }: {
  custody: Custody; cashAccounts: CashAccount[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const remaining = custody.amount - custody.settled_amount
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    settled_amount:  String(remaining),
    settled_date:    today,
    cash_account_id: cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const settledAmt = Number(form.settled_amount) || 0
  const returnAmt  = remaining - settledAmt

  async function handleSettle() {
    if (settledAmt <= 0) { toast.error('أدخل المبلغ المُسوَّى'); return }
    setSaving(true)

    await supabase.from('finance_employee_custody').update({
      settled_amount: custody.settled_amount + settledAmt,
      settled_date:   form.settled_date,
      status:         settledAmt >= remaining ? 'مُسوَّاة' : 'جزئية',
      notes:          form.notes || null,
    }).eq('id', custody.id)

    // إذا رجع مبلغ للصندوق
    if (returnAmt > 0 && form.cash_account_id) {
      await supabase.from('finance_treasury').insert({
        tenant_id: tenantId,
        transaction_no: `RCV-CUS-${custody.custody_no}`,
        transaction_date: form.settled_date,
        type: 'قبض',
        amount: returnAmt,
        description: `إرجاع فائض عهدة — ${custody.employee_name}`,
        cash_account_id: Number(form.cash_account_id),
        payment_method: 'نقداً',
        reference_type: 'عهدة',
        party_name: custody.employee_name,
        status: 'معتمد',
      })
    }

    toast.success('✅ تمت التسوية' + (returnAmt > 0 ? ` — تم إرجاع ${returnAmt.toLocaleString()} ر.س للصندوق` : ''))
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ تسوية عهدة — {custody.employee_name}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
            {[
              { label: 'إجمالي العهدة',    value: custody.amount,           color: '#374151', bg: '#f3f4f6' },
              { label: 'تم تسويته',         value: custody.settled_amount,   color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'المتبقي',           value: remaining,                color: '#c81e1e', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px', background: s.bg, borderRadius: '8px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{s.label} ر.س</div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ المُسوَّى (المصروف فعلاً)</label>
            <input type="number" value={form.settled_amount} onChange={e => set('settled_amount', e.target.value)} className="input" dir="ltr" max={remaining} />
          </div>

          {returnAmt > 0 && (
            <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
              💰 سيُرجَع للصندوق: {returnAmt.toLocaleString()} ر.س
            </div>
          )}
          {returnAmt < 0 && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.82rem', color: '#991b1b', fontWeight: 600 }}>
              ⚠️ المبلغ المُسوَّى أكبر من العهدة — تحقق من المبلغ
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التسوية</label>
              <input type="date" value={form.settled_date} onChange={e => set('settled_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الصندوق</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSettle} disabled={saving || returnAmt < 0} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✅'}
            تسوية العهدة
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
export default function FinanceTreasuryPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'transactions' | 'receipts' | 'payments' | 'custody' | 'accounts'>('transactions')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [custodies,    setCustodies]    = useState<Custody[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [costCenters,  setCostCenters]  = useState<CostCenter[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')

  // مودالات
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCustodyModal, setShowCustodyModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showSettleModal,  setShowSettleModal]  = useState(false)
  const [editAccount,   setEditAccount]   = useState<CashAccount | null>(null)
  const [settleCustody, setSettleCustody] = useState<Custody | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [trRes, cusRes, caRes, accRes, ccRes, projRes, empRes] = await Promise.all([
      supabase.from('finance_treasury').select('*, cash_account:finance_cash_accounts(name), account:finance_accounts(code,name)').eq('tenant_id', tenant.id).order('transaction_date', { ascending: false }).limit(200),
      supabase.from('finance_employee_custody').select('*, project:projects(name)').eq('tenant_id', tenant.id).order('custody_date', { ascending: false }),
      supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_accounts').select('id,code,name').eq('tenant_id', tenant.id).eq('is_parent', false).order('code'),
      supabase.from('finance_cost_centers').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    setTransactions(trRes.data || [])
    setCustodies(cusRes.data || [])

    // حساب الرصيد لكل حساب نقدي
    const trData = trRes.data || []
    const caData = (caRes.data || []).map((ca: CashAccount) => {
      const cashIn  = trData.filter((t: Transaction) => t.type === 'قبض' && t.cash_account_id === ca.id).reduce((s: number, t: Transaction) => s + Number(t.amount), 0)
      const cashOut = trData.filter((t: Transaction) => t.type === 'صرف' && t.cash_account_id === ca.id).reduce((s: number, t: Transaction) => s + Number(t.amount), 0)
      return { ...ca, balance: Number(ca.opening_balance) + cashIn - cashOut }
    })
    setCashAccounts(caData)
    setAccounts(accRes.data || [])
    setCostCenters(ccRes.data || [])
    setProjects(projRes.data || [])
    setEmployees(empRes.data || [])
    setLoading(false)
  }

  // إحصائيات
  const totalIn  = transactions.filter(t => t.type === 'قبض').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = transactions.filter(t => t.type === 'صرف').reduce((s, t) => s + Number(t.amount), 0)
  const netBalance = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const openCustodies = custodies.filter(c => c.status === 'مفتوحة').reduce((s, c) => s + Number(c.amount) - Number(c.settled_amount), 0)

  const receipts = transactions.filter(t => t.type === 'قبض')
  const payments = transactions.filter(t => t.type === 'صرف')

  const filtered = (activeTab === 'receipts' ? receipts
    : activeTab === 'payments' ? payments
    : transactions).filter(t =>
      !search || t.description.includes(search) || (t.party_name || '').includes(search) || t.transaction_no.includes(search)
  )

  const TABS = [
    { id: 'transactions', label: '📋 كل الحركات',        color: '#374151' },
    { id: 'receipts',     label: '💵 المقبوضات',          color: '#0ea77b' },
    { id: 'payments',     label: '💸 المدفوعات',          color: '#c81e1e' },
    { id: 'custody',      label: '👤 عهد الموظفين',       color: '#e6820a' },
    { id: 'accounts',     label: '🏦 الحسابات النقدية',   color: '#1a56db' },
  ]

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            الخزينة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>المقبوضات والمدفوعات — عهد الموظفين — الحسابات النقدية</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(activeTab === 'transactions' || activeTab === 'receipts') && (
            <button onClick={() => setShowReceiptModal(true)} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> قبض
            </button>
          )}
          {(activeTab === 'transactions' || activeTab === 'payments') && (
            <button onClick={() => setShowPaymentModal(true)} className="btn btn-primary" style={{ background: '#c81e1e' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> صرف
            </button>
          )}
          {activeTab === 'custody' && (
            <button onClick={() => setShowCustodyModal(true)} className="btn btn-primary" style={{ background: '#e6820a' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إصدار عهدة
            </button>
          )}
          {activeTab === 'accounts' && (
            <button onClick={() => { setEditAccount(null); setShowAccountModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة حساب
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'الرصيد الإجمالي',   value: netBalance, color: '#1a56db', bg: 'linear-gradient(135deg, #1a56db, #3b82f6)', white: true },
          { label: 'إجمالي المقبوضات',  value: totalIn,    color: '#0ea77b', bg: '#ecfdf5', white: false },
          { label: 'إجمالي المدفوعات',  value: totalOut,   color: '#c81e1e', bg: '#fef2f2', white: false },
          { label: 'عهد مفتوحة',        value: openCustodies, color: '#e6820a', bg: '#fffbeb', white: false },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg, color: kpi.white ? 'white' : 'inherit' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.white ? 'white' : kpi.color }}>{kpi.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: kpi.white ? 'rgba(255,255,255,0.8)' : '#9ca3af', marginTop: '3px' }}>{kpi.label} — ريال</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); setSearch('') }}
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* بحث */}
      {activeTab !== 'accounts' && activeTab !== 'custody' && (
        <div style={{ position: 'relative', width: '240px' }}>
          <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
        </div>
      )}

      {/* ══ الحركات ══ */}
      {(activeTab === 'transactions' || activeTab === 'receipts' || activeTab === 'payments') && (
        loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        : filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Wallet style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af' }}>لا توجد حركات بعد</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ', 'النوع', 'البيان', 'الجهة', 'الحساب النقدي', 'طريقة الدفع', 'المبلغ', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{t.transaction_date}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                          background: t.type === 'قبض' ? '#ecfdf5' : '#fef2f2',
                          color: t.type === 'قبض' ? '#0ea77b' : '#c81e1e' }}>
                          {t.type === 'قبض'
                            ? <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                            : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{t.transaction_no}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{t.party_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                        {t.cash_account?.name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{t.payment_method}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap',
                        color: t.type === 'قبض' ? '#0ea77b' : '#c81e1e' }}>
                        {t.type === 'قبض' ? '+' : '-'}{Number(t.amount).toLocaleString()} ر.س
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={'badge ' + (t.status === 'معتمد' ? 'badge-green' : t.status === 'معلق' ? 'badge-amber' : 'badge-gray')}>{t.status}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <button onClick={async () => { if(!confirm('حذف هذه الحركة؟')) return; await supabase.from('finance_treasury').delete().eq('id', t.id); loadAll(); toast.success('تم الحذف') }} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                    <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length})</td>
                    <td style={{ padding: '10px 12px',
                      color: activeTab === 'receipts' ? '#0ea77b' : activeTab === 'payments' ? '#c81e1e' : 'var(--text)' }}>
                      {filtered.reduce((s,t)=>s+Number(t.amount),0).toLocaleString()} ر.س
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      {/* ══ عهد الموظفين ══ */}
      {activeTab === 'custody' && (
        loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        : custodies.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af' }}>لا توجد عهد مفتوحة</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم العهدة', 'الموظف', 'النوع', 'الغرض', 'المشروع', 'التاريخ', 'الاستحقاق', 'العهدة', 'المُسوَّى', 'المتبقي', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {custodies.map(c => {
                  const remaining = Number(c.amount) - Number(c.settled_amount)
                  const isOverdue = c.due_date && c.due_date < new Date().toISOString().split('T')[0] && c.status === 'مفتوحة'
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#e6820a', fontSize: '0.8rem' }}>{c.custody_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.employee_name}</td>
                      <td style={{ padding: '10px 12px' }}><span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{c.custody_type}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.purpose}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{c.project?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{c.custody_date}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', color: isOverdue ? '#c81e1e' : 'inherit' }}>
                        {c.due_date || '—'} {isOverdue && '⚠️'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#e6820a' }}>{Number(c.amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#0ea77b' }}>{Number(c.settled_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: remaining > 0 ? '#c81e1e' : '#0ea77b' }}>{remaining.toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={'badge ' + (c.status === 'مُسوَّاة' ? 'badge-green' : c.status === 'جزئية' ? 'badge-amber' : 'badge-blue')}>{c.status}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {c.status !== 'مُسوَّاة' && (
                          <button onClick={() => { setSettleCustody(c); setShowSettleModal(true) }}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                            تسوية
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ══ الحسابات النقدية ══ */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* بطاقات الأرصدة */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
            {cashAccounts.map(ca => (
              <div key={ca.id} className="card" style={{ padding: '20px', borderTop: '3px solid ' + (ca.account_type === 'صندوق' ? '#e6820a' : '#1a56db') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                      {ca.account_type === 'صندوق' ? '💰' : '🏦'} {ca.name}
                    </div>
                    {ca.bank_name && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{ca.bank_name}</div>}
                    {ca.iban && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{ca.iban.substring(0, 14)}...</div>}
                  </div>
                  <button onClick={() => { setEditAccount(ca); setShowAccountModal(true) }} className="btn btn-ghost btn-xs">
                    <Pencil style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px' }}>الرصيد الحالي</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (ca.balance || 0) >= 0 ? '#1a56db' : '#c81e1e' }}>
                    {(ca.balance || 0).toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>ر.س</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* المودالات */}
      {showReceiptModal && (
        <TransactionModal type="قبض" cashAccounts={cashAccounts} accounts={accounts} costCenters={costCenters}
          tenantId={tenant!.id} onClose={() => setShowReceiptModal(false)} onSave={() => { setShowReceiptModal(false); loadAll() }} />
      )}
      {showPaymentModal && (
        <TransactionModal type="صرف" cashAccounts={cashAccounts} accounts={accounts} costCenters={costCenters}
          tenantId={tenant!.id} onClose={() => setShowPaymentModal(false)} onSave={() => { setShowPaymentModal(false); loadAll() }} />
      )}
      {showCustodyModal && (
        <CustodyModal custody={null} employees={employees} projects={projects} cashAccounts={cashAccounts}
          tenantId={tenant!.id} onClose={() => setShowCustodyModal(false)} onSave={() => { setShowCustodyModal(false); loadAll() }} />
      )}
      {showAccountModal && (
        <CashAccountModal account={editAccount} tenantId={tenant!.id}
          onClose={() => { setShowAccountModal(false); setEditAccount(null) }}
          onSave={() => { setShowAccountModal(false); setEditAccount(null); loadAll() }} />
      )}
      {showSettleModal && settleCustody && (
        <SettleCustodyModal custody={settleCustody} cashAccounts={cashAccounts}
          tenantId={tenant!.id} onClose={() => { setShowSettleModal(false); setSettleCustody(null) }}
          onSave={() => { setShowSettleModal(false); setSettleCustody(null); loadAll() }} />
      )}
    </div>
  )
}
