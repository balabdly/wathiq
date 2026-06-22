'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Wrench, Search } from 'lucide-react'
import toast from 'react-hot-toast'

type Asset       = { id: number; asset_no: string; name: string; category: string }
type Maintenance = {
  id: number; asset_id: number; tenant_id: string
  maintenance_date: string; description: string; cost: number
  maintenance_type: string; expense_account_id?: number
  cash_account_id?: number; notes?: string
  asset?: { name: string; asset_no: string }
  expense_account?: { code: string; name: string }
}
type Account     = { id: number; code: string; name: string; is_parent?: boolean }
type CashAccount = { id: number; name: string; account_type: string; account_id?: number }

const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })
const TYPES = ['صيانة دورية', 'إصلاح طارئ', 'تحسين وتطوير', 'فحص دوري']

function MaintenanceModal({ assets, accounts, cashAccounts, tenantId, onClose, onSave }: {
  assets: Asset[]; accounts: Account[]; cashAccounts: CashAccount[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    asset_id:          '',
    maintenance_date:  today,
    maintenance_type:  'صيانة دورية',
    description:       '',
    cost:              '',
    expense_account_id: '',
    cash_account_id:   '',
    notes:             '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // تعيين حساب المصروف تلقائياً
  useEffect(() => {
    const acc = accounts.find(a => a.code === '5420')
    if (acc) set('expense_account_id', String(acc.id))
  }, [accounts])

  async function handleSave() {
    if (!form.asset_id)       { toast.error('اختر الأصل'); return }
    if (!form.description)    { toast.error('الوصف مطلوب'); return }
    if (!form.cost || Number(form.cost) <= 0) { toast.error('التكلفة مطلوبة'); return }
    if (!form.expense_account_id) { toast.error('الحساب المحاسبي مطلوب'); return }
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        tenant_id: tenantId, asset_id: Number(form.asset_id),
        maintenance_date: form.maintenance_date,
        maintenance_type: form.maintenance_type,
        description: form.description.trim(),
        cost: Number(form.cost),
        expense_account_id: Number(form.expense_account_id),
        notes: form.notes || null,
      }
      if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)

      const { error } = await supabase.from('finance_asset_maintenance').insert(payload)
      if (error) throw error

      // القيد المحاسبي: مدين مصروف الصيانة / دائن البنك أو الصندوق
      if (form.cash_account_id) {
        const cashAcc = cashAccounts.find(a => a.id === Number(form.cash_account_id))
        if (cashAcc?.account_id) {
          const { data: cashCode } = await supabase.from('finance_accounts').select('code').eq('id', cashAcc.account_id).single()
          const expAcc = accounts.find(a => a.id === Number(form.expense_account_id))
          if (expAcc?.code && cashCode?.code) {
            const { count: jc } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
            const asset = assets.find(a => a.id === Number(form.asset_id))
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId,
              entry_number: `JE-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`,
              entry_date: form.maintenance_date,
              description: `صيانة — ${asset?.name} — ${form.description}`,
              reference_type: 'صيانة', total_debit: Number(form.cost), total_credit: Number(form.cost),
              status: 'معتمد', entry_source: 'آلي',
            }).select('id').single()

            if (entry) {
              const [{ data: expAccRow }, { data: cashAccRow }] = await Promise.all([
                supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', expAcc.code).single(),
                supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', cashCode.code).single(),
              ])
              if (expAccRow && cashAccRow) {
                await supabase.from('finance_journal_lines').insert([
                  { entry_id: entry.id, account_id: expAccRow.id,  debit: Number(form.cost), credit: 0,                description: `صيانة: ${asset?.name}` },
                  { entry_id: entry.id, account_id: cashAccRow.id, debit: 0,                 credit: Number(form.cost), description: form.description },
                ])
              }
            }
          }
        }
      }

      toast.success('✅ تم تسجيل الصيانة والقيد المحاسبي')
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  const expenseAccounts = accounts.filter(a => !a.is_parent && (a.code?.startsWith('54') || a.code?.startsWith('53')))
  const banks  = cashAccounts.filter(a => a.account_type === 'بنك')
  const boxes  = cashAccounts.filter(a => a.account_type === 'صندوق')

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            تسجيل صيانة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الأصل *</label>
              <select value={form.asset_id} onChange={e => set('asset_id', e.target.value)} className="select">
                <option value="">— اختر الأصل —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.asset_no} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>نوع الصيانة</label>
              <select value={form.maintenance_type} onChange={e => set('maintenance_type', e.target.value)} className="select">
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.maintenance_date} onChange={e => set('maintenance_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>التكلفة *</label>
              <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label style={lbl}>وصف الصيانة *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="مثال: تغيير زيت المحرك، إصلاح الفرامل..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>الحساب المحاسبي *</label>
              <select value={form.expense_account_id} onChange={e => set('expense_account_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الدفع من</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {banks.length > 0 && <optgroup label="🏦 بنوك">{banks.map(a => <option key={a.id} value={a.id}>🏦 {a.name}</option>)}</optgroup>}
                {boxes.length > 0 && <optgroup label="💰 صناديق">{boxes.map(a => <option key={a.id} value={a.id}>💰 {a.name}</option>)}</optgroup>}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
          {form.cost && Number(form.cost) > 0 && (
            <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.78rem', color: '#5b21b6' }}>
              📋 القيد: مدين حـ/مصروف الصيانة ← دائن حـ/{cashAccounts.find(a=>a.id===Number(form.cash_account_id))?.name || 'البنك/الصندوق'} — {Number(form.cost).toLocaleString()} ر.س
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MaintenancePage() {
  const { tenant } = useStore()
  const [records,      setRecords]      = useState<Maintenance[]>([])
  const [assets,       setAssets]       = useState<Asset[]>([])
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [search,       setSearch]       = useState('')
  const [assetFilter,  setAssetFilter]  = useState('')

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [mRes, aRes, accRes, cashRes] = await Promise.all([
      supabase.from('finance_asset_maintenance')
        .select('*, asset:finance_assets(name,asset_no), expense_account:finance_accounts!finance_asset_maintenance_expense_account_id_fkey(code,name)')
        .eq('tenant_id', tenant.id).order('maintenance_date', { ascending: false }),
      supabase.from('finance_assets').select('id,asset_no,name,category').eq('tenant_id', tenant.id).eq('status', 'نشط').order('name'),
      supabase.from('finance_accounts').select('id,code,name,is_parent').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setRecords(mRes.data || [])
    setAssets(aRes.data || [])
    setAccounts(accRes.data || [])
    setCashAccounts(cashRes.data || [])
    setLoading(false)
  }

  const filtered = records.filter(r => {
    const matchSearch = !search || r.description.includes(search) || (r.asset as any)?.name?.includes(search)
    const matchAsset  = !assetFilter || String(r.asset_id) === assetFilter
    return matchSearch && matchAsset
  })

  const totalCost = filtered.reduce((s,r) => s + Number(r.cost), 0)

  const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
    'صيانة دورية':   { bg: '#ecfdf5', color: '#0ea77b' },
    'إصلاح طارئ':   { bg: '#fef2f2', color: '#c81e1e' },
    'تحسين وتطوير': { bg: '#eff6ff', color: '#1a56db' },
    'فحص دوري':     { bg: '#f5f3ff', color: '#7c3aed' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench style={{ width: '20px', height: '20px', color: '#0ea77b' }} />
            سجل الصيانة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>تسجيل مصاريف صيانة الأصول الثابتة</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0ea77b' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> تسجيل صيانة
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي تكاليف الصيانة', value: fmt(records.reduce((s,r)=>s+Number(r.cost),0)) + ' ر.س', color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'عدد سجلات الصيانة',    value: String(records.length),   color: '#7c3aed', bg: '#f5f3ff', isCount: true },
          { label: 'صيانة دورية',           value: String(records.filter(r=>r.maintenance_type==='صيانة دورية').length), color: '#0ea77b', bg: '#ecfdf5', isCount: true },
          { label: 'إصلاح طارئ',           value: String(records.filter(r=>r.maintenance_type==='إصلاح طارئ').length),  color: '#c81e1e', bg: '#fef2f2', isCount: true },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
            <div style={{ fontSize: (kpi as any).isCount ? '2rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
        </div>
        <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)} className="select" style={{ width: '200px' }}>
          <option value="">كل الأصول</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* جدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Wrench style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد سجلات صيانة</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول صيانة
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التاريخ','الأصل','النوع','الوصف','الحساب','التكلفة'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const tc = TYPE_COLOR[r.maintenance_type] || { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{r.maintenance_date}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{(r as any).asset?.name || '#' + r.asset_id}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: tc.bg, color: tc.color }}>{r.maintenance_type}</span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(r as any).expense_account?.code} — {(r as any).expense_account?.name}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0ea77b', whiteSpace: 'nowrap' }}>{fmt(r.cost)} ر.س</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={5} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length} سجل)</td>
                  <td style={{ padding: '10px 12px', color: '#0ea77b' }}>{fmt(totalCost)} ر.س</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <MaintenanceModal
          assets={assets} accounts={accounts} cashAccounts={cashAccounts}
          tenantId={tenant!.id}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadAll() }}
        />
      )}
    </div>
  )
}
