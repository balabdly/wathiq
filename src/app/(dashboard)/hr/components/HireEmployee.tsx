'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Save, User, Briefcase, DollarSign, Building2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { HREmployee, Department, JobTitle } from '../hr_types'
import { calcGOSI } from '../hr_utils'
import { hashPassword } from '@/lib/auth'

const WORK_LOCATIONS = ['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الأحساء','القطيف','حائل','تبوك','الجوف','نجران','عسير','جازان','الباحة']
const CONTRACT_TYPES = ['دوام كامل','دوام جزئي','مؤقت','موسمي']
const GENDERS       = ['ذكر','أنثى']
const MARITAL       = ['أعزب','متزوج','مطلق','أرمل']

// ── حقل إدخال ──
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '5px', color: 'var(--text)' }}>
        {label} {required && <span style={{ color: '#c81e1e' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ── قسم ──
function Section({ title, icon, color = '#1a56db', children }: { title: string; icon: React.ReactNode; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: color + '0f', borderBottom: `2px solid ${color}30`, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color }}>{icon}</span>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color }}>{title}</h3>
      </div>
      <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
        {children}
      </div>
    </div>
  )
}

export default function HireEmployee({ onSuccess }: { onSuccess: () => void }) {
  const { tenant } = useStore()
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers,    setManagers]    = useState<any[]>([])
  const [jobTitles,   setJobTitles]   = useState<JobTitle[]>([])

  const [form, setForm] = useState({
    first_name: '', father_name: '', grandfather_name: '', family_name: '',
    first_name_en: '', family_name_en: '',
    national_id: '', nationality: 'سعودي', nationality_text: '',
    birth_date: '', gender: 'ذكر', marital_status: 'أعزب',
    hire_date: '', contract_type: 'دوام كامل',
    job_title: '', department: '', work_location: '', direct_manager: '',
    basic_salary: '', housing_allow: '', transport_allow: '', other_allow: '',
    gosi_enrolled: true, gosi_pct: 10,
    bank_name: '', iban: '',
    iqama_number: '', iqama_expiry: '',
    passport_number: '', passport_expiry: '',
    notes: '',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!tenant) return
    // جلب الأقسام
    supabase.from('hr_departments').select('*').eq('tenant_id', tenant.id).then(({ data }) => setDepartments(data || []))
    // جلب المديرين
    supabase.from('employees').select('id, name, role').eq('tenant_id', tenant.id).eq('is_active', true).then(({ data }) => setManagers(data || []))
  }, [tenant?.id])

  async function handleDeptChange(deptName: string) {
    set('department', deptName)
    if (!tenant || !deptName) return
    const { data: jt } = await supabase.from('hr_job_titles').select('*').eq('tenant_id', tenant.id)
    setJobTitles((jt || []).filter((j: any) => !j.department_id || departments.find(d => d.name === deptName)?.id === j.department_id))
    const dept = departments.find(d => d.name === deptName)
    if (dept?.manager_id) set('direct_manager', String(dept.manager_id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    if (!form.first_name.trim())  { toast.error('أدخل الاسم الأول'); return }
    if (!form.father_name.trim()) { toast.error('أدخل اسم الأب'); return }
    if (!form.family_name.trim()) { toast.error('أدخل اسم العائلة'); return }
    if (!form.department)         { toast.error('اختر القسم'); return }
    if (!form.job_title)          { toast.error('اختر المسمى الوظيفي'); return }
    if (!form.hire_date)          { toast.error('أدخل تاريخ التعيين'); return }
    if (!form.national_id.trim()) { toast.error('أدخل رقم الهوية / الإقامة'); return }
    if (!form.birth_date)         { toast.error('أدخل تاريخ الميلاد'); return }
    if (!Number(form.basic_salary)) { toast.error('أدخل الراتب الأساسي'); return }
    if (!form.bank_name.trim())   { toast.error('أدخل اسم البنك'); return }
    if (!form.iban.trim())        { toast.error('أدخل رقم IBAN'); return }

    setSaving(true)
    try {
      const finalNationality = form.nationality === 'سعودي' ? 'سعودي' : (form.nationality_text.trim() || 'وافد')
      const fullName = [form.first_name, form.father_name, form.grandfather_name, form.family_name].filter(Boolean).join(' ')

      // ✅ توليد رقم الموظف مع استخدام head: false لتجنب الغموض في اختيار الدالة
      const { data: empNum, error: empNumError } = await supabase.rpc(
        'generate_employee_number',
        { p_tenant_id: tenant.id },
        { head: false }
      )
      if (empNumError || !empNum) {
        throw new Error('فشل توليد رقم الموظف: ' + (empNumError?.message || 'رقم غير صحيح'))
      }

      // إنشاء حساب دخول
      const { data: existingEmp } = await supabase.from('employees').select('id').eq('tenant_id', tenant.id).eq('name', fullName).eq('is_active', true).maybeSingle()
      let newEmp = existingEmp
      if (!existingEmp) {
        const tempUsername = `emp_${Date.now()}`
        const tempPassword = await hashPassword(crypto.randomUUID())
        const { data: createdEmp } = await supabase.from('employees').insert({
          tenant_id: tenant.id, name: fullName,
          role: form.job_title || 'موظف',
          username: tempUsername, password: tempPassword,
          permissions: [], is_active: true,
        }).select('id').single()
        newEmp = createdEmp
      }

      // إدراج في hr_employees مع حفظ الاسم الكامل
      const hrPayload: Record<string, any> = {
        tenant_id: tenant.id, 
        employee_id: newEmp?.id || null,
        employee_number: empNum,
        name: fullName, // ✅ إضافة الاسم الكامل
        first_name: form.first_name.trim(), 
        father_name: form.father_name.trim(),
        grandfather_name: form.grandfather_name.trim() || null, 
        family_name: form.family_name.trim(),
        first_name_en: form.first_name_en.trim() || null, 
        family_name_en: form.family_name_en.trim() || null,
        national_id: form.national_id.trim(), 
        nationality: finalNationality,
        birth_date: form.birth_date || null, 
        gender: form.gender, 
        marital_status: form.marital_status,
        hire_date: form.hire_date || null, 
        contract_type: form.contract_type,
        job_title: form.job_title, 
        department: form.department, 
        work_location: form.work_location || null,
        direct_manager: form.direct_manager && Number(form.direct_manager) > 0 ? Number(form.direct_manager) : null,
        basic_salary: Number(form.basic_salary) || 0,
        housing_allow: Number(form.housing_allow) || 0,
        transport_allow: Number(form.transport_allow) || 0,
        other_allow: Number(form.other_allow) || 0,
        gosi_enrolled: form.gosi_enrolled, 
        gosi_pct: form.gosi_pct,
        bank_name: form.bank_name.trim(), 
        iban: form.iban.trim(),
        iqama_number: form.iqama_number.trim() || null, 
        iqama_expiry: form.iqama_expiry || null,
        passport_number: form.passport_number.trim() || null, 
        passport_expiry: form.passport_expiry || null,
        notes: form.notes.trim() || null, 
        is_active: true,
      }
      Object.keys(hrPayload).forEach(k => { if (hrPayload[k] === undefined) delete hrPayload[k] })

      const { data: newHR, error } = await supabase.from('hr_employees').insert(hrPayload).select('id').single()
      if (error) throw error

      if (newEmp?.id && newHR?.id) {
        await supabase.from('employees').update({ hr_employee_id: newHR.id }).eq('id', newEmp.id)
      }

      setSaved(true)
      toast.success(`✅ تم تعيين الموظف ${fullName} برقم ${empNum}`)
      setTimeout(() => { setSaved(false); onSuccess() }, 2000)
    } catch (err: any) {
      toast.error('خطأ: ' + (err?.message || 'حدث خطأ'))
    } finally {
      setSaving(false)
    }
  }

  const isSaudi  = form.nationality === 'سعودي'
  const gosi     = calcGOSI(form.nationality, Number(form.basic_salary), Number(form.housing_allow), Number(form.transport_allow))
  const totalSal = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow)
  const netSal   = totalSal - (form.gosi_enrolled ? gosi.employeeDeduction : 0)

  if (saved) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
      <CheckCircle2 style={{ width: '64px', height: '64px', color: '#0ea77b' }} />
      <h2 style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1.2rem' }}>تم التعيين بنجاح!</h2>
      <p style={{ color: 'var(--text3)' }}>جاري الانتقال لقائمة الموظفين...</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ١ — البيانات الشخصية */}
      <Section title="البيانات الشخصية" icon={<User style={{ width: '18px', height: '18px' }} />} color="#1a56db">
        <Field label="الاسم الأول" required>
          <input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="input" placeholder="محمد" />
        </Field>
        <Field label="اسم الأب" required>
          <input value={form.father_name} onChange={e => set('father_name', e.target.value)} className="input" placeholder="عبدالله" />
        </Field>
        <Field label="اسم الجد">
          <input value={form.grandfather_name} onChange={e => set('grandfather_name', e.target.value)} className="input" placeholder="اختياري" />
        </Field>
        <Field label="اسم العائلة" required>
          <input value={form.family_name} onChange={e => set('family_name', e.target.value)} className="input" placeholder="العمري" />
        </Field>
        <Field label="الاسم الأول (إنجليزي)">
          <input value={form.first_name_en} onChange={e => set('first_name_en', e.target.value)} className="input" dir="ltr" placeholder="Mohammed" />
        </Field>
        <Field label="اسم العائلة (إنجليزي)">
          <input value={form.family_name_en} onChange={e => set('family_name_en', e.target.value)} className="input" dir="ltr" placeholder="Al-Omari" />
        </Field>
        <Field label="الجنسية" required>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['سعودي','وافد'].map(n => (
              <button key={n} type="button" onClick={() => set('nationality', n)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${form.nationality === n ? (n==='سعودي'?'#1a56db':'#e6820a') : '#e5e7eb'}`, background: form.nationality === n ? (n==='سعودي'?'#eff6ff':'#fffbeb') : 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s' }}>
                {n === 'سعودي' ? '🇸🇦 سعودي' : '🌍 وافد'}
              </button>
            ))}
          </div>
        </Field>
        {form.nationality !== 'سعودي' && (
          <Field label="الجنسية (تحديد)">
            <input value={form.nationality_text} onChange={e => set('nationality_text', e.target.value)} className="input" placeholder="مثال: مصري، يمني..." />
          </Field>
        )}
        <Field label="رقم الهوية / الإقامة" required>
          <input value={form.national_id} onChange={e => set('national_id', e.target.value)} className="input" dir="ltr" />
        </Field>
        <Field label="تاريخ الميلاد" required>
          <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" />
        </Field>
        <Field label="الجنس">
          <select value={form.gender} onChange={e => set('gender', e.target.value)} className="select">
            {GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="الحالة الاجتماعية">
          <select value={form.marital_status} onChange={e => set('marital_status', e.target.value)} className="select">
            {MARITAL.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </Section>

      {/* ٢ — البيانات الوظيفية */}
      <Section title="البيانات الوظيفية" icon={<Briefcase style={{ width: '18px', height: '18px' }} />} color="#7c3aed">
        <Field label="القسم" required>
          <select value={form.department} onChange={e => handleDeptChange(e.target.value)} className="select">
            <option value="">— اختر القسم —</option>
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="المسمى الوظيفي" required>
          <input value={form.job_title} onChange={e => set('job_title', e.target.value)} className="input" placeholder="مهندس كهرباء..." list="jobtitles-list" />
          <datalist id="jobtitles-list">
            {jobTitles.map(jt => <option key={jt.id} value={jt.name} />)}
          </datalist>
        </Field>
        <Field label="تاريخ التعيين" required>
          <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="input" />
        </Field>
        <Field label="نوع العقد">
          <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">
            {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="الموقع / المدينة" required>
          <select value={form.work_location} onChange={e => set('work_location', e.target.value)} className="select">
            <option value="">— اختر المدينة —</option>
            {WORK_LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="المدير المباشر">
          <select value={form.direct_manager} onChange={e => set('direct_manager', e.target.value)} className="select">
            <option value="">— اختر المدير —</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
          </select>
        </Field>
      </Section>

      {/* ٣ — الراتب والبدلات */}
      <Section title="الراتب والبدلات" icon={<DollarSign style={{ width: '18px', height: '18px' }} />} color="#0ea77b">
        <Field label="الراتب الأساسي" required>
          <input type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} className="input" min="0" />
        </Field>
        <Field label="بدل السكن">
          <input type="number" value={form.housing_allow} onChange={e => set('housing_allow', e.target.value)} className="input" min="0" />
        </Field>
        <Field label="بدل النقل">
          <input type="number" value={form.transport_allow} onChange={e => set('transport_allow', e.target.value)} className="input" min="0" />
        </Field>
        <Field label="بدلات أخرى">
          <input type="number" value={form.other_allow} onChange={e => set('other_allow', e.target.value)} className="input" min="0" />
        </Field>

        {/* ملخص الراتب */}
        <div style={{ gridColumn: '1/-1', background: '#f0fdf4', borderRadius: '10px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', border: '1px solid #bbf7d0' }}>
          {[
            { label: 'إجمالي الراتب',  value: totalSal.toLocaleString() + ' ر.س', color: '#0ea77b' },
            { label: 'اشتراك GOSI',    value: form.gosi_enrolled ? gosi.employeeDeduction.toLocaleString() + ' ر.س' : '—', color: '#e6820a' },
            { label: 'صافي الراتب',    value: netSal.toLocaleString() + ' ر.س', color: '#1a56db' },
            { label: 'مساهمة صاحب العمل', value: gosi.employerContribution.toLocaleString() + ' ر.س', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: s.color, fontSize: '0.95rem' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* GOSI */}
        <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
            <input type="checkbox" checked={form.gosi_enrolled} onChange={e => set('gosi_enrolled', e.target.checked)} />
            تسجيل في GOSI
          </label>
          {form.gosi_enrolled && (
            <span style={{ fontSize: '0.78rem', color: '#0ea77b', background: '#ecfdf5', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {isSaudi ? 'سعودي: 9.75% موظف + 11.75% صاحب عمل' : 'وافد: 0% موظف + 2% صاحب عمل'}
            </span>
          )}
        </div>
      </Section>

      {/* ٤ — البنك والوثائق */}
      <Section title="البنك والوثائق" icon={<Building2 style={{ width: '18px', height: '18px' }} />} color="#e6820a">
        <Field label="اسم البنك" required>
          <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" placeholder="الراجحي، الأهلي..." />
        </Field>
        <Field label="رقم IBAN" required>
          <input value={form.iban} onChange={e => set('iban', e.target.value)} className="input" dir="ltr" placeholder="SA..." />
        </Field>
        {form.nationality !== 'سعودي' && <>
          <Field label="رقم الإقامة">
            <input value={form.iqama_number} onChange={e => set('iqama_number', e.target.value)} className="input" dir="ltr" />
          </Field>
          <Field label="انتهاء الإقامة">
            <input type="date" value={form.iqama_expiry} onChange={e => set('iqama_expiry', e.target.value)} className="input" />
          </Field>
          <Field label="رقم الجواز">
            <input value={form.passport_number} onChange={e => set('passport_number', e.target.value)} className="input" dir="ltr" />
          </Field>
          <Field label="انتهاء الجواز">
            <input type="date" value={form.passport_expiry} onChange={e => set('passport_expiry', e.target.value)} className="input" />
          </Field>
        </>}
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="ملاحظات">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="أي ملاحظات إضافية" />
          </Field>
        </div>
      </Section>

      {/* زر الحفظ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '4px 0' }}>
        <button type="button" onClick={onSuccess} className="btn btn-ghost">إلغاء</button>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 32px', fontSize: '0.9rem' }}>
          <Save style={{ width: '16px', height: '16px' }} />
          {saving ? 'جاري الحفظ...' : '💾 حفظ وتعيين الموظف'}
        </button>
      </div>
    </form>
  )
}
