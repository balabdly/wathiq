'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, Package, TrendingDown, Wrench, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Asset = {
  id: number; tenant_id: string; asset_no: string
  name: string; category: string; description?: string; serial_no?: string
  purchase_date: string; purchase_value: number; installation_cost: number
  total_cost: number; salvage_value: number; useful_life_years: number
  depreciation_method: string; monthly_depreciation: number
  accumulated_depreciation: number; book_value: number
  last_depreciation_date?: string
  asset_account_id?: number; accum_account_id?: number; expense_account_id?: number
  project_id?: number; cash_account_id?: number; payment_method?: string
  status: string; disposal_date?: string; disposal_value?: number; disposal_type?: string
  notes?: string
  project?: { name: string }
  asset_account?: { code: string; name: string }
}

type Account    = { id: number; code: string; name: string; is_parent?: boolean }
type Project    = { id: number; name: string }
type CashAccount = { id: number; name: string; account_type: string }

const CATEGORIES = ['سيارات ومركبات', 'معدات وآلات', 'أجهزة وحاسبات', 'أثاث ومفروشات', 'أصول أخرى']

const CATEGORY_ACCOUNTS: Record<string, { asset: string; accum: string }> = {
  'سيارات ومركبات': { asset: '1510', accum: '1511' },
  'معدات وآلات':    { asset: '1520', accum: '1521' },
  'أجهزة وحاسبات':  { asset: '1530', accum: '1531' },
  'أثاث ومفروشات':  { asset: '1540', accum: '1541' },
  'أصول أخرى':      { asset: '1550', accum: '1551' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'نشط':         { bg: '#ecfdf5', color: '#0ea77b' },
  'مُهلَك كلياً': { bg: '#f3f4f6', color: '#6b7280' },
  'مُستبعَد':    { bg: '#fef2f2', color: '#c81e1e' },
}

const fmt  = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })
const fmtP = (n: number) => `${Math.round(n)}%`

