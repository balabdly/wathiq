// src/app/(dashboard)/finance/treasury/transfers/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ArrowLeftRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextDocNumber, journalInternalTransfer, confirmCashSpend } from '@/lib/journal'
import { useTreasury } from '../TreasuryContext'
import type { CashAccount } from '@/lib/treasury-types'

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
    // ══ ضابط الرصيد على الحساب المصدر ══
    if (fromAcc && !(await confirmCashSpend(tenantId, fromAcc, Number(form.amount)))) return
    setSaving(true)
    const amount = Number(form.amount)
    const transferNo = (await nextDocNumber(tenantId, 'TRF', 'TRF'))!

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
        await journalInternalTransfer({
          tenantId,
          date: form.transfer_date,
          description: `تحويل داخلي ${transferNo} — ${form.description}`,
          amount,
          toAccountCode: toCode.code,
          fromAccountCode: fromCode.code,
        })
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


// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function TransfersPage() {
  const { tenantId, cashAccounts, reloadAll } = useTreasury()
  const [showTransferModal, setShowTransferModal] = useState(false)
  const activeCash = cashAccounts.filter(a => a.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowTransferModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <ArrowLeftRight style={{ width: '16px', height: '16px' }} /> تحويل جديد
        </button>
      </div>

      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <ArrowLeftRight style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
        <p style={{ color: '#9ca3af', marginBottom: '16px' }}>سجل التحويلات الداخلية بين الحسابات</p>
        <button onClick={() => setShowTransferModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <ArrowLeftRight style={{ width: '16px', height: '16px' }} /> تحويل جديد
        </button>
      </div>

      {showTransferModal && (
        <TransferModal cashAccounts={activeCash} tenantId={tenantId!}
          onClose={() => setShowTransferModal(false)}
          onSave={() => { setShowTransferModal(false); reloadAll() }} />
      )}
    </div>
  )
}
