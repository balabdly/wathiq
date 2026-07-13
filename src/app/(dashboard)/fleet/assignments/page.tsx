'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { STATUS_STYLE, unwrapJoin } from '@/lib/fleet-types'

type Unit = { id: number; fleet_no: string; name: string; category: string; operational_status: string; hour_meter: number; km_reading: number }
type Project = { id: number; name: string }
type Employee = { id: number; name: string; job_title?: string }
type Assignment = {
  id: number; unit_id: number; project_id?: number; operator_id?: number
  start_date: string; end_date?: string; status: string
  start_hour_meter?: number; start_km?: number
  unit?: Unit; project?: Project; operator?: Employee
}

function AssignModal({ units, projects, employees, tenantId, onClose, onSave }: {
  units: Unit[]; projects: Project[]; employees: Employee[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const today = new Date().toISOString().split('T')[0]
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ unit_id: '', project_id: '', operator_id: '', start_date: today, notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedUnit = units.find(u => u.id === Number(form.unit_id))

  async function handleSave() {
    if (!form.unit_id) { toast.error('اختر المعدة'); return }
    if (!form.operator_id) { toast.error('اختر المشغّل'); return }
    setSaving(true)
    try {
      const unit = selectedUnit!
      if (unit.operational_status === 'معطل' || unit.operational_status === 'صيانة') {
        toast.error('المعدة غير متاحة للتخصيص'); setSaving(false); return
      }

      await supabase.from('fleet_units').update({ operational_status: 'مخصص' }).eq('id', unit.id)

      const { error } = await supabase.from('fleet_assignments').insert({
        tenant_id: tenantId,
        unit_id: Number(form.unit_id),
        project_id: form.project_id ? Number(form.project_id) : null,
        operator_id: Number(form.operator_id),
        start_date: form.start_date,
        start_hour_meter: unit.hour_meter,
        start_km: unit.km_reading,
        status: 'نشط',
        notes: form.notes || null,
      })
      if (error) throw error
      toast.success('✅ تم التخصيص')
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>تخصيص معدة لمشروع</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.filter(u => u.operational_status === 'متاح').map(u => (
                <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>المشروع</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— بدون مشروع —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>المشغّل / السائق *</label>
            <select value={form.operator_id} onChange={e => set('operator_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.job_title || ''}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>تاريخ البداية</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
          </div>
          {selectedUnit && (
            <div style={{ padding: '10px', background: '#f0fdfa', borderRadius: '8px', fontSize: '0.82rem' }}>
              قراءة العداد عند التخصيص: {selectedUnit.hour_meter} ساعة / {selectedUnit.km_reading} كم
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Save style={{ width: '15px', height: '15px' }} /> تخصيص
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetAssignmentsPage() {
  const { tenant } = useStore()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [aRes, uRes, pRes, eRes] = await Promise.all([
      supabase.from('fleet_assignments').select('*, unit:fleet_units(id,fleet_no,name,category,operational_status,hour_meter,km_reading), project:projects(id,name), operator:hr_employees(id,name,job_title)')
        .eq('tenant_id', tenant.id).order('start_date', { ascending: false }).limit(100),
      supabase.from('fleet_units').select('id,fleet_no,name,category,operational_status,hour_meter,km_reading')
        .eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id,name,job_title').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    setAssignments((aRes.data || []).map(row => ({
      ...row,
      unit: unwrapJoin((row as { unit?: Unit | Unit[] }).unit),
      project: unwrapJoin((row as { project?: Project | Project[] }).project),
      operator: unwrapJoin((row as { operator?: Employee | Employee[] }).operator),
    })) as Assignment[])
    setUnits(uRes.data || [])
    setProjects(pRes.data || [])
    setEmployees(eRes.data || [])
    setLoading(false)
  }

  async function completeAssignment(a: Assignment) {
    if (!tenant || !confirm('إنهاء التخصيص وإرجاع المعدة للمتاح؟')) return
    const unit = a.unit
    await supabase.from('fleet_assignments').update({
      status: 'مكتمل', end_date: new Date().toISOString().split('T')[0],
      end_hour_meter: unit?.hour_meter, end_km: unit?.km_reading,
    }).eq('id', a.id)
    if (unit) await supabase.from('fleet_units').update({ operational_status: 'متاح' }).eq('id', a.unit_id)
    toast.success('تم إنهاء التخصيص')
    load()
  }

  const active = assignments.filter(a => a.status === 'نشط')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{active.length} تخصيص نشط</span>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0d9488' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> تخصيص جديد
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['المعدة', 'المشروع', 'المشغّل', 'البداية', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const st = STATUS_STYLE[a.status === 'نشط' ? 'مخصص' : 'متاح'] || STATUS_STYLE['متاح']
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.unit?.fleet_no} — {a.unit?.name}</td>
                    <td style={{ padding: '10px 12px' }}>{a.project?.name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{a.operator?.name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{a.start_date}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontWeight: 700 }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {a.status === 'نشط' && (
                        <button onClick={() => completeAssignment(a)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>إنهاء</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <AssignModal units={units} projects={projects} employees={employees} tenantId={tenant.id}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
