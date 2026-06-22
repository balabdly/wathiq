'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Wallet, Users, ArrowLeftRight, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string
  opening_balance: number; is_active: boolean; notes?: string
  balance?: number; account_id?: number
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
// دوال مساعدة للقيود المحاسبية
// ════════════════════════════════════════
async function getCashAccountCode(tenantId: string, accountId: number): Promise<string | null> {
  const { data } = await supabase.from('finance_accounts').select('code').eq('id', accountId).single()
  return data?.code || null
}

async function getAccountId(tenantId: string, code: string): Promise<number | null> {
  const { data } = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', code).single()
  return data?.id || null
}

async function createJournalEntry(tenantId: string, params: {
  date: string; description: string
  referenceType: string; referenceId?: number
  lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
  const lineIds = await Promise.all(params.lines.map(async l => ({ ...l, account_id: await getAccountId(tenantId, l.accountCode) })))
  if (lineIds.some(l => !l.account_id)) { console.warn('حسابات غير موجودة — تخطي القيد'); return null }
  const totalDebit  = lineIds.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lineIds.reduce((s, l) => s + l.credit, 0)
  const { count } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const entryNumber = `JE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: entry, error } = await supabase.from('finance_journal_entries').insert({
    tenant_id: tenantId, entry_number: entryNumber, entry_date: params.date,
    description: params.description, reference_type: params.referenceType,
    reference_id: params.referenceId, total_debit: totalDebit, total_credit: totalCredit, status: 'معتمد',
  }).select('id').single()
  if (error || !entry) return null
  await supabase.from('finance_journal_lines').insert(
    lineIds.map(l => ({ entry_id: entry.id, account_id: l.account_id, debit: l.debit, credit: l.credit, description: l.description || null }))
  )
  return entry.id
}

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
    try {
      const payload: Record<string, any> = {
        tenant_id:       tenantId,
        name:            form.name.trim(),
        account_type:    form.account_type,
        bank_name:       form.bank_name   || null,
        account_no:      form.account_no  || null,
        iban:            form.iban        || null,
        opening_balance: Number(form.opening_balance) || 0,
        is_active:       form.is_active,
        notes:           form.notes       || null,
      }

      if (account) {
        // ── تعديل حساب موجود ──
        await supabase.from('finance_cash_accounts').update(payload).eq('id', account.id)
        if (account.account_id) {
          await supabase.from('finance_accounts')
            .update({ name: form.name.trim(), notes: form.iban || form.account_no || null })
            .eq('id', account.account_id)
        }
        toast.success('✅ تم التعديل')

      } else {
        // ── إضافة حساب جديد ──
        const { data: parent } = await supabase
          .from('finance_accounts').select('id')
          .eq('tenant_id', tenantId).eq('code', '1110').single()

        let newAccountId: number | null = null
        let newCode: string | null = null

        if (parent) {
          const { data: siblings } = await supabase
            .from('finance_accounts').select('code')
            .eq('tenant_id', tenantId).eq('parent_id', parent.id)
            .order('code', { ascending: false }).limit(1)

          const lastCode = siblings?.[0]?.code ? parseInt(siblings[0].code) : 1110
          newCode = String(lastCode + 1)

          const { data: newAcc, error: accErr } = await supabase
            .from('finance_accounts').insert({
              tenant_id:      tenantId,
              code:           newCode,
              name:           form.name.trim(),
              name_en:        form.bank_name || form.name.trim(),
              account_type:   'أصول',
              account_class:  'ميزانية',
              parent_id:      parent.id,
              level:          4,
              is_parent:      false,
              normal_balance: 'مدين',
              is_active:      true,
              notes:          form.iban || form.account_no || null,
            }).select('id').single()

          if (!accErr && newAcc) newAccountId = newAcc.id
        }

        if (newAccountId) payload.account_id = newAccountId
        await supabase.from('finance_cash_accounts').insert(payload)

        // ✅ قيد الرصيد الافتتاحي
        if (newAccountId && newCode && Number(form.opening_balance) > 0) {
          await createJournalEntry(tenantId, {
            date:          new Date().toISOString().split('T')[0],
            description:   `رصيد افتتاحي — ${form.name.trim()}`,
            referenceType: 'رصيد افتتاحي',
            referenceId:   newAccountId,
            lines: [
              { accountCode: newCode, debit: Number(form.opening_balance), credit: 0,                            description: `رصيد افتتاحي ${form.name.trim()}` },
              { accountCode: '3110',  debit: 0,                            credit: Number(form.opening_balance), description: 'أرصدة افتتاحية' },
            ]
          })
        }

        toast.success(newAccountId
          ? '✅ تمت الإضافة وأُنشئ الحساب في شجرة الحسابات' + (Number(form.opening_balance) > 0 ? ' وسُجّل الرصيد الافتتاحي' : '')
          : '✅ تمت الإضافة (تعذر إنشاء الحساب في الشجرة)'
        )
      }

      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {account ? 'تعديل حساب نقدي' : 'إضافة حساب نقدي'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
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
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الاسم *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: بنك الراجحي" />
          </div>
          {form.account_type === 'بنك' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>اسم البنك</label>
                  <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" placeholder="بنك الراجحي" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الحساب</label>
                  <input value={form.account_no} onChange={e => set('account_no', e.target.value)} className="input" dir="ltr" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم IBAN</label>
                <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} className="input" dir="ltr" placeholder="SA..." />
              </div>
            </>
          )}
          {/* الرصيد الافتتاحي — عند الإنشاء فقط */}
          {!account ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الرصيد الافتتاحي</label>
              <input type="number" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
              {Number(form.opening_balance) > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#0ea77b' }}>
                  ✅ سيُسجَّل قيد افتتاحي تلقائياً في شجرة الحسابات
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: '#fef9ec', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e' }}>
              🔒 الرصيد الافتتاحي لا يُعدَّل مباشرة — لتصحيح الرصيد سجّل قيداً تصحيحياً من صفحة القيود اليومية
            </div>
          )}
          {!account && (
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1e40af' }}>
              ℹ️ سيُضاف الحساب تلقائياً في شجرة الحسابات تحت <strong>1110 — الصندوق والبنوك</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {account ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عهدة موظف (مصروف على الشركة)
// ════════════════════════════════════════
function CustodyModal({ employees, projects, cashAccounts, tenantId, onClose, onSave }: {
  employees: Employee[]; projects: Project[]
  cashAccounts: CashAccount[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    custody_date:    today,
    employee_id:     '',
    employee_name:   '',
    amount:          '',
    purpose:         '',
    project_id:      '',
    due_date:        '',
    cash_account_id: cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.employee_name.trim()) { toast.error('اسم الموظف مطلوب'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('المبلغ مطلوب'); return }
    if (!form.purpose.trim()) { toast.error('الغرض مطلوب'); return }
    setSaving(true)
    try {
      const { count } = await supabase.from('finance_employee_custody').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const custodyNo = `CUS-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
      const amount = Number(form.amount)

      const payload: Record<string, any> = {
        tenant_id: tenantId, custody_no: custodyNo,
        custody_date: form.custody_date,
        employee_name: form.employee_name.trim(),
        custody_type: 'عهدة نقدية',
        amount, purpose: form.purpose.trim(),
        due_date: form.due_date || null,
        settled_amount: 0, status: 'مفتوحة',
        notes: form.notes || null,
      }
      if (form.employee_id)     payload.employee_id     = Number(form.employee_id)
      if (form.project_id)      payload.project_id      = Number(form.project_id)
      if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)

      const { error } = await supabase.from('finance_employee_custody').insert(payload)
      if (error) throw error

      // سند صرف في الخزينة
      if (form.cash_account_id) {
        await supabase.from('finance_treasury').insert({
          tenant_id: tenantId, transaction_no: `PAY-${custodyNo}`,
          transaction_date: form.custody_date, type: 'صرف', amount,
          description: `عهدة — ${form.employee_name} — ${form.purpose}`,
          cash_account_id: Number(form.cash_account_id),
          payment_method: 'نقداً', reference_type: 'عهدة',
          party_name: form.employee_name, status: 'معتمد',
        })
      }

      // القيد المحاسبي: مدين حساب عهدة الموظف الفرعي / دائن الصندوق
      const cashAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
      if (cashAcc?.account_id) {
        // البحث عن الحساب الأب 1150
        const { data: parentAcc } = await supabase.from('finance_accounts').select('id,code').eq('tenant_id', tenantId).eq('code', '1150').single()
        if (parentAcc) {
          // البحث عن الحساب الفرعي للموظف أو إنشاؤه
          const empAccName = `عهدة — ${form.employee_name}`
          let { data: empAcc } = await supabase.from('finance_accounts').select('id,code').eq('tenant_id', tenantId).eq('parent_id', parentAcc.id).eq('name', empAccName).maybeSingle()
          if (!empAcc) {
            const siblings = await supabase.from('finance_accounts').select('code').eq('tenant_id', tenantId).eq('parent_id', parentAcc.id)
            const codes = (siblings.data || []).map((s: any) => parseInt(s.code)).filter((n: number) => !isNaN(n))
            const nextCode = codes.length > 0 ? String(Math.max(...codes) + 1) : String(parseInt(parentAcc.code) * 10 + 1)
            const { data: newAcc } = await supabase.from('finance_accounts').insert({
              tenant_id: tenantId, code: nextCode, name: empAccName,
              account_type: 'أصول', account_class: 'ميزانية', normal_balance: 'مدين',
              parent_id: parentAcc.id, level: 3, is_parent: false, is_active: true,
            }).select('id,code').single()
            empAcc = newAcc
            // تحديث is_parent للأب
            await supabase.from('finance_accounts').update({ is_parent: true }).eq('id', parentAcc.id)
          }
          if (empAcc) {
            const { count: jc } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId, entry_number: `JE-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`,
              entry_date: form.custody_date,
              description: `عهدة — ${form.employee_name} — ${form.purpose}`,
              reference_type: 'عهدة', total_debit: amount, total_credit: amount, status: 'معتمد', entry_source: 'آلي',
            }).select('id').single()
            if (entry) {
              await supabase.from('finance_journal_lines').insert([
                { entry_id: entry.id, account_id: empAcc.id,           debit: amount, credit: 0,      description: `عهدة: ${form.employee_name}` },
                { entry_id: entry.id, account_id: cashAcc.account_id,  debit: 0,      credit: amount, description: form.purpose },
              ])
            }
          }
        }
      }
      toast.success('✅ تم إصدار العهدة وتسجيل القيد')
      onSave()
    } catch (err: any) { toast.error('خطأ: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            إصدار عهدة موظف
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e' }}>
            💼 العهدة: مبلغ تصرفه الشركة عبر موظف لأغراض العمل (مشتريات، مصاريف موقع، إلخ)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الموظف *</label>
              <select value={form.employee_id} onChange={e => { set('employee_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('employee_name', emp.name) }} className="select">
                <option value="">— اختر الموظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input value={form.employee_name} onChange={e => set('employee_name', e.target.value)} className="input" style={{ marginTop: '6px' }} placeholder="أو أدخل الاسم..." />
            </div>
            <div>
              <label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون مشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>الغرض *</label>
            <input value={form.purpose} onChange={e => set('purpose', e.target.value)} className="input" placeholder="مثال: شراء مواد للموقع، مصاريف سفر..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label style={lbl}>المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" />
            </div>
            <div>
              <label style={lbl}>تاريخ الإصدار *</label>
              <input type="date" value={form.custody_date} onChange={e => set('custody_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>تاريخ التسليم</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={lbl}>الصرف من *</label>
            <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
              {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
            </select>
          </div>
          <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.78rem', color: '#5b21b6' }}>
            📋 القيد: مدين حـ/ عهد الموظفين (1150) ← دائن حـ/ {cashAccounts.find(a => a.id === Number(form.cash_account_id))?.name || 'الصندوق'}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            إصدار العهدة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: سلفة موظف (قرض شخصي)
// ════════════════════════════════════════
function LoanModal({ employees, cashAccounts, tenantId, onClose, onSave }: {
  employees: Employee[]; cashAccounts: CashAccount[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    loan_date:       today,
    employee_id:     '',
    employee_name:   '',
    amount:          '',
    installments:    '1',
    repay_method:    'خصم من الراتب',
    cash_account_id: cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const amount = Number(form.amount) || 0
  const installAmt = Number(form.installments) > 0 ? Math.ceil(amount / Number(form.installments)) : amount

  async function handleSave() {
    if (!form.employee_name.trim()) { toast.error('اسم الموظف مطلوب'); return }
    if (!form.amount || amount <= 0) { toast.error('مبلغ السلفة مطلوب'); return }
    setSaving(true)
    try {
      const { count } = await supabase.from('finance_employee_custody').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const loanNo = `LN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

      const payload: Record<string, any> = {
        tenant_id: tenantId, custody_no: loanNo,
        custody_date: form.loan_date,
        employee_name: form.employee_name.trim(),
        custody_type: 'سلفة راتب',
        amount, purpose: `سلفة — ${form.repay_method} — ${form.installments} قسط`,
        settled_amount: 0, status: 'مفتوحة',
        notes: form.notes ? `طريقة السداد: ${form.repay_method} | عدد الأقساط: ${form.installments}
${form.notes}` : `طريقة السداد: ${form.repay_method} | عدد الأقساط: ${form.installments}`,
      }
      if (form.employee_id)     payload.employee_id     = Number(form.employee_id)
      if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)

      const { error } = await supabase.from('finance_employee_custody').insert(payload)
      if (error) throw error

      // سند صرف
      if (form.cash_account_id) {
        await supabase.from('finance_treasury').insert({
          tenant_id: tenantId, transaction_no: `PAY-${loanNo}`,
          transaction_date: form.loan_date, type: 'صرف', amount,
          description: `سلفة راتب — ${form.employee_name}`,
          cash_account_id: Number(form.cash_account_id),
          payment_method: 'نقداً', reference_type: 'سلفة',
          party_name: form.employee_name, status: 'معتمد',
        })
      }

      // القيد المحاسبي: مدين حساب سلفة الموظف الفرعي / دائن الصندوق
      const cashAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
      if (cashAcc?.account_id) {
        const { data: parentAcc } = await supabase.from('finance_accounts').select('id,code').eq('tenant_id', tenantId).eq('code', '1160').single()
        if (parentAcc) {
          const empAccName = `سلفة — ${form.employee_name}`
          let { data: empAcc } = await supabase.from('finance_accounts').select('id,code').eq('tenant_id', tenantId).eq('parent_id', parentAcc.id).eq('name', empAccName).maybeSingle()
          if (!empAcc) {
            const siblings = await supabase.from('finance_accounts').select('code').eq('tenant_id', tenantId).eq('parent_id', parentAcc.id)
            const codes = (siblings.data || []).map((s: any) => parseInt(s.code)).filter((n: number) => !isNaN(n))
            const nextCode = codes.length > 0 ? String(Math.max(...codes) + 1) : String(parseInt(parentAcc.code) * 10 + 1)
            const { data: newAcc } = await supabase.from('finance_accounts').insert({
              tenant_id: tenantId, code: nextCode, name: empAccName,
              account_type: 'أصول', account_class: 'ميزانية', normal_balance: 'مدين',
              parent_id: parentAcc.id, level: 3, is_parent: false, is_active: true,
            }).select('id,code').single()
            empAcc = newAcc
            await supabase.from('finance_accounts').update({ is_parent: true }).eq('id', parentAcc.id)
          }
          if (empAcc) {
            const { count: jc } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId, entry_number: `JE-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`,
              entry_date: form.loan_date,
              description: `سلفة راتب — ${form.employee_name}`,
              reference_type: 'سلفة', total_debit: amount, total_credit: amount, status: 'معتمد', entry_source: 'آلي',
            }).select('id').single()
            if (entry) {
              await supabase.from('finance_journal_lines').insert([
                { entry_id: entry.id, account_id: empAcc.id,           debit: amount, credit: 0,      description: `سلفة: ${form.employee_name}` },
                { entry_id: entry.id, account_id: cashAcc.account_id,  debit: 0,      credit: amount, description: 'صرف سلفة راتب' },
              ])
            }
          }
        }
      }
      toast.success('✅ تم تسجيل السلفة والقيد المحاسبي')
      onSave()
    } catch (err: any) { toast.error('خطأ: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            منح سلفة موظف
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '8px 12px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.78rem', color: '#5b21b6' }}>
            💳 السلفة: قرض شخصي للموظف يُسدَّد من راتبه أو نقداً
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الموظف *</label>
              <select value={form.employee_id} onChange={e => { set('employee_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('employee_name', emp.name) }} className="select">
                <option value="">— اختر الموظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input value={form.employee_name} onChange={e => set('employee_name', e.target.value)} className="input" style={{ marginTop: '6px' }} placeholder="أو أدخل الاسم..." />
            </div>
            <div>
              <label style={lbl}>تاريخ السلفة *</label>
              <input type="date" value={form.loan_date} onChange={e => set('loan_date', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f5f3ff', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label style={lbl}>مبلغ السلفة *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" />
            </div>
            <div>
              <label style={lbl}>عدد الأقساط</label>
              <input type="number" value={form.installments} onChange={e => set('installments', e.target.value)} className="input" dir="ltr" min="1" max="24" />
              {amount > 0 && Number(form.installments) > 1 && (
                <div style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '4px' }}>
                  قسط شهري: {installAmt.toLocaleString()} ر.س
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>طريقة السداد</label>
              <select value={form.repay_method} onChange={e => set('repay_method', e.target.value)} className="select">
                {['خصم من الراتب', 'سداد نقدي', 'تحويل بنكي'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الصرف من *</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
          <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.78rem', color: '#5b21b6' }}>
            📋 القيد: مدين حـ/ سلف الرواتب (1160) ← دائن حـ/ {cashAccounts.find(a => a.id === Number(form.cash_account_id))?.name || 'الصندوق'}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            منح السلفة
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
          <h3 style={{ fontWeight: 700 }}>✅ تسوية عهدة — {custody.employee_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
            {[
              { label: 'إجمالي العهدة',  value: custody.amount,         color: '#374151', bg: '#f3f4f6' },
              { label: 'تم تسويته',      value: custody.settled_amount, color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'المتبقي',        value: remaining,              color: '#c81e1e', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px', background: s.bg, borderRadius: '8px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{s.label} ر.س</div>
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المبلغ المُسوَّى</label>
            <input type="number" value={form.settled_amount} onChange={e => set('settled_amount', e.target.value)} className="input" dir="ltr" max={remaining} />
          </div>
          {returnAmt > 0 && (
            <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
              💰 سيُرجَع للصندوق: {returnAmt.toLocaleString()} ر.س
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ التسوية</label>
              <input type="date" value={form.settled_date} onChange={e => set('settled_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الصندوق</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSettle} disabled={saving || returnAmt < 0} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : '✅'}
            تسوية العهدة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceTreasuryPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'accounts' | 'custody' | 'transfers'>('accounts')
  const [transfers, setTransfers] = useState<any[]>([])
  const [showTransferModal, setShowTransferModal] = useState(false)

  const [custodies,    setCustodies]    = useState<Custody[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)

  const [showCustodyModal,  setShowCustodyModal]  = useState(false)
  const [showLoanModal,     setShowLoanModal]     = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showSettleModal,  setShowSettleModal]  = useState(false)
  const [editAccount,      setEditAccount]      = useState<CashAccount | null>(null)
  const [settleCustody,    setSettleCustody]    = useState<Custody | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [trRes, cusRes, caRes, projRes, empRes] = await Promise.all([
      supabase.from('finance_treasury').select('type, amount, cash_account_id').eq('tenant_id', tenant.id),
      supabase.from('finance_employee_custody').select('*, project:projects(name)').eq('tenant_id', tenant.id).order('custody_date', { ascending: false }),
      supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenant.id).order('is_active', { ascending: false }).order('name'),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id, employee_id, employee:employees!hr_employees_employee_id_fkey(name)').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setCustodies(cusRes.data || [])
    const trData = trRes.data || []
    const caData = (caRes.data || []).map((ca: CashAccount) => {
      const cashIn  = trData.filter((t: any) => t.type === 'قبض' && t.cash_account_id === ca.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
      const cashOut = trData.filter((t: any) => t.type === 'صرف' && t.cash_account_id === ca.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
      return { ...ca, balance: Number(ca.opening_balance) + cashIn - cashOut }
    })
    setCashAccounts(caData)
    setProjects(projRes.data || [])
    setEmployees((empRes.data || []).map((e: any) => ({
      id: e.id,
      name: Array.isArray(e.employee) ? e.employee[0]?.name : e.employee?.name || '—',
    })).filter((e: any) => e.name !== '—'))
    setLoading(false)
  }

  const netBalance    = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const openCustodies = custodies.filter(c => c.status === 'مفتوحة').reduce((s, c) => s + Number(c.amount) - Number(c.settled_amount), 0)

  const TABS = [
    { id: 'accounts',  label: '🏦 الحسابات النقدية', color: '#1a56db' },
    { id: 'custody',   label: '👤 عهد وسلف',          color: '#e6820a' },
    { id: 'transfers', label: '🔄 التحويلات',          color: '#7c3aed' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            الخزينة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>الحسابات النقدية — العهد والسلف — التحويلات الداخلية</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'accounts' && (
            <button onClick={() => { setEditAccount(null); setShowAccountModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة حساب
            </button>
          )}
          {activeTab === 'custody' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowCustodyModal(true)} className="btn btn-primary" style={{ background: '#e6820a' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> 💼 عهدة
              </button>
              <button onClick={() => setShowLoanModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> 💳 سلفة
              </button>
            </div>
          )}
          {activeTab === 'transfers' && (
            <button onClick={() => setShowTransferModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
              <ArrowLeftRight style={{ width: '16px', height: '16px' }} /> تحويل جديد
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'الرصيد الإجمالي',    value: netBalance.toLocaleString(),     color: 'white',    bg: 'linear-gradient(135deg, #1a56db, #3b82f6)' },
          { label: 'عدد الحسابات',       value: String(cashAccounts.length),      color: '#1a56db',  bg: '#eff6ff' },
          { label: 'عهد مفتوحة (ر.س)',  value: openCustodies.toLocaleString(),   color: '#e6820a',  bg: '#fffbeb' },
          { label: 'عدد العهد المفتوحة', value: String(custodies.filter(c => c.status === 'مفتوحة').length), color: '#e6820a', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any) }}
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>


      {/* عهد الموظفين */}
      {activeTab === 'custody' && (
        loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
          : custodies.length === 0
            ? <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
                <p style={{ color: '#9ca3af' }}>لا توجد عهد مفتوحة</p>
              </div>
            : <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['رقم العهدة','الموظف','النوع','الغرض','المشروع','التاريخ','الاستحقاق','العهدة','المُسوَّى','المتبقي','الحالة',''].map(h => (
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
                          <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(c as any).project?.name || '—'}</td>
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
      )}

      {/* الحسابات النقدية */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {cashAccounts.map(ca => (
            <div key={ca.id} className="card" style={{
              padding: '20px',
              borderTop: '3px solid ' + (ca.is_active ? (ca.account_type === 'صندوق' ? '#e6820a' : '#1a56db') : '#d1d5db'),
              opacity: ca.is_active ? 1 : 0.65,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {ca.account_type === 'صندوق' ? '💰' : '🏦'} {ca.name}
                    {!ca.is_active && (
                      <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: '#f3f4f6', color: '#6b7280', fontWeight: 700 }}>
                        غير نشط
                      </span>
                    )}
                  </div>
                  {ca.bank_name && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{ca.bank_name}</div>}
                  {ca.iban && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{ca.iban.substring(0, 14)}...</div>}
                  {ca.account_id
                    ? <div style={{ fontSize: '0.7rem', color: '#0ea77b', marginTop: '4px' }}>✅ مرتبط بشجرة الحسابات</div>
                    : <div style={{ fontSize: '0.7rem', color: '#e6820a', marginTop: '4px' }}>⚠️ غير مرتبط بشجرة الحسابات</div>
                  }
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setEditAccount(ca); setShowAccountModal(true) }} className="btn btn-ghost btn-xs" title="تعديل">
                    <Pencil style={{ width: '13px', height: '13px' }} />
                  </button>
                  <button
                    onClick={async () => {
                      const { count } = await supabase.from('finance_treasury')
                        .select('*', { count: 'exact', head: true }).eq('cash_account_id', ca.id)
                      if (ca.is_active) {
                        if (!confirm(`تعطيل حساب "${ca.name}"؟
لن يمكن استخدامه في العمليات الجديدة ويمكن تنشيطه لاحقاً.`)) return
                        await supabase.from('finance_cash_accounts').update({ is_active: false }).eq('id', ca.id)
                        toast.success('تم تعطيل الحساب')
                      } else {
                        if (!confirm(`تنشيط حساب "${ca.name}"؟`)) return
                        await supabase.from('finance_cash_accounts').update({ is_active: true }).eq('id', ca.id)
                        toast.success('تم تنشيط الحساب ✅')
                      }
                      loadAll()
                    }}
                    className="btn btn-ghost btn-xs"
                    title={ca.is_active ? 'تعطيل' : 'تنشيط'}
                    style={{ color: ca.is_active ? '#e6820a' : '#0ea77b' }}>
                    {ca.is_active ? '⏸' : '▶'}
                  </button>
                </div>
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
      )}

      {/* تاب التحويلات */}
      {activeTab === 'transfers' && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <ArrowLeftRight style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>سجل التحويلات الداخلية بين الحسابات</p>
          <button onClick={() => setShowTransferModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            <ArrowLeftRight style={{ width: '16px', height: '16px' }} /> تحويل جديد
          </button>
        </div>
      )}

      {/* المودالات */}
      {showCustodyModal && (
        <CustodyModal employees={employees} projects={projects} cashAccounts={cashAccounts.filter(a => a.is_active)}
          tenantId={tenant!.id} onClose={() => setShowCustodyModal(false)} onSave={() => { setShowCustodyModal(false); loadAll() }} />
      )}
      {showLoanModal && (
        <LoanModal employees={employees} cashAccounts={cashAccounts.filter(a => a.is_active)}
          tenantId={tenant!.id} onClose={() => setShowLoanModal(false)} onSave={() => { setShowLoanModal(false); loadAll() }} />
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
      {showTransferModal && (
        <TransferModal cashAccounts={cashAccounts.filter(a => a.is_active)} tenantId={tenant!.id}
          onClose={() => setShowTransferModal(false)}
          onSave={() => { setShowTransferModal(false); loadAll() }} />
      )}
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تحويل بين الحسابات
// ════════════════════════════════════════
function TransferModal({ cashAccounts, tenantId, onClose, onSave }: {
  cashAccounts: CashAccount[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    transfer_date:   today,
    from_account_id: cashAccounts[0]?.id ? String(cashAccounts[0].id) : '',
    to_account_id:   cashAccounts[1]?.id ? String(cashAccounts[1].id) : '',
    amount:          '',
    description:     '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const fromAcc = cashAccounts.find(a => a.id === Number(form.from_account_id))
  const toAcc   = cashAccounts.find(a => a.id === Number(form.to_account_id))
  const sameAcc = form.from_account_id === form.to_account_id

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('المبلغ مطلوب'); return }
    if (sameAcc) { toast.error('لا يمكن التحويل للحساب نفسه'); return }
    if (!form.description.trim()) { toast.error('البيان مطلوب'); return }
    setSaving(true)
    const amount = Number(form.amount)
    const { count } = await supabase.from('finance_treasury').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const transferNo = `TRF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

    await Promise.all([
      supabase.from('finance_treasury').insert({
        tenant_id: tenantId, transaction_no: `${transferNo}-OUT`, transaction_date: form.transfer_date,
        type: 'صرف', amount, description: `تحويل إلى ${toAcc?.name} — ${form.description}`,
        cash_account_id: Number(form.from_account_id), payment_method: 'تحويل داخلي',
        reference_type: 'تحويل', reference_no: transferNo, party_name: toAcc?.name || '', status: 'معتمد', notes: form.notes || null,
      }),
      supabase.from('finance_treasury').insert({
        tenant_id: tenantId, transaction_no: `${transferNo}-IN`, transaction_date: form.transfer_date,
        type: 'قبض', amount, description: `تحويل من ${fromAcc?.name} — ${form.description}`,
        cash_account_id: Number(form.to_account_id), payment_method: 'تحويل داخلي',
        reference_type: 'تحويل', reference_no: transferNo, party_name: fromAcc?.name || '', status: 'معتمد', notes: form.notes || null,
      }),
    ])

    // القيد المحاسبي
    if (fromAcc?.account_id && toAcc?.account_id) {
      const [{ data: fromCode }, { data: toCode }] = await Promise.all([
        supabase.from('finance_accounts').select('code').eq('id', fromAcc.account_id).single(),
        supabase.from('finance_accounts').select('code').eq('id', toAcc.account_id).single(),
      ])
      if (fromCode?.code && toCode?.code) {
        const { count: jCount } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        const entryNumber = `JE-${new Date().getFullYear()}-${String((jCount || 0) + 1).padStart(4, '0')}`
        const { data: entry } = await supabase.from('finance_journal_entries').insert({
          tenant_id: tenantId, entry_number: entryNumber, entry_date: form.transfer_date,
          description: `تحويل داخلي ${transferNo} — ${form.description}`, reference_type: 'تحويل',
          total_debit: amount, total_credit: amount, status: 'معتمد', entry_source: 'آلي',
        }).select('id').single()
        if (entry) {
          await supabase.from('finance_journal_lines').insert([
            { entry_id: entry.id, account_id: toAcc.account_id,   debit: amount, credit: 0,      description: `تحويل إلى ${toAcc.name}` },
            { entry_id: entry.id, account_id: fromAcc.account_id, debit: 0,      credit: amount, description: `تحويل من ${fromAcc.name}` },
          ])
        }
      }
    }

    toast.success(`✅ تم تحويل ${amount.toLocaleString()} ر.س من ${fromAcc?.name} إلى ${toAcc?.name}`)
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            تحويل بين الحسابات
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px' }}>من</div>
              <div style={{ fontWeight: 700, color: '#c81e1e', fontSize: '0.9rem' }}>{fromAcc ? (fromAcc.account_type === 'صندوق' ? '💰 ' : '🏦 ') + fromAcc.name : '—'}</div>
              {fromAcc && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>رصيد: {(fromAcc.balance || 0).toLocaleString()} ر.س</div>}
            </div>
            <ArrowLeftRight style={{ width: '24px', height: '24px', color: '#7c3aed', flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px' }}>إلى</div>
              <div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '0.9rem' }}>{toAcc ? (toAcc.account_type === 'صندوق' ? '💰 ' : '🏦 ') + toAcc.name : '—'}</div>
              {toAcc && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>رصيد: {(toAcc.balance || 0).toLocaleString()} ر.س</div>}
            </div>
          </div>
          {sameAcc && <div style={{ padding: '8px 14px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.82rem', color: '#c81e1e', fontWeight: 600 }}>⚠️ لا يمكن التحويل للحساب نفسه</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>من حساب *</label>
              <select value={form.from_account_id} onChange={e => set('from_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>إلى حساب *</label>
              <select value={form.to_account_id} onChange={e => set('to_account_id', e.target.value)} className="select">
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.transfer_date} onChange={e => set('transfer_date', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={lbl}>البيان *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="مثال: تغذية صندوق الفرع" />
          </div>
          {Number(form.amount) > 0 && !sameAcc && fromAcc && toAcc && (
            <div style={{ padding: '12px 16px', background: '#f5f3ff', borderRadius: '10px', border: '1px solid #e9d5ff', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: '#7c3aed' }}>📋 القيد المحاسبي:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9d5ff' }}>
                <span>مدين — {toAcc.name}</span>
                <span style={{ fontWeight: 700, color: '#0ea77b' }}>{Number(form.amount).toLocaleString()} ر.س</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>دائن — {fromAcc.name}</span>
                <span style={{ fontWeight: 700, color: '#c81e1e' }}>{Number(form.amount).toLocaleString()} ر.س</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || sameAcc} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <ArrowLeftRight style={{ width: '15px', height: '15px' }} />}
            تنفيذ التحويل
          </button>
        </div>
      </div>
    </div>
  )
}
