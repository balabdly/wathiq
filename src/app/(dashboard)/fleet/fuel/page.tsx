'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Fuel, Upload, Settings, Search, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'
import {
  loadFleetFuelSettings,
  saveFleetFuelSettings,
  isDreesFuelEnabled,
  readDreesFile,
  matchDreesRows,
  loadExistingFuelRefs,
  importDreesFuelBatch,
  type FleetFuelSettings,
  type FuelMode,
  type MatchedDreesRow,
} from '@/lib/fleet-fuel'

type Unit = { id: number; fleet_no: string; name: string; category: string; drees_card_no?: string | null; plate_no?: string | null }
type FuelLog = {
  id: number; fill_date: string; liters: number; cost: number; source?: string
  hour_meter?: number; km_reading?: number; station_name?: string; drees_card_no?: string
  unit?: Unit; project?: { name: string }
}
type ImportBatch = {
  id: number; file_name: string; period_label?: string; imported_at: string
  matched_count: number; unmatched_count: number; duplicate_count: number
  total_liters: number; total_cost: number; imported_by?: string
}

type FuelTab = 'logs' | 'import' | 'batches'

function FuelModal({ units, projects, tenantId, dreesEnabled, onClose, onSave }: {
  units: Unit[]; projects: { id: number; name: string }[]
  tenantId: string; dreesEnabled: boolean
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const today = new Date().toISOString().split('T')[0]
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', fill_date: today, liters: '', cost: '', project_id: '',
    hour_meter: '', km_reading: '', payment_method: dreesEnabled ? 'يدوي / استثناء' : 'بطاقة وقود', notes: '',
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
        payment_method: form.payment_method,
        source: 'manual',
        notes: form.notes || null,
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
            <Fuel style={{ width: '18px', color: '#1a56db' }} /> تعبئة يدوية
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dreesEnabled && (
            <p style={{ fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', padding: '8px 10px', borderRadius: '8px' }}>
              للتعبئة العادية عبر الدريس — استخدم «استيراد التقرير». الإدخال اليدوي للاستثناءات فقط.
            </p>
          )}
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
  const { tenant, currentUser } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fuelSettings, setFuelSettings] = useState<FleetFuelSettings>({ fuel_mode: 'manual' })
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [tab, setTab] = useState<FuelTab>('logs')
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [logSearch, setLogSearch] = useState('')
  const [logSourceFilter, setLogSourceFilter] = useState('')
  const [importPreview, setImportPreview] = useState<MatchedDreesRow[] | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const dreesEnabled = isDreesFuelEnabled(fuelSettings)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const settings = await loadFleetFuelSettings(tenant.id)
    setFuelSettings(settings)

    const [fRes, uRes, pRes, bRes] = await Promise.all([
      supabase.from('fleet_fuel_logs').select('*')
        .eq('tenant_id', tenant.id).order('fill_date', { ascending: false }).limit(200),
      supabase.from('fleet_units').select('id,fleet_no,name,category,drees_card_no,plate_no')
        .eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id),
      dreesEnabled || settings.fuel_mode === 'drees'
        ? supabase.from('fleet_fuel_import_batches').select('*')
            .eq('tenant_id', tenant.id).order('imported_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [] as ImportBatch[], error: null }),
    ])

    const unitMap = new Map((uRes.data || []).map(u => [u.id, u as Unit]))
    const rows = fRes.data || []
    const unitIds = Array.from(new Set(rows.map(r => r.unit_id)))
    const projectIds = Array.from(new Set(rows.map(r => r.project_id).filter(Boolean)))

    let projectMap = new Map<number, { name: string }>()
    if (projectIds.length > 0) {
      const { data: projs } = await supabase.from('projects').select('id,name').in('id', projectIds)
      projectMap = new Map((projs || []).map(p => [p.id, { name: p.name }]))
    }

    setLogs(rows.map(row => ({
      ...row,
      unit: unitMap.get(row.unit_id),
      project: row.project_id ? projectMap.get(row.project_id) : undefined,
    })) as FuelLog[])
    setUnits(uRes.data || [])
    setProjects(pRes.data || [])
    setBatches(bRes.data || [])
    setLoading(false)
  }

  async function handleSaveSettings(mode: FuelMode) {
    if (!tenant) return
    setSavingSettings(true)
    const ok = await saveFleetFuelSettings(tenant.id, { fuel_mode: mode })
    setSavingSettings(false)
    if (!ok) { toast.error('فشل حفظ الإعداد'); return }
    setFuelSettings({ fuel_mode: mode })
    toast.success(mode === 'drees' ? '✅ تفعيل تكامل الدريس' : '✅ الوضع اليدوي فقط')
    if (mode === 'manual') setTab('logs')
    load()
  }

  async function handleFileSelect(file: File) {
    if (!tenant) return
    try {
      const parsed = await readDreesFile(file)
      if (parsed.length === 0) { toast.error('الملف فارغ أو غير مفهوم'); return }
      const existing = await loadExistingFuelRefs(tenant.id)
      const matched = matchDreesRows(parsed, units, existing)
      setImportPreview(matched)
      setImportFileName(file.name)
      setTab('import')
      toast.success(`تم تحليل ${parsed.length} صف`)
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function confirmImport() {
    if (!tenant || !importPreview) return
    setImporting(true)
    const result = await importDreesFuelBatch({
      tenantId: tenant.id,
      fileName: importFileName,
      importedBy: currentUser?.name,
      rows: importPreview,
    })
    setImporting(false)
    if (!result.ok) { toast.error(result.error || 'فشل الاستيراد'); return }
    toast.success(`✅ استُورد ${result.imported} تعبئة`)
    setImportPreview(null)
    setImportFileName('')
    load()
    setTab('logs')
  }

  const filteredLogs = logs.filter(l => {
    if (logSourceFilter && (l.source || 'manual') !== logSourceFilter) return false
    if (!logSearch.trim()) return true
    const q = logSearch.trim().toLowerCase()
    const hay = `${l.unit?.fleet_no} ${l.unit?.name} ${l.station_name || ''} ${l.fill_date}`.toLowerCase()
    return hay.includes(q)
  })

  const monthStart = new Date().toISOString().slice(0, 8) + '01'
  const monthLogs = logs.filter(l => l.fill_date >= monthStart)
  const totalLiters = monthLogs.reduce((s, l) => s + Number(l.liters), 0)
  const totalCost = monthLogs.reduce((s, l) => s + Number(l.cost), 0)
  const unitsWithCard = units.filter(u => u.drees_card_no).length
  const unmatchedPreview = importPreview?.filter(r => r.status === 'unmatched') || []

  const tabBtn = (id: FuelTab, label: string) => (
    <button type="button" onClick={() => setTab(id)} style={{
      padding: '8px 14px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
      borderBottom: tab === id ? '2px solid #1a56db' : '2px solid transparent',
      color: tab === id ? '#1a56db' : '#6b7280', background: 'transparent',
    }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader
        title="وقود الأسطول"
        description={dreesEnabled ? 'تكامل الدريس + إدخال يدوي للاستثناءات' : 'تسجيل تعبئة الوقود يدوياً'}
      />

      <div className="card" style={{ padding: '12px 16px' }}>
        <button type="button" onClick={() => setShowSettings(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#374151', width: '100%', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings style={{ width: '16px', color: '#6b7280' }} /> إعدادات الوقود (للمستأجر)
          </span>
          <span style={{ fontSize: '0.78rem', color: fuelSettings.fuel_mode === 'drees' ? '#0d9488' : '#9ca3af' }}>
            {fuelSettings.fuel_mode === 'drees' ? 'الدريس مفعّل' : 'يدوي فقط'}
          </span>
        </button>
        {showSettings && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '10px' }}>
              كل شركة تختار أسلوبها — بعض المستأجرين يفضّلون الإدخال اليدوي فقط، والبعض يستورد تقارير الدريس.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={fuelSettings.fuel_mode}
                disabled={savingSettings}
                onChange={e => handleSaveSettings(e.target.value as FuelMode)}
                className="select"
                style={{ minWidth: '260px' }}
              >
                <option value="manual">يدوي فقط — بدون الدريس</option>
                <option value="drees">تكامل الدريس — استيراد تقرير + يدوي للاستثناءات</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: dreesEnabled ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: '12px' }}>
        <div className="card" style={{ padding: '14px', background: '#eff6ff' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>لترات الشهر</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1a56db' }}>{fmt(totalLiters)}</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#f0fdfa' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>تكلفة الشهر</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0d9488' }}>{fmt(totalCost)} ر.س</div>
        </div>
        {dreesEnabled && (
          <>
            <div className="card" style={{ padding: '14px', background: '#fffbeb' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>معدات بشريحة</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#e6820a' }}>{unitsWithCard}/{units.length}</div>
            </div>
            <div className="card" style={{ padding: '14px', background: '#f3f4f6' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>دفعات مستوردة</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#374151' }}>{batches.length}</div>
            </div>
          </>
        )}
      </div>

      {dreesEnabled && (
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)' }}>
          {tabBtn('logs', 'سجل التعبئة')}
          {tabBtn('import', 'استيراد الدريس')}
          {tabBtn('batches', 'دفعات الاستيراد')}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        {(tab === 'logs' || !dreesEnabled) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: '200px', flex: 1, maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: '#9ca3af' }} />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '100%' }} placeholder="بحث بالمعدة..." />
            </div>
            {dreesEnabled && (
              <select value={logSourceFilter} onChange={e => setLogSourceFilter(e.target.value)} className="select" style={{ width: '160px' }}>
                <option value="">كل المصادر</option>
                <option value="drees_import">الدريس</option>
                <option value="manual">يدوي</option>
              </select>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {dreesEnabled && tab === 'import' && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} className="btn btn-primary" style={{ background: '#e6820a' }}>
                <Upload style={{ width: '16px' }} /> رفع تقرير الدريس
              </button>
            </>
          )}
          {(tab === 'logs' || !dreesEnabled) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#1a56db' }}>
              <Plus style={{ width: '16px' }} /> {dreesEnabled ? 'تعبئة يدوية' : 'تعبئة جديدة'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : tab === 'import' && dreesEnabled ? (
        <div className="card" style={{ padding: '16px' }}>
          {!importPreview ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <FileSpreadsheet style={{ width: '40px', height: '40px', margin: '0 auto 12px', opacity: 0.4 }} />
              <p>ارفع ملف Excel/CSV من بوابة الدريس</p>
              <p style={{ fontSize: '0.78rem', marginTop: '8px' }}>يُطابق تلقائياً عبر رقم الشريحة المسجّل على المعدة</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{importFileName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    مطابق: {importPreview.filter(r => r.status === 'matched').length} |
                    غير مطابق: {unmatchedPreview.length} |
                    مكرر: {importPreview.filter(r => r.status === 'duplicate').length}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setImportPreview(null); setImportFileName('') }} className="btn btn-ghost">إلغاء</button>
                  <button onClick={confirmImport} disabled={importing || importPreview.filter(r => r.status === 'matched').length === 0}
                    className="btn btn-primary" style={{ background: '#0ea77b' }}>
                    استيراد {importPreview.filter(r => r.status === 'matched').length} سجل
                  </button>
                </div>
              </div>
              {unmatchedPreview.length > 0 && (
                <p style={{ fontSize: '0.78rem', color: '#c81e1e', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                  {unmatchedPreview.length} صف بدون معدة — سجّل رقم الشريحة في «سجل الأسطول» ثم أعد الاستيراد
                </p>
              )}
              <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['التاريخ', 'الشريحة', 'المعدة', 'لترات', 'مبلغ', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.72rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 100).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: r.status === 'unmatched' ? '#fef2f2' : r.status === 'duplicate' ? '#f3f4f6' : 'white' }}>
                        <td style={{ padding: '8px 10px' }}>{r.fillDate}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.dreesCardNo}</td>
                        <td style={{ padding: '8px 10px' }}>{r.unitLabel || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{fmt(r.liters)}</td>
                        <td style={{ padding: '8px 10px' }}>{fmt(r.cost)}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.72rem', fontWeight: 600, color: r.status === 'matched' ? '#0ea77b' : r.status === 'duplicate' ? '#9ca3af' : '#c81e1e' }}>
                          {r.status === 'matched' ? 'مطابق' : r.status === 'duplicate' ? 'مكرر' : 'غير مطابق'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : tab === 'batches' && dreesEnabled ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['التاريخ', 'الملف', 'مطابق', 'غير مطابق', 'لترات', 'مبلغ', 'بواسطة'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد دفعات مستوردة</td></tr>
              )}
              {batches.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 12px' }}>{b.imported_at?.split('T')[0]}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{b.file_name}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea77b', fontWeight: 600 }}>{b.matched_count}</td>
                  <td style={{ padding: '10px 12px', color: b.unmatched_count ? '#c81e1e' : '#9ca3af' }}>{b.unmatched_count}</td>
                  <td style={{ padding: '10px 12px' }}>{fmt(Number(b.total_liters))}</td>
                  <td style={{ padding: '10px 12px' }}>{fmt(Number(b.total_cost))} ر.س</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{b.imported_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['التاريخ', 'المعدة', 'لترات', 'تكلفة', 'المصدر', 'محطة', 'مشروع'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد سجلات</td></tr>
              )}
              {filteredLogs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 12px' }}>{l.fill_date}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{l.unit?.fleet_no} {l.unit?.name}</td>
                  <td style={{ padding: '10px 12px', color: '#1a56db', fontWeight: 700 }}>{fmt(l.liters)}</td>
                  <td style={{ padding: '10px 12px' }}>{fmt(l.cost)} ر.س</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: '0.68rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                      background: l.source === 'drees_import' ? '#eff6ff' : '#f3f4f6',
                      color: l.source === 'drees_import' ? '#1a56db' : '#6b7280',
                    }}>
                      {l.source === 'drees_import' ? 'الدريس' : 'يدوي'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{l.station_name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{l.project?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <FuelModal units={units} projects={projects} tenantId={tenant.id} dreesEnabled={dreesEnabled}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
