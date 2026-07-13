'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextWorkOrderNo, fmt, unwrapJoin } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'

type Unit = { id: number; fleet_no: string; name: string }
type WorkOrder = {
  id: number; unit_id: number; wo_no: string; wo_type: string; source: string; status: string
  priority: string; description: string; opened_at: string
  labor_hours: number; parts_cost: number; external_cost: number; total_cost: number
  vendor_name?: string
  unit?: Unit
}

function WOModal({ units, tenantId, onClose, onSave }: {
  units: Unit[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', wo_type: 'CM', source: 'داخلي', priority: 'عادي',
    description: '', vendor_name: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.unit_id || !form.description.trim()) { toast.error('المعدة والوصف مطلوبان'); return }
    setSaving(true)
    try {
      const woNo = await nextWorkOrderNo(tenantId)
      const { error } = await supabase.from('fleet_work_orders').insert({
        tenant_id: tenantId, wo_no: woNo,
        unit_id: Number(form.unit_id), wo_type: form.wo_type, source: form.source,
        priority: form.priority, description: form.description.trim(),
        vendor_name: form.vendor_name || null, status: 'مفتوح',
      })
      if (error) throw error
      if (form.wo_type === 'CM') {
        await supabase.from('fleet_units').update({ operational_status: 'صيانة' }).eq('id', Number(form.unit_id))
      }
      toast.success(`أمر عمل ${woNo}`)
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>أمر عمل جديد</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>)}
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div><label style={lbl}>النوع</label>
              <select value={form.wo_type} onChange={e => set('wo_type', e.target.value)} className="select">
                <option value="PM">وقائية PM</option><option value="CM">تصحيحية CM</option>
              </select></div>
            <div><label style={lbl}>المسار</label>
              <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                <option>داخلي</option><option>خارجي</option>
              </select></div>
            <div><label style={lbl}>الأولوية</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="select">
                <option>عادي</option><option>عاجل</option>
              </select></div>
          </div>
          <div><label style={lbl}>الوصف *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" rows={3} /></div>
          {form.source === 'خارجي' && (
            <div><label style={lbl}>المورد</label>
              <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="input" /></div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0d9488' }}><Save style={{ width: '15px' }} /> إنشاء</button>
        </div>
      </div>
    </div>
  )
}

export default function FleetMaintenancePage() {
  const { tenant } = useStore()
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [woRes, uRes] = await Promise.all([
      supabase.from('fleet_work_orders').select('*, unit:fleet_units(fleet_no,name)')
        .eq('tenant_id', tenant.id).order('opened_at', { ascending: false }).limit(100),
      supabase.from('fleet_units').select('id,fleet_no,name').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setOrders((woRes.data || []).map(row => ({
      ...row,
      unit: unwrapJoin((row as { unit?: Unit | Unit[] }).unit),
    })) as WorkOrder[])
    setUnits(uRes.data || [])
    setLoading(false)
  }

  async function updateStatus(wo: WorkOrder, status: string) {
    const payload: Record<string, unknown> = { status }
    if (status === 'مكتمل') {
      payload.completed_at = new Date().toISOString()
      const total = Number(wo.labor_hours) * 50 + Number(wo.parts_cost) + Number(wo.external_cost)
      payload.total_cost = total
      await supabase.from('fleet_units').update({ operational_status: 'متاح' }).eq('id', wo.unit_id)
    }
    await supabase.from('fleet_work_orders').update(payload).eq('id', wo.id)
    toast.success('تم التحديث')
    load()
  }

  async function updateCosts(wo: WorkOrder, field: string, value: number) {
    const updated = { ...wo, [field]: value }
    const total = Number(updated.labor_hours) * 50 + Number(updated.parts_cost) + Number(updated.external_cost)
    await supabase.from('fleet_work_orders').update({
      [field]: value, total_cost: total,
    }).eq('id', wo.id)
    load()
  }

  const filtered = orders.filter(o => !filter || o.status === filter)
  const openCount = orders.filter(o => ['مفتوح', 'قيد التنفيذ'].includes(o.status)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="صيانة الأسطول" description="أوامر عمل وقائية وتصحيحية — ورشة داخلية وموردون" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{openCount} أمر مفتوح — ورشة مركزية + موردون</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="select" style={{ width: '140px' }}>
            <option value="">الكل</option>
            <option>مفتوح</option><option>قيد التنفيذ</option><option>مكتمل</option>
          </select>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Plus style={{ width: '16px' }} /> أمر عمل
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(wo => (
            <div key={wo.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench style={{ width: '16px', color: '#e6820a' }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{wo.wo_no}</span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: wo.wo_type === 'CM' ? '#fef2f2' : '#fffbeb', color: wo.wo_type === 'CM' ? '#c81e1e' : '#e6820a', fontWeight: 700 }}>{wo.wo_type}</span>
                    <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{wo.source}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginTop: '4px' }}>{wo.unit?.name} — {wo.description}</div>
                  {wo.vendor_name && <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>مورد: {wo.vendor_name}</div>}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: wo.status === 'مكتمل' ? '#0ea77b' : '#1a56db' }}>{wo.status}</span>
              </div>
              {wo.status !== 'مكتمل' && wo.status !== 'ملغي' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>ساعات عمالة</label>
                    <input type="number" defaultValue={wo.labor_hours} onBlur={e => updateCosts(wo, 'labor_hours', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>قطع غيار</label>
                    <input type="number" defaultValue={wo.parts_cost} onBlur={e => updateCosts(wo, 'parts_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>تكلفة خارجي</label>
                    <input type="number" defaultValue={wo.external_cost} onBlur={e => updateCosts(wo, 'external_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>الإجمالي: {fmt(Number(wo.total_cost))} ر.س</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {wo.status === 'مفتوح' && <button onClick={() => updateStatus(wo, 'قيد التنفيذ')} className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>بدء التنفيذ</button>}
                  {wo.status === 'قيد التنفيذ' && <button onClick={() => updateStatus(wo, 'مكتمل')} className="btn btn-primary" style={{ fontSize: '0.75rem', background: '#0ea77b' }}>إغلاق</button>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>لا توجد أوامر عمل</p>}
        </div>
      )}

      {showModal && tenant && (
        <WOModal units={units} tenantId={tenant.id} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
