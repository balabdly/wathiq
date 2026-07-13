'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Fuel } from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt } from '@/lib/fleet-types'

type Unit = { id: number; fleet_no: string; name: string; category: string }
type FuelLog = {
  id: number; fill_date: string; liters: number; cost: number
  hour_meter?: number; km_reading?: number
  unit?: Unit; project?: { name: string }
}

function FuelModal({ units, projects, tenantId, onClose, onSave }: {
  units: Unit[]; projects: { id: number; name: string }[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const today = new Date().toISOString().split('T')[0]
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', fill_date: today, liters: '', cost: '', project_id: '',
    hour_meter: '', km_reading: '', payment_method: 'بطاقة وقود', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.unit_id || !form.liters) { toast.error('المعدة واللترات مطلوبان'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('fleet_fuel_logs').insert({
        tenant_id: tenantId, unit_id: Number(form.unit_id),
        fill_date: form.fill_date, liters: Number(form.liters),
        cost: Number(form.cost) || 0,
        project_id: form.project_id ? Number(form.project_id) : null,
        hour_meter: form.hour_meter ? Number(form.hour_meter) : null,
        km_reading: form.km_reading ? Number(form.km_reading) : null,
        payment_method: form.payment_method, notes: form.notes || null,
      })
      if (error) throw error
      toast.success('✅ سُجّلت التعبئة')
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Fuel style={{ width: '18px', color: '#1a56db' }} /> تعبئة وقود
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>)}
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>التاريخ</label><input type="date" value={form.fill_date} onChange={e => set('fill_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>اللترات *</label><input type="number" value={form.liters} onChange={e => set('liters', e.target.value)} className="input" dir="ltr" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>التكلفة (ر.س)</label><input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>ساعات العداد</label><input type="number" value={form.hour_meter} onChange={e => set('hour_meter', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={lbl}>كيلومتر</label><input type="number" value={form.km_reading} onChange={e => set('km_reading', e.target.value)} className="input" dir="ltr" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}><Save style={{ width: '15px' }} /> حفظ</button>
        </div>
      </div>
    </div>
  )
}

export default function FleetFuelPage() {
  const { tenant } = useStore()
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [fRes, uRes, pRes] = await Promise.all([
      supabase.from('fleet_fuel_logs').select('*, unit:fleet_units(fleet_no,name,category), project:projects(name)')
        .eq('tenant_id', tenant.id).order('fill_date', { ascending: false }).limit(100),
      supabase.from('fleet_units').select('id,fleet_no,name,category').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id),
    ])
    setLogs(fRes.data || [])
    setUnits(uRes.data || [])
    setProjects(pRes.data || [])
    setLoading(false)
  }

  const totalLiters = logs.reduce((s, l) => s + Number(l.liters), 0)
  const totalCost = logs.reduce((s, l) => s + Number(l.cost), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '14px', background: '#eff6ff' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>إجمالي اللترات (آخر 100 سجل)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a56db' }}>{fmt(totalLiters)} لتر</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#f0fdfa' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>إجمالي التكلفة</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d9488' }}>{fmt(totalCost)} ر.س</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#1a56db' }}>
          <Plus style={{ width: '16px' }} /> تعبئة جديدة
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['التاريخ', 'المعدة', 'لترات', 'تكلفة', 'مشروع'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 12px' }}>{l.fill_date}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{l.unit?.name}</td>
                  <td style={{ padding: '10px 12px', color: '#1a56db', fontWeight: 700 }}>{fmt(l.liters)}</td>
                  <td style={{ padding: '10px 12px' }}>{fmt(l.cost)} ر.س</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{l.project?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <FuelModal units={units} projects={projects} tenantId={tenant.id}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
