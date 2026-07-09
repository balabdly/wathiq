// src/app/(dashboard)/finance/treasury/custody/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Users, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextDocNumber, confirmCashSpend } from '@/lib/journal'
import { suggestChildAccountCode } from '@/lib/suggest-account-code'
import { useTreasury } from '../TreasuryContext'
import type { Custody, Employee, Project, CashAccount } from '@/lib/treasury-types'

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
    // ══ ضابط الرصيد قبل الصرف ══
    const spendAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
    if (spendAcc && !(await confirmCashSpend(tenantId, spendAcc, Number(form.amount)))) return
    setSaving(true)
    try {
      const custodyNo = (await nextDocNumber(tenantId, 'CUS', 'CUS'))!
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
            const siblingCodes = (siblings.data || []).map((s: { code: string }) => s.code)
            const nextCode = suggestChildAccountCode(parentAcc.code, siblingCodes)
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
            const jeNo = (await nextDocNumber(tenantId, 'JE', 'JE'))!
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId, entry_number: jeNo,
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
    // ══ ضابط الرصيد قبل الصرف ══
    const spendAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
    if (spendAcc && !(await confirmCashSpend(tenantId, spendAcc, amount))) return
    setSaving(true)
    try {
      const loanNo = (await nextDocNumber(tenantId, 'LN', 'LN'))!

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
            const siblingCodes = (siblings.data || []).map((s: { code: string }) => s.code)
            const nextCode = suggestChildAccountCode(parentAcc.code, siblingCodes)
            const { data: newAcc } = await supabase.from('finance_accounts').insert({
              tenant_id: tenantId, code: nextCode, name: empAccName,
              account_type: 'أصول', account_class: 'ميزانية', normal_balance: 'مدين',
              parent_id: parentAcc.id, level: 3, is_parent: false, is_active: true,
            }).select('id,code').single()
            empAcc = newAcc
            await supabase.from('finance_accounts').update({ is_parent: true }).eq('id', parentAcc.id)
          }
          if (empAcc) {
            const jeNo = (await nextDocNumber(tenantId, 'JE', 'JE'))!
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId, entry_number: jeNo,
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
// الصفحة
// ════════════════════════════════════════
export default function CustodyPage() {
  const { tenantId, cashAccounts, projects, employees, reloadAll } = useTreasury()
  const [custodies, setCustodies] = useState<Custody[]>([])
  const [loading, setLoading] = useState(true)

  const [showCustodyModal, setShowCustodyModal] = useState(false)
  const [showLoanModal,    setShowLoanModal]    = useState(false)
  const [showSettleModal,  setShowSettleModal]  = useState(false)
  const [settleCustody,    setSettleCustody]    = useState<Custody | null>(null)

  useEffect(() => { if (tenantId) loadCustodies() }, [tenantId])

  async function loadCustodies() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_employee_custody').select('*, project:projects(name)').eq('tenant_id', tenantId).order('custody_date', { ascending: false })
    setCustodies(data || [])
    setLoading(false)
  }

  const activeCash = cashAccounts.filter(a => a.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={() => setShowCustodyModal(true)} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> 💼 عهدة
        </button>
        <button onClick={() => setShowLoanModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> 💳 سلفة
        </button>
      </div>

      {loading
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
          </div>}

      {showCustodyModal && (
        <CustodyModal employees={employees} projects={projects} cashAccounts={activeCash}
          tenantId={tenantId!} onClose={() => setShowCustodyModal(false)}
          onSave={() => { setShowCustodyModal(false); loadCustodies(); reloadAll() }} />
      )}
      {showLoanModal && (
        <LoanModal employees={employees} cashAccounts={activeCash}
          tenantId={tenantId!} onClose={() => setShowLoanModal(false)}
          onSave={() => { setShowLoanModal(false); loadCustodies(); reloadAll() }} />
      )}
      {showSettleModal && settleCustody && (
        <SettleCustodyModal custody={settleCustody} cashAccounts={cashAccounts}
          tenantId={tenantId!} onClose={() => { setShowSettleModal(false); setSettleCustody(null) }}
          onSave={() => { setShowSettleModal(false); setSettleCustody(null); loadCustodies(); reloadAll() }} />
      )}
    </div>
  )
}
