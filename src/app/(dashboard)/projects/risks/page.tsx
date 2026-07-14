'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, ShieldAlert, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

type Risk = {
  id: number; tenant_id: string; project_id: number; risk_code?: string
  title: string; description?: string; category: string
  probability: string; impact: string; risk_score?: number
  status: string; response_plan?: string; response_type?: string
  owner?: string; due_date?: string; notes?: string
  created_by?: string; created_at: string
  project?: { name: string; code?: string }
}
type Project = { id: number; name: string; code?: string }

// مصفوفة تقييم المخاطر 3×3
const PROB_SCORE: Record<string, number> = { 'منخفض': 1, 'متوسط': 2, 'عالي': 3 }
const RISK_LEVEL = (score: number) =>
  score >= 7 ? { label: 'حرج',    color: '#c81e1e', bg: '#fef2f2' } :
  score >= 4 ? { label: 'عالي',   color: '#e6820a', bg: '#fffbeb' } :
  score >= 2 ? { label: 'متوسط',  color: '#1a56db', bg: '#eff6ff' } :
               { label: 'منخفض',  color: '#0ea77b', bg: '#ecfdf5' }

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  'مفتوح':        { color: '#c81e1e', bg: '#fef2f2' },
  'تحت المعالجة': { color: '#e6820a', bg: '#fffbeb' },
  'مغلق':         { color: '#0ea77b', bg: '#ecfdf5' },
  'مقبول':        { color: '#6b7280', bg: '#f3f4f6' },
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

