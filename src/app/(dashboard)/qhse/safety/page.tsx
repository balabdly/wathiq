'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Shield, AlertTriangle, Award, BookOpen, Eye,
  Plus, X, Save, ChevronDown, ChevronUp,
  Package, CheckCircle, Clock, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────
const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
const fmtDays  = (d: string) => {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, string]> = {
    'سارية':   ['#d1fae5','#065f46','✅'],
    'قاربت':   ['#fef3c7','#92400e','⚠️'],
    'منتهية':  ['#fee2e2','#b91c1c','❌'],
    'مفتوح':   ['#fef3c7','#92400e','🔴'],
    'مغلق':    ['#d1fae5','#065f46','✅'],
    'ناجح':    ['#d1fae5','#065f46','✓'],
    'راسب':    ['#fee2e2','#b91c1c','✗'],
  }
  const [bg, color, icon] = map[status] || ['#f3f4f6','#374151','•']
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
      {icon} {status}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, [string, string]> = {
    'عالية':    ['#fee2e2','#b91c1c'],
    'متوسطة':  ['#fef3c7','#92400e'],
    'منخفضة':  ['#d1fae5','#065f46'],
  }
  const [bg, color] = map[severity] || ['#f3f4f6','#374151']
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{severity}</span>
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e9ecef' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, icon: Icon, color, children, action }: {
  title: string; icon: any; color: string; children: React.ReactNode; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card overflow-hidden">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: open ? '1px solid #e9ecef' : 'none', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={17} style={{ color }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          {action}
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════════════
export default function SafetyPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const tid = tenant?.id
  const bid = activeBranch?.id

  // بيانات
  const [incidents,        setIncidents]       = useState<any[]>([])
  const [certs,            setCerts]           = useState<any[]>([])
  const [trainings,        setTrainings]       = useState<any[]>([])
  const [trainingRecords,  setTrainingRecords] = useState<any[]>([])
  const [safetyVisits,     setSafetyVisits]    = useState<any[]>([])
  const [safetyMaterials,  setSafetyMaterials] = useState<any[]>([])
  const [employees,        setEmployees]       = useState<any[]>([])
  const [loading,          setLoading]         = useState(true)

  // Modals
  const [showIncidentModal,  setShowIncidentModal]  = useState(false)
  const [showCertModal,      setShowCertModal]      = useState(false)
  const [showTrainingModal,  setShowTrainingModal]  = useState(false)
  const [showRecordModal,    setShowRecordModal]    = useState(false)
  const [editIncident,       setEditIncident]       = useState<any>(null)
  const [editCert,           setEditCert]           = useState<any>(null)

  // نماذج
  const [incidentForm, setIncidentForm] = useState({
    type: '', date: '', time: '', location: '', project_id: '',
    severity: 'متوسطة', description: '', injured: '',
    action: '', lesson: '', reported_by: '', status: 'مفتوح',
  })
  const [certForm, setCertForm] = useState({
    category: 'safety', type: '', name: '', cert_no: '',
    issuer: '', issue_date: '', expiry_date: '', notify_days: 30, notes: '',
  })
  const [trainingForm, setTrainingForm] = useState({
    name: '', code: '', category: 'safety', duration_days: 1,
    validity_months: 24, is_mandatory: true, provider: '', notes: '',
  })
  const [recordForm, setRecordForm] = useState({
    training_id: '', employee_id: '', training_date: '',
    expiry_date: '', result: 'ناجح', cert_number: '', provider: '', score: '', notes: '',
  })

  const loadData = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const [inc, cert, tr, trr, vis, mat, emp] = await Promise.all([
        supabase.from('qhse_incidents').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
        supabase.from('qhse_certs').select('*').eq('tenant_id', tid).in('category', ['safety','fire','first_aid']).order('expiry_date'),
        supabase.from('qhse_trainings').select('*').eq('tenant_id', tid).eq('is_active', true).order('name'),
        supabase.from('qhse_training_records').select('*, hr_employees(name, department), qhse_trainings(name, validity_months)').eq('tenant_id', tid).order('expiry_date'),
        supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid).eq('type', 'سلامة').order('date', { ascending: false }),
        supabase.from('materials').select('*').eq('tenant_id', tid).eq('branch_id', bid).eq('category', 'safety').order('name'),
        supabase.from('hr_employees').select('id, name, department').eq('tenant_id', tid).eq('is_active', true).order('name'),
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

  // ── احتساب أيام بدون حوادث ──
  const lastIncident = incidents.find(i => i.status !== 'مغلق')
  const daysSafe = lastIncident
    ? Math.floor((Date.now() - new Date(lastIncident.date).getTime()) / 86400000)
    : incidents.length > 0
      ? Math.floor((Date.now() - new Date(incidents[0].date).getTime()) / 86400000)
      : null

  const openIncidents    = incidents.filter(i => i.status === 'مفتوح').length
  const expiredCerts     = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length
  const expiringSoon     = certs.filter(c => { const d = fmtDays(c.expiry_date); return d !== null && d >= 0 && d <= 60 }).length
  const overdueTraining  = trainingRecords.filter(r => r.status === 'منتهية').length
  const soonTraining     = trainingRecords.filter(r => r.status === 'قاربت').length
  const lowSafeMat       = safetyMaterials.filter(m => m.qty <= m.reorder).length
  const thisMonthVisits  = safetyVisits.filter(v => {
    const d = new Date(v.date)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  // ── حفظ الحادثة ──
  async function saveIncident() {
    if (!incidentForm.type || !incidentForm.date || !incidentForm.location) {
      toast.error('يرجى تعبئة النوع والتاريخ والموقع'); return
    }
    const payload = { ...incidentForm, tenant_id: tid, branch_id: bid }
    const { error } = editIncident
      ? await supabase.from('qhse_incidents').update(payload).eq('id', editIncident.id)
      : await supabase.from('qhse_incidents').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success(editIncident ? '✅ تم تحديث الحادثة' : '✅ تم تسجيل الحادثة')
    setShowIncidentModal(false); setEditIncident(null)
    setIncidentForm({ type:'',date:'',time:'',location:'',project_id:'',severity:'متوسطة',description:'',injured:'',action:'',lesson:'',reported_by:'',status:'مفتوح' })
    loadData()
  }

  // ── حفظ الشهادة ──
  async function saveCert() {
    if (!certForm.name || !certForm.expiry_date) {
      toast.error('يرجى تعبئة اسم الشهادة وتاريخ الانتهاء'); return
    }
    const payload = { ...certForm, tenant_id: tid, branch_id: bid }
    const { error } = editCert
      ? await supabase.from('qhse_certs').update(payload).eq('id', editCert.id)
      : await supabase.from('qhse_certs').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ الشهادة')
    setShowCertModal(false); setEditCert(null)
    setCertForm({ category:'safety',type:'',name:'',cert_no:'',issuer:'',issue_date:'',expiry_date:'',notify_days:30,notes:'' })
    loadData()
  }

  // ── حفظ الدورة ──
  async function saveTraining() {
    if (!trainingForm.name) { toast.error('يرجى إدخال اسم الدورة'); return }
    const { error } = await supabase.from('qhse_trainings').insert({ ...trainingForm, tenant_id: tid, branch_id: bid })
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم إضافة الدورة')
    setShowTrainingModal(false)
    setTrainingForm({ name:'',code:'',category:'safety',duration_days:1,validity_months:24,is_mandatory:true,provider:'',notes:'' })
    loadData()
  }

  // ── حفظ سجل حضور ──
  async function saveRecord() {
    if (!recordForm.training_id || !recordForm.employee_id || !recordForm.training_date) {
      toast.error('يرجى تعبئة الدورة والموظف والتاريخ'); return
    }
    // احتساب تاريخ الانتهاء تلقائياً
    const training = trainings.find(t => t.id === Number(recordForm.training_id))
    let expiry = recordForm.expiry_date
    if (!expiry && training) {
      const d = new Date(recordForm.training_date)
      d.setMonth(d.getMonth() + training.validity_months)
      expiry = d.toISOString().split('T')[0]
    }
    const { error } = await supabase.from('qhse_training_records').insert({
      ...recordForm, expiry_date: expiry,
      training_id: Number(recordForm.training_id),
      employee_id: Number(recordForm.employee_id),
      score: recordForm.score ? Number(recordForm.score) : null,
      tenant_id: tid, branch_id: bid,
    })
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم تسجيل الحضور')
    setShowRecordModal(false)
    setRecordForm({ training_id:'',employee_id:'',training_date:'',expiry_date:'',result:'ناجح',cert_number:'',provider:'',score:'',notes:'' })
    loadData()
  }

  const iS = (k: string, v: any) => setIncidentForm(f => ({ ...f, [k]: v }))
  const iC = (k: string, v: any) => setCertForm(f => ({ ...f, [k]: v }))
  const iT = (k: string, v: any) => setTrainingForm(f => ({ ...f, [k]: v }))
  const iR = (k: string, v: any) => setRecordForm(f => ({ ...f, [k]: v }))

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 fade-in" dir="rtl">

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} style={{ color: 'var(--primary)' }} />
          السلامة والصحة المهنية (HSE)
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
          إدارة الحوادث، الشهادات، التدريب، وزيارات السلامة الميدانية
        </p>
      </div>

      {/* ══ المؤشرات ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

        {/* أيام بدون حوادث */}
        <div style={{ background: daysSafe === null || daysSafe > 30 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)', borderRadius: 14, padding: '16px 18px', border: '1px solid', borderColor: daysSafe === null || daysSafe > 30 ? '#bbf7d0' : '#fecaca' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🛡️</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: daysSafe === null || daysSafe > 30 ? '#065f46' : '#b91c1c' }}>
            {daysSafe ?? '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>يوم بدون حوادث</div>
        </div>

        {/* الحوادث المفتوحة */}
        <div style={{ background: openIncidents > 0 ? '#fef2f2' : '#f8f9fa', borderRadius: 14, padding: '16px 18px', border: '1px solid', borderColor: openIncidents > 0 ? '#fecaca' : '#e9ecef' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>⚠️</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: openIncidents > 0 ? '#b91c1c' : '#374151' }}>{openIncidents}</div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>حادثة مفتوحة</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>إجمالي: {incidents.length}</div>
        </div>

        {/* الشهادات */}
        <div style={{ background: expiredCerts > 0 ? '#fef2f2' : expiringSoon > 0 ? '#fffbeb' : '#f0fdf4', borderRadius: 14, padding: '16px 18px', border: '1px solid', borderColor: expiredCerts > 0 ? '#fecaca' : expiringSoon > 0 ? '#fde68a' : '#bbf7d0' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: expiredCerts > 0 ? '#b91c1c' : expiringSoon > 0 ? '#92400e' : '#065f46' }}>
            {expiredCerts > 0 ? expiredCerts : expiringSoon > 0 ? expiringSoon : certs.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
            {expiredCerts > 0 ? 'شهادة منتهية' : expiringSoon > 0 ? 'شهادة تقترب' : 'شهادة سارية'}
          </div>
        </div>

        {/* التدريب */}
        <div style={{ background: overdueTraining > 0 ? '#fef2f2' : soonTraining > 0 ? '#fffbeb' : '#f8f9fa', borderRadius: 14, padding: '16px 18px', border: '1px solid', borderColor: overdueTraining > 0 ? '#fecaca' : soonTraining > 0 ? '#fde68a' : '#e9ecef' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>📚</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: overdueTraining > 0 ? '#b91c1c' : soonTraining > 0 ? '#92400e' : '#374151' }}>
            {overdueTraining > 0 ? overdueTraining : soonTraining}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
            {overdueTraining > 0 ? 'تدريب منتهي' : 'تدريب يقترب'}
          </div>
        </div>

        {/* زيارات السلامة */}
        <div style={{ background: '#eff6ff', borderRadius: 14, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🔍</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1d4ed8' }}>{thisMonthVisits}</div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>زيارة سلامة هذا الشهر</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>إجمالي: {safetyVisits.length}</div>
        </div>

        {/* مواد السلامة */}
        <div style={{ background: lowSafeMat > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 14, padding: '16px 18px', border: '1px solid', borderColor: lowSafeMat > 0 ? '#fecaca' : '#bbf7d0' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>📦</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: lowSafeMat > 0 ? '#b91c1c' : '#065f46' }}>{lowSafeMat}</div>
          <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>مادة سلامة منخفضة</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>إجمالي: {safetyMaterials.length}</div>
        </div>

        {/* موظفون بحاجة تجديد */}
        <div style={{ background: overdueTraining > 0 ? '#fef2f2' : '#f8f9fa', borderRadius: 14, padding: '16px 18px', border: '1px solid #e9ecef', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 24 }}>👷</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{overdueTraining} موظف</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>بحاجة لتجديد دورات السلامة</div>
            </div>
          </div>
          {overdueTraining > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {trainingRecords.filter(r => r.status === 'منتهية').slice(0, 5).map((r: any) => (
                <span key={r.id} style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>
                  {r.hr_employees?.name}
                </span>
              ))}
              {overdueTraining > 5 && <span style={{ fontSize: 11, color: '#6b7280' }}>+{overdueTraining - 5} آخرين</span>}
            </div>
          )}
        </div>
      </div>

      {/* ══ الحوادث ══ */}
      <Section title="⚠️ الحوادث والإصابات" icon={AlertTriangle} color="#dc2626"
        action={
          <button onClick={() => setShowIncidentModal(true)}
            className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> تسجيل حادثة
          </button>
        }>
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div>لا توجد حوادث مسجلة</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['النوع','التاريخ','الموقع','الخطورة','المصاب','الإجراء','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, i) => (
                  <tr key={inc.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 500 }}>{inc.type}</td>
                    <td style={{ padding: '9px 14px', color: '#6b7280' }}>{fmtDate(inc.date)}</td>
                    <td style={{ padding: '9px 14px' }}>{inc.location}</td>
                    <td style={{ padding: '9px 14px' }}><SeverityBadge severity={inc.severity} /></td>
                    <td style={{ padding: '9px 14px', color: '#6b7280' }}>{inc.injured || '—'}</td>
                    <td style={{ padding: '9px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{inc.action || '—'}</td>
                    <td style={{ padding: '9px 14px' }}><StatusBadge status={inc.status} /></td>
                    <td style={{ padding: '9px 14px' }}>
                      <button onClick={() => { setEditIncident(inc); setIncidentForm({ type:inc.type,date:inc.date,time:inc.time||'',location:inc.location,project_id:inc.project_id||'',severity:inc.severity,description:inc.description||'',injured:inc.injured||'',action:inc.action||'',lesson:inc.lesson||'',reported_by:inc.reported_by||'',status:inc.status }); setShowIncidentModal(true) }}
                        style={{ background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ الشهادات ══ */}
      <Section title="🏆 شهادات السلامة المؤسسية" icon={Award} color="#f59e0b"
        action={
          <button onClick={() => setShowCertModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> إضافة شهادة
          </button>
        }>
        {certs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
            <div>لا توجد شهادات مضافة</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: 16 }}>
            {certs.map((cert: any) => {
              const days = fmtDays(cert.expiry_date)
              const isExpired = days !== null && days < 0
              const isSoon    = days !== null && days >= 0 && days <= 60
              return (
                <div key={cert.id} style={{
                  borderRadius: 12, padding: 16,
                  border: `1px solid ${isExpired ? '#fecaca' : isSoon ? '#fde68a' : '#bbf7d0'}`,
                  background: isExpired ? '#fef2f2' : isSoon ? '#fffbeb' : '#f0fdf4',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cert.name}</div>
                    <StatusBadge status={isExpired ? 'منتهية' : isSoon ? 'قاربت' : 'سارية'} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cert.cert_no && <div>رقم الشهادة: <strong>{cert.cert_no}</strong></div>}
                    {cert.issuer   && <div>الجهة: <strong>{cert.issuer}</strong></div>}
                    <div>تاريخ الانتهاء: <strong style={{ color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>{fmtDate(cert.expiry_date)}</strong></div>
                    {days !== null && (
                      <div style={{ fontWeight: 600, color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>
                        {isExpired ? `منتهية منذ ${Math.abs(days)} يوم` : `تنتهي بعد ${days} يوم`}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setEditCert(cert); setCertForm({ category:cert.category,type:cert.type||'',name:cert.name,cert_no:cert.cert_no||'',issuer:cert.issuer||'',issue_date:cert.issue_date||'',expiry_date:cert.expiry_date||'',notify_days:cert.notify_days||30,notes:cert.notes||'' }); setShowCertModal(true) }}
                    style={{ marginTop: 10, background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#6b7280', width: '100%' }}>
                    تعديل
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ══ التدريب ══ */}
      <Section title="📚 خطة التدريب على السلامة" icon={BookOpen} color="#7c3aed"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowRecordModal(true)} className="btn btn-primary btn-sm gap-1.5">
              <Plus size={14} /> تسجيل حضور
            </button>
            <button onClick={() => setShowTrainingModal(true)} className="btn btn-ghost btn-sm gap-1.5 border border-gray-200">
              <Plus size={14} /> إضافة دورة
            </button>
          </div>
        }>
        <div style={{ padding: 16 }}>
          {/* الدورات المتاحة */}
          {trainings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 8 }}>الدورات الإلزامية</div>
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

          {/* سجلات التدريب */}
          {trainingRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div>لا توجد سجلات تدريب</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['الموظف','القسم','الدورة','تاريخ التدريب','تاريخ الانتهاء','المتبقي','النتيجة','الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trainingRecords.map((r: any, i: number) => {
                    const days = fmtDays(r.expiry_date)
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.hr_employees?.name || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.hr_employees?.department || '—'}</td>
                        <td style={{ padding: '9px 14px' }}>{r.qhse_trainings?.name || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{fmtDate(r.training_date)}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{fmtDate(r.expiry_date)}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: days !== null && days < 0 ? '#b91c1c' : days !== null && days <= 60 ? '#92400e' : '#065f46' }}>
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
      </Section>

      {/* ══ زيارات السلامة ══ */}
      <Section title="🔍 زيارات السلامة الميدانية" icon={Eye} color="#0891b2"
        action={
          <button onClick={() => router.push('/visits')} className="btn btn-ghost btn-sm gap-1.5 border border-gray-200">
            <Plus size={14} /> إضافة زيارة
          </button>
        }>
        {safetyVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div>لا توجد زيارات سلامة مسجلة</div>
            <button onClick={() => router.push('/visits')} style={{ marginTop: 10, padding: '6px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
              انتقل لصفحة الزيارات
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['التاريخ','المهندس','الموقع','النتيجة','NCR','تاريخ الإغلاق'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safetyVisits.map((v: any, i: number) => (
                  <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 14px', color: '#6b7280' }}>{fmtDate(v.date)}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 500 }}>{v.engineer}</td>
                    <td style={{ padding: '9px 14px' }}>{v.location || '—'}</td>
                    <td style={{ padding: '9px 14px' }}><StatusBadge status={v.specs === 'مطابق' ? 'سارية' : 'مفتوح'} /></td>
                    <td style={{ padding: '9px 14px' }}>
                      {v.specs === 'غير مطابق'
                        ? <StatusBadge status={v.resolved_report ? 'مغلق' : 'مفتوح'} />
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#6b7280' }}>{v.resolved_date ? fmtDate(v.resolved_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ مواد السلامة ══ */}
      <Section title="📦 مخزون مواد السلامة" icon={Package} color="#d97706">
        {safetyMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div>لا توجد مواد سلامة في المخزون</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>تأكد من تصنيف المواد بـ category = safety في صفحة المخزون</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, padding: 16 }}>
            {safetyMaterials.map((m: any) => {
              const isLow = m.qty <= m.reorder
              return (
                <div key={m.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${isLow ? '#fecaca' : '#e9ecef'}`, background: isLow ? '#fef2f2' : 'white' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      الكمية: <strong style={{ color: isLow ? '#b91c1c' : '#374151' }}>{m.qty}</strong> {m.unit}
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
      </Section>

      {/* ════════════════════════════════
          Modals
      ════════════════════════════════ */}

      {/* Modal الحادثة */}
      {showIncidentModal && (
        <Modal title={editIncident ? 'تعديل الحادثة' : 'تسجيل حادثة جديدة'} onClose={() => { setShowIncidentModal(false); setEditIncident(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحادثة *</label>
                <select value={incidentForm.type} onChange={e => iS('type', e.target.value)} className="input">
                  <option value="">— اختر —</option>
                  {['إصابة','حريق','سقوط','صعق كهربائي','حادث مركبة','إغماء','أخرى'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">درجة الخطورة</label>
                <select value={incidentForm.severity} onChange={e => iS('severity', e.target.value)} className="input">
                  <option value="منخفضة">منخفضة</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="عالية">عالية</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <input type="date" value={incidentForm.date} onChange={e => iS('date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوقت</label>
                <input type="time" value={incidentForm.time} onChange={e => iS('time', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الموقع *</label>
              <input value={incidentForm.location} onChange={e => iS('location', e.target.value)} className="input" placeholder="موقع الحادثة" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وصف الحادثة</label>
              <textarea value={incidentForm.description} onChange={e => iS('description', e.target.value)} className="input" rows={3} placeholder="تفاصيل ما حدث..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المصاب (إن وجد)</label>
                <input value={incidentForm.injured} onChange={e => iS('injured', e.target.value)} className="input" placeholder="اسم المصاب" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">أبلغ عنها</label>
                <input value={incidentForm.reported_by} onChange={e => iS('reported_by', e.target.value)} className="input" placeholder="اسم المبلّغ" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الإجراء المتخذ</label>
              <textarea value={incidentForm.action} onChange={e => iS('action', e.target.value)} className="input" rows={2} placeholder="الإجراءات الفورية..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدروس المستفادة</label>
              <textarea value={incidentForm.lesson} onChange={e => iS('lesson', e.target.value)} className="input" rows={2} placeholder="ماذا تعلمنا..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
              <select value={incidentForm.status} onChange={e => iS('status', e.target.value)} className="input">
                <option value="مفتوح">مفتوح</option>
                <option value="قيد المعالجة">قيد المعالجة</option>
                <option value="مغلق">مغلق</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setShowIncidentModal(false); setEditIncident(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveIncident} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal الشهادة */}
      {showCertModal && (
        <Modal title={editCert ? 'تعديل الشهادة' : 'إضافة شهادة سلامة'} onClose={() => { setShowCertModal(false); setEditCert(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <select value={certForm.category} onChange={e => iC('category', e.target.value)} className="input">
                  <option value="safety">سلامة عامة</option>
                  <option value="fire">مكافحة الحرائق</option>
                  <option value="first_aid">إسعافات أولية</option>
                  <option value="environment">بيئة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الشهادة</label>
                <input value={certForm.type} onChange={e => iC('type', e.target.value)} className="input" placeholder="ISO 45001 / OHSAS..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشهادة *</label>
              <input value={certForm.name} onChange={e => iC('name', e.target.value)} className="input" placeholder="مثال: شهادة ISO 45001 لنظام إدارة السلامة" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الشهادة</label>
                <input value={certForm.cert_no} onChange={e => iC('cert_no', e.target.value)} className="input" dir="ltr" placeholder="CERT-0001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المصدرة</label>
                <input value={certForm.issuer} onChange={e => iC('issuer', e.target.value)} className="input" placeholder="اسم الجهة" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإصدار</label>
                <input type="date" value={certForm.issue_date} onChange={e => iC('issue_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء *</label>
                <input type="date" value={certForm.expiry_date} onChange={e => iC('expiry_date', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التنبيه قبل الانتهاء (يوم)</label>
              <input type="number" value={certForm.notify_days} onChange={e => iC('notify_days', Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={certForm.notes} onChange={e => iC('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCertModal(false); setEditCert(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveCert} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal الدورة */}
      {showTrainingModal && (
        <Modal title="إضافة دورة تدريبية" onClose={() => setShowTrainingModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الدورة *</label>
                <input value={trainingForm.name} onChange={e => iT('name', e.target.value)} className="input" placeholder="مكافحة الحرائق" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كود الدورة</label>
                <input value={trainingForm.code} onChange={e => iT('code', e.target.value)} className="input" dir="ltr" placeholder="HSE-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <select value={trainingForm.category} onChange={e => iT('category', e.target.value)} className="input">
                  <option value="safety">سلامة عامة</option>
                  <option value="fire">مكافحة الحرائق</option>
                  <option value="first_aid">إسعافات أولية</option>
                  <option value="environment">بيئة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مدة الدورة (يوم)</label>
                <input type="number" value={trainingForm.duration_days} onChange={e => iT('duration_days', Number(e.target.value))} className="input" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">صلاحية الشهادة (شهر)</label>
                <input type="number" value={trainingForm.validity_months} onChange={e => iT('validity_months', Number(e.target.value))} className="input" min={1} />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>السلامة ومكافحة الحرائق = 24 شهر</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المقدمة</label>
                <input value={trainingForm.provider} onChange={e => iT('provider', e.target.value)} className="input" placeholder="اسم الجهة" />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={trainingForm.is_mandatory} onChange={e => iT('is_mandatory', e.target.checked)} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>دورة إلزامية لجميع الموظفين</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={trainingForm.notes} onChange={e => iT('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTrainingModal(false)} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveTraining} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal تسجيل حضور */}
      {showRecordModal && (
        <Modal title="تسجيل حضور دورة تدريبية" onClose={() => setShowRecordModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدورة *</label>
              <select value={recordForm.training_id} onChange={e => iR('training_id', e.target.value)} className="input">
                <option value="">— اختر الدورة —</option>
                {trainings.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الموظف *</label>
              <select value={recordForm.employee_id} onChange={e => iR('employee_id', e.target.value)} className="input">
                <option value="">— اختر الموظف —</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.department}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التدريب *</label>
                <input type="date" value={recordForm.training_date} onChange={e => iR('training_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تاريخ الانتهاء
                  <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 4 }}>(يُحتسب تلقائياً)</span>
                </label>
                <input type="date" value={recordForm.expiry_date} onChange={e => iR('expiry_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">النتيجة</label>
                <select value={recordForm.result} onChange={e => iR('result', e.target.value)} className="input">
                  <option value="ناجح">ناجح</option>
                  <option value="راسب">راسب</option>
                  <option value="غائب">غائب</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدرجة</label>
                <input type="number" value={recordForm.score} onChange={e => iR('score', e.target.value)} className="input" placeholder="من 100" min={0} max={100} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الشهادة</label>
                <input value={recordForm.cert_number} onChange={e => iR('cert_number', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المقدمة</label>
                <input value={recordForm.provider} onChange={e => iR('provider', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={recordForm.notes} onChange={e => iR('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRecordModal(false)} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveRecord} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
