'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { MapPin, Clock, GraduationCap, Briefcase, CheckCircle2, Upload, X } from 'lucide-react'

export default function CareerForm({ job }: { job: any }) {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cvFile, setCvFile] = useState<{ name: string; data: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', nationality: '',
    gender: 'ذكر', education: '', experience_years: 0,
    current_job: '', expected_salary: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('حجم الملف يجب أن يكون أقل من 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setCvFile({ name: file.name, data: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.phone.trim()) return
    setSaving(true)

    const answersArr = (job.questions || []).map((q: string, i: number) => ({
      question: q, answer: answers[i] || ''
    }))

    await supabase.from('hr_applicants').insert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      ...form,
      experience_years: Number(form.experience_years),
      expected_salary: form.expected_salary ? Number(form.expected_salary) : null,
      cv_data: cvFile?.data || null,
      cv_name: cvFile?.name || null,
      answers: answersArr,
      status: 'جديد',
    })

    setSubmitted(true)
    setSaving(false)
  }

  const tenant = job.tenant

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0e3485, #1a56db)', fontFamily: 'IBM Plex Sans Arabic, sans-serif', direction: 'rtl', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '48px 40px', textAlign: 'center', maxWidth: '480px', width: '100%' }}>
          <div style={{ width: '72px', height: '72px', background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 style={{ width: '40px', height: '40px', color: '#0ea77b' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>تم استلام طلبك!</h2>
          <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
            شكراً <strong>{form.full_name}</strong>، تم استلام طلب توظيفك على وظيفة <strong>{job.title}</strong> بنجاح.
            سنتواصل معك قريباً على الجوال {form.phone}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'IBM Plex Sans Arabic, sans-serif', direction: 'rtl' }}>
      
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0e3485, #1a56db)', padding: '32px 20px', textAlign: 'center', color: 'white' }}>
        {tenant?.logo_url && (
          <img src={tenant.logo_url} alt="شعار الشركة" style={{ height: '50px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
        )}
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{job.title}</h1>
        <p style={{ opacity: 0.85, fontSize: '1rem' }}>{tenant?.name}</p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px', fontSize: '0.875rem', opacity: 0.9 }}>
          {job.location && <span>📍 {job.location}</span>}
          <span>⏰ {job.job_type}</span>
          {job.experience_years > 0 && <span>🎯 {job.experience_years}+ سنوات خبرة</span>}
          {job.deadline && <span>📅 آخر موعد: {new Date(job.deadline).toLocaleDateString('ar-EG')}</span>}
        </div>
        {job.show_salary && job.salary_min && (
          <div style={{ marginTop: '10px', fontSize: '1rem', fontWeight: 600 }}>
            💰 {job.salary_min.toLocaleString()} — {job.salary_max?.toLocaleString()} ر.س
          </div>
        )}
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>

        {/* تفاصيل الوظيفة */}
        {(job.description || job.requirements || job.benefits) && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
            {job.description && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>📋 وصف الوظيفة</h3>
                <p style={{ color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{job.description}</p>
              </div>
            )}
            {job.requirements && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>✅ المتطلبات</h3>
                <p style={{ color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{job.requirements}</p>
              </div>
            )}
            {job.benefits && (
              <div>
                <h3 style={{ fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>🎁 المزايا</h3>
                <p style={{ color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{job.benefits}</p>
              </div>
            )}
          </div>
        )}

        {/* نموذج التقديم */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '20px' }}>📝 نموذج التقديم</h2>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  الاسم الكامل <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl' }}
                  required placeholder="الاسم الكامل" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  رقم الجوال <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'ltr' }}
                  required placeholder="05xxxxxxxx" dir="ltr" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'ltr' }}
                  placeholder="email@example.com" dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>الجنسية</label>
                <input value={form.nationality} onChange={e => set('nationality', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl' }}
                  placeholder="سعودي / مصري / ..." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>الجنس</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl' }}>
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>سنوات الخبرة</label>
                <input type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  min="0" max="50" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>الراتب المتوقع (ر.س)</label>
                <input type="number" value={form.expected_salary} onChange={e => set('expected_salary', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  min="0" placeholder="0" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>المؤهل العلمي</label>
                <input value={form.education} onChange={e => set('education', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl' }}
                  placeholder="بكالوريوس هندسة..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>الوظيفة الحالية</label>
                <input value={form.current_job} onChange={e => set('current_job', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl' }}
                  placeholder="مهندس / فني / ..." />
              </div>
            </div>

            {/* السيرة الذاتية */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>السيرة الذاتية (PDF أو صورة — بحد أقصى 5MB)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleFile} />
              {cvFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 style={{ width: '18px', height: '18px', color: '#0ea77b', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.875rem', color: '#065f46' }}>{cvFile.name}</span>
                  <button type="button" onClick={() => setCvFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px' }}>
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', background: '#f9fafb', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}>
                  <Upload style={{ width: '18px', height: '18px' }} />
                  اضغط لرفع السيرة الذاتية
                </button>
              )}
            </div>

            {/* الأسئلة الإضافية */}
            {job.questions && job.questions.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>أسئلة إضافية</h3>
                {job.questions.map((q: string, i: number) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>{q}</label>
                    <textarea value={answers[i] || ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', minHeight: '70px', resize: 'none', fontFamily: 'inherit', direction: 'rtl', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={saving}
              style={{ width: '100%', padding: '14px', background: '#1a56db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit', marginTop: '8px', opacity: saving ? 0.8 : 1 }}>
              {saving ? <span style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> : null}
              {saving ? 'جارٍ الإرسال...' : '📨 تقديم الطلب'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
