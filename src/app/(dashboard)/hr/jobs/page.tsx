'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Briefcase, Plus, Search, Pencil, Trash2, X, Save,
  Users, Eye, Copy, CheckCircle2, Clock, XCircle,
  MapPin, GraduationCap, DollarSign, Calendar,
  Phone, Mail, Star, ChevronRight, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════════════
// Types
// ════════════════════════════════════
type Job = {
  id: number; tenant_id: string; title: string
  department?: string; location?: string; job_type: string
  experience_years: number; education?: string
  salary_min?: number; salary_max?: number; show_salary: boolean
  description?: string; requirements?: string; benefits?: string
  questions: any[]; status: string; deadline?: string
  created_at: string; applicants_count?: number
}

type Applicant = {
  id: number; tenant_id: string; job_id: number
  full_name: string; email?: string; phone: string
  nationality?: string; gender?: string; education?: string
  experience_years: number; current_job?: string
  expected_salary?: number; cv_data?: string; cv_name?: string
  answers: any[]; status: string; notes?: string
  interviewed_at?: string; created_at: string
  job?: { title: string }
}

const STATUS_COLOR: Record<string, string> = {
  'نشط':           'badge-green',
  'متوقف':         'badge-amber',
  'مغلق':          'badge-gray',
  'جديد':          'badge-blue',
  'قيد المراجعة':  'badge-amber',
  'مقابلة':        'badge-blue',
  'مقبول':         'badge-green',
  'مرفوض':         'badge-red',
}

const APPLICANT_STAGES = ['جديد', 'قيد المراجعة', 'مقابلة', 'مقبول', 'مرفوض']

