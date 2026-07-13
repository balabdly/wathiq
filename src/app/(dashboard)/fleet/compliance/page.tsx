'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, FileWarning } from 'lucide-react'
import toast from 'react-hot-toast'
import { COMPLIANCE_TYPES, complianceStatusFromExpiry, unwrapJoin } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'

type Unit = { id: number; fleet_no: string; name: string }
type Doc = {
  id: number; unit_id: number; doc_type: string; doc_number?: string
  issuer?: string; issue_date?: string; expiry_date?: string; status: string
  unit?: Unit
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'ساري': { bg: '#ecfdf5', color: '#0ea77b' },
  'قريب الانتهاء': { bg: '#fffbeb', color: '#e6820a' },
  'منتهي': { bg: '#fef2f2', color: '#c81e1e' },
}

function DocModal({ units, tenantId, onClose, onSave }: {
  units: Unit[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', doc_type: 'استمارة', doc_number: '', issuer: '',
    issue_date: '', expiry_date: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.unit_id || !form.doc_type) { toast.error('المعدة ونوع الوثيقة مطلوبان'); return }
    setSaving(true)
    const status = complianceStatusFromExpiry(form.expiry_date || null)
    try {
      const { error } = await supabase.from('fleet_compliance_docs').insert({
        tenant_id: tenantId, unit_id: Number(form.unit_id),
        doc_type: form.doc_type, doc_number: form.doc_number || null,
        issuer: form.issuer || null,
        issue_date: form.issue_date || null, expiry_date: form.expiry_date || null,
        status, notes: form.notes || null,
      })
      if (error) throw error
      toast.success('✅ سُجّلت الوثيقة')
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>وثيقة امتثال</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>)}
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>نوع الوثيقة *</label>
              <select value={form.doc_type} onChange={e => set('doc_type', e.target.value)} className="select">
                {COMPLIANCE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label style={lbl}>رقم الوثيقة</label>
              <input value={form.doc_number} onChange={e => set('doc_number', e.target.value)} className="input" /></div>
          </div>
          <div><label style={lbl}>الجهة المصدرة</label>
            <input value={form.issuer} onChange={e => set('issuer', e.target.value)} className="input" placeholder="تأمين / المرور / طرف ثالث" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>تاريخ الإصدار</label><input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ الانتهاء</label><input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}><Save style={{ width: '15px' }} /> حفظ</button>
        </div>
      </div>
    </div>
  )
}

export default function FleetCompliancePage() {
  const { tenant } = useStore()
  const [docs, setDocs] = useState<Doc[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [dRes, uRes] = await Promise.all([
      supabase.from('fleet_compliance_docs').select('*, unit:fleet_units(fleet_no,name)')
        .eq('tenant_id', tenant.id).order('expiry_date', { ascending: true }),
      supabase.from('fleet_units').select('id,fleet_no,name').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    const list = (dRes.data || []).map(d => ({
      ...d,
      unit: unwrapJoin((d as { unit?: Unit | Unit[] }).unit),
      status: complianceStatusFromExpiry(d.expiry_date),
    }))
    setDocs(list)
    setUnits(uRes.data || [])
    setLoading(false)
  }

  const filtered = docs.filter(d => !filter || d.status === filter)
  const expired = docs.filter(d => d.status === 'منتهي').length
  const soon = docs.filter(d => d.status === 'قريب الانتهاء').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="امتثال الأسطول" description="رخص، تأمين، فحص دوري، وتواريخ انتهاء الوثائق" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '14px', background: '#fef2f2' }}>
          <FileWarning style={{ width: '18px', color: '#c81e1e' }} />
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c81e1e' }}>{expired}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>منتهية</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#fffbeb' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e6820a' }}>{soon}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>قريبة الانتهاء (30 يوم)</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#ecfdf5' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0ea77b' }}>{docs.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>إجمالي الوثائق</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="select" style={{ width: '180px' }}>
          <option value="">كل الحالات</option>
          <option>منتهي</option><option>قريب الانتهاء</option><option>ساري</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px' }} /> وثيقة جديدة
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['المعدة', 'النوع', 'الرقم', 'الجهة', 'الانتهاء', 'الحالة'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const st = STATUS_COLORS[d.status] || STATUS_COLORS['ساري']
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.unit?.name}</td>
                    <td style={{ padding: '10px 12px' }}>{d.doc_type}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.doc_number || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{d.issuer || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{d.expiry_date || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontWeight: 700 }}>{d.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <DocModal units={units} tenantId={tenant.id} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
