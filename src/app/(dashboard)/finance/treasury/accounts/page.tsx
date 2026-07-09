// src/app/(dashboard)/finance/treasury/accounts/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextDocNumber, createJournalEntry } from '@/lib/journal'
import { ACC } from '@/lib/account-codes'
import { useTreasury } from '../TreasuryContext'
import type { CashAccount } from '@/lib/treasury-types'

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
          await createJournalEntry({
            tenantId,
            date:          new Date().toISOString().split('T')[0],
            description:   `رصيد افتتاحي — ${form.name.trim()}`,
            referenceType: 'رصيد افتتاحي',
            referenceId:   newAccountId,
            lines: [
              { accountCode: newCode, debit: Number(form.opening_balance), credit: 0,                            description: `رصيد افتتاحي ${form.name.trim()}` },
              { accountCode: ACC.PAID_IN_CAPITAL,  debit: 0,                            credit: Number(form.opening_balance), description: 'أرصدة افتتاحية' },
            ],
            source: 'آلي',
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
// الصفحة
// ════════════════════════════════════════
export default function CashAccountsPage() {
  const { tenantId, cashAccounts, reloadAll } = useTreasury()
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editAccount, setEditAccount] = useState<CashAccount | null>(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={() => { setEditAccount(null); setShowAccountModal(true) }} className="btn btn-primary">
          <Plus style={{ width: '16px', height: '16px' }} /> إضافة حساب
        </button>
      </div>

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
                    if (ca.is_active) {
                      if (!confirm(`تعطيل حساب "${ca.name}"؟\nلن يمكن استخدامه في العمليات الجديدة ويمكن تنشيطه لاحقاً.`)) return
                      await supabase.from('finance_cash_accounts').update({ is_active: false }).eq('id', ca.id)
                      toast.success('تم تعطيل الحساب')
                    } else {
                      if (!confirm(`تنشيط حساب "${ca.name}"؟`)) return
                      await supabase.from('finance_cash_accounts').update({ is_active: true }).eq('id', ca.id)
                      toast.success('تم تنشيط الحساب ✅')
                    }
                    reloadAll()
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

      {showAccountModal && (
        <CashAccountModal account={editAccount} tenantId={tenantId!}
          onClose={() => { setShowAccountModal(false); setEditAccount(null) }}
          onSave={() => { setShowAccountModal(false); setEditAccount(null); reloadAll() }} />
      )}
    </div>
  )
}
