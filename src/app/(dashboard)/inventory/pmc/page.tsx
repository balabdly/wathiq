'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  fetchReservations, createReservation, fetchBoqVersions,
  createBoqVersion, activateBoqVersion, fetchReservationReconciliation,
  fetchVariationOrders, createVariationOrder, applyVariationOrder, approveVariationOrder,
  finalizeReservationReconciliation,
} from '@/lib/pmc-service'
import {
  RESERVATION_STATUS_LABELS, BOQ_VERSION_TYPE_LABELS, VARIATION_STATUS_LABELS,
  type MaterialReservation, type ProjectBoqVersion, type ReservationReconciliation,
  type BoqVariationOrder,
} from '@/lib/pmc-types'
import { Plus, Search, BookOpen, ClipboardList, BarChart3, GitBranch, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  OPEN:        { color: '#0ea77b', bg: '#ecfdf5' },
  PARTIAL:     { color: '#e6820a', bg: '#fffbeb' },
  RECONCILED:  { color: '#1a56db', bg: '#eff6ff' },
  CLOSED:      { color: '#6b7280', bg: '#f9fafb' },
  DRAFT:       { color: '#6b7280', bg: '#f9fafb' },
  ACTIVE:      { color: '#0ea77b', bg: '#ecfdf5' },
  SUPERSEDED:  { color: '#9ca3af', bg: '#f3f4f6' },
}

type Project = { id: number; name: string }