// ════════════════════════════════════
// مودال إنشاء / تعديل وظيفة
// ════════════════════════════════════
function JobModal({ job, tenantId, departments, onClose, onSave }: {
  job: Job | null; tenantId: string
  departments: string[]; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving]       = useState(false)
  const [questions, setQuestions] = useState<string[]>(job?.questions || [])
  const [newQ, setNewQ]           = useState('')
  const [form, setForm] = useState({
    title:            job?.title            || '',
    department:       job?.department       || '',
    location:         job?.location         || '',
    job_type:         job?.job_type         || 'دوام كامل',
    experience_years: job?.experience_years ?? 0,
    education:        job?.education        || '',
    salary_min:       job?.salary_min       ? String(job.salary_min) : '',
    salary_max:       job?.salary_max       ? String(job.salary_max) : '',
    show_salary:      job?.show_salary      ?? false,
    description:      job?.description      || '',
    requirements:     job?.requirements     || '',
    benefits:         job?.benefits         || '',
    status:           job?.status           || 'نشط',
    deadline:         job?.deadline         || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('المسمى الوظيفي مطلوب'); return }
    setSaving(true)
    const payload = {
      ...form,
      tenant_id:        tenantId,
      questions,
      salary_min:       form.salary_min ? Number(form.salary_min) : null,
      salary_max:       form.salary_max ? Number(form.salary_max) : null,
      experience_years: Number(form.experience_years),
    }
    let error
    if (job) {
      const res = await supabase.from('hr_jobs').update(payload).eq('id', job.id).eq('tenant_id', tenantId)
      error = res.error
    } else {
      const res = await supabase.from('hr_jobs').insert(payload)
      error = res.error
    }
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success(job ? 'تم التعديل ✅' : 'تم نشر الوظيفة ✅')
    onSave(); setSaving(false)
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '660px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            {job ? 'تعديل وظيفة' : 'نشر وظيفة جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* المسمى */}
            <div>
              <label style={lbl}>المسمى الوظيفي <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                className="input" placeholder="مثال: مهندس كهرباء" required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>القسم</label>
                <select value={form.department} onChange={e => set('department', e.target.value)} className="select">
                  <option value="">— اختر القسم —</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="input" placeholder="مثال: الرياض" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>نوع الدوام</label>
                <select value={form.job_type} onChange={e => set('job_type', e.target.value)} className="select">
                  {['دوام كامل', 'دوام جزئي', 'عن بعد', 'مؤقت', 'تدريب'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>سنوات الخبرة</label>
                <input type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr" min="0" max="30" />
              </div>
              <div>
                <label style={lbl}>المؤهل العلمي</label>
                <select value={form.education} onChange={e => set('education', e.target.value)} className="select">
                  <option value="">— اختياري —</option>
                  {['دكتوراه', 'ماجستير', 'بكالوريوس', 'دبلوم', 'ثانوية', 'أي مؤهل'].map(e => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* الراتب */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
              <label style={{ ...lbl, marginBottom: '10px' }}>💰 نطاق الراتب (ريال)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ ...lbl, fontWeight: 400, color: 'var(--text3)' }}>من</label>
                  <input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" placeholder="3000" min="0" />
                </div>
                <div>
                  <label style={{ ...lbl, fontWeight: 400, color: 'var(--text3)' }}>إلى</label>
                  <input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" placeholder="8000" min="0" />
                </div>
                <div style={{ paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input type="checkbox" checked={form.show_salary} onChange={e => set('show_salary', e.target.checked)} />
                    إظهار للمتقدمين
                  </label>
                </div>
              </div>
            </div>

            {/* التواريخ والحالة */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>آخر موعد للتقديم</label>
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className="input" />
              </div>
              <div>
                <label style={lbl}>حالة الإعلان</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  <option value="نشط">🟢 نشط — يقبل طلبات</option>
                  <option value="متوقف">🟡 متوقف — مؤقتاً</option>
                  <option value="مغلق">⚫ مغلق — انتهى التقديم</option>
                </select>
              </div>
            </div>

            {/* الوصف */}
            <div>
              <label style={lbl}>وصف الوظيفة</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className="input" style={{ minHeight: '80px', resize: 'none' }}
                placeholder="نبذة عن الوظيفة ومهامها الرئيسية..." />
            </div>

            {/* المتطلبات */}
            <div>
              <label style={lbl}>المتطلبات والمؤهلات</label>
              <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="اكتب كل متطلب في سطر..." />
            </div>

            {/* المميزات */}
            <div>
              <label style={lbl}>المميزات والحوافز</label>
              <textarea value={form.benefits} onChange={e => set('benefits', e.target.value)}
                className="input" style={{ minHeight: '60px', resize: 'none' }}
                placeholder="مثال: تأمين صحي، بدل سكن، حوافز..." />
            </div>

            {/* أسئلة المتقدم */}
            <div>
              <label style={lbl}>أسئلة للمتقدم <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400 }}>(اختياري)</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {questions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.82rem' }}>
                    <span style={{ flex: 1 }}>{q}</span>
                    <button type="button" onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                      style={{ color: '#c81e1e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                      <X style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={newQ} onChange={e => setNewQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newQ.trim()) { setQuestions(qs => [...qs, newQ.trim()]); setNewQ('') } } }}
                    className="input" placeholder="اكتب سؤالاً..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => { if (newQ.trim()) { setQuestions(qs => [...qs, newQ.trim()]); setNewQ('') } }}
                    className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>+ إضافة</button>
                </div>
              </div>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Save style={{ width: '14px', height: '14px' }} />}
              {job ? 'حفظ التعديلات' : 'نشر الوظيفة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// مودال تفاصيل المتقدم
// ════════════════════════════════════
function ApplicantModal({ applicant, onClose, onUpdate }: {
  applicant: Applicant; onClose: () => void; onUpdate: () => void
}) {
  const [status, setStatus]   = useState(applicant.status)
  const [notes, setNotes]     = useState(applicant.notes || '')
  const [intDate, setIntDate] = useState(applicant.interviewed_at || '')
  const [saving, setSaving]   = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('hr_applicants').update({
      status, notes,
      interviewed_at: intDate || null,
    }).eq('id', applicant.id)
    toast.success('تم الحفظ ✅')
    onUpdate(); setSaving(false)
  }

  const stageColors: Record<string, { bg: string; color: string; border: string }> = {
    'جديد':           { bg: '#eff6ff', color: '#1a56db', border: '#bfdbfe' },
    'قيد المراجعة':   { bg: '#fffbeb', color: '#e6820a', border: '#fde68a' },
    'مقابلة':         { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
    'مقبول':          { bg: '#ecfdf5', color: '#0ea77b', border: '#bbf7d0' },
    'مرفوض':          { bg: '#fef2f2', color: '#c81e1e', border: '#fecaca' },
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{applicant.full_name}</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>
              {applicant.job?.title} · {applicant.nationality} · {applicant.gender}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Pipeline المراحل */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px' }}>مرحلة التوظيف</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {APPLICANT_STAGES.map(s => {
                const sc = stageColors[s] || { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                      border: `2px solid ${status === s ? sc.color : 'var(--border)'}`,
                      background: status === s ? sc.bg : 'white',
                      color: status === s ? sc.color : 'var(--text3)',
                      cursor: 'pointer' }}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* بيانات المتقدم */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--bg2)', borderRadius: '10px', padding: '14px' }}>
            {applicant.phone && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
                <Phone style={{ width: '14px', height: '14px', color: '#1a56db' }} />
                <span dir="ltr">{applicant.phone}</span>
              </div>
            )}
            {applicant.email && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
                <Mail style={{ width: '14px', height: '14px', color: '#1a56db' }} />
                <span>{applicant.email}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
              <GraduationCap style={{ width: '14px', height: '14px', color: '#0ea77b' }} />
              <span>{applicant.education || '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
              <Briefcase style={{ width: '14px', height: '14px', color: '#0ea77b' }} />
              <span>{applicant.experience_years} سنوات خبرة</span>
            </div>
            {applicant.current_job && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
                <Star style={{ width: '14px', height: '14px', color: '#e6820a' }} />
                <span>{applicant.current_job}</span>
              </div>
            )}
            {applicant.expected_salary && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
                <DollarSign style={{ width: '14px', height: '14px', color: '#e6820a' }} />
                <span>{applicant.expected_salary.toLocaleString()} ر.س</span>
              </div>
            )}
          </div>

          {/* تاريخ المقابلة */}
          {(status === 'مقابلة' || status === 'مقبول') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                📅 تاريخ المقابلة
              </label>
              <input type="date" value={intDate} onChange={e => setIntDate(e.target.value)} className="input" />
            </div>
          )}

          {/* الأسئلة والإجابات */}
          {applicant.answers?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text3)' }}>إجابات المتقدم</div>
              {applicant.answers.map((a: any, i: number) => (
                <div key={i} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', marginBottom: '6px', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{a.question}</div>
                  <div style={{ color: 'var(--text3)' }}>{a.answer}</div>
                </div>
              ))}
            </div>
          )}

          {/* السيرة الذاتية */}
          {applicant.cv_data && (
            <div>
              <button onClick={() => {
                const win = window.open('', '_blank')
                if (win) { win.document.write(`<pre style="font-family:Arial;padding:20px;direction:rtl">${applicant.cv_data}</pre>`) }
              }} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                📄 عرض السيرة الذاتية
              </button>
            </div>
          )}

          {/* الملاحظات */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>ملاحظات المقيّم</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }}
              placeholder="ملاحظات المقابلة، نقاط القوة والضعف..." />
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Save style={{ width: '14px', height: '14px' }} />}
            حفظ الحالة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════
export default function JobsPage() {
  const { tenant, currentUser } = useStore()
  const [view, setView]     = useState<'jobs' | 'applicants' | 'pipeline'>('jobs')
  const [jobs, setJobs]             = useState<Job[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [departments, setDepts]     = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [jobFilter, setJobFilter]   = useState('')
  const [showJobModal, setJobModal] = useState(false)
  const [editJob, setEditJob]       = useState<Job | null>(null)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [copied, setCopied]         = useState<number | null>(null)

  const isAdmin = ['مدير عام', 'مدير الموارد البشرية'].includes((currentUser?.role as string) || '')

  useEffect(() => { loadAll() }, [tenant?.id])
  useEffect(() => { if (view === 'applicants' || view === 'pipeline') loadApplicants() }, [view])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    // جلب الأقسام
    const { data: depts } = await supabase.from('hr_departments')
      .select('name').eq('tenant_id', tenant.id).order('name')
    setDepts((depts || []).map((d: any) => d.name))
    await loadJobs()
    setLoading(false)
  }

  async function loadJobs() {
    if (!tenant) return
    const { data } = await supabase.from('hr_jobs')
      .select('*').eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    // عدد المتقدمين
    const withCount = await Promise.all((data || []).map(async job => {
      const { count } = await supabase.from('hr_applicants')
        .select('*', { count: 'exact', head: true }).eq('job_id', job.id)
      return { ...job, applicants_count: count || 0 }
    }))
    setJobs(withCount)
  }

  async function loadApplicants() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('hr_applicants')
      .select('*, job:hr_jobs(title)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    setApplicants(data || [])
    setLoading(false)
  }

  async function deleteJob(id: number) {
    if (!confirm('حذف هذه الوظيفة وجميع طلباتها؟')) return
    await supabase.from('hr_applicants').delete().eq('job_id', id).eq('tenant_id', tenant?.id || '')
    await supabase.from('hr_jobs').delete().eq('id', id).eq('tenant_id', tenant?.id || '')
    setJobs(jobs => jobs.filter(j => j.id !== id))
    toast.success('تم الحذف')
  }

  function copyLink(jobId: number) {
    const url = `${window.location.origin}/careers/${jobId}`
    navigator.clipboard.writeText(url)
    setCopied(jobId)
    setTimeout(() => setCopied(null), 2000)
    toast.success('تم نسخ رابط التقديم ✅')
  }

  // KPIs
  const activeJobs    = jobs.filter(j => j.status === 'نشط').length
  const totalApps     = jobs.reduce((s, j) => s + (j.applicants_count || 0), 0)
  const newApps       = applicants.filter(a => a.status === 'جديد').length
  const acceptedApps  = applicants.filter(a => a.status === 'مقبول').length

  // فلترة
  const filteredJobs = jobs.filter(j => {
    const q = search.toLowerCase()
    return (!q || j.title.toLowerCase().includes(q) || (j.department || '').toLowerCase().includes(q)) &&
           (!statusFilter || j.status === statusFilter)
  })

  const filteredApplicants = applicants.filter(a => {
    const q = search.toLowerCase()
    return (!q || a.full_name.toLowerCase().includes(q) || (a.job?.title || '').toLowerCase().includes(q)) &&
           (!statusFilter || a.status === statusFilter) &&
           (!jobFilter || String(a.job_id) === jobFilter)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            التوظيف وعروض الوظائف
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            {jobs.length} وظيفة · {totalApps} متقدم
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditJob(null); setJobModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> نشر وظيفة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'وظائف نشطة',   value: activeJobs,   color: '#0ea77b', bg: '#ecfdf5', icon: '💼' },
          { label: 'إجمالي الطلبات', value: totalApps,   color: '#1a56db', bg: '#eff6ff', icon: '📋' },
          { label: 'طلبات جديدة',   value: newApps,      color: '#e6820a', bg: '#fffbeb', icon: '🆕' },
          { label: 'مقبولون',       value: acceptedApps, color: '#7c3aed', bg: '#f5f3ff', icon: '✅' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.icon} {kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* تبويبات العرض */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { id: 'jobs',       label: '💼 الوظائف' },
          { id: 'applicants', label: '👥 المتقدمون' },
          { id: 'pipeline',   label: '🔄 Pipeline' },
        ].map(t => (
          <button key={t.id} onClick={() => { setView(t.id as any); setSearch(''); setStatusFilter(''); setJobFilter('') }}
            style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s',
              background: view === t.id ? '#1a56db' : 'transparent',
              color: view === t.id ? 'white' : 'var(--text3)',
              boxShadow: view === t.id ? '0 2px 8px rgba(26,86,219,0.3)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* فلاتر وبحث */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={view === 'jobs' ? 'بحث بالمسمى...' : 'بحث باسم المتقدم...'}
            className="input" style={{ paddingRight: '32px', width: '220px' }} />
        </div>
        {view === 'jobs' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select" style={{ width: 'auto' }}>
            <option value="">كل الحالات</option>
            <option value="نشط">🟢 نشط</option>
            <option value="متوقف">🟡 متوقف</option>
            <option value="مغلق">⚫ مغلق</option>
          </select>
        )}
        {view === 'applicants' && (
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select" style={{ width: 'auto' }}>
              <option value="">كل المراحل</option>
              {APPLICANT_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={jobFilter} onChange={e => setJobFilter(e.target.value)} className="select" style={{ width: 'auto', minWidth: '160px' }}>
              <option value="">كل الوظائف</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ══ تاب: الوظائف ══ */}
      {view === 'jobs' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Briefcase style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد وظائف منشورة</p>
            {isAdmin && (
              <button onClick={() => { setEditJob(null); setJobModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> نشر أول وظيفة
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filteredJobs.map(job => (
              <div key={job.id} className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e' }}>{job.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {job.department && <span>🏢 {job.department}</span>}
                      {job.location   && <span><MapPin style={{ width: '11px', height: '11px', display: 'inline' }} /> {job.location}</span>}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_COLOR[job.status] || 'badge-gray'}`} style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                    {job.status}
                  </span>
                </div>

                {/* تفاصيل */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#f3f4f6', color: '#6b7280' }}>
                    💼 {job.job_type}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#f3f4f6', color: '#6b7280' }}>
                    <GraduationCap style={{ width: '11px', height: '11px', display: 'inline' }} /> {job.experience_years} سنوات
                  </span>
                  {job.show_salary && job.salary_min && (
                    <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#ecfdf5', color: '#0ea77b' }}>
                      💰 {job.salary_min.toLocaleString()}
                      {job.salary_max ? ` — ${job.salary_max.toLocaleString()}` : '+'} ر.س
                    </span>
                  )}
                  {job.deadline && (
                    <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#fef2f2', color: '#c81e1e' }}>
                      <Calendar style={{ width: '11px', height: '11px', display: 'inline' }} /> {formatDate(job.deadline)}
                    </span>
                  )}
                </div>

                {/* عدد المتقدمين */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => { setView('applicants'); setJobFilter(String(job.id)) }}>
                  <Users style={{ width: '15px', height: '15px', color: '#1a56db' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a56db' }}>
                    {job.applicants_count} متقدم
                  </span>
                  <ChevronRight style={{ width: '13px', height: '13px', color: '#1a56db', marginRight: 'auto' }} />
                </div>

                {/* الأزرار */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => copyLink(job.id)}
                      style={{ flex: 1, padding: '6px', borderRadius: '7px', border: '1px solid #bfdbfe', background: copied === job.id ? '#ecfdf5' : '#eff6ff', color: copied === job.id ? '#0ea77b' : '#1a56db', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      {copied === job.id ? <CheckCircle2 style={{ width: '13px', height: '13px' }} /> : <Copy style={{ width: '13px', height: '13px' }} />}
                      {copied === job.id ? 'تم النسخ' : 'نسخ الرابط'}
                    </button>
                    <button onClick={() => { setEditJob(job); setJobModal(true) }}
                      style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                      <Pencil style={{ width: '13px', height: '13px' }} />
                    </button>
                    <button onClick={() => deleteJob(job.id)}
                      style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', display: 'flex', alignItems: 'center' }}>
                      <Trash2 style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ══ تاب: المتقدمون ══ */}
      {view === 'applicants' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filteredApplicants.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <Users style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.3 }} />
              <div>لا توجد طلبات توظيف</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الاسم', 'الوظيفة', 'الجنسية', 'الخبرة', 'الراتب المتوقع', 'المرحلة', 'التاريخ', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => setSelectedApplicant(a)}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.full_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{a.job?.title || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem' }}>{a.nationality || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem' }}>{a.experience_years} سنوات</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#e6820a' }}>
                      {a.expected_salary ? a.expected_salary.toLocaleString() + ' ر.س' : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${STATUS_COLOR[a.status] || 'badge-gray'}`}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{formatDate(a.created_at)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button onClick={e => { e.stopPropagation(); setSelectedApplicant(a) }}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Eye style={{ width: '12px', height: '12px' }} /> عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ تاب: Pipeline ══ */}
      {view === 'pipeline' && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start' }}>
          {APPLICANT_STAGES.map(stage => {
            const stageApps = applicants.filter(a => a.status === stage)
            const colors: Record<string, { bg: string; color: string; border: string }> = {
              'جديد':          { bg: '#eff6ff', color: '#1a56db', border: '#bfdbfe' },
              'قيد المراجعة':  { bg: '#fffbeb', color: '#e6820a', border: '#fde68a' },
              'مقابلة':        { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
              'مقبول':         { bg: '#ecfdf5', color: '#0ea77b', border: '#bbf7d0' },
              'مرفوض':         { bg: '#fef2f2', color: '#c81e1e', border: '#fecaca' },
            }
            const sc = colors[stage] || { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
            return (
              <div key={stage} style={{ flexShrink: 0, width: '220px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '10px 10px 0 0', background: sc.bg, border: `1px solid ${sc.border}`, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: sc.color }}>{stage}</span>
                  <span style={{ background: sc.color, color: 'white', borderRadius: '20px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {stageApps.length}
                  </span>
                </div>
                <div style={{ minHeight: '200px', padding: '8px', background: sc.bg, border: `1px solid ${sc.border}`, borderTop: `3px solid ${sc.color}`, borderRadius: '0 0 10px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stageApps.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#d1d5db', fontSize: '0.78rem' }}>لا يوجد</div>
                  ) : (
                    stageApps.map(a => (
                      <div key={a.id}
                        onClick={() => setSelectedApplicant(a)}
                        style={{ background: 'white', borderRadius: '8px', padding: '10px', cursor: 'pointer', border: `1px solid ${sc.border}`, transition: 'box-shadow 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1a1a2e' }}>{a.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{a.job?.title}</div>
                        {a.experience_years > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '3px' }}>
                            {a.experience_years} سنوات خبرة
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showJobModal && tenant && (
        <JobModal job={editJob} tenantId={tenant.id} departments={departments}
          onClose={() => { setJobModal(false); setEditJob(null) }}
          onSave={() => { setJobModal(false); setEditJob(null); loadJobs() }} />
      )}
      {selectedApplicant && (
        <ApplicantModal applicant={selectedApplicant}
          onClose={() => setSelectedApplicant(null)}
          onUpdate={() => { loadApplicants(); setSelectedApplicant(null) }} />
      )}
    </div>
  )
}
