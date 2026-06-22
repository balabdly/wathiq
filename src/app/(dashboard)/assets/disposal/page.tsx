'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, LogOut, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

type Asset = {
  id: number; asset_no: string; name: string; category: string
  total_cost: number; accumulated_depreciation: number; book_value: number
  salvage_value: number; asset_account_id?: number; accum_account_id?: number
  status: string
}
type Disposal = {
  id: number; asset_id: number; disposal_date: string
  disposal_type: string; disposal_value: number
  book_value_at_disposal: number; gain_loss: number
  notes?: string
  asset?: { name: string; asset_no: string }
}
type Account = { id: number; code: string; name: string }
type CashAccount = { id: number; name: string; account_type: string; account_id?: number }

const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

function DisposalModal({ assets, accounts, cashAccounts, tenantId, onClose, onSave }: {
  assets: Asset[]; accounts: Account[]; cashAccounts: CashAccount[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    asset_id:       '',
    disposal_date:  today,
    disposal_type:  'بيع',
    disposal_value: '',
    cash_account_id: '',
    notes:          '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const selectedAsset  = assets.find(a => a.id === Number(form.asset_id))
  const bookValue      = selectedAsset ? Number(selectedAsset.book_value) : 0
  const disposalVal    = Number(form.disposal_value) || 0
  const gainLoss       = disposalVal - bookValue
  const isGain         = gainLoss > 0
  const isSale         = form.disposal_type === 'بيع'

  async function handleSave() {
    if (!form.asset_id)    { toast.error('اختر الأصل'); return }
    if (isSale && !form.disposal_value) { toast.error('أدخل قيمة البيع'); return }
    setSaving(true)
    try {
      const asset = selectedAsset!
      const gainLossAmt = disposalVal - bookValue

      // تحديث حالة الأصل
      await supabase.from('finance_assets').update({
        status:       'مُستبعَد',
        disposal_date:  form.disposal_date,
        disposal_value: disposalVal,
        disposal_type:  form.disposal_type,
      }).eq('id', asset.id)

      // تسجيل سجل الاستبعاد
      await supabase.from('finance_asset_disposals').insert({
        tenant_id: tenantId, asset_id: asset.id,
        disposal_date: form.disposal_date,
        disposal_type: form.disposal_type,
        disposal_value: disposalVal,
        book_value_at_disposal: bookValue,
        gain_loss: gainLossAmt,
        notes: form.notes || null,
      })

      // القيد المحاسبي
      if (asset.asset_account_id && asset.accum_account_id) {
        const totalCost  = Number(asset.total_cost)
        const accumDep   = Number(asset.accumulated_depreciation)

        // جلب أكواد الحسابات
        const [{ data: assetAcc }, { data: accumAcc }] = await Promise.all([
          supabase.from('finance_accounts').select('id').eq('id', asset.asset_account_id).single(),
          supabase.from('finance_accounts').select('id').eq('id', asset.accum_account_id).single(),
        ])

        // حساب الربح/الخسارة
        const gainAcc  = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', '4200').single()
        const lossAcc  = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', '5710').single()

        // حساب البنك/الصندوق
        let cashAccId: number | null = null
        if (form.cash_account_id) {
          const cashFA = cashAccounts.find(a => a.id === Number(form.cash_account_id))
          if (cashFA?.account_id) cashAccId = cashFA.account_id
        }

        const { count: jc } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        const totalDebit  = totalCost + (gainLossAmt < 0 ? Math.abs(gainLossAmt) : 0) + (isSale ? disposalVal : 0)
        const totalCredit = accumDep + totalCost + (gainLossAmt > 0 ? gainLossAmt : 0)

        const { data: entry } = await supabase.from('finance_journal_entries').insert({
          tenant_id: tenantId,
          entry_number: `JE-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`,
          entry_date: form.disposal_date,
          description: `استبعاد أصل — ${form.disposal_type} — ${asset.name}`,
          reference_type: 'استبعاد',
          total_debit: Math.max(totalDebit, totalCredit),
          total_credit: Math.max(totalDebit, totalCredit),
          status: 'معتمد', entry_source: 'آلي',
        }).select('id').single()

        if (entry) {
          const lines: any[] = []
          // مدين: مجمع الإهلاك
          if (accumAcc) lines.push({ entry_id: entry.id, account_id: accumAcc.id, debit: accumDep, credit: 0, description: 'استنزال مجمع الإهلاك' })
          // مدين: البنك (إذا بيع)
          if (isSale && cashAccId && disposalVal > 0) lines.push({ entry_id: entry.id, account_id: cashAccId, debit: disposalVal, credit: 0, description: `عائد البيع` })
          // مدين: خسارة بيع الأصول (إذا خسارة)
          if (gainLossAmt < 0 && lossAcc.data) lines.push({ entry_id: entry.id, account_id: lossAcc.data.id, debit: Math.abs(gainLossAmt), credit: 0, description: 'خسارة بيع أصل' })
          // دائن: الأصل بتكلفته الأصلية
          if (assetAcc) lines.push({ entry_id: entry.id, account_id: assetAcc.id, debit: 0, credit: totalCost, description: `استبعاد: ${asset.name}` })
          // دائن: ربح بيع الأصول (إذا ربح)
          if (gainLossAmt > 0 && gainAcc.data) lines.push({ entry_id: entry.id, account_id: gainAcc.data.id, debit: 0, credit: gainLossAmt, description: 'ربح بيع أصل' })

          if (lines.length > 0) await supabase.from('finance_journal_lines').insert(lines)
        }
      }

      toast.success(`✅ تم استبعاد الأصل — ${gainLossAmt > 0 ? 'ربح' : gainLossAmt < 0 ? 'خسارة' : 'بدون ربح أو خسارة'}: ${fmt(Math.abs(gainLossAmt))} ر.س`)
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            استبعاد أصل
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع الاستبعاد */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['بيع', 'إتلاف', 'تبرع'].map(t => (
              <button key={t} type="button" onClick={() => { set('disposal_type', t); if (t !== 'بيع') set('disposal_value', '0') }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                  borderColor: form.disposal_type === t ? '#c81e1e' : 'var(--border)',
                  background:  form.disposal_type === t ? '#fef2f2' : 'white',
                  color:       form.disposal_type === t ? '#c81e1e' : 'var(--text3)' }}>
                {t === 'بيع' ? '💰 بيع' : t === 'إتلاف' ? '🗑️ إتلاف' : '🎁 تبرع'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الأصل *</label>
              <select value={form.asset_id} onChange={e => set('asset_id', e.target.value)} className="select">
                <option value="">— اختر الأصل —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.asset_no} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>تاريخ الاستبعاد *</label>
              <input type="date" value={form.disposal_date} onChange={e => set('disposal_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* معلومات الأصل */}
          {selectedAsset && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
              {[
                { label: 'التكلفة الأصلية',  value: fmt(selectedAsset.total_cost), color: '#374151' },
                { label: 'مجمع الإهلاك',     value: fmt(selectedAsset.accumulated_depreciation), color: '#e6820a' },
                { label: 'القيمة الدفترية',  value: fmt(selectedAsset.book_value), color: '#1a56db' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '10px', background: 'var(--bg2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: item.color, fontSize: '0.9rem' }}>{item.value} ر.س</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* قيمة البيع */}
          {isSale && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>قيمة البيع *</label>
                <input type="number" value={form.disposal_value} onChange={e => set('disposal_value', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
              </div>
              <div>
                <label style={lbl}>الإيداع في</label>
                <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                  <option value="">— اختياري —</option>
                  {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ملخص الربح/الخسارة */}
          {selectedAsset && (isSale ? disposalVal >= 0 : true) && (
            <div style={{
              padding: '14px', borderRadius: '10px',
              background: gainLoss > 0 ? '#ecfdf5' : gainLoss < 0 ? '#fef2f2' : '#f3f4f6',
              border: `1px solid ${gainLoss > 0 ? '#bbf7d0' : gainLoss < 0 ? '#fecaca' : '#e5e7eb'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {gainLoss > 0
                    ? <TrendingUp style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
                    : <TrendingDown style={{ width: '18px', height: '18px', color: '#c81e1e' }} />}
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: gainLoss > 0 ? '#0ea77b' : gainLoss < 0 ? '#c81e1e' : '#6b7280' }}>
                    {gainLoss > 0 ? 'ربح بيع الأصل' : gainLoss < 0 ? 'خسارة بيع الأصل' : 'لا ربح ولا خسارة'}
                  </span>
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: gainLoss > 0 ? '#0ea77b' : gainLoss < 0 ? '#c81e1e' : '#6b7280' }}>
                  {fmt(Math.abs(gainLoss))} ر.س
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '8px' }}>
                القيد: مدين مجمع الإهلاك + {isSale ? 'البنك' : ''}{gainLoss < 0 ? ' + خسائر' : ''} ← دائن الأصل{gainLoss > 0 ? ' + أرباح' : ''}
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <LogOut style={{ width: '15px', height: '15px' }} />}
            تنفيذ الاستبعاد
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DisposalPage() {
  const { tenant } = useStore()
  const [disposals,    setDisposals]    = useState<Disposal[]>([])
  const [assets,       setAssets]       = useState<Asset[]>([])
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [dRes, aRes, accRes, cashRes] = await Promise.all([
      supabase.from('finance_asset_disposals').select('*, asset:finance_assets(name,asset_no)')
        .eq('tenant_id', tenant.id).order('disposal_date', { ascending: false }),
      supabase.from('finance_assets').select('id,asset_no,name,category,total_cost,accumulated_depreciation,book_value,salvage_value,asset_account_id,accum_account_id,status')
        .eq('tenant_id', tenant.id).eq('status', 'نشط').order('name'),
      supabase.from('finance_accounts').select('id,code,name').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setDisposals(dRes.data || [])
    setAssets(aRes.data || [])
    setAccounts(accRes.data || [])
    setCashAccounts(cashRes.data || [])
    setLoading(false)
  }

  const totalGain = disposals.reduce((s,d) => s + (Number(d.gain_loss) > 0 ? Number(d.gain_loss) : 0), 0)
  const totalLoss = disposals.reduce((s,d) => s + (Number(d.gain_loss) < 0 ? Math.abs(Number(d.gain_loss)) : 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut style={{ width: '20px', height: '20px', color: '#c81e1e' }} />
            استبعاد الأصول
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>بيع أو إتلاف أو تبرع بالأصول الثابتة</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#c81e1e' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> استبعاد أصل
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'عمليات الاستبعاد', value: String(disposals.length), color: '#c81e1e', bg: '#fef2f2', isCount: true },
          { label: 'إجمالي عائد البيع', value: fmt(disposals.reduce((s,d)=>s+Number(d.disposal_value),0)) + ' ر.س', color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي الأرباح',  value: fmt(totalGain) + ' ر.س', color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي الخسائر',  value: fmt(totalLoss) + ' ر.س', color: '#c81e1e', bg: '#fef2f2' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
            <div style={{ fontSize: (kpi as any).isCount ? '2rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* جدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : disposals.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <LogOut style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد عمليات استبعاد</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> استبعاد أول أصل
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التاريخ','الأصل','النوع','قيمة البيع','القيمة الدفترية','الربح/الخسارة'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disposals.map(d => {
                  const gl = Number(d.gain_loss)
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{d.disposal_date}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{(d as any).asset?.name || '#' + d.asset_id}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: '#fef2f2', color: '#c81e1e' }}>{d.disposal_type}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a56db', whiteSpace: 'nowrap' }}>{fmt(d.disposal_value)} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a', whiteSpace: 'nowrap' }}>{fmt(d.book_value_at_disposal)} ر.س</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: gl > 0 ? '#0ea77b' : gl < 0 ? '#c81e1e' : '#6b7280' }}>
                          {gl > 0 ? <TrendingUp style={{ width: '14px', height: '14px' }} /> : gl < 0 ? <TrendingDown style={{ width: '14px', height: '14px' }} /> : null}
                          {gl > 0 ? '+' : ''}{fmt(gl)} ر.س
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <DisposalModal
          assets={assets} accounts={accounts} cashAccounts={cashAccounts}
          tenantId={tenant!.id}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadAll() }}
        />
      )}
    </div>
  )
}