export default function PmcPage() {
  const { tenant } = useStore()
  const [tab, setTab] = useState<'reservations' | 'boq' | 'variations' | 'reconcile'>('reservations')
  const [projects, setProjects] = useState<Project[]>([])
  const [reservations, setReservations] = useState<MaterialReservation[]>([])
  const [boqVersions, setBoqVersions] = useState<ProjectBoqVersion[]>([])
  const [variations, setVariations] = useState<BoqVariationOrder[]>([])
  const [reconcile, setReconcile] = useState<ReservationReconciliation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<number | ''>('')

  const [showResForm, setShowResForm] = useState(false)
  const [resForm, setResForm] = useState({ project_id: '', reservation_no: '', client_name: '', notes: '' })

  const [showBoqForm, setShowBoqForm] = useState(false)
  const [showVarForm, setShowVarForm] = useState(false)
  const [varForm, setVarForm] = useState({ variation_no: '', parent_boq_version_id: '', reason: '', sec_reference: '' })
  const [closeResId, setCloseResId] = useState<number | ''>('')
  const [closeBoqId, setCloseBoqId] = useState<number | ''>('')
  const [boqForm, setBoqForm] = useState({
    project_id: '', version_type: 'INITIAL' as const,
    description: '', unit: 'قطعة', qty_planned: '',
  })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)
    const [projRes, resRes] = await Promise.all([
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id)
        .not('status', 'eq', 'مكتمل').order('name'),
      fetchReservations(tenant.id),
    ])
    setProjects(projRes.data || [])
    setReservations(resRes.data || [])
    setLoading(false)
  }

  async function loadBoq(projectId: number) {
    if (!tenant) return
    const { data } = await fetchBoqVersions(tenant.id, projectId)
    setBoqVersions(data || [])
  }

  async function loadReconcile(projectId?: number) {
    if (!tenant) return
    const { data } = await fetchReservationReconciliation(tenant.id, { projectId })
    setReconcile(data || [])
  }

  async function loadVariations(projectId: number) {
    if (!tenant) return
    const { data } = await fetchVariationOrders(tenant.id, projectId)
    setVariations(data || [])
  }

  useEffect(() => {
    if (!tenant) return
    if (tab === 'boq' && filterProject) loadBoq(Number(filterProject))
    if (tab === 'variations' && filterProject) loadVariations(Number(filterProject))
    if (tab === 'reconcile') {
      loadReconcile(filterProject ? Number(filterProject) : undefined)
      if (filterProject) loadBoq(Number(filterProject))
    }
  }, [tab, filterProject, tenant?.id])

  async function handleCreateReservation() {
    if (!tenant || !resForm.project_id || !resForm.reservation_no) {
      toast.error('المشروع ورقم الحجز مطلوبان')
      return
    }
    const { error } = await createReservation({
      tenant_id: tenant.id,
      project_id: Number(resForm.project_id),
      reservation_no: resForm.reservation_no.trim(),
      client_name: resForm.client_name || undefined,
      notes: resForm.notes || undefined,
      ownership_type: 'CUSTODY',
    })
    if (error) { toast.error(error.message); return }
    toast.success('تم إنشاء الحجز')
    setShowResForm(false)
    setResForm({ project_id: '', reservation_no: '', client_name: '', notes: '' })
    const { data } = await fetchReservations(tenant.id)
    setReservations(data || [])
  }

  async function handleCreateBoq() {
    if (!tenant || !filterProject || !boqForm.description) {
      toast.error('اختر مشروعاً ووصف البند')
      return
    }
    const projectId = Number(filterProject)
    const existing = boqVersions.filter(v => v.project_id === projectId)
    const versionNo = existing.length + 1
    const { error } = await createBoqVersion({
      tenant_id: tenant.id,
      project_id: projectId,
      version_type: boqForm.version_type,
      version_no: versionNo,
      lines: [{
        line_no: 1,
        description: boqForm.description,
        unit: boqForm.unit,
        qty_planned: Number(boqForm.qty_planned) || 0,
      }],
    })
    if (error) { toast.error(error.message); return }
    toast.success('تم إنشاء إصدار BOQ')
    setShowBoqForm(false)
    loadBoq(projectId)
  }

  async function handleCreateVariation() {
    if (!tenant || !filterProject || !varForm.variation_no || !varForm.parent_boq_version_id) {
      toast.error('رقم أمر التغيير وإصدار BOQ الأب مطلوبان')
      return
    }
    const { error } = await createVariationOrder({
      tenant_id: tenant.id,
      project_id: Number(filterProject),
      variation_no: varForm.variation_no.trim(),
      parent_boq_version_id: Number(varForm.parent_boq_version_id),
      reason: varForm.reason || undefined,
      sec_reference: varForm.sec_reference || undefined,
    })
    if (error) { toast.error(error.message); return }
    toast.success('تم إنشاء أمر التغيير')
    setShowVarForm(false)
    setVarForm({ variation_no: '', parent_boq_version_id: '', reason: '', sec_reference: '' })
    loadVariations(Number(filterProject))
  }

  async function handleCloseReservation() {
    if (!tenant || !closeResId) { toast.error('اختر الحجز للإغلاق'); return }
    const openBalance = reconcile
      .filter(r => r.reservation_id === Number(closeResId))
      .reduce((s, r) => s + Number(r.qty_on_hand), 0)
    if (openBalance > 0) {
      toast.error(`لا يمكن الإغلاق — رصيد متبقٍ: ${fmt(openBalance)} (أرجع الفائض للعميل أولاً)`)
      return
    }
    const { error } = await finalizeReservationReconciliation(
      tenant.id, Number(closeResId), closeBoqId ? Number(closeBoqId) : undefined,
    )
    if (error) { toast.error(error.message); return }
    toast.success('تم إغلاق الحجز والمطابقة النهائية')
    loadBase()
    loadReconcile(filterProject ? Number(filterProject) : undefined)
    setCloseResId('')
  }

  const activeBoqVersions = boqVersions.filter(v => v.status === 'ACTIVE' || v.status === 'DRAFT')
  const openReservations = reservations.filter(r => r.status !== 'CLOSED')

  const filteredRes = reservations.filter(r => {
    if (filterProject && r.project_id !== Number(filterProject)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return r.reservation_no.toLowerCase().includes(q)
      || (r.project as any)?.name?.toLowerCase().includes(q)
      || (r.client_name || '').toLowerCase().includes(q)
  })

  const TABS = [
    { id: 'reservations' as const, label: 'حجوزات المواد', icon: ClipboardList },
    { id: 'boq' as const,          label: 'مقايسات BOQ',   icon: BookOpen },
    { id: 'variations' as const,  label: 'أوامر التغيير', icon: GitBranch },
    { id: 'reconcile' as const,    label: 'مطابقة العهدة', icon: BarChart3 },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>إدارة عهدة SEC</h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>
          حجوزات المواد · إصدارات BOQ · مطابقة العهدة (مستلم − مصروف − مرتجع عميل)
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border)',
              background: active ? '#1a56db' : 'white', color: active ? 'white' : 'var(--text)',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}>
              <Icon style={{ width: '16px', height: '16px' }} /> {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {tab === 'reservations' && (
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', color: '#9ca3af' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الحجز أو المشروع..."
              style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }} />
          </div>
        )}
        {tab === 'reservations' && (
          <button onClick={() => setShowResForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: '#0ea77b', color: 'white', border: 'none', borderRadius: '8px',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            <Plus style={{ width: '16px', height: '16px' }} /> حجز جديد
          </button>
        )}
        {tab === 'boq' && (
          <button onClick={() => setShowBoqForm(true)} disabled={!filterProject} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: filterProject ? '#1a56db' : '#9ca3af', color: 'white', border: 'none',
            borderRadius: '8px', fontWeight: 600, cursor: filterProject ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
          }}>
            <Plus style={{ width: '16px', height: '16px' }} /> إصدار BOQ
          </button>
        )}
        {tab === 'variations' && (
          <button onClick={() => { if (filterProject) loadBoq(Number(filterProject)); setShowVarForm(true) }}
            disabled={!filterProject} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              background: filterProject ? '#7c3aed' : '#9ca3af', color: 'white', border: 'none',
              borderRadius: '8px', fontWeight: 600, cursor: filterProject ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
            }}>
            <Plus style={{ width: '16px', height: '16px' }} /> أمر تغيير
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : tab === 'reservations' ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {filteredRes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد حجوزات — أنشئ حجزاً جديداً</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['رقم الحجز', 'المشروع', 'العميل', 'الحالة', 'تاريخ الفتح'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRes.map(r => {
                  const sc = STATUS_COLORS[r.status] || STATUS_COLORS.OPEN
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{r.reservation_no}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{(r.project as any)?.name || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#6b7280' }}>{r.client_name || 'SEC'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {RESERVATION_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.8rem' }}>
                        {new Date(r.opened_at).toLocaleDateString('ar-SA')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'boq' ? (
        <div>
          {!filterProject ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
              اختر مشروعاً لعرض إصدارات BOQ
            </div>
          ) : boqVersions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
              لا توجد مقايسات — أنشئ إصداراً أولياً
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {boqVersions.map(v => {
                const sc = STATUS_COLORS[v.status] || STATUS_COLORS.DRAFT
                return (
                  <div key={v.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                          إصدار {v.version_no} — {BOQ_VERSION_TYPE_LABELS[v.version_type]}
                        </span>
                        <span style={{ marginRight: '10px', background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{v.status}</span>
                      </div>
                      {v.status === 'DRAFT' && tenant && (
                        <button onClick={async () => {
                          await activateBoqVersion(tenant.id, v.id, v.project_id)
                          toast.success('تم تفعيل الإصدار')
                          loadBoq(v.project_id)
                        }} style={{ padding: '6px 12px', background: '#0ea77b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          تفعيل
                        </button>
                      )}
                    </div>
                    {(v.lines || []).length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {['#', 'الوصف', 'الوحدة', 'الكمية المخططة'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(v.lines || []).map(l => (
                            <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{l.line_no}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{l.description}</td>
                              <td style={{ padding: '8px 10px' }}>{l.unit}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(l.qty_planned)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : tab === 'variations' ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {!filterProject ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>اختر مشروعاً لعرض أوامر التغيير</div>
          ) : variations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد أوامر تغيير</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['رقم الأمر', 'السبب', 'مرجع SEC', 'الحالة', 'إجراء'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variations.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{v.variation_no}</td>
                    <td style={{ padding: '11px 14px' }}>{v.reason || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280' }}>{v.sec_reference || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {VARIATION_STATUS_LABELS[v.status] || v.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {v.status === 'DRAFT' && tenant && (
                        <button onClick={async () => {
                          await approveVariationOrder(v.id)
                          toast.success('تم اعتماد الأمر')
                          loadVariations(Number(filterProject))
                        }} style={{ padding: '4px 10px', background: '#0ea77b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '6px' }}>
                          اعتماد
                        </button>
                      )}
                      {v.status === 'APPROVED' && tenant && (
                        <button onClick={async () => {
                          const { error } = await applyVariationOrder(v.id)
                          if (error) { toast.error(error.message); return }
                          toast.success('تم تطبيق الأمر — إصدار BOQ جديد')
                          loadVariations(Number(filterProject))
                          loadBoq(Number(filterProject))
                        }} style={{ padding: '4px 10px', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
                          تطبيق
                        </button>
                      )}
                      {v.status === 'APPLIED' && v.new_boq_version_id && (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>إصدار #{v.new_boq_version_id}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={closeResId} onChange={e => setCloseResId(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <option value="">— حجز للإغلاق —</option>
              {openReservations.map(r => <option key={r.id} value={r.id}>{r.reservation_no} ({RESERVATION_STATUS_LABELS[r.status]})</option>)}
            </select>
            <select value={closeBoqId} onChange={e => setCloseBoqId(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <option value="">إصدار AS_BUILT (اختياري)</option>
              {boqVersions.filter(v => v.version_type === 'AS_BUILT' || v.status === 'ACTIVE').map(v => (
                <option key={v.id} value={v.id}>v{v.version_no} — {BOQ_VERSION_TYPE_LABELS[v.version_type]}</option>
              ))}
            </select>
            <button onClick={handleCloseReservation} disabled={!closeResId} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              background: closeResId ? '#374151' : '#9ca3af', color: 'white', border: 'none',
              borderRadius: '8px', fontWeight: 600, cursor: closeResId ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
            }}>
              <Lock style={{ width: '14px', height: '14px' }} /> إغلاق ومطابقة نهائية
            </button>
          </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {reconcile.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد بيانات مطابقة بعد</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['الحجز', 'المادة', 'مستلم', 'مصروف', 'مرتجع WH', 'مرتجع عميل', 'صافي الاستهلاك', 'رصيد'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconcile.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{r.reservation_no}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.material_name}</td>
                    <td style={{ padding: '10px 12px', color: '#0ea77b', fontWeight: 700 }}>{fmt(r.qty_received)}</td>
                    <td style={{ padding: '10px 12px', color: '#c81e1e', fontWeight: 700 }}>{fmt(r.qty_issued)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(r.qty_returned_wh)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(r.qty_returned_client)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{fmt(r.qty_net_consumed)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: r.qty_on_hand > 0 ? '#e6820a' : '#0ea77b' }}>{fmt(r.qty_on_hand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}

      {showResForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '16px' }}>حجز مواد جديد</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select value={resForm.project_id} onChange={e => setResForm(f => ({ ...f, project_id: e.target.value }))}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <option value="">اختر المشروع *</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={resForm.reservation_no} onChange={e => setResForm(f => ({ ...f, reservation_no: e.target.value }))}
                placeholder="رقم الحجز (Booking No) *" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', direction: 'ltr', textAlign: 'right' }} />
              <input value={resForm.client_name} onChange={e => setResForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="اسم العميل (SEC)" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <textarea value={resForm.notes} onChange={e => setResForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات" rows={2} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleCreateReservation} style={{ padding: '8px 16px', background: '#0ea77b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {showVarForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '16px' }}>أمر تغيير BOQ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input value={varForm.variation_no} onChange={e => setVarForm(f => ({ ...f, variation_no: e.target.value }))}
                placeholder="رقم أمر التغيير *" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <select value={varForm.parent_boq_version_id} onChange={e => setVarForm(f => ({ ...f, parent_boq_version_id: e.target.value }))}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <option value="">إصدار BOQ الأب *</option>
                {activeBoqVersions.map(v => (
                  <option key={v.id} value={v.id}>v{v.version_no} — {BOQ_VERSION_TYPE_LABELS[v.version_type]} ({v.status})</option>
                ))}
              </select>
              <input value={varForm.sec_reference} onChange={e => setVarForm(f => ({ ...f, sec_reference: e.target.value }))}
                placeholder="مرجع SEC" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <textarea value={varForm.reason} onChange={e => setVarForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="سبب التغيير" rows={2} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVarForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleCreateVariation} style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {showBoqForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '16px' }}>إصدار BOQ جديد</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select value={boqForm.version_type} onChange={e => setBoqForm(f => ({ ...f, version_type: e.target.value as any }))}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <option value="INITIAL">مقايسة أولية</option>
                <option value="VARIATION">أمر تغيير</option>
                <option value="AS_BUILT">كما بُني</option>
              </select>
              <input value={boqForm.description} onChange={e => setBoqForm(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف البند *" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input value={boqForm.qty_planned} onChange={e => setBoqForm(f => ({ ...f, qty_planned: e.target.value }))}
                  placeholder="الكمية" type="number" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                <input value={boqForm.unit} onChange={e => setBoqForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="الوحدة" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBoqForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleCreateBoq} style={{ padding: '8px 16px', background: '#1a56db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
