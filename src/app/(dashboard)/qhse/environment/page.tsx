'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Leaf, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import IncidentModal      from './IncidentModal'
import EnvCertModal       from './EnvCertModal'
import TrainingModal      from './TrainingModal'
import TrainingRecordModal from './TrainingRecordModal'

// ════════════════════════════════════════
// Helpers
// ════════════════════════════════════════
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
const fmtDays = (d: string) => {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, string]> = {
    'سارية':        ['#d1fae5','#065f46','✅'],
    'قاربت':        ['#fef3c7','#92400e','⚠️'],
    'منتهية':       ['#fee2e2','#b91c1c','❌'],
    'مفتوح':        ['#fef3c7','#92400e','🔴'],
    'مغلق':         ['#d1fae5','#065f46','✅'],
    'ناجح':         ['#d1fae5','#065f46','✓'],
    'راسب':         ['#fee2e2','#b91c1c','✗'],
    'قيد المعالجة': ['#eff6ff','#1d4ed8','🔄'],
  }
  const [bg, color, icon] = map[status] || ['#f3f4f6','#374151','•']
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {icon} {status}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, [string, string]> = {
    'عالية':   ['#fee2e2','#b91c1c'],
    'متوسطة': ['#fef3c7','#92400e'],
    'منخفضة': ['#d1fae5','#065f46'],
  }
  const [bg, color] = map[severity] || ['#f3f4f6','#374151']
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{severity}</span>
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function EnvironmentPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const tid = tenant?.id
  const bid = activeBranch?.id

  const [tab,    setTab]    = useState('incidents')
  const [search, setSearch] = useState('')

  // بيانات
  const [incidents,       setIncidents]       = useState<any[]>([])
  const [certs,           setCerts]           = useState<any[]>([])
  const [trainings,       setTrainings]       = useState<any[]>([])
  const [trainingRecords, setTrainingRecords] = useState<any[]>([])
  const [safetyVisits,    setSafetyVisits]    = useState<any[]>([])
  const [safetyMaterials, setSafetyMaterials] = useState<any[]>([])
  const [employees,       setEmployees]       = useState<any[]>([])
  const [loading,         setLoading]         = useState(true)

  // حالة المودالات
  const [showIncidentModal,  setShowIncidentModal]  = useState(false)
  const [showCertModal,      setShowCertModal]      = useState(false)
  const [showTrainingModal,  setShowTrainingModal]  = useState(false)
  const [showRecordModal,    setShowRecordModal]    = useState(false)
  const [editIncident,       setEditIncident]       = useState<any>(null)
  const [editCert,           setEditCert]           = useState<any>(null)

  const loadData = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const [inc, cert, tr, trr, vis, mat, emp] = await Promise.all([
        supabase.from('qhse_incidents').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
        supabase.from('qhse_certs').select('*').eq('tenant_id', tid)
          .in('category', ['safety','fire','first_aid','environment']).order('expiry_date'),
        supabase.from('qhse_trainings').select('*').eq('tenant_id', tid).eq('is_active', true).order('name'),
        supabase.from('qhse_training_records')
          .select('*, hr_employees(name, department), qhse_trainings(name, validity_months)')
          .eq('tenant_id', tid).order('expiry_date'),
        supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid)
          .eq('type', 'سلامة').order('date', { ascending: false }),
        supabase.from('materials').select('*').eq('tenant_id', tid).eq('branch_id', bid)
          .eq('category', 'safety').order('name'),
        supabase.from('hr_employees').select('id, name, department')
          .eq('tenant_id', tid).eq('is_active', true).order('name'),
      ])
      setIncidents(inc.data || [])
      setCerts(cert.data || [])
      setTrainings(tr.data || [])
      setTrainingRecords(trr.data || [])
      setSafetyVisits(vis.data || [])
      setSafetyMaterials(mat.data || [])
      setEmployees(emp.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [tid, bid])

  useEffect(() => { loadData() }, [loadData])

  // ══ KPIs ══
  const lastIncident = incidents.find(i => i.status !== 'مغلق')
  const daysSafe = lastIncident
    ? Math.floor((Date.now() - new Date(lastIncident.date).getTime()) / 86400000)
    : incidents.length > 0
      ? Math.floor((Date.now() - new Date(incidents[0].date).getTime()) / 86400000)
      : null

  const openIncidents   = incidents.filter(i => i.status === 'مفتوح').length
  const expiredCerts    = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length
  const expiringSoon    = certs.filter(c => { const d = fmtDays(c.expiry_date); return d !== null && d >= 0 && d <= 60 }).length
  const overdueTraining = trainingRecords.filter(r => r.status === 'منتهية').length
  const soonTraining    = trainingRecords.filter(r => r.status === 'قاربت').length
  const lowSafeMat      = safetyMaterials.filter(m => m.qty <= m.reorder).length
  const thisMonthVisits = safetyVisits.filter(v => {
    const d = new Date(v.date); const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  const TABS = [
    { id: 'incidents', label: 'الحوادث والإصابات',  icon: '⚠️' },
    { id: 'certs',     label: 'الشهادات البيئية',    icon: '🏆' },
    { id: 'training',  label: 'التدريب',             icon: '📚' },
    { id: 'visits',    label: 'الزيارات الميدانية',  icon: '🔍' },
    { id: 'materials', label: 'مخزون مواد السلامة',  icon: '📦' },
  ]

  function onModalSave() { loadData() }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} dir="rtl">

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Leaf size={20} style={{ color: '#0ea77b' }} />
            الإدارة البيئية والسلامة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
            إدارة الحوادث والشهادات والتدريب وزيارات السلامة الميدانية
          </p>
        </div>

        {/* أزرار الإضافة — تتغيّر حسب التاب */}
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'incidents' && (
            <button onClick={() => setShowIncidentModal(true)} className="btn btn-primary" style={{ background: '#dc2626' }}>
              <Plus size={16} /> تسجيل حادثة
            </button>
          )}
          {tab === 'certs' && (
            <button onClick={() => setShowCertModal(true)} className="btn btn-primary" style={{ background: '#f59e0b' }}>
              <Plus size={16} /> إضافة شهادة
            </button>
          )}
          {tab === 'training' && (
            <>
              <button onClick={() => setShowRecordModal(true)} className="btn btn-primary" style={{ background: '#7c3aed' }}>
                <Plus size={16} /> تسجيل حضور
              </button>
              <button onClick={() => setShowTrainingModal(true)} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
                <Plus size={16} /> إضافة دورة
              </button>
            </>
          )}
          {tab === 'visits' && (
            <button onClick={() => router.push('/visits')} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
              <Plus size={16} /> إضافة زيارة
            </button>
          )}
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          {
            icon: '🛡️', value: daysSafe ?? '—', label: 'يوم بدون حوادث',
            bg: daysSafe === null || daysSafe > 30 ? '#f0fdf4' : '#fef2f2',
            color: daysSafe === null || daysSafe > 30 ? '#065f46' : '#b91c1c',
            border: daysSafe === null || daysSafe > 30 ? '#bbf7d0' : '#fecaca',
          },
          { icon: '⚠️', value: openIncidents, label: 'حادثة مفتوحة',
            bg: openIncidents > 0 ? '#fef2f2' : '#f8f9fa',
            color: openIncidents > 0 ? '#b91c1c' : '#374151',
            border: openIncidents > 0 ? '#fecaca' : '#e9ecef' },
          { icon: '🏆',
            value: expiredCerts > 0 ? expiredCerts : expiringSoon > 0 ? expiringSoon : certs.length,
            label: expiredCerts > 0 ? 'شهادة منتهية' : expiringSoon > 0 ? 'شهادة تقترب' : 'شهادة سارية',
            bg: expiredCerts > 0 ? '#fef2f2' : expiringSoon > 0 ? '#fffbeb' : '#f0fdf4',
            color: expiredCerts > 0 ? '#b91c1c' : expiringSoon > 0 ? '#92400e' : '#065f46',
            border: expiredCerts > 0 ? '#fecaca' : expiringSoon > 0 ? '#fde68a' : '#bbf7d0' },
          { icon: '📚',
            value: overdueTraining > 0 ? overdueTraining : soonTraining,
            label: overdueTraining > 0 ? 'تدريب منتهي' : 'تدريب يقترب',
            bg: overdueTraining > 0 ? '#fef2f2' : soonTraining > 0 ? '#fffbeb' : '#f8f9fa',
            color: overdueTraining > 0 ? '#b91c1c' : soonTraining > 0 ? '#92400e' : '#374151',
            border: overdueTraining > 0 ? '#fecaca' : '#e9ecef' },
          { icon: '🔍', value: thisMonthVisits, label: 'زيارة هذا الشهر',
            bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
          { icon: '📦', value: lowSafeMat, label: 'مادة منخفضة',
            bg: lowSafeMat > 0 ? '#fef2f2' : '#f0fdf4',
            color: lowSafeMat > 0 ? '#b91c1c' : '#065f46',
            border: lowSafeMat > 0 ? '#fecaca' : '#bbf7d0' },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: 14, background: kpi.bg, border: `1px solid ${kpi.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{kpi.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 600, marginTop: 2 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ══ التابات ══ */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#0ea77b' : 'var(--text3)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══ بحث ══ */}
      <div style={{ position: 'relative', maxWidth: 340 }}>
        <Search size={15} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input"
          style={{ paddingRight: 32 }} placeholder="بحث..." />
      </div>

      {/* ══════════════════════════════════ */}
      {/* تاب: الحوادث والإصابات            */}
      {/* ══════════════════════════════════ */}
      {tab === 'incidents' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p>لا توجد حوادث مسجلة — هذا جيد!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['النوع','التاريخ','الموقع','الخطورة','المصاب','الإجراء','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents
                    .filter(i => !search || i.type?.includes(search) || i.location?.includes(search) || i.description?.includes(search))
                    .map(inc => (
                      <tr key={inc.id}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 14px', fontWeight: 500 }}>{inc.type}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{fmtDate(inc.date)}</td>
                        <td style={{ padding: '9px 14px' }}>{inc.location}</td>
                        <td style={{ padding: '9px 14px' }}><SeverityBadge severity={inc.severity} /></td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{inc.injured || '—'}</td>
                        <td style={{ padding: '9px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text3)' }}>{inc.action || '—'}</td>
                        <td style={{ padding: '9px 14px' }}><StatusBadge status={inc.status} /></td>
                        <td style={{ padding: '8px 14px' }}>
                          <button onClick={() => { setEditIncident(inc); setShowIncidentModal(true) }}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>
                            تعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* تاب: الشهادات البيئية             */}
      {/* ══════════════════════════════════ */}
      {tab === 'certs' && (
        <>
          {certs.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
              <p>لا توجد شهادات مضافة</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {certs
                .filter(c => !search || c.name?.includes(search) || c.issuer?.includes(search))
                .map((cert: any) => {
                  const days      = fmtDays(cert.expiry_date)
                  const isExpired = days !== null && days < 0
                  const isSoon    = days !== null && days >= 0 && days <= 60
                  return (
                    <div key={cert.id} className="card" style={{ padding: 16, borderTop: `3px solid ${isExpired ? '#fecaca' : isSoon ? '#fde68a' : '#bbf7d0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cert.name}</div>
                        <StatusBadge status={isExpired ? 'منتهية' : isSoon ? 'قاربت' : 'سارية'} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cert.cert_no && <div>رقم الشهادة: <strong>{cert.cert_no}</strong></div>}
                        {cert.issuer  && <div>الجهة: <strong>{cert.issuer}</strong></div>}
                        <div>تاريخ الانتهاء: <strong style={{ color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>{fmtDate(cert.expiry_date)}</strong></div>
                        {days !== null && (
                          <div style={{ fontWeight: 600, color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>
                            {isExpired ? `منتهية منذ ${Math.abs(days)} يوم` : `تنتهي بعد ${days} يوم`}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setEditCert(cert); setShowCertModal(true) }}
                        style={{ marginTop: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', width: '100%', fontFamily: 'inherit' }}>
                        تعديل
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════ */}
      {/* تاب: التدريب                      */}
      {/* ══════════════════════════════════ */}
      {tab === 'training' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trainings.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 10 }}>الدورات الإلزامية</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {trainings.map((t: any) => (
                  <div key={t.id} style={{ padding: '6px 12px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 20, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#3730a3' }}>{t.name}</span>
                    <span style={{ color: '#6b7280', marginRight: 6 }}>• كل {t.validity_months} شهر</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            {trainingRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                <p>لا توجد سجلات تدريب</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['الموظف','القسم','الدورة','تاريخ التدريب','تاريخ الانتهاء','المتبقي','النتيجة','الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trainingRecords
                      .filter(r => !search || r.hr_employees?.name?.includes(search) || r.qhse_trainings?.name?.includes(search))
                      .map((r: any) => {
                        const days = fmtDays(r.expiry_date)
                        return (
                          <tr key={r.id}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.hr_employees?.name || '—'}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{r.hr_employees?.department || '—'}</td>
                            <td style={{ padding: '9px 14px' }}>{r.qhse_trainings?.name || '—'}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{fmtDate(r.training_date)}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{fmtDate(r.expiry_date)}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600,
                              color: days !== null && days < 0 ? '#b91c1c' : days !== null && days <= 60 ? '#92400e' : '#065f46' }}>
                              {days !== null ? (days < 0 ? `منتهية منذ ${Math.abs(days)} يوم` : `${days} يوم`) : '—'}
                            </td>
                            <td style={{ padding: '9px 14px' }}><StatusBadge status={r.result} /></td>
                            <td style={{ padding: '9px 14px' }}><StatusBadge status={r.status} /></td>
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

      {/* ══════════════════════════════════ */}
      {/* تاب: الزيارات الميدانية           */}
      {/* ══════════════════════════════════ */}
      {tab === 'visits' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {safetyVisits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p>لا توجد زيارات سلامة مسجلة</p>
              <button onClick={() => router.push('/visits')}
                style={{ marginTop: 10, padding: '6px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#1d4ed8', fontFamily: 'inherit' }}>
                انتقل لصفحة الزيارات
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ','المهندس','الموقع','النتيجة','NCR','تاريخ الإغلاق'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {safetyVisits
                    .filter(v => !search || v.engineer?.includes(search) || v.location?.includes(search))
                    .map((v: any) => (
                      <tr key={v.id}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{fmtDate(v.date)}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 500 }}>{v.engineer}</td>
                        <td style={{ padding: '9px 14px' }}>{v.location || '—'}</td>
                        <td style={{ padding: '9px 14px' }}><StatusBadge status={v.specs === 'مطابق' ? 'سارية' : 'مفتوح'} /></td>
                        <td style={{ padding: '9px 14px' }}>
                          {v.specs === 'غير مطابق'
                            ? <StatusBadge status={v.resolved_report ? 'مغلق' : 'مفتوح'} />
                            : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{v.resolved_date ? fmtDate(v.resolved_date) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* تاب: مخزون مواد السلامة           */}
      {/* ══════════════════════════════════ */}
      {tab === 'materials' && (
        <>
          {safetyMaterials.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <p>لا توجد مواد سلامة في المخزون</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>تأكد من تصنيف المواد بـ category = safety في صفحة المخزون</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {safetyMaterials
                .filter(m => !search || m.name?.includes(search))
                .map((m: any) => {
                  const isLow = m.qty <= m.reorder
                  return (
                    <div key={m.id} className="card" style={{ padding: 14, borderTop: `3px solid ${isLow ? '#fecaca' : '#bbf7d0'}` }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>{m.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                          الكمية: <strong style={{ color: isLow ? '#b91c1c' : 'var(--text)' }}>{m.qty}</strong> {m.unit}
                        </div>
                        {isLow
                          ? <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>⚠️ منخفض</span>
                          : <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>✅ كافي</span>}
                      </div>
                      <div style={{ marginTop: 6, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min((m.qty / Math.max(m.reorder * 2, 1)) * 100, 100)}%`, background: isLow ? '#ef4444' : '#10b981', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>حد الأمان: {m.reorder} {m.unit}</div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════
          المودالات — مستوردة من ملفاتها المنفصلة
      ════════════════════════════════════ */}

      {showIncidentModal && (
        <IncidentModal
          editIncident={editIncident}
          onClose={() => { setShowIncidentModal(false); setEditIncident(null) }}
          onSave={() => { setShowIncidentModal(false); setEditIncident(null); onModalSave() }} />
      )}

      {showCertModal && (
        <EnvCertModal
          editCert={editCert}
          onClose={() => { setShowCertModal(false); setEditCert(null) }}
          onSave={() => { setShowCertModal(false); setEditCert(null); onModalSave() }} />
      )}

      {showTrainingModal && (
        <TrainingModal
          onClose={() => setShowTrainingModal(false)}
          onSave={() => { setShowTrainingModal(false); onModalSave() }} />
      )}

      {showRecordModal && (
        <TrainingRecordModal
          trainings={trainings}
          employees={employees}
          onClose={() => setShowRecordModal(false)}
          onSave={() => { setShowRecordModal(false); onModalSave() }} />
      )}
    </div>
  )
}
