'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Leaf, Search, Plus } from 'lucide-react'
import EnvIncidentModal    from './EnvIncidentModal'
import EnvWasteModal       from './EnvWasteModal'
import EnvChemicalModal    from './EnvChemicalModal'
import EnvEmissionsModal   from './EnvEmissionsModal'
import EnvWaterModal       from './EnvWaterModal'
import EnvCertModal2       from './EnvCertModal2'
import EnvTrainingModal    from './EnvTrainingModal'
import EnvInspectionModal  from './EnvInspectionModal'

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
const daysLeft = (d: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

function Badge({ children, type = 'gray' }: { children: React.ReactNode; type?: 'red'|'green'|'warn'|'info'|'purple'|'gray' }) {
  const styles = {
    red:    { bg: '#fef2f2', color: '#b91c1c' },
    green:  { bg: '#d1fae5', color: '#065f46' },
    warn:   { bg: '#fef3c7', color: '#92400e' },
    info:   { bg: '#eff6ff', color: '#1d4ed8' },
    purple: { bg: '#f5f3ff', color: '#6d28d9' },
    gray:   { bg: '#f3f4f6', color: '#374151' },
  }
  const s = styles[type]
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>
}

function KpiCard({ icon, value, label, bg, color, border }: any) {
  return (
    <div className="card" style={{ padding: 14, background: bg, border: `1px solid ${border}`, textAlign: 'center' }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function EnvironmentPage() {
  const { tenant } = useStore()
  const tid = tenant?.id
  const [tab,    setTab]    = useState('incidents')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [incidents,   setIncidents]   = useState<any[]>([])
  const [wastes,      setWastes]      = useState<any[]>([])
  const [chemicals,   setChemicals]   = useState<any[]>([])
  const [emissions,   setEmissions]   = useState<any[]>([])
  const [waters,      setWaters]      = useState<any[]>([])
  const [certs,       setCerts]       = useState<any[]>([])
  const [trainings,   setTrainings]   = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [employees,   setEmployees]   = useState<any[]>([])

  // مودالات
  const [modal,    setModal]    = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any>(null)

  const openEdit = (m: string, item: any) => { setEditItem(item); setModal(m) }
  const openAdd  = (m: string) => { setEditItem(null); setModal(m) }
  const closeModal = () => { setModal(null); setEditItem(null) }

  const loadAll = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [inc, was, che, emi, wat, cer, tra, ins, emp] = await Promise.all([
      supabase.from('env_incidents').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
      supabase.from('env_waste').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
      supabase.from('env_chemicals').select('*').eq('tenant_id', tid).order('name'),
      supabase.from('env_emissions').select('*').eq('tenant_id', tid).order('year', { ascending: false }),
      supabase.from('env_water').select('*').eq('tenant_id', tid).order('year', { ascending: false }),
      supabase.from('env_certificates').select('*').eq('tenant_id', tid).order('expiry_date'),
      supabase.from('env_training').select('*').eq('tenant_id', tid).order('training_date', { ascending: false }),
      supabase.from('env_inspections').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
      supabase.from('hr_employees').select('id,name,job_title').eq('tenant_id', tid).eq('is_active', true).order('name'),
    ])
    setIncidents(inc.data || [])
    setWastes(was.data || [])
    setChemicals(che.data || [])
    setEmissions(emi.data || [])
    setWaters(wat.data || [])
    setCerts(cer.data || [])
    setTrainings(tra.data || [])
    setInspections(ins.data || [])
    setEmployees(emp.data || [])
    setLoading(false)
  }, [tid])

  useEffect(() => { loadAll() }, [loadAll])

  const onSave = () => { closeModal(); loadAll() }

  // KPIs
  const openIncidents    = incidents.filter(i => i.status !== 'مغلق').length
  const expiredCerts     = certs.filter(c => daysLeft(c.expiry_date) !== null && (daysLeft(c.expiry_date) as number) < 0).length
  const soonCerts        = certs.filter(c => { const d = daysLeft(c.expiry_date); return d !== null && d >= 0 && d <= 60 }).length
  const hazardousWaste   = wastes.filter(w => w.classification === 'خطرة').reduce((s, w) => s + Number(w.quantity_ton), 0)
  const totalWaste       = wastes.reduce((s, w) => s + Number(w.quantity_ton), 0)
  const dangerChemicals  = chemicals.filter(c => c.status !== 'آمن').length
  const totalEmissions   = emissions.reduce((s, e) => s + Number(e.quantity), 0)
  const totalWater       = waters.reduce((s, w) => s + Number(w.consumption_m3), 0)
  const expiredTraining  = trainings.filter(t => t.expiry_date && (daysLeft(t.expiry_date) as number) < 0).length

  const TABS = [
    { id: 'incidents',   label: 'الحوادث البيئية',       icon: '⚠️',  count: openIncidents },
    { id: 'waste',       label: 'إدارة النفايات',         icon: '♻️',  count: wastes.length },
    { id: 'chemicals',   label: 'المواد الكيميائية',      icon: '⚗️',  count: dangerChemicals },
    { id: 'emissions',   label: 'الانبعاثات والطاقة',     icon: '☁️',  count: null },
    { id: 'water',       label: 'المياه',                 icon: '💧',  count: null },
    { id: 'certs',       label: 'الشهادات والتراخيص',     icon: '🏅',  count: expiredCerts + soonCerts },
    { id: 'training',    label: 'التدريب',                icon: '📚',  count: expiredTraining },
    { id: 'inspections', label: 'الزيارات التفتيشية',     icon: '🔍',  count: null },
  ]

  const KPIS = [
    { icon: '⚠️', value: openIncidents,                label: 'حادثة مفتوحة',       bg: openIncidents > 0 ? '#fef2f2' : '#f8f9fa', color: openIncidents > 0 ? '#b91c1c' : '#374151', border: openIncidents > 0 ? '#fecaca' : '#e9ecef' },
    { icon: '♻️', value: `${totalWaste.toFixed(1)} ط`, label: 'نفايات هذا الشهر',   bg: '#f0fdf4', color: '#065f46', border: '#bbf7d0' },
    { icon: '⚗️', value: dangerChemicals,              label: 'مادة تحتاج مراجعة',  bg: dangerChemicals > 0 ? '#fef2f2' : '#f0fdf4', color: dangerChemicals > 0 ? '#b91c1c' : '#065f46', border: dangerChemicals > 0 ? '#fecaca' : '#bbf7d0' },
    { icon: '☁️', value: `${totalEmissions.toFixed(1)}`, label: 'طن CO₂ — إجمالي',  bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
    { icon: '💧', value: `${totalWater.toFixed(0)} م³`, label: 'استهلاك المياه',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    { icon: '🏅', value: expiredCerts + soonCerts,     label: 'شهادة منتهية/تقترب', bg: (expiredCerts + soonCerts) > 0 ? '#fffbeb' : '#f0fdf4', color: (expiredCerts + soonCerts) > 0 ? '#92400e' : '#065f46', border: (expiredCerts + soonCerts) > 0 ? '#fde68a' : '#bbf7d0' },
    { icon: '📚', value: expiredTraining,              label: 'تدريب منتهي الصلاحية', bg: expiredTraining > 0 ? '#fef2f2' : '#f0fdf4', color: expiredTraining > 0 ? '#b91c1c' : '#065f46', border: expiredTraining > 0 ? '#fecaca' : '#bbf7d0' },
    { icon: '🔍', value: inspections.length,           label: 'زيارة تفتيشية',        bg: '#f0fdf4', color: '#065f46', border: '#bbf7d0' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Leaf size={20} style={{ color: '#0ea77b' }} />
            الإدارة البيئية (EMS)
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
            متوافق مع ISO 14001 · GHG Protocol · GRI Standards
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'incidents'   && <button onClick={() => openAdd('incidents')}   className="btn btn-primary" style={{ background: '#dc2626' }}><Plus size={15} /> تسجيل حادثة</button>}
          {tab === 'waste'       && <button onClick={() => openAdd('waste')}       className="btn btn-primary" style={{ background: '#059669' }}><Plus size={15} /> تسجيل نفايات</button>}
          {tab === 'chemicals'   && <button onClick={() => openAdd('chemicals')}   className="btn btn-primary" style={{ background: '#7c3aed' }}><Plus size={15} /> إضافة مادة</button>}
          {tab === 'emissions'   && <button onClick={() => openAdd('emissions')}   className="btn btn-primary" style={{ background: '#6d28d9' }}><Plus size={15} /> تسجيل انبعاث</button>}
          {tab === 'water'       && <button onClick={() => openAdd('water')}       className="btn btn-primary" style={{ background: '#0891b2' }}><Plus size={15} /> تسجيل استهلاك</button>}
          {tab === 'certs'       && <button onClick={() => openAdd('certs')}       className="btn btn-primary" style={{ background: '#f59e0b' }}><Plus size={15} /> إضافة شهادة</button>}
          {tab === 'training'    && <button onClick={() => openAdd('training')}    className="btn btn-primary" style={{ background: '#0891b2' }}><Plus size={15} /> تسجيل تدريب</button>}
          {tab === 'inspections' && <button onClick={() => openAdd('inspections')} className="btn btn-primary" style={{ background: '#059669' }}><Plus size={15} /> زيارة تفتيشية</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
        {KPIS.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', padding: 4, borderRadius: 10, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#0ea77b' : 'var(--text3)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <span>{t.icon}</span>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 700 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 340 }}>
        <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: 30 }} placeholder="بحث..." />
      </div>

      {/* ══ تاب: الحوادث ══ */}
      {tab === 'incidents' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <p>لا توجد حوادث بيئية مسجلة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['النوع','التاريخ','الموقع','الخطورة','التأثير البيئي','الغرامة','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {incidents.filter(i => !search || i.type?.includes(search) || i.location?.includes(search)).map(inc => (
                    <tr key={inc.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{inc.type}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{fmtDate(inc.date)}</td>
                      <td style={{ padding: '9px 12px' }}>{inc.location}</td>
                      <td style={{ padding: '9px 12px' }}><Badge type={inc.severity === 'عالية' || inc.severity === 'حرجة' ? 'red' : inc.severity === 'متوسطة' ? 'warn' : 'green'}>{inc.severity}</Badge></td>
                      <td style={{ padding: '9px 12px', color: 'var(--text3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.environmental_impact || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: inc.penalty_amount > 0 ? '#b91c1c' : 'var(--text3)' }}>{inc.penalty_amount > 0 ? `${inc.penalty_amount.toLocaleString()} ﷼` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}><Badge type={inc.status === 'مغلق' ? 'green' : inc.status === 'قيد المعالجة' ? 'info' : 'red'}>{inc.status}</Badge></td>
                      <td style={{ padding: '8px' }}><button onClick={() => openEdit('incidents', inc)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: النفايات ══ */}
      {tab === 'waste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'إجمالي النفايات', value: `${totalWaste.toFixed(1)} طن`, color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'نفايات خطرة',     value: `${hazardousWaste.toFixed(1)} طن`, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
              { label: 'معدل إعادة التدوير', value: wastes.filter(w => w.disposal_method === 'إعادة تدوير').reduce((s, w) => s + Number(w.quantity_ton), 0).toFixed(1) + ' طن', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: 14, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {wastes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>♻️</div><p>لا توجد سجلات نفايات</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ','نوع النفاية','التصنيف','الكمية (طن)','طريقة التخلص','جهة الاستلام','الترخيص',''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {wastes.filter(w => !search || w.waste_type?.includes(search)).map(w => {
                      const licDays = daysLeft(w.license_expiry)
                      return (
                        <tr key={w.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{fmtDate(w.date)}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{w.waste_type}</td>
                          <td style={{ padding: '9px 12px' }}><Badge type={w.classification === 'خطرة' ? 'red' : w.classification === 'محدودة الخطورة' ? 'warn' : 'green'}>{w.classification}</Badge></td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>{Number(w.quantity_ton).toFixed(2)}</td>
                          <td style={{ padding: '9px 12px' }}>{w.disposal_method}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{w.receiver || '—'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            {licDays === null ? '—' : licDays < 0 ? <Badge type="red">❌ منتهي</Badge> : licDays <= 60 ? <Badge type="warn">⚠️ {licDays} يوم</Badge> : <Badge type="green">✓ ساري</Badge>}
                          </td>
                          <td style={{ padding: '8px' }}><button onClick={() => openEdit('waste', w)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ تاب: المواد الكيميائية ══ */}
      {tab === 'chemicals' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {chemicals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>⚗️</div><p>لا توجد مواد كيميائية مسجلة</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['المادة','الصيغة','تصنيف GHS','الكمية','موقع التخزين','انتهاء MSDS','حالة MSDS','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {chemicals.filter(c => !search || c.name?.includes(search)).map(c => {
                    const expDays = daysLeft(c.expiry_date)
                    return (
                      <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 12px', fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{c.chemical_formula || '—'}</td>
                        <td style={{ padding: '9px 12px' }}><Badge type="warn">{c.ghs_class || '—'}</Badge></td>
                        <td style={{ padding: '9px 12px', fontWeight: 700 }}>{c.quantity} {c.unit}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{c.storage_location || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {expDays === null ? '—' : expDays < 0 ? <Badge type="red">❌ منتهية</Badge> : expDays <= 60 ? <Badge type="warn">⚠️ {expDays} يوم</Badge> : <Badge type="green">✓</Badge>}
                        </td>
                        <td style={{ padding: '9px 12px' }}><Badge type={c.msds_status === 'محدّثة' ? 'green' : c.msds_status === 'تحتاج تحديث' ? 'warn' : 'red'}>{c.msds_status}</Badge></td>
                        <td style={{ padding: '9px 12px' }}><Badge type={c.status === 'آمن' ? 'green' : c.status === 'يتطلب مراجعة' ? 'warn' : 'red'}>{c.status}</Badge></td>
                        <td style={{ padding: '8px' }}><button onClick={() => openEdit('chemicals', c)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: الانبعاثات ══ */}
      {tab === 'emissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Scope 1 — مباشر',       value: `${emissions.filter(e => e.scope === 'S1').reduce((s, e) => s + Number(e.quantity), 0).toFixed(1)} طن CO₂`, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
              { label: 'Scope 2 — كهرباء',       value: `${emissions.filter(e => e.scope === 'S2').reduce((s, e) => s + Number(e.quantity), 0).toFixed(1)} طن CO₂`, color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
              { label: 'Scope 3 — غير مباشر',   value: `${emissions.filter(e => e.scope === 'S3').reduce((s, e) => s + Number(e.quantity), 0).toFixed(1)} طن CO₂`, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: 14, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {emissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>☁️</div><p>لا توجد سجلات انبعاثات</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['الشهر / السنة','مصدر الانبعاث','Scope','الوحدة','الكمية الفعلية','الهدف','الفجوة',''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {emissions.filter(e => !search || e.source?.includes(search)).map(e => {
                      const gap = e.target ? (Number(e.quantity) - Number(e.target)).toFixed(1) : null
                      return (
                        <tr key={e.id} onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{e.month} {e.year}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{e.source}</td>
                          <td style={{ padding: '9px 12px' }}><Badge type={e.scope === 'S1' ? 'red' : e.scope === 'S2' ? 'warn' : 'gray'}>{e.scope}</Badge></td>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{e.unit}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{Number(e.quantity).toFixed(1)}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{e.target ? Number(e.target).toFixed(1) : '—'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            {gap === null ? '—' : Number(gap) > 0 ? <Badge type="red">+{gap} ↑</Badge> : <Badge type="green">{gap} ↓</Badge>}
                          </td>
                          <td style={{ padding: '8px' }}><button onClick={() => openEdit('emissions', e)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ تاب: المياه ══ */}
      {tab === 'water' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'إجمالي الاستهلاك',   value: `${totalWater.toFixed(0)} م³`,  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
              { label: 'المُعاد تدويرها',    value: `${waters.reduce((s, w) => s + Number(w.recycled_m3), 0).toFixed(0)} م³`, color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'المُعالَجة قبل الصرف', value: `${waters.reduce((s, w) => s + Number(w.treated_m3), 0).toFixed(0)} م³`, color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: 14, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {waters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>💧</div><p>لا توجد سجلات مياه</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['الشهر / السنة','المصدر','الاستهلاك (م³)','المُعاد تدويرها','المُعالَجة','الهدف','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {waters.filter(w => !search || w.source?.includes(search)).map(w => {
                      const aboveTarget = w.target_m3 && Number(w.consumption_m3) > Number(w.target_m3)
                      return (
                        <tr key={w.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{w.month} {w.year}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{w.source}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{Number(w.consumption_m3).toFixed(0)}</td>
                          <td style={{ padding: '9px 12px', color: '#065f46' }}>{Number(w.recycled_m3).toFixed(0)}</td>
                          <td style={{ padding: '9px 12px', color: '#92400e' }}>{Number(w.treated_m3).toFixed(0)}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{w.target_m3 ? Number(w.target_m3).toFixed(0) : '—'}</td>
                          <td style={{ padding: '9px 12px' }}><Badge type={aboveTarget ? 'warn' : 'green'}>{aboveTarget ? '↑ أعلى من الهدف' : 'ضمن الهدف'}</Badge></td>
                          <td style={{ padding: '8px' }}><button onClick={() => openEdit('water', w)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ تاب: الشهادات ══ */}
      {tab === 'certs' && (
        certs.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>🏅</div><p>لا توجد شهادات بيئية</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {certs.filter(c => !search || c.title?.includes(search)).map((c: any) => {
              const d = daysLeft(c.expiry_date)
              const isExp  = d !== null && d < 0
              const isSoon = d !== null && d >= 0 && d <= 60
              return (
                <div key={c.id} className="card" style={{ padding: 16, borderTop: `3px solid ${isExp ? '#fecaca' : isSoon ? '#fde68a' : '#bbf7d0'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.title}</div>
                    <Badge type={isExp ? 'red' : isSoon ? 'warn' : 'green'}>{isExp ? 'منتهية' : isSoon ? `${d} يوم` : 'سارية'}</Badge>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {c.standard_ref && <div>📐 {c.standard_ref}</div>}
                    {c.cert_no      && <div>رقم: {c.cert_no}</div>}
                    {c.issuer       && <div>الجهة: {c.issuer}</div>}
                    <div style={{ fontWeight: 600, color: isExp ? '#b91c1c' : isSoon ? '#92400e' : '#065f46', marginTop: 4 }}>
                      {isExp ? `انتهت منذ ${Math.abs(d as number)} يوم` : d !== null ? `تنتهي ${fmtDate(c.expiry_date)}` : ''}
                    </div>
                  </div>
                  <button onClick={() => openEdit('certs', c)} style={{ marginTop: 10, width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ══ تاب: التدريب ══ */}
      {tab === 'training' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {trainings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>📚</div><p>لا توجد سجلات تدريب بيئي</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الموظف','الدورة','المعيار المرجعي','التاريخ','انتهاء الصلاحية','المتبقي','النتيجة',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {trainings.filter(t => !search || t.employee_name?.includes(search) || t.course_name?.includes(search)).map(t => {
                    const d = daysLeft(t.expiry_date)
                    return (
                      <tr key={t.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 12px', fontWeight: 600 }}>{t.employee_name}</td>
                        <td style={{ padding: '9px 12px' }}>{t.course_name}</td>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: '#1d4ed8' }}>{t.iso_ref || '—'}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{fmtDate(t.training_date)}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{t.expiry_date ? fmtDate(t.expiry_date) : '—'}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: d !== null && d < 0 ? '#b91c1c' : d !== null && d <= 60 ? '#92400e' : '#065f46' }}>
                          {d === null ? '—' : d < 0 ? `منتهي منذ ${Math.abs(d)} يوم` : `${d} يوم`}
                        </td>
                        <td style={{ padding: '9px 12px' }}><Badge type={t.result === 'ناجح' ? 'green' : t.result === 'راسب' ? 'red' : 'gray'}>{t.result}</Badge></td>
                        <td style={{ padding: '8px' }}><button onClick={() => openEdit('training', t)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: الزيارات ══ */}
      {tab === 'inspections' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {inspections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div><p>لا توجد زيارات تفتيشية</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التاريخ','الموقع','المفتش','البنود المفحوصة','المخالفات','النتيجة',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {inspections.filter(i => !search || i.location?.includes(search) || i.inspector_name?.includes(search)).map(ins => (
                    <tr key={ins.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{fmtDate(ins.date)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{ins.location}</td>
                      <td style={{ padding: '9px 12px' }}>{ins.inspector_name}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700 }}>{ins.checklist_items}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {ins.violations > 0 ? <Badge type="red">❌ {ins.violations}</Badge> : <Badge type="green">0</Badge>}
                      </td>
                      <td style={{ padding: '9px 12px' }}><Badge type={ins.overall_result === 'مطابق' ? 'green' : 'warn'}>{ins.overall_result === 'مطابق' ? '✅ مطابق' : '⚠️ يتطلب تصحيح'}</Badge></td>
                      <td style={{ padding: '8px' }}><button onClick={() => openEdit('inspections', ins)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>تعديل</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ المودالات ══ */}
      {modal === 'incidents'   && <EnvIncidentModal   editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'waste'       && <EnvWasteModal       editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'chemicals'   && <EnvChemicalModal    editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'emissions'   && <EnvEmissionsModal   editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'water'       && <EnvWaterModal       editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'certs'       && <EnvCertModal2       editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'training'    && <EnvTrainingModal    employees={employees} editItem={editItem} onClose={closeModal} onSave={onSave} />}
      {modal === 'inspections' && <EnvInspectionModal  editItem={editItem} onClose={closeModal} onSave={onSave} />}
    </div>
  )
}
