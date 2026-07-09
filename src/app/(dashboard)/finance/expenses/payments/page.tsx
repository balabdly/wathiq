// src/app/(dashboard)/finance/expenses/payments/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, getCashAccountCode, nextDocNumber, confirmCashSpend } from '@/lib/journal'
import { ACC } from '@/lib/account-codes'
import { useExpenses } from '../ExpensesContext'
import type { Transaction, Account, CostCenter, Project, Vendor, Client, CashAccount } from '@/lib/expenses-types'
import { STATUS_COLOR, fmt } from '@/lib/expenses-types'

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
    // ══ ضابط الرصيد قبل سند الصرف ══
    if (!isReceipt) {
      const spendAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
      if (spendAcc && !(await confirmCashSpend(tenantId, spendAcc, Number(form.amount)))) return
    }
    setSaving(true)
    // ══ الرقم النهائي — ذرّي عند الحفظ (الرقم المعروض معاينة، والمخصص يدوياً يُحترم) ══
    const docType = isReceipt ? 'RCV' : 'PAY'
    let finalRefNo = form.reference_no
    if (new RegExp(`^${docType}-\\d{4}-\\d{4}$`).test(finalRefNo)) {
      finalRefNo = (await nextDocNumber(tenantId, docType, docType)) || finalRefNo
    }
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      transaction_no: finalRefNo,
      transaction_date: form.transaction_date,
      type, amount: Number(form.amount),
      description: form.description.trim(),
      payment_method: form.payment_method,
      reference_no: finalRefNo,
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
      const cashCode = selectedCash?.account_id ? await getCashAccountCode(selectedCash.id) : ACC.CASH_LOCAL
      const counterCode = form.account_id
        ? accounts.find(a => a.id === Number(form.account_id))?.code
        : (isReceipt ? ACC.OTHER_RECEIVABLE : ACC.OTHER_EXPENSE)
      const ccId = form.cost_center_id ? Number(form.cost_center_id) : undefined
      if (counterCode && cashCode) {
        await createJournalEntry({
          tenantId,
          date: form.transaction_date,
          description: `${type} — ${form.description}`,
          referenceType: type, referenceId: trxData.id,
          source: 'آلي',
          lines: isReceipt ? [
            { accountCode: cashCode,  debit: Number(form.amount), credit: 0,                    description: form.description, costCenterId: ccId },
            { accountCode: counterCode, debit: 0,                   credit: Number(form.amount),  description: form.party_name || form.description, costCenterId: ccId },
          ] : [
            { accountCode: counterCode, debit: Number(form.amount), credit: 0,                    description: form.description, costCenterId: ccId },
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
// الصفحة
// ════════════════════════════════════════
export default function PaymentsPage() {
  const { tenantId, cashAccounts, accounts, costCenters, clients, vendors, projects } = useExpenses()
  const [vouchers, setVouchers]   = useState<Transaction[]>([])
  const [loading, setLoading]     = useState(false)
  const [showVoucher, setShowVoucher] = useState(false)

  useEffect(() => { if (tenantId) loadVouchers() }, [tenantId])

  async function loadVouchers() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_treasury')
      .select('*, cash_account:finance_cash_accounts(name), project:projects(name)')
      .eq('tenant_id', tenantId).eq('type', 'صرف')
      .order('transaction_date', { ascending: false }).limit(100)
    setVouchers(data || [])
    setLoading(false)
  }

  async function handleDeleteVoucher(id: number) {
    if (!confirm('حذف هذا السند؟')) return
    await supabase.from('finance_treasury').delete().eq('id', id)
    setVouchers(p => p.filter(v => v.id !== id))
    toast.success('تم الحذف')
  }

  const totalVouchers = vouchers.reduce((s, v) => s + Number(v.amount), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowVoucher(true)} className="btn btn-primary" style={{ background: '#c81e1e' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> سند صرف
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي المدفوعات', value: totalVouchers, color: '#c81e1e', bg: '#c81e1e11' },
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : vouchers.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <ArrowDownRight style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>لا توجد سندات صرف بعد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم السند', 'التاريخ', 'البيان', 'المُدفَع له', 'المشروع', 'الحساب', 'المبلغ', 'الحالة', ''].map(h => (
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
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#c81e1e', whiteSpace: 'nowrap' }}>
                      -{fmt(v.amount)} ر.س
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
                  <td style={{ padding: '10px 12px', color: '#c81e1e' }}>{fmt(totalVouchers)} ر.س</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showVoucher && (
        <VoucherModal type="صرف" cashAccounts={cashAccounts} accounts={accounts} costCenters={costCenters} clients={clients} vendors={vendors} projects={projects} tenantId={tenantId!}
          onClose={() => setShowVoucher(false)}
          onSave={() => { setShowVoucher(false); loadVouchers() }} />
      )}
    </div>
  )
}
