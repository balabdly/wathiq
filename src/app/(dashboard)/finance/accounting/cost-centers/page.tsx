// src/app/(dashboard)/finance/accounting/cost-centers/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Target, Plus, Save, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CostCenter } from '@/lib/accounting-types'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }
const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
)

// ════════════════════════════════════════
// تاب مراكز التكلفة
// ════════════════════════════════════════
function CostCentersTab({ tenantId }: { tenantId: string }) {
  const [centers,  setCenters]  = useState<CostCenter[]>([])
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<number | null>(null)
  const [form, setForm] = useState({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('finance_cost_centers').select('*, project:projects(name)').eq('tenant_id', tenantId).order('code'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenantId).order('name'),
    ])
    setCenters(cRes.data || []); setProjects(pRes.data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { toast.error('الرمز والاسم مطلوبان'); return }
    const payload = {
      tenant_id: tenantId, code: form.code.trim(), name: form.name.trim(),
      type: form.type, project_id: form.project_id ? Number(form.project_id) : null,
      is_active: form.is_active, notes: form.notes || null,
    }
    if (editId) {
      await supabase.from('finance_cost_centers').update(payload).eq('id', editId)
      toast.success('تم التعديل ✅')
    } else {
      await supabase.from('finance_cost_centers').insert(payload)
      toast.success('✅ تمت الإضافة')
    }
    setShowForm(false); setEditId(null)
    setForm({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
    loadData()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target style={{ width: '18px', height: '18px', color: '#e6820a' }} /> مراكز التكلفة
        </h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' }) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> مركز تكلفة
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '16px', border: '2px solid #fde68a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>الرمز *</label>
              <input value={form.code} onChange={e => setF('code', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={labelStyle}>الاسم *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={labelStyle}>النوع</label>
              <select value={form.type} onChange={e => setF('type', e.target.value)} className="select">
                {['مشروع', 'قسم', 'منطقة', 'عام'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>ربط بمشروع</label>
              <select value={form.project_id} onChange={e => setF('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>ملاحظات</label>
              <input value={form.notes} onChange={e => setF('notes', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} className="btn btn-primary" style={{ background: '#e6820a' }}>
              <Save style={{ width: '15px', height: '15px' }} /> {editId ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : centers.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مراكز تكلفة</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الرمز', 'الاسم', 'النوع', 'المشروع', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#e6820a' }}>{c.code}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '12px 14px' }}><span className="badge badge-amber">{c.type}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.project?.name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}><span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span></td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => { setForm({ code: c.code, name: c.name, type: c.type, project_id: c.project_id ? String(c.project_id) : '', is_active: c.is_active, notes: c.notes || '' }); setEditId(c.id); setShowForm(true) }} className="btn btn-ghost btn-xs">
                      <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function CostCentersPage() {
  const { tenant } = useStore()
  if (!tenant) return <Spinner />
  return <CostCentersTab tenantId={tenant.id} />
}