// ════════════════════════════════════════
// مودال: إضافة / تعديل أصل
// ════════════════════════════════════════
function AssetModal({ asset, accounts, projects, cashAccounts, tenantId, onClose, onSave }: {
  asset: Asset | null; accounts: Account[]; projects: Project[]
  cashAccounts: CashAccount[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    name:                 asset?.name                || '',
    category:             asset?.category            || 'سيارات ومركبات',
    description:          asset?.description         || '',
    serial_no:            asset?.serial_no           || '',
    purchase_date:        asset?.purchase_date       || today,
    purchase_value:       asset?.purchase_value      ? String(asset.purchase_value)      : '',
    installation_cost:    asset?.installation_cost   ? String(asset.installation_cost)   : '0',
    salvage_value:        asset?.salvage_value       ? String(asset.salvage_value)       : '0',
    useful_life_years:    asset?.useful_life_years   ? String(asset.useful_life_years)   : '5',
    depreciation_method:  asset?.depreciation_method || 'قسط ثابت',
    project_id:           asset?.project_id          ? String(asset.project_id)          : '',
    cash_account_id:      asset?.cash_account_id     ? String(asset.cash_account_id)     : '',
    payment_method:       asset?.payment_method      || 'تحويل بنكي',
    asset_account_id:     asset?.asset_account_id    ? String(asset.asset_account_id)    : '',
    accum_account_id:     asset?.accum_account_id    ? String(asset.accum_account_id)    : '',
    expense_account_id:   asset?.expense_account_id  ? String(asset.expense_account_id)  : '',
    notes:                asset?.notes               || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // تعيين الحسابات تلقائياً عند تغيير الفئة
  function handleCategoryChange(cat: string) {
    set('category', cat)
    const cats = CATEGORY_ACCOUNTS[cat]
    if (cats) {
      const assetAcc  = accounts.find(a => a.code === cats.asset)
      const accumAcc  = accounts.find(a => a.code === cats.accum)
      const expAcc    = accounts.find(a => a.code === '5410')
      if (assetAcc) set('asset_account_id',   String(assetAcc.id))
      if (accumAcc) set('accum_account_id',    String(accumAcc.id))
      if (expAcc)   set('expense_account_id',  String(expAcc.id))
    }
  }

  // حساب الإهلاك الشهري
  const purchaseVal    = Number(form.purchase_value)    || 0
  const installCost    = Number(form.installation_cost) || 0
  const salvageVal     = Number(form.salvage_value)     || 0
  const usefulLife     = Number(form.useful_life_years) || 1
  const totalCost      = purchaseVal + installCost
  const depreciableAmt = totalCost - salvageVal
  const monthlyDep     = form.depreciation_method === 'قسط ثابت'
    ? depreciableAmt / (usefulLife * 12)
    : totalCost * (2 / (usefulLife * 12)) // رصيد متناقص مبسط

  async function handleSave() {
    if (!form.name.trim())         { toast.error('اسم الأصل مطلوب'); return }
    if (!form.purchase_value)      { toast.error('قيمة الشراء مطلوبة'); return }
    if (!form.asset_account_id)    { toast.error('حساب الأصل إلزامي'); return }
    if (!form.accum_account_id)    { toast.error('حساب مجمع الإهلاك إلزامي'); return }
    if (!form.expense_account_id)  { toast.error('حساب مصروف الإهلاك إلزامي'); return }
    setSaving(true)

    try {
      const { count } = await supabase.from('finance_assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const assetNo = asset?.asset_no || `AST-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

      const payload: Record<string, any> = {
        tenant_id: tenantId, asset_no: assetNo,
        name: form.name.trim(), category: form.category,
        description: form.description || null, serial_no: form.serial_no || null,
        purchase_date: form.purchase_date,
        purchase_value: purchaseVal, installation_cost: installCost,
        salvage_value: salvageVal, useful_life_years: usefulLife,
        depreciation_method: form.depreciation_method,
        monthly_depreciation: Math.round(monthlyDep * 100) / 100,
        book_value: totalCost,
        accumulated_depreciation: asset?.accumulated_depreciation || 0,
        asset_account_id:   Number(form.asset_account_id),
        accum_account_id:   Number(form.accum_account_id),
        expense_account_id: Number(form.expense_account_id),
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        status: asset?.status || 'نشط',
      }
      if (form.project_id)      payload.project_id      = Number(form.project_id)
      if (form.cash_account_id) payload.cash_account_id = Number(form.cash_account_id)

      let savedId: number | null = null
      if (asset?.id) {
        const { error } = await supabase.from('finance_assets').update(payload).eq('id', asset.id)
        if (error) throw error
        savedId = asset.id
      } else {
        const { data, error } = await supabase.from('finance_assets').insert(payload).select('id').single()
        if (error) throw error
        savedId = data?.id

        // قيد تسجيل الأصل: مدين الأصل / دائن البنك أو الصندوق
        if (savedId && form.cash_account_id) {
          const assetAcc = accounts.find(a => a.id === Number(form.asset_account_id))
          const cashAcc  = cashAccounts.find(a => a.id === Number(form.cash_account_id))
          if (assetAcc?.code && cashAcc) {
            const { data: cashFAcc } = await supabase.from('finance_accounts').select('id,code').eq('tenant_id', tenantId).eq('code',
              cashAcc.account_type === 'صندوق' ? '1111' : '1115'
            ).maybeSingle()
            const { count: jc } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
            const { data: entry } = await supabase.from('finance_journal_entries').insert({
              tenant_id: tenantId,
              entry_number: `JE-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`,
              entry_date: form.purchase_date,
              description: `شراء أصل — ${form.name.trim()} (${assetNo})`,
              reference_type: 'أصل', reference_id: savedId,
              total_debit: totalCost, total_credit: totalCost,
              status: 'معتمد', entry_source: 'آلي',
            }).select('id').single()

            if (entry) {
              const debitAccId = Number(form.asset_account_id)
              const creditAccId = cashFAcc?.id || (cashAccounts.find(a => a.id === Number(form.cash_account_id)) as any)?.account_id
              if (debitAccId && creditAccId) {
                await supabase.from('finance_journal_lines').insert([
                  { entry_id: entry.id, account_id: debitAccId,  debit: totalCost, credit: 0,         description: `شراء: ${form.name.trim()}` },
                  { entry_id: entry.id, account_id: creditAccId, debit: 0,         credit: totalCost, description: form.payment_method },
                ])
              }
            }
          }
        }
      }

      toast.success(asset ? 'تم التعديل ✅' : `✅ تم تسجيل الأصل (${assetNo})`)
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  // تعيين الحسابات تلقائياً عند فتح المودال لأول مرة
  useEffect(() => {
    if (!asset) handleCategoryChange(form.category)
  }, [])

  const expenseAccounts = accounts.filter(a => !a.is_parent && a.code?.startsWith('54'))
  const assetAccounts   = accounts.filter(a => !a.is_parent && (a.code?.startsWith('15')))

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            {asset ? 'تعديل أصل' : 'تسجيل أصل ثابت'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* الفئة */}
          <div>
            <label style={lbl}>فئة الأصل *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    borderColor: form.category === cat ? '#7c3aed' : 'var(--border)',
                    background:  form.category === cat ? '#f5f3ff' : 'white',
                    color:       form.category === cat ? '#7c3aed' : 'var(--text3)' }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* الاسم والرقم التسلسلي */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>اسم الأصل *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: سيارة تويوتا هايلكس 2024" />
            </div>
            <div>
              <label style={lbl}>الرقم التسلسلي</label>
              <input value={form.serial_no} onChange={e => set('serial_no', e.target.value)} className="input" dir="ltr" placeholder="S/N..." />
            </div>
          </div>

          {/* بيانات الشراء */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#f5f3ff', padding: '14px', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
            <div>
              <label style={lbl}>تاريخ الشراء *</label>
              <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>قيمة الشراء *</label>
              <input type="number" value={form.purchase_value} onChange={e => set('purchase_value', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>تكاليف الإعداد</label>
              <input type="number" value={form.installation_cost} onChange={e => set('installation_cost', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
          </div>

          {/* إعدادات الإهلاك */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div>
              <label style={lbl}>القيمة التخريدية</label>
              <input type="number" value={form.salvage_value} onChange={e => set('salvage_value', e.target.value)} className="input" dir="ltr" min="0" placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>العمر الإنتاجي (سنوات)</label>
              <input type="number" value={form.useful_life_years} onChange={e => set('useful_life_years', e.target.value)} className="input" dir="ltr" min="1" max="50" />
            </div>
            <div>
              <label style={lbl}>طريقة الإهلاك</label>
              <select value={form.depreciation_method} onChange={e => set('depreciation_method', e.target.value)} className="select">
                <option>قسط ثابت</option>
                <option>رصيد متناقص</option>
              </select>
            </div>
          </div>

          {/* ملخص الإهلاك */}
          {purchaseVal > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'إجمالي التكلفة',    value: fmt(totalCost) + ' ر.س',              color: '#7c3aed' },
                { label: 'إهلاك شهري',         value: fmt(monthlyDep) + ' ر.س',             color: '#e6820a' },
                { label: 'إهلاك سنوي',         value: fmt(monthlyDep * 12) + ' ر.س',        color: '#1a56db' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: item.color, fontSize: '0.9rem' }}>{item.value}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* طريقة الدفع */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
                {['تحويل بنكي', 'نقداً', 'شيك', 'آجل'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الدفع من حساب</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_type === 'صندوق' ? '💰' : '🏦'} {a.name}</option>)}
              </select>
            </div>
          </div>

          {/* الحسابات المحاسبية */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px', color: '#374151' }}>📋 الحسابات المحاسبية (تُعبَّأ تلقائياً حسب الفئة)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={lbl}>حساب الأصل *</label>
                <select value={form.asset_account_id} onChange={e => set('asset_account_id', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>مجمع الإهلاك *</label>
                <select value={form.accum_account_id} onChange={e => set('accum_account_id', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>مصروف الإهلاك *</label>
                <select value={form.expense_account_id} onChange={e => set('expense_account_id', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* المشروع والملاحظات */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المشروع (اختياري)</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون مشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {form.project_id && (
                <div style={{ fontSize: '0.68rem', color: '#0ea77b', marginTop: '3px' }}>
                  ✅ سيُحمَّل الإهلاك على تكلفة المشروع
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {asset ? 'حفظ التعديل' : 'تسجيل الأصل'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function AssetsPage() {
  const { tenant } = useStore()
  const [assets,       setAssets]       = useState<Asset[]>([])
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [catFilter,    setCatFilter]    = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editAsset,    setEditAsset]    = useState<Asset | null>(null)

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [assetsRes, accRes, projRes, cashRes] = await Promise.all([
      supabase.from('finance_assets').select('*, project:projects(name), asset_account:finance_accounts!finance_assets_asset_account_id_fkey(code,name)')
        .eq('tenant_id', tenant.id).order('asset_no'),
      supabase.from('finance_accounts').select('id,code,name,is_parent').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_cash_accounts').select('id,name,account_type').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setAssets(assetsRes.data || [])
    setAccounts(accRes.data || [])
    setProjects(projRes.data || [])
    setCashAccounts(cashRes.data || [])
    setLoading(false)
  }

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.name.includes(search) || a.asset_no.includes(search)
    const matchCat    = !catFilter || a.category === catFilter
    return matchSearch && matchCat
  })

  // KPIs
  const totalCost   = assets.filter(a => a.status !== 'مُستبعَد').reduce((s, a) => s + Number(a.total_cost), 0)
  const totalAccum  = assets.filter(a => a.status !== 'مُستبعَد').reduce((s, a) => s + Number(a.accumulated_depreciation), 0)
  const totalBook   = assets.filter(a => a.status !== 'مُستبعَد').reduce((s, a) => s + Number(a.book_value), 0)
  const activeCount = assets.filter(a => a.status === 'نشط').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
            سجل الأصول الثابتة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>تسجيل وإدارة الأصول الثابتة وإهلاكاتها</p>
        </div>
        <button onClick={() => { setEditAsset(null); setShowModal(true) }} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> تسجيل أصل جديد
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي التكلفة',     value: fmt(totalCost),   color: '#7c3aed', bg: '#f5f3ff', icon: '📦' },
          { label: 'مجمع الإهلاك',       value: fmt(totalAccum),  color: '#e6820a', bg: '#fffbeb', icon: '📉' },
          { label: 'القيمة الدفترية',    value: fmt(totalBook),   color: '#1a56db', bg: '#eff6ff', icon: '💰' },
          { label: 'أصول نشطة',          value: String(activeCount), color: '#0ea77b', bg: '#ecfdf5', icon: '✅', isCount: true },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '6px' }}>{kpi.icon} {kpi.label}</div>
            <div style={{ fontSize: (kpi as any).isCount ? '2rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>
              {(kpi as any).isCount ? kpi.value : kpi.value + ' ر.س'}
            </div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث باسم الأصل أو الرقم..." />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select" style={{ width: '180px' }}>
          <option value="">كل الفئات</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Package style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد أصول مسجلة</p>
          <button onClick={() => { setEditAsset(null); setShowModal(true) }} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول أصل
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم الأصل', 'الاسم', 'الفئة', 'تاريخ الشراء', 'التكلفة', 'مجمع الإهلاك', 'القيمة الدفترية', 'نسبة الإهلاك', 'المشروع', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => {
                  const depPct = Number(asset.total_cost) > 0 ? (Number(asset.accumulated_depreciation) / Number(asset.total_cost)) * 100 : 0
                  const statusStyle = STATUS_STYLE[asset.status] || { bg: '#f3f4f6', color: '#6b7280' }
                  return (
                    <tr key={asset.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.8rem' }}>{asset.asset_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '160px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                        {asset.serial_no && <div style={{ fontSize: '0.68rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{asset.serial_no}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>{asset.category}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{asset.purchase_date}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{fmt(asset.total_cost)} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a', whiteSpace: 'nowrap' }}>{fmt(asset.accumulated_depreciation)} ر.س</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a56db', whiteSpace: 'nowrap' }}>{fmt(asset.book_value)} ر.س</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', minWidth: '60px' }}>
                            <div style={{ height: '100%', borderRadius: '3px', background: depPct >= 90 ? '#c81e1e' : depPct >= 50 ? '#e6820a' : '#7c3aed', width: `${Math.min(depPct, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtP(depPct)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#1a56db' }}>{(asset as any).project?.name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, background: statusStyle.bg, color: statusStyle.color }}>{asset.status}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <button onClick={() => { setEditAsset(asset); setShowModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={4} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length} أصل)</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{fmt(filtered.reduce((s, a) => s + Number(a.total_cost), 0))} ر.س</td>
                  <td style={{ padding: '10px 12px', color: '#e6820a' }}>{fmt(filtered.reduce((s, a) => s + Number(a.accumulated_depreciation), 0))} ر.س</td>
                  <td style={{ padding: '10px 12px', color: '#1a56db' }}>{fmt(filtered.reduce((s, a) => s + Number(a.book_value), 0))} ر.س</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AssetModal
          asset={editAsset}
          accounts={accounts}
          projects={projects}
          cashAccounts={cashAccounts}
          tenantId={tenant!.id}
          onClose={() => { setShowModal(false); setEditAsset(null) }}
          onSave={() => { setShowModal(false); setEditAsset(null); loadAll() }}
        />
      )}
    </div>
  )
}
