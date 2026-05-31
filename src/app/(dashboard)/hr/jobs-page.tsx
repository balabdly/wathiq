'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Briefcase, Plus, Search, Pencil, Trash2, X, Save,
  Users, Eye, Copy, CheckCircle2, Clock, XCircle,
  MapPin, GraduationCap, DollarSign, Calendar, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'

type Job = {
  id: number
  tenant_id: string
  title: string
  department?: string
  location?: string
  job_type: string
  experience_years: number
  education?: string
  salary_min?: number
  salary_max?: number
  show_salary: boolean
  description?: string
  requirements?: string
  benefits?: string
  questions: any[]
  status: string
  deadline?: string
  created_at: string
  applicants_count?: number
}

type Applicant = {
  id: number
  job_id: number
  full_name: string
  email?: string
  phone: string
  nationality?: string
  gender?: string
  education?: string
  experience_years: number
  current_job?: string
  expected_salary?: number
  cv_data?: string
  cv_name?: string
  answers: any[]
  status: string
  notes?: string
  created_at: string
  job?: { title: string }
}

// ══════════════════════════════════════
// نافذة إنشاء/تعديل وظيفة
// ══════════════════════════════════════
function JobModal({ job, tenantId, onClose, onSave }: {
  job: Job | null
  tenantId: string
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<string[]>(job?.questions || [])
  const [newQ, setNewQ] = useState('')
  const [form, setForm] = useState({
    title:            job?.title            || '',
    department:       job?.department       || '',
    location:         job?.location         || '',
    job_type:         job?.job_type         || 'دوام كامل',
    experience_years: job?.experience_years ?? 0,
    education:        job?.education        || '',
    salary_min:       job?.salary_min       || '',
    salary_max:       job?.salary_max       || '',
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
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      tenant_id: tenantId,
      questions,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      experience_years: Number(form.experience_years),
    }
    if (job) {
      await supabase.from('hr_jobs').update(payload).eq('id', job.id)
    } else {
      await supabase.from('hr_jobs').insert(payload)
    }
    toast.success(job ? 'تم التعديل ✅' : 'تم نشر الوظيفة ✅')
    onSave()
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{job ? 'تعديل وظيفة' : 'نشر وظيفة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* المسمى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي <span className="text-red-500">*</span></label>
              <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: مهندس كهرباء" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="مثال: قسم المشاريع" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: الرياض" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الدوام</label>
                <select value={form.job_type} onChange={e => set('job_type', e.target.value)} className="select">
                  {['دوام كامل','دوام جزئي','عن بعد','مؤقت'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">سنوات الخبرة</label>
                <input type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)} className="input" min="0" max="30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">آخر موعد</label>
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المؤهل المطلوب</label>
              <input value={form.education} onChange={e => set('education', e.target.value)} className="input" placeholder="مثال: بكالوريوس هندسة كهربائية" />
            </div>

            {/* الراتب */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <label className="text-sm font-medium text-gray-700">نطاق الراتب</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text3)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.show_salary} onChange={e => set('show_salary', e.target.checked)} />
                  إظهار للمتقدمين
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">من (ر.س)</label>
                  <input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} className="input" min="0" placeholder="5000" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">إلى (ر.س)</label>
                  <input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} className="input" min="0" placeholder="10000" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">وصف الوظيفة</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }} placeholder="اكتب وصفاً تفصيلياً للوظيفة..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المتطلبات</label>
              <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="المهارات والشروط المطلوبة..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المزايا</label>
              <textarea value={form.benefits} onChange={e => set('benefits', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} placeholder="ما الذي تقدمه الشركة للموظف..." />
            </div>

            {/* أسئلة إضافية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">أسئلة إضافية للمتقدم</label>
              {questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ flex: 1, padding: '6px 10px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.8rem' }}>{q}</span>
                  <button type="button" onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                    style={{ color: '#c81e1e', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <X style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newQ} onChange={e => setNewQ(e.target.value)} className="input" placeholder="اكتب سؤالاً..." style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newQ.trim()) { setQuestions(qs => [...qs, newQ.trim()]); setNewQ('') } } }} />
                <button type="button" onClick={() => { if (newQ.trim()) { setQuestions(qs => [...qs, newQ.trim()]); setNewQ('') } }}
                  className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>إضافة</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">حالة الوظيفة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option value="نشط">نشط — يقبل طلبات</option>
                <option value="متوقف">متوقف — مؤقتاً</option>
                <option value="مغلق">مغلق — انتهى التقديم</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {job ? 'حفظ التعديلات' : 'نشر الوظيفة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// نافذة تفاصيل المتقدم
// ══════════════════════════════════════
function ApplicantModal({ applicant, onClose, onUpdate }: {
  applicant: Applicant
  onClose: () => void
  onUpdate: () => void
}) {
  const [status, setStatus] = useState(applicant.status)
  const [notes, setNotes] = useState(applicant.notes || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('hr_applicants').update({ status, notes }).eq('id', applicant.id)
    toast.success('تم الحفظ ✅')
    onUpdate()
    setSaving(false)
  }

  const STATUS_STEPS = ['جديد', 'قيد المراجعة', 'مقابلة', 'مقبول', 'مرفوض']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800">{applicant.full_name}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{applicant.job?.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* مسار الحالة */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {STATUS_STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setStatus(s)}
                  style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                    border: '2px solid', cursor: 'pointer',
                    borderColor: status === s ? (s === 'مقبول' ? '#0ea77b' : s === 'مرفوض' ? '#c81e1e' : 'var(--primary)') : 'var(--border)',
                    background: status === s ? (s === 'مقبول' ? '#ecfdf5' : s === 'مرفوض' ? '#fef2f2' : 'var(--primary-light)') : 'white',
                    color: status === s ? (s === 'مقبول' ? '#0ea77b' : s === 'مرفوض' ? '#c81e1e' : 'var(--primary)') : 'var(--text3)',
                  }}>{s}</button>
                {i < STATUS_STEPS.length - 1 && <span style={{ color: 'var(--border)', fontSize: '0.7rem' }}>←</span>}
              </div>
            ))}
          </div>

          {/* البيانات */}
          <div className="grid grid-cols-2 gap-3" style={{ fontSize: '0.875rem' }}>
            {[
              { label: 'الجوال', value: applicant.phone },
              { label: 'البريد', value: applicant.email || '—' },
              { label: 'الجنسية', value: applicant.nationality || '—' },
              { label: 'الجنس', value: applicant.gender || '—' },
              { label: 'المؤهل', value: applicant.education || '—' },
              { label: 'سنوات الخبرة', value: `${applicant.experience_years} سنة` },
              { label: 'الوظيفة الحالية', value: applicant.current_job || '—' },
              { label: 'الراتب المتوقع', value: applicant.expected_salary ? `${applicant.expected_salary.toLocaleString()} ر.س` : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{label}</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* الأسئلة والأجوبة */}
          {applicant.answers && applicant.answers.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.875rem' }}>إجابات الأسئلة الإضافية</div>
              {applicant.answers.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: '8px', padding: '10px', background: 'var(--bg2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '4px' }}>س: {a.question}</div>
                  <div style={{ fontSize: '0.875rem' }}>ج: {a.answer}</div>
                </div>
              ))}
            </div>
          )}

          {/* السيرة الذاتية */}
          {applicant.cv_data && (
            <a href={applicant.cv_data} download={applicant.cv_name || 'cv.pdf'}
              className="btn btn-ghost" style={{ border: '1px solid var(--border)', justifyContent: 'center', gap: '8px' }}>
              <GraduationCap style={{ width: '16px', height: '16px' }} />
              تحميل السيرة الذاتية — {applicant.cv_name}
            </a>
          )}

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات داخلية</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="ملاحظات للاستخدام الداخلي فقط..." />
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
            تاريخ التقديم: {formatDate(applicant.created_at)}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ الحالة
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function JobsPage() {
  const { tenant, currentUser } = useStore()
  const [view, setView] = useState<'jobs'|'applicants'>('jobs')
  const [jobs, setJobs] = useState<Job[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showJobModal, setJobModal] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [selectedJobFilter, setJobFilter] = useState('')
  const [copied, setCopied] = useState<number | null>(null)

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { loadJobs() }, [tenant?.id])
  useEffect(() => { if (view === 'applicants') loadApplicants() }, [view, tenant?.id])

  async function loadJobs() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('hr_jobs').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
    // نحسب عدد المتقدمين لكل وظيفة
    const jobsWithCount = await Promise.all((data || []).map(async job => {
      const { count } = await supabase.from('hr_applicants').select('*', { count: 'exact', head: true }).eq('job_id', job.id)
      return { ...job, applicants_count: count || 0 }
    }))
    setJobs(jobsWithCount)
    setLoading(false)
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
    if (!confirm('حذف هذه الوظيفة؟')) return
    await supabase.from('hr_jobs').delete().eq('id', id)
    setJobs(jobs => jobs.filter(j => j.id !== id))
    toast.success('تم الحذف')
  }

  function copyLink(jobId: number) {
    const url = `${window.location.origin}/careers/${jobId}`
    navigator.clipboard.writeText(url)
    setCopied(jobId)
    setTimeout(() => setCopied(null), 2000)
    toast.success('تم نسخ الرابط ✅')
  }

  const STATUS_COLOR: Record<string, string> = {
    'نشط': 'badge-green',
    'متوقف': 'badge-amber',
    'مغلق': 'badge-gray',
    'جديد': 'badge-blue',
    'قيد المراجعة': 'badge-amber',
    'مقابلة': 'badge-blue',
    'مقبول': 'badge-green',
    'مرفوض': 'badge-red',
  }

  const filteredApplicants = applicants.filter(a =>
    (!selectedJobFilter || a.job_id === Number(selectedJobFilter)) &&
    (!search || a.full_name.toLowerCase().includes(search.toLowerCase()) || a.phone.includes(search))
  )

  // إحصائيات
  const activeJobs = jobs.filter(j => j.status === 'نشط').length
  const totalApplicants = applicants.length
  const newApplicants = applicants.filter(a => a.status === 'جديد').length
  const acceptedApplicants = applicants.filter(a => a.status === 'مقبول').length

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          عروض الوظائف
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>نشر الوظائف واستقبال طلبات التوظيف</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'وظائف نشطة',     value: activeJobs,       color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي المتقدمين', value: totalApplicants,  color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'طلبات جديدة',     value: newApplicants,    color: newApplicants > 0 ? '#e6820a' : '#0ea77b', bg: newApplicants > 0 ? '#fffbeb' : '#ecfdf5' },
          { label: 'تم القبول',       value: acceptedApplicants, color: '#0ea77b', bg: '#ecfdf5' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        {[
          { id: 'jobs', label: 'الوظائف المنشورة', icon: <Briefcase style={{ width: '16px', height: '16px' }} /> },
          { id: 'applicants', label: `المتقدمون (${totalApplicants})`, icon: <Users style={{ width: '16px', height: '16px' }} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem',
              fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: view === t.id ? 'var(--primary)' : 'transparent',
              color: view === t.id ? 'white' : 'var(--text3)',
              boxShadow: view === t.id ? '0 2px 8px rgba(26,86,219,0.3)' : 'none',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ الوظائف ══ */}
      {view === 'jobs' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '220px' }} placeholder="بحث..." />
            </div>
            {isAdmin && (
              <button onClick={() => { setEditJob(null); setJobModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> نشر وظيفة جديدة
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Briefcase style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد وظائف منشورة بعد</p>
              {isAdmin && (
                <button onClick={() => { setEditJob(null); setJobModal(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  <Plus style={{ width: '16px', height: '16px' }} /> انشر أول وظيفة
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.filter(j => !search || j.title.toLowerCase().includes(search.toLowerCase())).map(job => (
                <div key={job.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{job.title}</h3>
                        <span className={`badge ${STATUS_COLOR[job.status]}`}>{job.status}</span>
                        {job.deadline && new Date(job.deadline) < new Date() && (
                          <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>انتهى الموعد</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text3)' }}>
                        {job.department && <span>📂 {job.department}</span>}
                        {job.location && <span><MapPin style={{ width: '12px', height: '12px', display: 'inline' }} /> {job.location}</span>}
                        <span>⏰ {job.job_type}</span>
                        {job.experience_years > 0 && <span>🎯 {job.experience_years}+ سنوات خبرة</span>}
                        {job.deadline && <span><Calendar style={{ width: '12px', height: '12px', display: 'inline' }} /> آخر موعد: {formatDate(job.deadline)}</span>}
                      </div>
                      {job.show_salary && job.salary_min && (
                        <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#0ea77b', fontWeight: 600 }}>
                          💰 {job.salary_min.toLocaleString()} — {job.salary_max?.toLocaleString()} ر.س
                        </div>
                      )}
                    </div>

                    {/* عدد المتقدمين */}
                    <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg2)', borderRadius: '10px', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{job.applicants_count}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>متقدم</div>
                    </div>
                  </div>

                  {/* أزرار */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--bg2)', flexWrap: 'wrap' }}>
                    <button onClick={() => copyLink(job.id)}
                      className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: '6px' }}>
                      {copied === job.id ? <CheckCircle2 style={{ width: '14px', height: '14px', color: '#0ea77b' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                      {copied === job.id ? 'تم النسخ!' : 'نسخ رابط التقديم'}
                    </button>
                    <a href={`/careers/${job.id}`} target="_blank"
                      className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: '6px' }}>
                      <ExternalLink style={{ width: '14px', height: '14px' }} /> معاينة
                    </a>
                    <button onClick={() => { setView('applicants'); setJobFilter(String(job.id)) }}
                      className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: '6px' }}>
                      <Users style={{ width: '14px', height: '14px' }} /> المتقدمون
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => { setEditJob(job); setJobModal(true) }} className="btn btn-ghost btn-sm">
                          <Pencil style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => deleteJob(job.id)} className="btn btn-ghost btn-sm" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ المتقدمون ══ */}
      {view === 'applicants' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '220px' }} placeholder="بحث بالاسم أو الجوال..." />
            </div>
            <select value={selectedJobFilter} onChange={e => setJobFilter(e.target.value)} className="select" style={{ width: 'auto' }}>
              <option value="">كل الوظائف</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {selectedJobFilter && (
              <button onClick={() => setJobFilter('')} className="btn btn-ghost btn-sm" style={{ color: 'var(--text3)' }}>مسح</button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا يوجد متقدمون بعد</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المتقدم</th>
                    <th>الوظيفة</th>
                    <th>الجوال</th>
                    <th>الخبرة</th>
                    <th>الراتب المتوقع</th>
                    <th>الحالة</th>
                    <th>تاريخ التقديم</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.full_name}</div>
                        {a.email && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{a.email}</div>}
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text2)' }}>{a.job?.title || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{a.phone}</td>
                      <td style={{ textAlign: 'center' }}>{a.experience_years} سنة</td>
                      <td style={{ color: '#0ea77b', fontWeight: 600 }}>
                        {a.expected_salary ? `${a.expected_salary.toLocaleString()} ر.س` : '—'}
                      </td>
                      <td><span className={`badge ${STATUS_COLOR[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{formatDate(a.created_at)}</td>
                      <td>
                        <button onClick={() => setSelectedApplicant(a)} className="btn btn-ghost btn-xs">
                          <Eye style={{ width: '14px', height: '14px' }} /> عرض
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

      {/* Modals */}
      {showJobModal && tenant && (
        <JobModal job={editJob} tenantId={tenant.id}
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