function RiskModal({ risk, projects, tenantId, onClose, onSave }: {
  risk: Risk | null; projects: Project[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    project_id:    risk?.project_id ? String(risk.project_id) : '',
    title:         risk?.title         || '',
    description:   risk?.description   || '',
    category:      risk?.category      || 'تشغيلي',
    probability:   risk?.probability   || 'متوسط',
    impact:        risk?.impact        || 'متوسط',
    status:        risk?.status        || 'مفتوح',
    response_plan: risk?.response_plan || '',
    response_type: risk?.response_type || '',
    owner:         risk?.owner         || '',
    due_date:      risk?.due_date      || '',
    notes:         risk?.notes         || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const score = PROB_SCORE[form.probability] * PROB_SCORE[form.impact]
  const level = RISK_LEVEL(score)

  async function handleSave() {
    if (!form.title.trim())  { toast.error('عنوان المخاطرة مطلوب'); return }
    if (!form.project_id)    { toast.error('يجب تحديد المشروع');    return }
    setSaving(true)

    // توليد كود المخاطرة
    let riskCode = risk?.risk_code
    if (!riskCode) {
      const { count } = await supabase.from('project_risks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      riskCode = `R-${String((count || 0) + 1).padStart(3, '0')}`
    }

    const payload: any = {
      tenant_id: tenantId, project_id: Number(form.project_id),
      risk_code: riskCode, title: form.title.trim(),
      description: form.description || null, category: form.category,
      probability: form.probability, impact: form.impact, risk_score: score,
      status: form.status, response_plan: form.response_plan || null,
      response_type: form.response_type || null, owner: form.owner || null,
      due_date: form.due_date || null, notes: form.notes || null,
    }
    if (form.status === 'مغلق' && (!risk || risk.status !== 'مغلق')) {
      payload.closed_at = new Date().toISOString()
    }

    if (risk) await supabase.from('project_risks').update(payload).eq('id', risk.id)
    else      await supabase.from('project_risks').insert(payload)
    toast.success(risk ? 'تم التعديل ✅' : '✅ تم تسجيل المخاطرة')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {risk ? '✏️ تعديل المخاطرة' : '⚠️ تسجيل مخاطرة جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                {['تشغيلي', 'مالي', 'تعاقدي', 'فني', 'خارجي', 'بيئي', 'سلامة'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>وصف المخاطرة <span style={{ color: '#c81e1e' }}>*</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="ما هي المخاطرة؟ صِفها بوضوح..." />
          </div>

          <div>
            <label style={lbl}>التفاصيل</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: '60px', resize: 'none' }} placeholder="سياق المخاطرة والأسباب المحتملة..." />
          </div>

          {/* مصفوفة المخاطر */}
          <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px' }}>📊 تقييم المخاطرة</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ ...lbl, fontSize: '0.82rem' }}>الاحتمالية</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['منخفض', 'متوسط', 'عالي'].map(v => (
                    <button key={v} type="button" onClick={() => set('probability', v)}
                      style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '2px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        borderColor: form.probability === v ? '#1a56db' : 'var(--border)',
                        background:  form.probability === v ? '#eff6ff' : 'white',
                        color:       form.probability === v ? '#1a56db' : 'var(--text3)' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ ...lbl, fontSize: '0.82rem' }}>الأثر</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['منخفض', 'متوسط', 'عالي'].map(v => (
                    <button key={v} type="button" onClick={() => set('impact', v)}
                      style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '2px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        borderColor: form.impact === v ? '#c81e1e' : 'var(--border)',
                        background:  form.impact === v ? '#fef2f2' : 'white',
                        color:       form.impact === v ? '#c81e1e' : 'var(--text3)' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* مستوى المخاطرة المحسوب */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: level.bg, borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: level.color }}>{score}</div>
              <div>
                <div style={{ fontWeight: 700, color: level.color, fontSize: '0.9rem' }}>مستوى المخاطرة: {level.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>الاحتمالية × الأثر = {PROB_SCORE[form.probability]} × {PROB_SCORE[form.impact]}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>نوع الاستجابة</label>
              <select value={form.response_type} onChange={e => set('response_type', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['تجنب', 'تخفيف', 'نقل', 'قبول'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>خطة الاستجابة</label>
            <textarea value={form.response_plan} onChange={e => set('response_plan', e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }}
              placeholder="ما هي الإجراءات المتخذة للتعامل مع هذه المخاطرة؟" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المسؤول</label>
              <input value={form.owner} onChange={e => set('owner', e.target.value)} className="input" placeholder="اسم المسؤول..." />
            </div>
            <div>
              <label style={lbl}>تاريخ المراجعة</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
            {risk ? 'حفظ التعديل' : 'تسجيل المخاطرة'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectRisksPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [risks,    setRisks]    = useState<Risk[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterLevel,   setFilterLevel]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editRisk,  setEditRisk]  = useState<Risk | null>(null)

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { if (tenant && activeBranch) loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const pRes = await supabase.from('projects')
      .select('id, name, code')
      .eq('tenant_id', tenant.id)
      .eq('branch_id', activeBranch.id)
      .order('name')
    const projList = pRes.data || []
    const projectIds = projList.map(p => p.id)
    let risksData: Risk[] = []
    if (projectIds.length > 0) {
      const rRes = await supabase.from('project_risks')
        .select('*, project:projects(name, code)')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds)
        .order('risk_score', { ascending: false })
      risksData = rRes.data || []
    }
    setRisks(risksData)
    setProjects(projList)
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه المخاطرة؟')) return
    await supabase.from('project_risks').delete().eq('id', id)
    setRisks(r => r.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const filtered = risks.filter(r => {
    if (filterProject && String(r.project_id) !== filterProject) return false
    if (filterStatus  && r.status !== filterStatus)  return false
    if (filterLevel) {
      const lvl = RISK_LEVEL((r.risk_score || 1)).label
      if (lvl !== filterLevel) return false
    }
    if (search && !r.title.includes(search) && !(r.project?.name || '').includes(search)) return false
    return true
  })

  const stats = {
    total:    risks.length,
    critical: risks.filter(r => (r.risk_score || 0) >= 7 && r.status !== 'مغلق').length,
    high:     risks.filter(r => (r.risk_score || 0) >= 4 && (r.risk_score || 0) < 7 && r.status !== 'مغلق').length,
    open:     risks.filter(r => r.status === 'مفتوح').length,
    closed:   risks.filter(r => r.status === 'مغلق').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛡️ مخاطر المشروع
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '4px' }}>
            تحديد وتقييم ومتابعة مخاطر المشاريع
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditRisk(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل مخاطرة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'إجمالي المخاطر', value: stats.total,    color: '#1a56db', bg: '#eff6ff' },
          { label: 'حرجة',           value: stats.critical, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'عالية',          value: stats.high,     color: '#e6820a', bg: '#fffbeb' },
          { label: 'مفتوحة',         value: stats.open,     color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'مغلقة',          value: stats.closed,   color: '#0ea77b', bg: '#ecfdf5' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px', background: s.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل الحالات</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل المستويات</option>
          {['حرج', 'عالي', 'متوسط', 'منخفض'].map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد مخاطر مسجلة</p>
          {canEdit && <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول مخاطرة</button>}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الكود', 'المخاطرة', 'المشروع', 'التصنيف', 'المستوى', 'الاستجابة', 'المسؤول', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(risk => {
                  const score = risk.risk_score || 1
                  const level = RISK_LEVEL(score)
                  const st    = STATUS_CONFIG[risk.status]
                  return (
                    <tr key={risk.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{risk.risk_code || '—'}</td>
                      <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 700 }}>{risk.title}</div>
                        {risk.description && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '200px' }}>{risk.description}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{risk.project?.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem' }}>{risk.category}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: level.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: level.color, flexShrink: 0 }}>
                            {score}
                          </div>
                          <span style={{ background: level.bg, color: level.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{level.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{risk.response_type || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{risk.owner || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>{risk.status}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditRisk(risk); setShowModal(true) }} className="btn btn-ghost btn-xs">
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button onClick={() => handleDelete(risk.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </div>
                        )}
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
        <RiskModal
          risk={editRisk}
          projects={projects}
          tenantId={tenant!.id}
          onClose={() => { setShowModal(false); setEditRisk(null) }}
          onSave={() => { setShowModal(false); setEditRisk(null); loadAll() }}
        />
      )}
    </div>
  )
}
