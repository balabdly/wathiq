'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  FolderOpen, Search, Package, AlertTriangle, RotateCcw,
  ChevronDown, ChevronUp, Download, Plus, X, Save,
  ArrowDownToLine, ArrowUpFromLine, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════════
// الألوان والثوابت
// ══════════════════════════════════════════
const MOVEMENT_COLORS = {
  استلام:       { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', label: 'استلام عهدة' },
  صرف:          { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', label: 'صرف'          },
  ارجاع_عميل:  { color: '#e6820a', bg: '#fffbeb', border: '#fde68a', label: 'إرجاع للعميل' },
  استلام_مقايسة:{ color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'استلام مقايسة' },
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  'معلق':        { color: '#e6820a', bg: '#fffbeb' },
  'موافق':       { color: '#1a56db', bg: '#eff6ff' },
  'تم الاستلام': { color: '#0ea77b', bg: '#ecfdf5' },
}

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

type Project     = { id: number; name: string; status?: string; location?: string }
type ProjectMat  = {
  id: number; project_id: number; material_id: number; warehouse_id: number
  qty_received: number; qty_issued: number; qty_balance: number
  material?: { name: string; unit: string; catalog_no?: string; sec_number?: string }
  warehouse?: { name: string }
}
type Adjustment  = {
  id: string; project_id: number; material_id: number; warehouse_id: number
  qty_requested: number; qty_received: number; unit_price: number; total_amount: number
  reason?: string; status: string; requested_date: string; received_date?: string; notes?: string
  material?: { name: string; unit: string }
  warehouse?: { name: string }
}

// ══════════════════════════════════════════
// مودال: طلب تعديل مقايسة
// ══════════════════════════════════════════
function AdjustmentModal({ projectId, tenantId, materials, onClose, onSave }: {
  projectId: number; tenantId: string
  materials: ProjectMat[]
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    material_id: '', qty_requested: '', unit_price: '', reason: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedMat = materials.find(m => m.material_id === Number(form.material_id))

  async function handleSave() {
    if (!form.material_id)    { toast.error('اختر المادة'); return }
    if (!form.qty_requested)  { toast.error('أدخل الكمية'); return }
    if (!form.reason?.trim()) { toast.error('أدخل سبب النقص'); return }
    setSaving(true)
    const { error } = await supabase.from('project_material_adjustments').insert({
      tenant_id:     tenantId,
      project_id:    projectId,
      material_id:   Number(form.material_id),
      warehouse_id:  selectedMat?.warehouse_id,
      qty_requested: Number(form.qty_requested),
      qty_received:  0,
      unit_price:    Number(form.unit_price) || 0,
      reason:        form.reason.trim(),
      notes:         form.notes || null,
      status:        'معلق',
      requested_date: new Date().toISOString().split('T')[0],
    })
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('تم توثيق طلب تعديل المقايسة ✅')
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}>
          <h3 style={{ fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px' }} /> طلب تعديل مقايسة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fff7ed', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#92400e' }}>
            ⚠️ هذا الطلب يُسجَّل كدين على المشروع عند الاستلام
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
              المادة <span style={{ color: '#c81e1e' }}>*</span>
            </label>
            <select value={form.material_id} onChange={e => set('material_id', e.target.value)} className="select">
              <option value="">— اختر المادة —</option>
              {materials.map(m => (
                <option key={m.material_id} value={m.material_id}>
                  {m.material?.name} — رصيد: {fmt(m.qty_balance)} {m.material?.unit}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                الكمية المطلوبة <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <input type="number" value={form.qty_requested} onChange={e => set('qty_requested', e.target.value)}
                className="input" placeholder="0" min="0" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                السعر التقديري للوحدة
              </label>
              <input type="number" value={form.unit_price} onChange={e => set('unit_price', e.target.value)}
                className="input" placeholder="0.00" min="0" step="0.01" />
            </div>
          </div>

          {form.qty_requested && form.unit_price && (
            <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 600 }}>
              💰 الدين التقديري: {fmt(Number(form.qty_requested) * Number(form.unit_price))} ر.س
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
              سبب النقص <span style={{ color: '#c81e1e' }}>*</span>
            </label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
              className="input" placeholder="اشرح سبب النقص..." style={{ minHeight: '70px', resize: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="input" placeholder="اختياري" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? 'جاري الحفظ...' : 'توثيق الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: تأكيد استلام مقايسة
// ══════════════════════════════════════════
function ReceiveAdjustmentModal({ adj, tenantId, branchId, onClose, onSave }: {
  adj: Adjustment; tenantId: string; branchId: number
  onClose: () => void; onSave: () => void
}) {
  const [saving,   setSaving]   = useState(false)
  const [qtyRecv,  setQtyRecv]  = useState(String(adj.qty_requested))
  const [unitPrice, setUnitPrice] = useState(String(adj.unit_price || ''))
  const [recvDate, setRecvDate] = useState(new Date().toISOString().split('T')[0])

  async function handleSave() {
    const qty = Number(qtyRecv)
    if (!qty) { toast.error('أدخل الكمية'); return }
    setSaving(true)

    // ١ — جلب رصيد المادة الحالي
    const { data: mat } = await supabase.from('materials').select('qty, name, unit, warehouse_id')
      .eq('id', adj.material_id).single()
    if (!mat) { toast.error('لم يتم العثور على المادة'); setSaving(false); return }

    const qtyBefore = Number(mat.qty)
    const qtyAfter  = qtyBefore + qty

    // ٢ — تحديث رصيد المادة
    await supabase.from('materials').update({ qty: qtyAfter }).eq('id', adj.material_id)

    // ٣ — تسجيل في stock_ledger بنوع "استلام مقايسة"
    const { data: wh } = await supabase.from('warehouses').select('name').eq('id', adj.warehouse_id).single()
    const { data: proj } = await supabase.from('projects').select('name').eq('id', adj.project_id).single()

    await supabase.from('stock_ledger').insert({
      tenant_id:         tenantId,
      branch_id:         branchId,
      type:              'استلام',
      movement_category: 'استلام_مقايسة',
      is_adjustment:     true,
      adjustment_id:     adj.id,
      mat_name:          mat.name,
      unit:              mat.unit,
      qty,
      qty_before:        qtyBefore,
      qty_after:         qtyAfter,
      wh_name:           wh?.name || '',
      project_id:        adj.project_id,
      project_name:      proj?.name || '',
    })

    // ٤ — تحديث project_materials
    const { data: pm } = await supabase.from('project_materials').select('*')
      .eq('tenant_id', tenantId).eq('project_id', adj.project_id)
      .eq('material_id', adj.material_id).eq('warehouse_id', adj.warehouse_id).maybeSingle()

    if (pm) {
      await supabase.from('project_materials').update({
        qty_received: Number(pm.qty_received) + qty,
        qty_balance:  Number(pm.qty_balance) + qty,
      }).eq('id', pm.id)
    } else {
      await supabase.from('project_materials').insert({
        tenant_id: tenantId, project_id: adj.project_id,
        material_id: adj.material_id, warehouse_id: adj.warehouse_id,
        qty_received: qty, qty_issued: 0, qty_balance: qty,
      })
    }

    // ٥ — تحديث حالة طلب المقايسة
    await supabase.from('project_material_adjustments').update({
      status:        'تم الاستلام',
      qty_received:  qty,
      unit_price:    Number(unitPrice) || adj.unit_price,
      received_date: recvDate,
    }).eq('id', adj.id)

    setSaving(false)
    toast.success('✅ تم استلام مواد المقايسة وتسجيل الدين على المشروع')
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}>
          <h3 style={{ fontWeight: 700, color: '#7c3aed' }}>تأكيد استلام مواد المقايسة</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{adj.material?.name}</div>
            <div style={{ color: 'var(--text3)' }}>
              مطلوب: <strong>{fmt(adj.qty_requested)}</strong> {adj.material?.unit}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                الكمية المستلمة <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <input type="number" value={qtyRecv} onChange={e => setQtyRecv(e.target.value)}
                className="input" min="0" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                السعر الفعلي للوحدة
              </label>
              <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                className="input" min="0" step="0.01" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>تاريخ الاستلام</label>
            <input type="date" value={recvDate} onChange={e => setRecvDate(e.target.value)} className="input" />
          </div>

          {qtyRecv && unitPrice && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#c81e1e', fontWeight: 700 }}>
              💰 الدين المترتب: {fmt(Number(qtyRecv) * Number(unitPrice))} ر.س
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? 'جاري الحفظ...' : 'تأكيد الاستلام وتسجيل الدين'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function InventoryProjectsPage() {
  const { tenant, activeBranch } = useStore()

  const [projects,     setProjects]     = useState<Project[]>([])
  const [materials,    setMaterials]    = useState<Record<number, ProjectMat[]>>({})
  const [adjustments,  setAdjustments]  = useState<Record<number, Adjustment[]>>({})
  const [activeTab,    setActiveTab]    = useState<Record<number, 'materials' | 'adjustments'>>({})
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set())
  const [loadingProj,  setLoadingProj]  = useState<Set<number>>(new Set())
  const [adjModal,     setAdjModal]     = useState<number | null>(null)
  const [recvAdj,      setRecvAdj]      = useState<Adjustment | null>(null)
  const [kpis, setKpis] = useState({ totalProjects: 0, totalMaterials: 0, zeroBalance: 0, pendingAdj: 0, totalDebt: 0 })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)
    const { data: pmData } = await supabase.from('project_materials')
      .select('project_id').eq('tenant_id', tenant.id)
    const projectIds = Array.from(new Set((pmData || []).map((p: any) => p.project_id)))
    if (projectIds.length === 0) { setLoading(false); return }

    const [projRes, allPM, adjRes] = await Promise.all([
      supabase.from('projects').select('id, name, status, location').in('id', projectIds).order('name'),
      supabase.from('project_materials').select('qty_balance').eq('tenant_id', tenant.id),
      supabase.from('project_material_adjustments')
        .select('status, total_amount').eq('tenant_id', tenant.id),
    ])

    const zeroBalance = (allPM.data || []).filter(m => Number(m.qty_balance) === 0).length
    const pendingAdj  = (adjRes.data || []).filter(a => a.status === 'معلق').length
    const totalDebt   = (adjRes.data || []).filter(a => a.status === 'تم الاستلام')
      .reduce((s, a) => s + Number(a.total_amount || 0), 0)

    setProjects(projRes.data || [])
    setKpis({ totalProjects: projectIds.length, totalMaterials: allPM.data?.length || 0, zeroBalance, pendingAdj, totalDebt })
    setLoading(false)
  }

  async function loadProjectData(projectId: number) {
    if (!tenant) return

    if (materials[projectId] !== undefined) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.has(projectId) ? next.delete(projectId) : next.add(projectId)
        return next
      })
      return
    }

    setLoadingProj(prev => new Set(Array.from(prev).concat(projectId)))

    const [matsRes, adjsRes] = await Promise.all([
      supabase.from('project_materials')
        .select('*, material:materials(name, unit, catalog_no, sec_number), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', projectId),
      supabase.from('project_material_adjustments')
        .select('*, material:materials(name, unit), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])

    setMaterials(prev  => ({ ...prev,   [projectId]: matsRes.data  || [] }))
    setAdjustments(prev => ({ ...prev,  [projectId]: adjsRes.data  || [] }))
    setActiveTab(prev  => ({ ...prev,   [projectId]: 'materials' }))
    setExpanded(prev   => new Set(Array.from(prev).concat(projectId)))
    setLoadingProj(prev => { const next = new Set(prev); next.delete(projectId); return next })
  }

  async function refreshProject(projectId: number) {
    if (!tenant) return
    setLoadingProj(prev => new Set(Array.from(prev).concat(projectId)))
    const [matsRes, adjsRes] = await Promise.all([
      supabase.from('project_materials')
        .select('*, material:materials(name, unit, catalog_no, sec_number), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', projectId),
      supabase.from('project_material_adjustments')
        .select('*, material:materials(name, unit), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])
    setMaterials(prev  => ({ ...prev,  [projectId]: matsRes.data  || [] }))
    setAdjustments(prev => ({ ...prev, [projectId]: adjsRes.data  || [] }))
    setLoadingProj(prev => { const next = new Set(prev); next.delete(projectId); return next })
    loadBase()
  }

  function exportProject(proj: Project) {
    const mats = materials[proj.id] || []
    const headers = ['الاسم', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد']
    const rows = mats.map(m => [
      m.material?.name || '—', m.material?.catalog_no || '—',
      m.warehouse?.name || '—', m.material?.unit || '—',
      m.qty_received, m.qty_issued, m.qty_balance,
    ])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `مواد_${proj.name}.xls`; a.click()
  }

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen style={{ width: '22px', height: '22px', color: '#0f766e' }} /> عهدة المشاريع
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
          المواد المستلمة والمصروفة والرصيد لكل مشروع
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
        {[
          { label: 'مشاريع عليها عهدة', value: kpis.totalProjects,  color: '#0f766e', bg: '#f0fdfa', icon: FolderOpen    },
          { label: 'إجمالي الأصناف',    value: kpis.totalMaterials, color: '#1a56db', bg: '#eff6ff', icon: Package        },
          { label: 'أصناف رصيدها صفر', value: kpis.zeroBalance,    color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle  },
          { label: 'طلبات مقايسة معلقة',value: kpis.pendingAdj,    color: '#e6820a', bg: '#fffbeb', icon: FileText,      alert: kpis.pendingAdj > 0 },
          { label: 'إجمالي الديون',     value: fmt(kpis.totalDebt) + ' ر.س', color: '#7c3aed', bg: '#f5f3ff', icon: Package },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '14px', position: 'relative' }}>
            {(kpi as any).alert && <div style={{ position: 'absolute', top: '10px', left: '10px', width: '8px', height: '8px', borderRadius: '50%', background: '#c81e1e' }} className="pulse-dot" />}
            <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color, marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* مفتاح الألوان */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(MOVEMENT_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: val.color }} />
            <span style={{ color: 'var(--text3)' }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* البحث */}
      <div style={{ position: 'relative', maxWidth: '300px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث باسم المشروع..." className="input" style={{ paddingRight: '32px', fontSize: '0.82rem' }} />
      </div>

      {/* قائمة المشاريع */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏗️</div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>لا توجد مشاريع عليها عهدة</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(proj => {
            const isExpanded   = expanded.has(proj.id)
            const isLoading    = loadingProj.has(proj.id)
            const mats         = materials[proj.id]    || []
            const adjs         = adjustments[proj.id]  || []
            const tab          = activeTab[proj.id]    || 'materials'
            const totalRecv    = mats.reduce((s, m) => s + Number(m.qty_received), 0)
            const totalIssued  = mats.reduce((s, m) => s + Number(m.qty_issued), 0)
            const totalBalance = mats.reduce((s, m) => s + Number(m.qty_balance), 0)
            const zeroItems    = mats.filter(m => Number(m.qty_balance) === 0).length
            const pendingAdjs  = adjs.filter(a => a.status === 'معلق').length
            const totalDebt    = adjs.filter(a => a.status === 'تم الاستلام')
              .reduce((s, a) => s + Number(a.total_amount || 0), 0)

            return (
              <div key={proj.id} style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>

                {/* رأس المشروع */}
                <div onClick={() => loadProjectData(proj.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FolderOpen style={{ width: '20px', height: '20px', color: '#0f766e' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {proj.status && <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '10px', padding: '1px 7px', fontWeight: 600 }}>{proj.status}</span>}
                        {proj.location && <span>📍 {proj.location}</span>}
                        {pendingAdjs > 0 && <span style={{ background: '#fffbeb', color: '#e6820a', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>⚠ {pendingAdjs} طلب معلق</span>}
                        {totalDebt > 0 && <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>دين: {fmt(totalDebt)} ر.س</span>}
                      </div>
                    </div>
                  </div>

                  {/* إحصائيات سريعة */}
                  {mats.length > 0 && (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                      {[
                        { label: 'صنف', value: mats.length, color: '#0f766e' },
                        { label: 'مستلم', value: fmt(totalRecv), color: '#0ea77b' },
                        { label: 'مصروف', value: fmt(totalIssued), color: '#c81e1e' },
                        { label: 'الرصيد', value: fmt(totalBalance), color: totalBalance > 0 ? '#1a56db' : '#c81e1e' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text3)' }}>{s.label}</div>
                        </div>
                      ))}
                      {zeroItems > 0 && (
                        <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700 }}>
                          {zeroItems} نفذت
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => refreshProject(proj.id)} title="تحديث"
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                      <RotateCcw style={{ width: '13px', height: '13px' }} />
                    </button>
                    <button onClick={() => setAdjModal(proj.id)} title="طلب تعديل مقايسة"
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #ddd6fe', background: '#f5f3ff', cursor: 'pointer', color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus style={{ width: '12px', height: '12px' }} /> مقايسة
                    </button>
                    <button onClick={() => exportProject(proj)}
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                      <Download style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>

                  <div style={{ color: 'var(--text3)', flexShrink: 0 }}>
                    {isLoading
                      ? <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
                  </div>
                </div>

                {/* تفاصيل المشروع */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>

                    {/* تبويبات */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2, #f8fafc)' }}>
                      {[
                        { id: 'materials',   label: `📦 المواد (${mats.length})` },
                        { id: 'adjustments', label: `📋 تعديلات المقايسة (${adjs.length})`, alert: pendingAdjs > 0 },
                      ].map(t => (
                        <button key={t.id}
                          onClick={() => setActiveTab(prev => ({ ...prev, [proj.id]: t.id as any }))}
                          style={{
                            padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, position: 'relative',
                            background: tab === t.id ? 'var(--card-bg, white)' : 'transparent',
                            color: tab === t.id ? '#1a56db' : 'var(--text3)',
                            borderBottom: tab === t.id ? '2px solid #1a56db' : '2px solid transparent',
                          }}>
                          {t.label}
                          {(t as any).alert && <span style={{ position: 'absolute', top: '6px', right: '6px', width: '7px', height: '7px', borderRadius: '50%', background: '#e6820a' }} />}
                        </button>
                      ))}
                    </div>

                    {/* تاب المواد */}
                    {tab === 'materials' && (
                      mats.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
                          لا توجد مواد لهذا المشروع
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                                {['المادة', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد', 'الحالة'].map(h => (
                                  <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {mats.map((m, i) => {
                                const balance  = Number(m.qty_balance)
                                const received = Number(m.qty_received)
                                const pct      = received > 0 ? Math.round((balance / received) * 100) : 0
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: balance === 0 ? '#fff5f5' : 'transparent' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.material?.name || '—'}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.material?.catalog_no || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{m.warehouse?.name || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{m.material?.unit || '—'}</td>
                                    {/* مستلم — أخضر */}
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: MOVEMENT_COLORS.استلام.color }}>
                                      {fmt(received)}
                                    </td>
                                    {/* مصروف — أحمر */}
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: MOVEMENT_COLORS.صرف.color }}>
                                      {fmt(Number(m.qty_issued))}
                                    </td>
                                    {/* الرصيد */}
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: balance === 0 ? '#c81e1e' : balance < received * 0.2 ? '#d97706' : '#1a56db' }}>
                                      {fmt(balance)}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      {balance === 0 ? (
                                        <span style={{ background: MOVEMENT_COLORS.صرف.bg, color: MOVEMENT_COLORS.صرف.color, border: `1px solid ${MOVEMENT_COLORS.صرف.border}`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700 }}>نفذ</span>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', minWidth: '60px' }}>
                                            <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, transition: 'width 0.3s',
                                              background: pct > 50 ? MOVEMENT_COLORS.استلام.color : pct > 20 ? '#d97706' : MOVEMENT_COLORS.صرف.color }} />
                                          </div>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{pct}%</span>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                              {/* سطر الإجمالي */}
                              <tr style={{ background: '#f0fdfa', fontWeight: 700 }}>
                                <td colSpan={4} style={{ padding: '10px 14px', color: '#0f766e' }}>الإجمالي — {mats.length} صنف</td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: MOVEMENT_COLORS.استلام.color }}>{fmt(totalRecv)}</td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: MOVEMENT_COLORS.صرف.color }}>{fmt(totalIssued)}</td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db', fontSize: '0.95rem' }}>{fmt(totalBalance)}</td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {/* تاب تعديلات المقايسة */}
                    {tab === 'adjustments' && (
                      adjs.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
                          لا توجد طلبات تعديل مقايسة
                          <div style={{ marginTop: '10px' }}>
                            <button onClick={() => setAdjModal(proj.id)} className="btn btn-primary" style={{ background: '#7c3aed', fontSize: '0.82rem' }}>
                              <Plus style={{ width: '14px', height: '14px' }} /> طلب تعديل مقايسة
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f5f3ff' }}>
                                {['المادة', 'المستودع', 'مطلوب', 'مستلم', 'سعر الوحدة', 'الدين', 'السبب', 'الحالة', 'التاريخ', ''].map(h => (
                                  <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#7c3aed', fontSize: '0.72rem', whiteSpace: 'nowrap', borderBottom: '2px solid #ddd6fe' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {adjs.map((adj, i) => {
                                const sc = STATUS_COLORS[adj.status] || STATUS_COLORS['معلق']
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{adj.material?.name || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{adj.warehouse?.name || '—'}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 700 }}>{fmt(adj.qty_requested)} {adj.material?.unit}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: MOVEMENT_COLORS.استلام.color, fontWeight: 700 }}>
                                      {adj.qty_received > 0 ? fmt(adj.qty_received) : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text3)' }}>
                                      {adj.unit_price > 0 ? fmt(adj.unit_price) + ' ر.س' : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>
                                      {adj.total_amount > 0 ? fmt(adj.total_amount) + ' ر.س' : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text3)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {adj.reason || '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{ background: sc.bg, color: sc.color, borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700 }}>
                                        {adj.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                      {adj.requested_date}
                                    </td>
                                    <td style={{ padding: '10px 8px' }}>
                                      {adj.status === 'معلق' && (
                                        <button onClick={() => setRecvAdj(adj)}
                                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ddd6fe', background: '#f5f3ff', cursor: 'pointer', color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                          استلام ←
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                              {/* إجمالي الديون */}
                              {totalDebt > 0 && (
                                <tr style={{ background: '#fef2f2', fontWeight: 700 }}>
                                  <td colSpan={5} style={{ padding: '10px 14px', color: '#c81e1e' }}>إجمالي الديون المترتبة</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e', fontSize: '0.95rem' }}>{fmt(totalDebt)} ر.س</td>
                                  <td colSpan={4} />
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* مودال طلب مقايسة */}
      {adjModal !== null && tenant && (
        <AdjustmentModal
          projectId={adjModal}
          tenantId={tenant.id}
          materials={materials[adjModal] || []}
          onClose={() => setAdjModal(null)}
          onSave={() => refreshProject(adjModal)}
        />
      )}

      {/* مودال استلام مقايسة */}
      {recvAdj && tenant && activeBranch && (
        <ReceiveAdjustmentModal
          adj={recvAdj}
          tenantId={tenant.id}
          branchId={activeBranch.id}
          onClose={() => setRecvAdj(null)}
          onSave={() => { refreshProject(recvAdj.project_id); setRecvAdj(null) }}
        />
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pulse-dot { animation: pulse-anim 2s infinite; }
        @keyframes pulse-anim { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
      `}</style>
    </div>
  )
}
