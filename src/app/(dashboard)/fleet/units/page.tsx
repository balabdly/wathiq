'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Search, Download, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  FLEET_CATEGORIES, FLEET_SUB_CATEGORIES, FLEET_STATUSES,
  fmt, STATUS_STYLE, nextFleetNo, ensureDvirTemplates,
} from '@/lib/fleet-types'
import { downloadFleetImportTemplate } from '@/lib/fleet-import'
import { FleetImportModal } from './FleetImportModal'
import { FleetPageHeader } from '../FleetPageHeader'

type Unit = {
  id: number; fleet_no: string; name: string; category: string; sub_category?: string
  plate_no?: string; chassis_no?: string; make?: string; model?: string; model_year?: number
  primary_meter: string; hour_meter: number; km_reading: number
  operational_status: string; asset_id?: number; notes?: string
  asset?: { asset_no: string; name: string }
}

type FinanceAsset = { id: number; asset_no: string; name: string; category: string }

function UnitModal({ unit, assets, tenantId, onClose, onSave }: {
  unit: Unit | null; assets: FinanceAsset[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: unit?.name || '',
    category: unit?.category || 'معدات ثقيلة',
    sub_category: unit?.sub_category || 'حفر',
    asset_id: unit?.asset_id ? String(unit.asset_id) : '',
    plate_no: unit?.plate_no || '',
    chassis_no: unit?.chassis_no || '',
    make: unit?.make || '',
    model: unit?.model || '',
    model_year: unit?.model_year ? String(unit.model_year) : '',
    primary_meter: unit?.primary_meter || 'ساعات',
    hour_meter: unit?.hour_meter != null ? String(unit.hour_meter) : '0',
    km_reading: unit?.km_reading != null ? String(unit.km_reading) : '0',
    operational_status: unit?.operational_status || 'متاح',
    notes: unit?.notes || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم المعدة مطلوب'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        name: form.name.trim(),
        category: form.category,
        sub_category: form.sub_category,
        plate_no: form.plate_no || null,
        chassis_no: form.chassis_no || null,
        make: form.make || null,
        model: form.model || null,
        model_year: form.model_year ? Number(form.model_year) : null,
        primary_meter: form.category === 'سيارة' ? 'كم' : form.category === 'شاحنة' ? 'كم' : form.primary_meter,
        hour_meter: Number(form.hour_meter) || 0,
        km_reading: Number(form.km_reading) || 0,
        operational_status: form.operational_status,
        notes: form.notes || null,
        is_active: true,
      }
      if (form.asset_id) payload.asset_id = Number(form.asset_id)

      if (unit?.id) {
        const { error } = await supabase.from('fleet_units').update(payload).eq('id', unit.id)
        if (error) throw error
        toast.success('تم التعديل ✅')
      } else {
        payload.fleet_no = await nextFleetNo(tenantId)
        const { error } = await supabase.from('fleet_units').insert(payload)
        if (error) throw error
        toast.success(`تم التسجيل (${payload.fleet_no}) ✅`)
      }
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>{unit ? 'تعديل معدة' : 'تسجيل معدة في الأسطول'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>الاسم *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: حفار كاتربيلر 320" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>الفئة *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                {FLEET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>التصنيف التشغيلي</label>
              <select value={form.sub_category} onChange={e => set('sub_category', e.target.value)} className="select">
                {FLEET_SUB_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>اللوحة</label><input value={form.plate_no} onChange={e => set('plate_no', e.target.value)} className="input" /></div>
            <div><label style={lbl}>الشاسيه</label><input value={form.chassis_no} onChange={e => set('chassis_no', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={lbl}>الحالة</label>
              <select value={form.operational_status} onChange={e => set('operational_status', e.target.value)} className="select">
                {FLEET_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>الشركة المصنعة</label><input value={form.make} onChange={e => set('make', e.target.value)} className="input" /></div>
            <div><label style={lbl}>الموديل</label><input value={form.model} onChange={e => set('model', e.target.value)} className="input" /></div>
            <div><label style={lbl}>سنة الصنع</label><input type="number" value={form.model_year} onChange={e => set('model_year', e.target.value)} className="input" dir="ltr" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>عداد الساعات</label><input type="number" value={form.hour_meter} onChange={e => set('hour_meter', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={lbl}>عداد الكيلومتر</label><input type="number" value={form.km_reading} onChange={e => set('km_reading', e.target.value)} className="input" dir="ltr" /></div>
          </div>
          <div>
            <label style={lbl}>ربط بأصل محاسبي (اختياري)</label>
            <select value={form.asset_id} onChange={e => set('asset_id', e.target.value)} className="select">
              <option value="">— بدون ربط —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_no} — {a.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>ملاحظات</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Save style={{ width: '15px', height: '15px' }} /> {unit ? 'حفظ' : 'تسجيل'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetUnitsPage() {
  const { tenant } = useStore()
  const [units, setUnits] = useState<Unit[]>([])
  const [assets, setAssets] = useState<FinanceAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editUnit, setEditUnit] = useState<Unit | null>(null)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    await ensureDvirTemplates(tenant.id)
    const [uRes, aRes] = await Promise.all([
      supabase.from('fleet_units').select('*, asset:finance_assets(asset_no,name)')
        .eq('tenant_id', tenant.id).eq('is_active', true).order('fleet_no'),
      supabase.from('finance_assets').select('id,asset_no,name,category')
        .eq('tenant_id', tenant.id).neq('status', 'مُستبعَد').order('asset_no'),
    ])
    setUnits(uRes.data || [])
    setAssets(aRes.data || [])
    setLoading(false)
  }

  const filtered = units.filter(u => {
    const q = !search || u.name.includes(search) || u.fleet_no.includes(search) || (u.plate_no || '').includes(search)
    const c = !catFilter || u.category === catFilter
    return q && c
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="سجل الأسطول" description="تسجيل وإدارة المعدات والشاحنات والسيارات" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>{units.length} وحدة مسجّلة</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => downloadFleetImportTemplate()} className="btn btn-ghost" title="تحميل نموذج Excel">
            <Download style={{ width: '16px', height: '16px' }} /> نموذج Excel
          </button>
          <button type="button" onClick={() => setShowImport(true)} className="btn btn-ghost" title="استيراد من Excel">
            <Upload style={{ width: '16px', height: '16px' }} /> استيراد Excel
          </button>
          <button onClick={() => { setEditUnit(null); setShowModal(true) }} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة معدة
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select" style={{ width: '160px' }}>
          <option value="">كل الفئات</option>
          {FLEET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الرقم', 'الاسم', 'الفئة', 'اللوحة', 'ساعات', 'كم', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const st = STATUS_STYLE[u.operational_status] || STATUS_STYLE['متاح']
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{u.fleet_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{u.category}<br /><span style={{ color: '#9ca3af' }}>{u.sub_category}</span></td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.plate_no || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt(Number(u.hour_meter))}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt(Number(u.km_reading))}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontWeight: 700 }}>{u.operational_status}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => { setEditUnit(u); setShowModal(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <Pencil style={{ width: '15px', height: '15px', color: '#6b7280' }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && tenant && (
        <UnitModal unit={editUnit} assets={assets} tenantId={tenant.id}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}

      {showImport && tenant && (
        <FleetImportModal
          tenantId={tenant.id}
          assets={assets}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
