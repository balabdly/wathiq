'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Search, Pencil, X, Save, AlertTriangle, Trash2, LogOut, Building2, Briefcase, FileText, Printer, Download, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

type HREmployee = {
  id: number; tenant_id: string; employee_id?: number
  employee_number?: string
  name?: string                // الاسم المدمج من hr_employees
  first_name?: string; father_name?: string
  grandfather_name?: string; family_name?: string
  first_name_en?: string; family_name_en?: string
  national_id?: string; nationality?: string; birth_date?: string
  gender?: string; marital_status?: string; hire_date?: string
  contract_type?: string; job_title?: string; department?: string
  work_location?: string
  basic_salary?: number; housing_allow?: number; transport_allow?: number; other_allow?: number
  gosi_enrolled?: boolean; gosi_pct?: number
  iqama_number?: string; iqama_expiry?: string
  passport_number?: string; passport_expiry?: string
  bank_name?: string; iban?: string; notes?: string
  is_active: boolean; direct_manager?: number
}

type Department = {
  id: number; tenant_id: string; name: string; manager_id?: number
  manager?: { name: string; role: string }
}

type JobTitle = {
  id: number; tenant_id: string; name: string; department_id?: number
  department?: { name: string }
}

type Termination = {
  id: number; tenant_id: string; employee_id?: number; hr_employee_id: number
  termination_type: string; termination_date: string
  last_working_day: string; years_of_service: number
  gratuity_amount: number; notes?: string; status: string
  employee?: { name: string; job_title?: string }
}

// ── حساب مكافأة نهاية الخدمة حسب نظام العمل السعودي ──
// ══════════════════════════════════════════════════════════════════
// حساب مكافأة نهاية الخدمة — نظام العمل السعودي (المادة 84-88)
// ══════════════════════════════════════════════════════════════════

type GratuityResult = {
  years: number; months: number; days: number
  fullAmount: number       // المكافأة الكاملة قبل أي تخفيض
  finalAmount: number      // المبلغ النهائي بعد تطبيق نوع الإنهاء
  reductionPct: number     // نسبة التخفيض (0 = بدون تخفيض)
  reductionLabel: string   // سبب التخفيض
  breakdown: string[]      // تفاصيل الحساب
  entitlement: string      // وصف الاستحقاق
  isEntitled: boolean      // هل يستحق أصلاً
}

function calcGratuity(
  hireDateStr: string,
  lastDayStr: string,
  basicSalary: number,
  terminationType: string
): GratuityResult {

  const empty = (msg: string): GratuityResult => ({
    years: 0, months: 0, days: 0, fullAmount: 0, finalAmount: 0,
    reductionPct: 0, reductionLabel: '', breakdown: [], entitlement: msg, isEntitled: false
  })

  if (!hireDateStr || !lastDayStr || !basicSalary) return empty('بيانات غير مكتملة')

  const hire = new Date(hireDateStr)
  const last = new Date(lastDayStr)
  if (last <= hire) return empty('تاريخ الإنهاء قبل تاريخ المباشرة')

  // ── حساب مدة الخدمة بدقة ──
  let years = last.getFullYear() - hire.getFullYear()
  let months = last.getMonth() - hire.getMonth()
  let days = last.getDate() - hire.getDate()
  if (days < 0) { months--; days += 30 }
  if (months < 0) { years--; months += 12 }
  const totalMonths = years * 12 + months
  const dailySalary = basicSalary / 30

  // ── تحديد الاستحقاق حسب نوع الإنهاء ──
  // المادة 84: مكافأة كاملة في حالات: إنهاء صاحب العمل، انتهاء العقد، وفاة، عجز
  // المادة 85: مكافأة مخفّضة في حالة الاستقالة
  // المادة 80: لا مكافأة في حالة الفصل بسبب مخالفة جسيمة

  type TermRule = { fullRights: boolean; reduction: (y: number) => number; note: string; minMonths: number }

  const TERM_RULES: Record<string, TermRule> = {
    // ← مكافأة كاملة — صاحب العمل هو المنهي
    'إنهاء عقد من صاحب العمل': { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — المادة 84', minMonths: 1 },
    'انتهاء عقد':               { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة عند انتهاء مدة العقد — المادة 84', minMonths: 1 },
    'إنهاء باتفاق الطرفين':     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة باتفاق الطرفين — المادة 84', minMonths: 1 },
    'إحالة للتقاعد':            { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — إحالة للتقاعد', minMonths: 1 },
    'وفاة':                     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — تصرف لورثة الموظف', minMonths: 1 },
    'عجز كلي':                  { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — عجز كلي عن العمل المادة 84', minMonths: 1 },
    'إغلاق المنشأة':            { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — إغلاق المنشأة', minMonths: 1 },
    'تغيير جوهري في العقد':     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — رفض تغيير جوهري في العقد المادة 81', minMonths: 1 },

    // ← استقالة — مكافأة مخفّضة حسب المادة 85
    'استقالة': {
      fullRights: false,
      reduction: (y: number) => {
        if (y < 2)   return 0      // أقل من سنتين = لا شيء
        if (y < 5)   return 1/3    // 2-5 سنوات = ثلث
        if (y < 10)  return 2/3    // 5-10 سنوات = ثلثان
        return 1                    // 10 سنوات فأكثر = كاملة
      },
      note: 'استقالة — المادة 85 (تُخفَّض حسب سنوات الخدمة)',
      minMonths: 24,
    },

    // ← انتهاء عقد موسمي / جزئي
    'انتهاء عقد موسمي':   { fullRights: true, reduction: () => 1, note: 'مكافأة بنسبة أيام العمل الفعلية', minMonths: 1 },

    // ← فصل تأديبي — لا مكافأة (المادة 80)
    'فصل تأديبي':    { fullRights: false, reduction: () => 0, note: 'لا مكافأة — فصل بسبب مخالفة جسيمة المادة 80', minMonths: 0 },
    'فصل':           { fullRights: false, reduction: () => 0, note: 'لا مكافأة — فصل تأديبي المادة 80', minMonths: 0 },
  }

  const rule = TERM_RULES[terminationType] || { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة', minMonths: 1 }

  // ── حساب المكافأة الكاملة الأساسية ──
  const breakdown: string[] = []
  let fullAmount = 0

  if (totalMonths < rule.minMonths) {
    const msg = rule.minMonths >= 24
      ? `أقل من سنتين خدمة (${years} سنة ${months} شهر) — لا تستحق مكافأة عند الاستقالة`
      : `مدة الخدمة أقل من الحد الأدنى المطلوب`
    return empty(msg)
  }

  // أول 5 سنوات → نصف شهر لكل سنة
  const firstFive = Math.min(years, 5)
  if (firstFive > 0) {
    const a = Math.round(dailySalary * 15 * firstFive)
    fullAmount += a
    breakdown.push(`${firstFive} سنة × 15 يوم (نصف شهر) = ${a.toLocaleString()} ر.س`)
  }

  // بعد 5 سنوات → شهر كامل لكل سنة
  if (years > 5) {
    const extra = years - 5
    const a = Math.round(dailySalary * 30 * extra)
    fullAmount += a
    breakdown.push(`${extra} سنة × 30 يوم (شهر كامل) = ${a.toLocaleString()} ر.س`)
  }

  // الأشهر المتبقية بالنسبة
  if (months > 0) {
    const dayRate = years >= 5 ? 30 : 15
    const a = Math.round(dailySalary * dayRate * months / 12)
    fullAmount += a
    breakdown.push(`${months} شهر متبقي × نسبة = ${a.toLocaleString()} ر.س`)
  }

  // الأيام المتبقية بالنسبة
  if (days > 0 && years >= 1) {
    const dayRate = years >= 5 ? 30 : 15
    const a = Math.round(dailySalary * dayRate * days / 365)
    fullAmount += a
    if (a > 0) breakdown.push(`${days} يوم متبقي = ${a.toLocaleString()} ر.س`)
  }

  // ── تطبيق نسبة التخفيض حسب نوع الإنهاء ──
  const reductionFactor = rule.reduction(years)
  const finalAmount = Math.round(fullAmount * reductionFactor)
  const reductionPct = Math.round((1 - reductionFactor) * 100)

  // وصف الاستحقاق
  let entitlement = rule.note
  if (terminationType === 'استقالة' && reductionFactor < 1 && reductionFactor > 0) {
    entitlement = `استقالة — ${years >= 5 ? 'ثلثا' : 'ثلث'} المكافأة (${100 - reductionPct}%) — المادة 85`
  }

  return {
    years, months, days,
    fullAmount, finalAmount,
    reductionPct,
    reductionLabel: reductionPct > 0 ? `تخفيض ${reductionPct}% بسبب الاستقالة` : '',
    breakdown,
    entitlement,
    isEntitled: finalAmount > 0,
  }
}

function calcGOSI(nationality: string, basicSalary: number, housingAllow: number, transportAllow: number = 0) {
  const base = basicSalary + housingAllow + transportAllow
  if (nationality === 'سعودي') {
    return {
      employeeDeduction: Math.round(base * 0.0975),
      employerContribution: Math.round(base * 0.1175),
      employeePct: 9.75, employerPct: 11.75,
      breakdown: {
        employee: [
          { label: 'معاشات', pct: '9%', amount: Math.round(base * 0.09) },
          { label: 'ساند (تعطل)', pct: '0.75%', amount: Math.round(base * 0.0075) },
        ],
        employer: [
          { label: 'معاشات', pct: '9%', amount: Math.round(base * 0.09) },
          { label: 'ساند (تعطل)', pct: '1%', amount: Math.round(base * 0.01) },
          { label: 'أخطار مهنية', pct: '1.75%', amount: Math.round(base * 0.0175) },
        ],
      }
    }
  } else {
    return {
      employeeDeduction: 0, employerContribution: Math.round(base * 0.02),
      employeePct: 0, employerPct: 2,
      breakdown: {
        employee: [],
        employer: [{ label: 'أخطار مهنية', pct: '2%', amount: Math.round(base * 0.02) }],
      }
    }
  }
}

// ══════════════════════════════════════
// نافذة إضافة / تعديل موظف
// ══════════════════════════════════════
function HREmployeeModal({ emp, departments, managers, onClose, onSave }: {
  emp: HREmployee | null
  departments: Department[]
  managers: any[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'personal' | 'salary' | 'bank'>('personal')
  const [jobTitlesForDept, setJobTitlesForDept] = useState<JobTitle[]>([])

  const [form, setForm] = useState({
    emp_name:         emp?.name   || '',
    first_name:        emp?.first_name        || '',
    father_name:       emp?.father_name       || '',
    grandfather_name:  emp?.grandfather_name  || '',
    family_name:       emp?.family_name       || '',
    first_name_en:     emp?.first_name_en     || '',
    family_name_en:    emp?.family_name_en    || '',
    national_id:      emp?.national_id      || '',
    nationality:      emp?.nationality      || 'سعودي',
    nationality_text: (emp?.nationality && emp.nationality !== 'سعودي') ? emp.nationality : '',
    birth_date:       emp?.birth_date       || '',
    gender:           emp?.gender           || 'ذكر',
    marital_status:   emp?.marital_status   || 'أعزب',
    hire_date:        emp?.hire_date        || '',
    contract_type:    emp?.contract_type    || 'دوام كامل',
    work_location:    emp?.work_location    || '',
    _showCities:    false,
    department:       emp?.department       || '',
    job_title:        emp?.job_title        || '',
    direct_manager:   emp?.direct_manager   ? String(emp.direct_manager) : '',
    basic_salary:     emp?.basic_salary     ?? 0,
    housing_allow:    emp?.housing_allow    ?? 0,
    transport_allow:  emp?.transport_allow  ?? 0,
    other_allow:      emp?.other_allow      ?? 0,
    gosi_enrolled:    emp?.gosi_enrolled    ?? true,
    bank_name:        emp?.bank_name        || '',
    iban:             emp?.iban             || '',
    iqama_number:     emp?.iqama_number     || '',
    iqama_expiry:     emp?.iqama_expiry     || '',
    notes:            emp?.notes            || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  function buildFullName(first: string, father: string, grandfather: string, family: string): string {
    return [first, father, grandfather, family].map(s => s.trim()).filter(Boolean).join(' ')
  }

  const isSaudi = form.nationality === 'سعودي'
  const gosi = calcGOSI(form.nationality, Number(form.basic_salary), Number(form.housing_allow), Number(form.transport_allow))
const gosiBase = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow)
  const totalAllowances = Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow)
  const grossSalary = Number(form.basic_salary) + totalAllowances
  const netSalary = grossSalary - (form.gosi_enrolled ? gosi.employeeDeduction : 0)

  // عند تغيير القسم — جلب مسمياته وتعيين المدير تلقائياً
  async function handleDeptChange(deptName: string) {
    set('department', deptName)
    set('job_title', '')

    if (!deptName) {
      setJobTitlesForDept([])
      return
    }

    const dept = departments.find(d => d.name === deptName)
    if (dept) {
      // تعيين مدير القسم تلقائياً
      if (dept.manager_id) set('direct_manager', String(dept.manager_id))

      // جلب المسميات المرتبطة بهذا القسم
      const { data } = await supabase
        .from('hr_job_titles')
        .select('*')
        .eq('department_id', dept.id)
        .order('name')
      setJobTitlesForDept(data || [])
    } else {
      setJobTitlesForDept([])
    }
  }

  // عند فتح النافذة إذا كان هناك قسم محدد مسبقاً
  useEffect(() => {
    if (form.department) handleDeptChange(form.department)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { toast.error('أدخل الاسم الأول'); return }
    if (!form.work_location) { toast.error('اختر الموقع / المدينة'); return }
    if (!form.father_name.trim()) { toast.error('أدخل اسم الأب'); return }
    if (!form.family_name.trim()) { toast.error('أدخل اسم العائلة'); return }
    const fullName = buildFullName(form.first_name, form.father_name, form.grandfather_name, form.family_name)
    if (!form.department) { toast.error('اختر القسم'); return }
    if (!form.job_title) { toast.error('اختر المسمى الوظيفي'); return }
    if (!form.hire_date) { toast.error('أدخل تاريخ التعيين'); return }
    if (!form.national_id.trim()) { toast.error('أدخل رقم الهوية / الإقامة'); return }
    if (!form.birth_date) { toast.error('أدخل تاريخ الميلاد'); return }
    if (!Number(form.basic_salary)) { toast.error('أدخل الراتب الأساسي'); return }
    if (!form.bank_name.trim()) { toast.error('أدخل اسم البنك'); return }
    if (!form.iban.trim()) { toast.error('أدخل رقم IBAN'); return }

    setSaving(true)
    const finalNationality = isSaudi ? 'سعودي' : (form.nationality_text.trim() || 'وافد')
    await onSave({
      ...(emp ? { id: emp.id, employee_id: emp.employee_id } : {}),
      emp_name: fullName,
      first_name:       form.first_name.trim(),
      father_name:      form.father_name.trim(),
      grandfather_name: form.grandfather_name.trim() || null,
      family_name:      form.family_name.trim(),
      first_name_en:    form.first_name_en.trim() || null,
      family_name_en:   form.family_name_en.trim() || null,
      national_id: form.national_id,
      nationality: finalNationality,
      birth_date: form.birth_date,
      gender: form.gender,
      marital_status: form.marital_status,
      hire_date: form.hire_date,
      contract_type: form.contract_type,
      job_title: form.job_title,
      department: form.department,
      direct_manager: form.direct_manager ? Number(form.direct_manager) : null,
      basic_salary: Number(form.basic_salary),
      housing_allow: Number(form.housing_allow),
      transport_allow: Number(form.transport_allow),
      other_allow: Number(form.other_allow),
      gosi_enrolled: form.gosi_enrolled,
      gosi_pct: form.gosi_enrolled ? gosi.employeePct : 0,
      bank_name: form.bank_name,
      iban: form.iban,
      iqama_number: form.iqama_number,
      iqama_expiry: form.iqama_expiry || null,
      notes: form.notes,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{emp ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* تابات النافذة */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          {[
            { id: 'personal', label: '📋 البيانات الشخصية' },
            { id: 'salary',   label: '💰 الراتب والتأمينات' },
            { id: 'bank',     label: '🏦 البنك والإقامة' },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as any)}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--primary)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--text3)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* ── البيانات الشخصية ── */}
            {tab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* حقول الاسم الرباعي */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '12px' }}>
                    🔤 الاسم الرباعي بالعربي <span style={{ color: '#c81e1e' }}>*</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الأول <span className="text-red-500">*</span></label>
                      <input
                        value={form.first_name}
                        onChange={e => { set('first_name', e.target.value); set('emp_name', buildFullName(e.target.value, form.father_name, form.grandfather_name, form.family_name)) }}
                        className="input" placeholder="محمد" onKeyDown={noEnter}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الأب <span className="text-red-500">*</span></label>
                      <input
                        value={form.father_name}
                        onChange={e => { set('father_name', e.target.value); set('emp_name', buildFullName(form.first_name, e.target.value, form.grandfather_name, form.family_name)) }}
                        className="input" placeholder="عبدالله" onKeyDown={noEnter}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الجد</label>
                      <input
                        value={form.grandfather_name}
                        onChange={e => { set('grandfather_name', e.target.value); set('emp_name', buildFullName(form.first_name, form.father_name, e.target.value, form.family_name)) }}
                        className="input" placeholder="سالم" onKeyDown={noEnter}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العائلة <span className="text-red-500">*</span></label>
                      <input
                        value={form.family_name}
                        onChange={e => { set('family_name', e.target.value); set('emp_name', buildFullName(form.first_name, form.father_name, form.grandfather_name, e.target.value)) }}
                        className="input" placeholder="الغامدي" onKeyDown={noEnter}
                      />
                    </div>
                  </div>

                  {/* معاينة الاسم الكامل */}
                  {form.emp_name && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>الاسم الكامل: </span>
                      <span style={{ fontWeight: 700 }}>{form.emp_name}</span>
                    </div>
                  )}

                  {/* الاسم بالإنجليزي */}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: '14px', paddingTop: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '10px' }}>
                      🔡 الاسم بالإنجليزي (اختياري)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                        <input value={form.first_name_en} onChange={e => set('first_name_en', e.target.value)}
                          className="input" placeholder="Mohammed" dir="ltr" onKeyDown={noEnter} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Family Name</label>
                        <input value={form.family_name_en} onChange={e => set('family_name_en', e.target.value)}
                          className="input" placeholder="Al-Ghamdi" dir="ltr" onKeyDown={noEnter} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* القسم أولاً */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم <span className="text-red-500">*</span></label>
                  <select value={form.department} onChange={e => handleDeptChange(e.target.value)} className="select">
                    <option value="">— اختر القسم —</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                {/* المسمى الوظيفي */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي <span className="text-red-500">*</span></label>
                  <select value={form.job_title} onChange={e => set('job_title', e.target.value)} className="select" disabled={!form.department}>
                    <option value="">{form.department ? '— اختر المسمى —' : '— اختر القسم أولاً —'}</option>
                    {jobTitlesForDept.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  {form.department && jobTitlesForDept.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#e6820a', marginTop: '4px' }}>
                      ⚠️ لا توجد مسميات لهذا القسم — أضف من تاب المسميات الوظيفية
                    </p>
                  )}
                </div>

                {/* المدير المباشر */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    المدير المباشر
                    {form.direct_manager && (
                      <span style={{ fontSize: '0.72rem', color: '#0ea77b', marginRight: '6px' }}>
                        ✓ مُعيَّن تلقائياً من مدير القسم
                      </span>
                    )}
                  </label>
                  <select value={form.direct_manager} onChange={e => set('direct_manager', e.target.value)} className="select">
                    <option value="">— بدون مدير مباشر —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                  </select>
                </div>

                {/* الجنسية */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الجنسية <span className="text-red-500">*</span></label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => { set('nationality', 'سعودي'); set('nationality_text', '') }}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.9rem',
                        borderColor: isSaudi ? '#1a56db' : 'var(--border)',
                        background: isSaudi ? '#eff6ff' : 'white',
                        color: isSaudi ? '#1a56db' : 'var(--text3)',
                      }}>
                      🇸🇦 سعودي
                    </button>
                    <button type="button" onClick={() => set('nationality', 'وافد')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.9rem',
                        borderColor: !isSaudi ? '#e6820a' : 'var(--border)',
                        background: !isSaudi ? '#fffbeb' : 'white',
                        color: !isSaudi ? '#e6820a' : 'var(--text3)',
                      }}>
                      🌍 وافد (غير سعودي)
                    </button>
                  </div>
                  {!isSaudi && (
                    <input
                      value={form.nationality_text}
                      onChange={e => set('nationality_text', e.target.value)}
                      className="input" style={{ marginTop: '8px' }}
                      placeholder="اكتب الجنسية (مثال: مصري، يمني...)"
                      onKeyDown={noEnter}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهوية / الإقامة <span className="text-red-500">*</span></label>
                    <input value={form.national_id} onChange={e => set('national_id', e.target.value)} className="input" dir="ltr" placeholder={isSaudi ? '1XXXXXXXXX' : '2XXXXXXXXX'} onKeyDown={noEnter} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الميلاد <span className="text-red-500">*</span></label>
                    <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الجنس <span className="text-red-500">*</span></label>
                    <select value={form.gender} onChange={e => set('gender', e.target.value)} className="select">
                      <option value="ذكر">ذكر</option>
                      <option value="أنثى">أنثى</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة الاجتماعية <span className="text-red-500">*</span></label>
                    <select value={form.marital_status} onChange={e => set('marital_status', e.target.value)} className="select">
                      {['أعزب', 'متزوج', 'مطلق', 'أرمل'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التعيين <span className="text-red-500">*</span></label>
                    <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع العقد <span className="text-red-500">*</span></label>
                    <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">
                      {['دوام كامل', 'دوام جزئي', 'مؤقت', 'مياومة'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* الموقع — إلزامي مع نص تنبؤي */}
                <div style={{ position: 'relative' }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    الموقع / المدينة <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.work_location}
                    onChange={e => { set('work_location', e.target.value); set('_showCities', true) }}
                    onBlur={() => setTimeout(() => set('_showCities', false), 150)}
                    onFocus={() => set('_showCities', true)}
                    className="input"
                    placeholder="اكتب اسم المدينة..."
                    onKeyDown={noEnter}
                    autoComplete="off"
                    required
                  />
                  {form._showCities && form.work_location && (() => {
                    const CITIES = ['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الظهران','الأحساء','القطيف','تبوك','أبها','خميس مشيط','نجران','جازان','حائل','بريدة','القصيم','عرعر','سكاكا','الطائف','ينبع','الجبيل','رأس تنورة','بيشة','الباحة','وادي الدواسر','الخرج','المجمعة','شقراء','الزلفي','رفحاء','طريف','الوجه','ضباء','تيماء','العقيق','بيشة','المخواة','الليث','القنفذة','رابغ','الجموم','عفيف','الدوادمي','المدينة المنورة','البكيرية','الرس','عنيزة','الدرعية','الخبراء','المذنب']
                    const filtered = CITIES.filter(c => c.includes(form.work_location))
                    if (filtered.length === 0) return null
                    return (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 100,
                        background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {filtered.map(city => (
                          <div key={city}
                            onMouseDown={() => { set('work_location', city); set('_showCities', false) }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: '0.875rem',
                              borderBottom: '1px solid var(--bg2)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {city}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

              </div>
            )}

            {/* ── الراتب والتأمينات ── */}
            {tab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الراتب الأساسي <span className="text-red-500">*</span></label>
                    <input type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} className="input" min="0" onKeyDown={noEnter} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدل السكن</label>
                    <input type="number" value={form.housing_allow} onChange={e => set('housing_allow', e.target.value)} className="input" min="0" onKeyDown={noEnter} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدل النقل</label>
                    <input type="number" value={form.transport_allow} onChange={e => set('transport_allow', e.target.value)} className="input" min="0" onKeyDown={noEnter} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدلات أخرى</label>
                    <input type="number" value={form.other_allow} onChange={e => set('other_allow', e.target.value)} className="input" min="0" onKeyDown={noEnter} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg2)', borderRadius: '10px' }}>
                  <input type="checkbox" checked={form.gosi_enrolled} onChange={e => set('gosi_enrolled', e.target.checked)} className="w-4 h-4" id="gosi" />
                  <label htmlFor="gosi" className="text-sm font-medium text-gray-700">مسجل في التأمينات الاجتماعية (GOSI)</label>
                </div>

                {form.gosi_enrolled && Number(form.basic_salary) > 0 && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 14px', background: '#1a56db', color: 'white', fontWeight: 700, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>🧮 حساب GOSI التفصيلي</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>وعاء: {gosiBase.toLocaleString()} ر.س</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      <div style={{ padding: '12px 14px', borderLeft: '1px solid var(--border)', background: '#fef2f2' }}>
                        <div style={{ fontWeight: 700, color: '#c81e1e', fontSize: '0.8rem', marginBottom: '8px' }}>خصم الموظف — {gosi.employeePct}%</div>
                        {gosi.breakdown.employee.length > 0 ? gosi.breakdown.employee.map((b, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span>{b.label} ({b.pct})</span><span style={{ fontWeight: 600 }}>{b.amount.toLocaleString()} ر.س</span>
                          </div>
                        )) : <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>لا يوجد خصم على الموظف</div>}
                        <div style={{ borderTop: '1px solid #fca5a5', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#c81e1e' }}>
                          <span>الإجمالي</span><span>{gosi.employeeDeduction.toLocaleString()} ر.س</span>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', background: '#fffbeb' }}>
                        <div style={{ fontWeight: 700, color: '#e6820a', fontSize: '0.8rem', marginBottom: '8px' }}>حصة صاحب العمل — {gosi.employerPct}%</div>
                        {gosi.breakdown.employer.map((b, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span>{b.label} ({b.pct})</span><span style={{ fontWeight: 600 }}>{b.amount.toLocaleString()} ر.س</span>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px solid #fcd34d', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#e6820a' }}>
                          <span>الإجمالي</span><span>{gosi.employerContribution.toLocaleString()} ر.س</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--primary-light)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem', marginBottom: '10px' }}>📊 ملخص الراتب</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الراتب الأساسي</span><span style={{ fontWeight: 600 }}>{Number(form.basic_salary).toLocaleString()} ر.س</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>البدلات</span><span style={{ fontWeight: 600 }}>{totalAllowances.toLocaleString()} ر.س</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الإجمالي</span><span style={{ fontWeight: 600, color: 'var(--primary)' }}>{grossSalary.toLocaleString()} ر.س</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>خصم GOSI</span><span style={{ fontWeight: 600, color: '#c81e1e' }}>{(form.gosi_enrolled ? gosi.employeeDeduction : 0).toLocaleString()} ر.س</span></div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(26,86,219,0.2)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>صافي الراتب</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0ea77b' }}>{netSalary.toLocaleString()} ر.س</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── البنك والإقامة ── */}
            {tab === 'bank' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم البنك <span className="text-red-500">*</span></label>
                    <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" placeholder="مثال: الراجحي، الأهلي" onKeyDown={noEnter} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN <span className="text-red-500">*</span></label>
                    <input value={form.iban} onChange={e => set('iban', e.target.value)} className="input" dir="ltr" placeholder="SA..." onKeyDown={noEnter} />
                  </div>
                </div>
                {!isSaudi && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الإقامة</label>
                      <input value={form.iqama_number} onChange={e => set('iqama_number', e.target.value)} className="input" dir="ltr" placeholder="2XXXXXXXXX" onKeyDown={noEnter} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">انتهاء الإقامة</label>
                      <input type="date" value={form.iqama_expiry} onChange={e => set('iqama_expiry', e.target.value)} className="input" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }} />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save className="w-4 h-4" />}
              حفظ الموظف
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// تاب الأقسام
// ══════════════════════════════════════
function DepartmentsTab({ tenantId, managers, onUpdate }: {
  tenantId: string
  managers: any[]
  onUpdate?: () => void
}) {
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', manager_id: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hr_departments')
      .select('*, manager:employees(name, role)')
      .eq('tenant_id', tenantId)
      .order('name')
    setDepts(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('أدخل اسم القسم'); return }
    if (!form.manager_id) { toast.error('اختر مدير القسم'); return }
    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      manager_id: Number(form.manager_id),
    }
    if (editId) {
      await supabase.from('hr_departments').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_departments').insert(payload)
    }
    setForm({ name: '', manager_id: '' })
    setEditId(null)
    await load()
    onUpdate?.()
    toast.success('تم الحفظ ✅')
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا القسم؟ سيتأثر الموظفون المرتبطون به')) return
    await supabase.from('hr_departments').delete().eq('id', id)
    setDepts(d => d.filter(x => x.id !== id))
    onUpdate?.()
    toast.success('تم الحذف')
  }

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
          {editId ? '✏️ تعديل القسم' : '➕ إضافة قسم جديد'}
        </div>
        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '10px' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم القسم <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="مثال: قسم المشاريع"
              onKeyDown={noEnter}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">مدير القسم <span className="text-red-500">*</span></label>
            <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="select">
              <option value="">— اختر المدير —</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={save} className="btn btn-primary btn-sm">
            <Save style={{ width: '14px', height: '14px' }} />
            {editId ? 'حفظ التعديل' : 'إضافة القسم'}
          </button>
          {editId && (
            <button onClick={() => { setForm({ name: '', manager_id: '' }); setEditId(null) }} className="btn btn-ghost btn-sm">
              إلغاء
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : depts.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Building2 style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 10px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد أقسام بعد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {depts.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: i < depts.length - 1 ? '1px solid var(--bg2)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', color: '#e6820a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {d.manager
                      ? `👤 ${d.manager.name} — ${d.manager.role}`
                      : <span style={{ color: '#c81e1e' }}>⚠️ لا يوجد مدير</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { setForm({ name: d.name, manager_id: d.manager_id ? String(d.manager_id) : '' }); setEditId(d.id) }}
                  className="btn btn-ghost btn-xs">
                  <Pencil style={{ width: '14px', height: '14px' }} />
                </button>
                <button onClick={() => remove(d.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// تاب المسميات الوظيفية
// ══════════════════════════════════════
function JobTitlesTab({ tenantId }: { tenantId: string }) {
  const [titles, setTitles] = useState<JobTitle[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', department_id: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [tRes, dRes] = await Promise.all([
      supabase.from('hr_job_titles').select('*, department:hr_departments(name)').eq('tenant_id', tenantId).order('name'),
      supabase.from('hr_departments').select('id, name').eq('tenant_id', tenantId).order('name'),
    ])
    setTitles((tRes.data || []) as JobTitle[])
    setDepts((dRes.data || []) as Department[])
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('أدخل اسم المسمى الوظيفي'); return }
    if (!form.department_id) { toast.error('اختر القسم'); return }
    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      department_id: Number(form.department_id),
    }
    if (editId) {
      await supabase.from('hr_job_titles').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_job_titles').insert(payload)
    }
    setForm({ name: '', department_id: '' })
    setEditId(null)
    await load()
    toast.success('تم الحفظ ✅')
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا المسمى؟')) return
    await supabase.from('hr_job_titles').delete().eq('id', id)
    setTitles(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const grouped = depts.map(d => ({
    dept: d,
    titles: titles.filter(t => t.department_id === d.id),
  })).filter(g => g.titles.length > 0)

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
          {editId ? '✏️ تعديل المسمى' : '➕ إضافة مسمى وظيفي'}
        </div>
        {depts.length === 0 ? (
          <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.875rem', color: '#e6820a' }}>
            ⚠️ يجب إضافة أقسام أولاً من تاب الأقسام
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم <span className="text-red-500">*</span></label>
                <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="select">
                  <option value="">— اختر القسم —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المسمى الوظيفي <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="مثال: مهندس كهرباء"
                  onKeyDown={noEnter}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} className="btn btn-primary btn-sm">
                <Save style={{ width: '14px', height: '14px' }} />
                {editId ? 'حفظ التعديل' : 'إضافة المسمى'}
              </button>
              {editId && (
                <button onClick={() => { setForm({ name: '', department_id: '' }); setEditId(null) }} className="btn btn-ghost btn-sm">
                  إلغاء
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : titles.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Briefcase style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 10px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد مسميات وظيفية بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => (
            <div key={g.dept.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 style={{ width: '14px', height: '14px', color: '#e6820a' }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{g.dept.name}</span>
                <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{g.titles.length} مسمى</span>
              </div>
              {g.titles.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: i < g.titles.length - 1 ? '1px solid var(--bg2)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase style={{ width: '12px', height: '12px' }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => { setForm({ name: t.name, department_id: t.department_id ? String(t.department_id) : '' }); setEditId(t.id) }}
                      className="btn btn-ghost btn-xs">
                      <Pencil style={{ width: '14px', height: '14px' }} />
                    </button>
                    <button onClick={() => remove(t.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// تاب إنهاء الخدمة
// ══════════════════════════════════════
function TerminationTab({ tenantId, hrEmployees }: { tenantId: string; hrEmployees: HREmployee[] }) {
  const [terminations, setTerminations] = useState<Termination[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [form, setForm] = useState({
    hr_employee_id: '',
    termination_type: 'استقالة',
    termination_date: '',
    last_working_day: '',
    notes: '',
    status: 'نهائي',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const selectedHR = hrEmployees.find(e => e.id === Number(form.hr_employee_id))
  const gratuity = selectedHR && form.last_working_day
    ? calcGratuity(selectedHR.hire_date || '', form.last_working_day, Number(selectedHR.basic_salary || 0), form.termination_type)
    : null

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('hr_terminations')
      .select('*, employee:hr_employees!hr_terminations_hr_employee_id_fkey(name, job_title)')
      .eq('tenant_id', tenantId)
      .order('termination_date', { ascending: false })
    setTerminations(data || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ hr_employee_id: '', termination_type: 'استقالة', termination_date: '', last_working_day: '', notes: '', status: 'نهائي' })
    setEditId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.hr_employee_id) { toast.error('اختر الموظف'); return }
    if (!form.termination_date) { toast.error('أدخل تاريخ الإنهاء'); return }
    if (!form.last_working_day) { toast.error('أدخل آخر يوم عمل'); return }
    if (!selectedHR) return

    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      employee_id: selectedHR.employee_id,
      hr_employee_id: selectedHR.id,
      termination_type: form.termination_type,
      termination_date: form.termination_date,
      last_working_day: form.last_working_day,
      years_of_service: gratuity ? gratuity.years + (gratuity.months / 12) : 0,
      gratuity_amount: gratuity?.finalAmount || 0,
      notes: form.notes || null,
      status: form.status,
    }

    if (editId) {
      await supabase.from('hr_terminations').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_terminations').insert(payload)
      // تعطيل الموظف تلقائياً
      await supabase.from('hr_employees').update({ is_active: false }).eq('id', selectedHR.id)
      await supabase.from('employees').update({ is_active: false }).eq('id', selectedHR.employee_id)
    }

    await loadData()
    resetForm()
    setSaving(false)
    toast.success('تم حفظ إنهاء الخدمة ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السجل؟')) return
    await supabase.from('hr_terminations').delete().eq('id', id)
    setTerminations(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const TYPES = [
    // ← مكافأة كاملة
    { value: 'إنهاء عقد من صاحب العمل', icon: '📋', color: '#c81e1e',  group: 'كاملة' },
    { value: 'انتهاء عقد',              icon: '📅', color: '#1a56db',  group: 'كاملة' },
    { value: 'إنهاء باتفاق الطرفين',    icon: '🤝', color: '#0ea77b',  group: 'كاملة' },
    { value: 'إحالة للتقاعد',           icon: '🎖️', color: '#0ea77b',  group: 'كاملة' },
    { value: 'وفاة',                    icon: '🖤', color: '#374151',  group: 'كاملة' },
    { value: 'عجز كلي',                 icon: '🏥', color: '#6b7280',  group: 'كاملة' },
    { value: 'إغلاق المنشأة',           icon: '🏢', color: '#e6820a',  group: 'كاملة' },
    { value: 'تغيير جوهري في العقد',    icon: '📝', color: '#e6820a',  group: 'كاملة' },
    // ← مكافأة مخفّضة
    { value: 'استقالة',                 icon: '🚪', color: '#e6820a',  group: 'مخفّضة' },
    // ← لا مكافأة
    { value: 'فصل تأديبي',             icon: '⛔', color: '#c81e1e',  group: 'لا مكافأة' },
    { value: 'فصل',                    icon: '⚠️', color: '#c81e1e',  group: 'لا مكافأة' },
  ]

  const TYPE_COLOR: Record<string, string> = {
    'إنهاء عقد من صاحب العمل': 'badge-red',
    'انتهاء عقد': 'badge-blue',
    'إنهاء باتفاق الطرفين': 'badge-green',
    'إحالة للتقاعد': 'badge-green',
    'وفاة': 'badge-gray',
    'عجز كلي': 'badge-gray',
    'إغلاق المنشأة': 'badge-amber',
    'تغيير جوهري في العقد': 'badge-amber',
    'استقالة': 'badge-amber',
    'فصل تأديبي': 'badge-red',
    'فصل': 'badge-red',
  }

  return (
    <div className="space-y-4">

      {/* زر إضافة */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل إنهاء خدمة
          </button>
        </div>
      )}

      {/* ── نموذج الإضافة ── */}
      {showForm && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', color: 'var(--text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            {editId ? 'تعديل سجل إنهاء الخدمة' : 'تسجيل إنهاء خدمة جديد'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

            {/* الموظف */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.hr_employee_id} onChange={e => set('hr_employee_id', e.target.value)} className="select">
                <option value="">— اختر الموظف —</option>
                {hrEmployees.filter(e => e.is_active).map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.job_title || ''}</option>
                ))}
              </select>
            </div>

            {/* نوع الإنهاء */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإنهاء <span className="text-red-500">*</span></label>
              <select value={form.termination_type} onChange={e => set('termination_type', e.target.value)} className="select">
                <optgroup label="✅ مكافأة كاملة">
                  <option value="إنهاء عقد من صاحب العمل">📋 إنهاء عقد من صاحب العمل</option>
                  <option value="انتهاء عقد">📅 انتهاء مدة العقد</option>
                  <option value="إنهاء باتفاق الطرفين">🤝 إنهاء باتفاق الطرفين</option>
                  <option value="إحالة للتقاعد">🎖️ إحالة للتقاعد</option>
                  <option value="وفاة">🖤 وفاة</option>
                  <option value="عجز كلي">🏥 عجز كلي عن العمل</option>
                  <option value="إغلاق المنشأة">🏢 إغلاق المنشأة</option>
                  <option value="تغيير جوهري في العقد">📝 رفض تغيير جوهري في العقد</option>
                </optgroup>
                <optgroup label="⚠️ مكافأة مخفّضة">
                  <option value="استقالة">🚪 استقالة</option>
                </optgroup>
                <optgroup label="❌ لا مكافأة">
                  <option value="فصل تأديبي">⛔ فصل تأديبي</option>
                  <option value="فصل">⚠️ فصل</option>
                </optgroup>
              </select>
              {/* مؤشر نوع المكافأة */}
              {form.termination_type && (() => {
                const t = TYPES.find(x => x.value === form.termination_type)
                const grpLabel = t?.group === 'كاملة' ? { text: '✅ يستحق مكافأة كاملة', bg: '#ecfdf5', color: '#065f46' }
                  : t?.group === 'مخفّضة' ? { text: '⚠️ يستحق مكافأة مخفّضة حسب سنوات الخدمة', bg: '#fffbeb', color: '#92400e' }
                  : { text: '❌ لا يستحق مكافأة نهاية خدمة', bg: '#fef2f2', color: '#991b1b' }
                return (
                  <div style={{ marginTop: '6px', padding: '5px 10px', background: grpLabel.bg, borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: grpLabel.color }}>
                    {grpLabel.text}
                  </div>
                )
              })()}
            </div>

            {/* التواريخ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإنهاء الرسمي <span className="text-red-500">*</span></label>
              <input type="date" value={form.termination_date} onChange={e => set('termination_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">آخر يوم عمل فعلي <span className="text-red-500">*</span></label>
              <input type="date" value={form.last_working_day} onChange={e => set('last_working_day', e.target.value)} className="input" />
            </div>

            {/* مكافأة نهاية الخدمة — تلقائية حسب نظام العمل السعودي */}
            {gratuity && (
              <div style={{ gridColumn: '1/-1', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${gratuity.isEntitled ? '#bbf7d0' : '#fca5a5'}` }}>
                {/* رأس البطاقة */}
                <div style={{
                  padding: '10px 14px', color: 'white', fontWeight: 700, fontSize: '0.875rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: gratuity.isEntitled ? '#0ea77b' : '#c81e1e',
                }}>
                  <span>🧮 مكافأة نهاية الخدمة — حسب نظام العمل السعودي</span>
                  <span style={{ opacity: 0.9, fontSize: '0.78rem' }}>
                    {gratuity.years} سنة {gratuity.months > 0 ? `و ${gratuity.months} شهر` : ''} {gratuity.days > 0 ? `و ${gratuity.days} يوم` : ''}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: gratuity.isEntitled ? '#f0fdf4' : '#fef2f2' }}>
                  {/* الأساس القانوني */}
                  <div style={{ fontSize: '0.78rem', color: gratuity.isEntitled ? '#065f46' : '#991b1b', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{gratuity.isEntitled ? '✅' : '❌'}</span>
                    <span>{gratuity.entitlement}</span>
                  </div>

                  {/* تفاصيل الحساب */}
                  {gratuity.breakdown.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      {gratuity.breakdown.map((line, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#374151', padding: '3px 0', borderBottom: i < gratuity.breakdown.length - 1 ? '1px dashed #d1fae5' : 'none' }}>
                          • {line}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* المبالغ */}
                  {gratuity.isEntitled && (
                    <>
                      {gratuity.reductionPct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#6b7280', marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid #fde68a' }}>
                          <span>المكافأة الكاملة قبل التخفيض</span>
                          <span style={{ fontWeight: 600 }}>{gratuity.fullAmount.toLocaleString()} ر.س</span>
                        </div>
                      )}
                      {gratuity.reductionPct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#c81e1e', marginBottom: '8px' }}>
                          <span>تخفيض {gratuity.reductionPct}% ({gratuity.reductionLabel})</span>
                          <span style={{ fontWeight: 600 }}>- {(gratuity.fullAmount - gratuity.finalAmount).toLocaleString()} ر.س</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${gratuity.reductionPct > 0 ? '#fde68a' : '#bbf7d0'}`, paddingTop: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>💰 المكافأة المستحقة</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0ea77b' }}>{gratuity.finalAmount.toLocaleString()} ر.س</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* بيانات الموظف المختار */}
            {selectedHR && (
              <div style={{ gridColumn: '1/-1', background: 'var(--bg2)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div><span style={{ color: 'var(--text3)' }}>الراتب الأساسي: </span><strong>{Number(selectedHR.basic_salary || 0).toLocaleString()} ر.س</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>تاريخ المباشرة: </span><strong>{selectedHR.hire_date || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>القسم: </span><strong>{selectedHR.department || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>الجنسية: </span><strong>{selectedHR.nationality || '—'}</strong></div>
                </div>
              </div>
            )}

            {/* ملاحظات */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات / سبب الإنهاء</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="مثال: قدّم استقالته لأسباب شخصية..." />
            </div>

            {/* الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option value="مؤقت">مؤقت (قيد المعالجة)</option>
                <option value="نهائي">نهائي</option>
              </select>
            </div>
          </div>

          {/* أزرار الحفظ */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={resetForm} className="btn btn-ghost">إلغاء</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary"
              style={{ background: '#c81e1e' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogOut style={{ width: '15px', height: '15px' }} />}
              تأكيد إنهاء الخدمة
            </button>
          </div>
        </div>
      )}

      {/* ── جدول السجلات ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : terminations.length === 0 ? (
        <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
          <LogOut style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد سجلات إنهاء خدمة</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الموظف', 'نوع الإنهاء', 'تاريخ الإنهاء', 'آخر يوم عمل', 'سنوات الخدمة', 'مكافأة نهاية الخدمة', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {terminations.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{t.employee?.name || `#${t.hr_employee_id}`}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{t.employee?.job_title}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${TYPE_COLOR[t.termination_type] || 'badge-gray'}`}>
                        {TYPES.find(x => x.value === t.termination_type)?.icon} {t.termination_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>{t.termination_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>{t.last_working_day}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                      {Math.floor(t.years_of_service)} سنة
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: t.gratuity_amount > 0 ? '#0ea77b' : 'var(--text3)' }}>
                      {t.gratuity_amount > 0 ? `${t.gratuity_amount.toLocaleString()} ر.س` : 'لا تستحق'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${t.status === 'نهائي' ? 'badge-red' : 'badge-amber'}`}>{t.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => {
                          setForm({
                            hr_employee_id: String(t.hr_employee_id),
                            termination_type: t.termination_type,
                            termination_date: t.termination_date,
                            last_working_day: t.last_working_day,
                            notes: t.notes || '',
                            status: t.status,
                          })
                          setEditId(t.id)
                          setShowForm(true)
                        }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function HRPage() {
  const { tenant, currentUser } = useStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'employees' | 'terminations' | 'joboffers'>('employees')
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  // فتح مودال التعديل تلقائياً إذا جاء من صفحة تفاصيل الموظف
  useEffect(() => {
    const editId = sessionStorage.getItem('hr_edit_emp')
    if (!editId || !hrEmployees.length) return
    sessionStorage.removeItem('hr_edit_emp')
    const emp = hrEmployees.find(e => String(e.id) === editId)
    if (emp) { setEditEmp(emp); setShowModal(true) }
  }, [hrEmployees])
  const [viewEmp, setViewEmp] = useState<HREmployee | null>(null)
  const [listMode, setListMode] = useState<'idle' | 'search' | 'all'>('idle')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({ total: 0, active: 0, saudi: 0, expats: 0, totalSalaries: 0 })
  const PAGE_SIZE = 20
  const isAdmin = currentUser?.role === 'مدير عام'
  const now = new Date()

  useEffect(() => { if (tenant) loadStats() }, [tenant?.id])

  async function loadStats() {
    if (!tenant) return
    const [statsRes, mgRes, deptRes] = await Promise.all([
      supabase
        .from('hr_employees')
        .select('nationality, basic_salary, housing_allow, transport_allow, other_allow, is_active')
        .eq('tenant_id', tenant.id),
      supabase
        .from('employees')
        .select('id, name, role')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .in('role', ['مدير عام', 'مدير مشروع']),
      supabase
        .from('hr_departments')
        .select('*, manager:employees(name, role)')
        .eq('tenant_id', tenant.id)
        .order('name'),
    ])
    const all = statsRes.data || []
    setStats({
      total: all.length,
      active: all.filter(e => e.is_active).length,
      saudi: all.filter(e => e.nationality === 'سعودي').length,
      expats: all.filter(e => e.nationality !== 'سعودي').length,
      totalSalaries: all.reduce((s, e) => s + (e.basic_salary || 0) + (e.housing_allow || 0) + (e.transport_allow || 0) + (e.other_allow || 0), 0),
    })
    setManagers(mgRes.data || [])
    setDepartments((deptRes.data || []) as Department[])
  }

  async function doSearch(q: string) {
    if (!tenant || !q.trim()) return
    setLoading(true)
    setListMode('search')
    setSearch(q)
    const { data } = await supabase
      .from('hr_employees')
      .select('*')
      .eq('tenant_id', tenant.id)
      .or(`employee_number.eq.${q},first_name.ilike.%${q}%,family_name.ilike.%${q}%,father_name.ilike.%${q}%,name.ilike.%${q}%`)
      .order('employee_number', { ascending: true })
      .limit(50)
    setHREmployees(data || [])
    setLoading(false)
  }

  async function loadAll(p = 1) {
    if (!tenant) return
    setLoading(true)
    setListMode('all')
    setPage(p)
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('hr_employees')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('employee_number', { ascending: true })
      .range(from, to)
    setHREmployees(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  async function load() {
    if (listMode === 'search') await doSearch(search)
    else if (listMode === 'all') await loadAll(page)
    await loadStats()
  }

  async function handleSave(data: any) {
    if (!tenant) return
    try {
      let hrEmployeeId = data.hr_employee_id || null
      let employeeNumber: string | null = null

      if (!hrEmployeeId) {
        // ✅ توليد رقم الموظف التلقائي
        const { data: empNum, error: numErr } = await supabase
          .rpc('generate_employee_number', { p_tenant_id: tenant.id })
        if (!numErr && empNum) employeeNumber = empNum

        // ✅ إنشاء سجل في employees للـ login (اختياري)
        const { data: newEmp } = await supabase
          .from('employees')
          .insert({
            tenant_id: tenant.id,
            name: data.emp_name,
            role: data.job_title || 'موظف',
            username: `emp_${Date.now()}`,
            password: '1234',
            permissions: [],
            is_active: true,
          })
          .select('id')
          .single()

        // ✅ بناء payload لـ hr_employees
        const hrPayload: Record<string, any> = {
          tenant_id:       tenant.id,
          employee_id:     newEmp?.id || null,
          employee_number: employeeNumber,
          first_name:       data.first_name       || null,
          father_name:      data.father_name       || null,
          grandfather_name: data.grandfather_name  || null,
          family_name:      data.family_name       || null,
          first_name_en:    data.first_name_en     || null,
          family_name_en:   data.family_name_en    || null,
          national_id:    data.national_id    || null,
          nationality:    data.nationality,
          birth_date:     data.birth_date     || null,
          gender:         data.gender,
          marital_status: data.marital_status,
          hire_date:      data.hire_date      || null,
          contract_type:  data.contract_type,
          job_title:      data.job_title      || null,
          work_location:  data.work_location  || null,
          department:     data.department     || null,
          direct_manager: data.direct_manager || null,
          basic_salary:   data.basic_salary,
          housing_allow:  data.housing_allow,
          transport_allow: data.transport_allow,
          other_allow:    data.other_allow,
          gosi_enrolled:  data.gosi_enrolled,
          gosi_pct:       data.gosi_pct,
          bank_name:      data.bank_name      || null,
          iban:           data.iban           || null,
          iqama_number:   data.iqama_number   || null,
          iqama_expiry:   data.iqama_expiry   || null,
          notes:          data.notes          || null,
          is_active:      true,
        }

        // حذف أي مفتاح قيمته undefined تحسباً
        Object.keys(hrPayload).forEach(k => {
          if (hrPayload[k] === undefined) delete hrPayload[k]
        })

        // إدراج في hr_employees وربط hr_employee_id في employees
        const { data: newHR, error: insertErr } = await supabase
          .from('hr_employees')
          .insert(hrPayload)
          .select('id')
          .single()
        if (insertErr) throw insertErr

        // ربط العكسي: employees.hr_employee_id → hr_employees.id
        if (newEmp?.id && newHR?.id) {
          await supabase.from('employees').update({ hr_employee_id: newHR.id }).eq('id', newEmp.id)
        }

      } else {
        // تعديل موظف موجود — تحديث hr_employees فقط
        const hrPayload: Record<string, any> = {
          first_name:       data.first_name       || null,
          father_name:      data.father_name       || null,
          grandfather_name: data.grandfather_name  || null,
          family_name:      data.family_name       || null,
          first_name_en:    data.first_name_en     || null,
          family_name_en:   data.family_name_en    || null,
          national_id:    data.national_id    || null,
          nationality:    data.nationality,
          birth_date:     data.birth_date     || null,
          gender:         data.gender,
          marital_status: data.marital_status,
          hire_date:      data.hire_date      || null,
          contract_type:  data.contract_type,
          job_title:      data.job_title      || null,
          work_location:  data.work_location  || null,
          department:     data.department     || null,
          direct_manager: data.direct_manager || null,
          basic_salary:   data.basic_salary,
          housing_allow:  data.housing_allow,
          transport_allow: data.transport_allow,
          other_allow:    data.other_allow,
          gosi_enrolled:  data.gosi_enrolled,
          gosi_pct:       data.gosi_pct,
          bank_name:      data.bank_name      || null,
          iban:           data.iban           || null,
          iqama_number:   data.iqama_number   || null,
          iqama_expiry:   data.iqama_expiry   || null,
          notes:          data.notes          || null,
        }
        Object.keys(hrPayload).forEach(k => { if (hrPayload[k] === undefined) delete hrPayload[k] })
        const { error: updateErr } = await supabase.from('hr_employees').update(hrPayload).eq('id', data.id)
        if (updateErr) throw updateErr
      }

      // ✅ إعادة تحميل القائمة بعد الحفظ
      await load()
      setShowModal(false)
      setEditEmp(null)
      toast.success(data.id ? 'تم التعديل ✅' : 'تمت إضافة الموظف ✅')

    } catch (err: any) {
      console.error('HR Save Error:', err)
      toast.error('حدث خطأ: ' + (err.message || 'خطأ غير معروف'))
    }
  }

  // الحسابات تأتي من stats (الإحصائيات الخفيفة) لا من الجدول المحمّل
  const totalSalaries = stats.totalSalaries
  const active = stats.active
  const saudiCount = stats.saudi
  const expats = stats.expats
  const filtered = hrEmployees  // الفلترة تتم في Supabase مباشرة

  const TABS = [
    { id: 'employees',    label: '👥 ملفات الموظفين',   color: '#1a56db' },
    { id: 'terminations', label: '🚪 إنهاء الخدمة',      color: '#c81e1e' },
    { id: 'joboffers',    label: '📄 عروض العمل',         color: '#0ea77b' },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> ملفات الموظفين
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>بيانات الموظفين مع حسابات GOSI</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem',
              fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? `0 2px 8px ${t.color}44` : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ تاب الموظفين ══ */}
      {activeTab === 'employees' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'الموظفون النشطون', value: active,                                    color: '#1a56db', bg: '#eff6ff' },
              { label: 'إجمالي الرواتب',   value: `${totalSalaries.toLocaleString()} ر.س`,  color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'سعوديون',           value: saudiCount,                               color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'وافدون',            value: expats,                                   color: '#e6820a', bg: '#fffbeb' },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* شريط البحث + أزرار + إضافة */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* حقل البحث */}
              <div style={{ position: 'relative' }}>
                <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doSearch(searchInput) }}
                  className="input"
                  style={{ paddingRight: '36px', width: '240px' }}
                  placeholder="بحث بالاسم أو الرقم..."
                />
              </div>
              <button
                onClick={() => doSearch(searchInput)}
                className="btn btn-primary btn-sm"
                disabled={!searchInput.trim()}>
                بحث
              </button>
              <button
                onClick={() => { loadAll(1); setSearchInput('') }}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid var(--border)' }}>
                <Users style={{ width: '14px', height: '14px' }} /> عرض الكل ({stats.total})
              </button>
              {listMode !== 'idle' && (
                <button
                  onClick={() => { setListMode('idle'); setHREmployees([]); setSearchInput(''); setSearch('') }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>
                  ✕ إخفاء القائمة
                </button>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة موظف
              </button>
            )}
          </div>

          {/* قائمة الموظفين */}
          {listMode === 'idle' ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <Users style={{ width: '44px', height: '44px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>ابحث باسم أو رقم الموظف، أو اضغط "عرض الكل"</p>
              {isAdmin && (
                <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary btn-sm">
                  <Plus style={{ width: '14px', height: '14px' }} /> إضافة موظف جديد
                </button>
              )}
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد نتائج</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الرقم الوظيفي</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الاسم</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>القسم / المسمى</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الجنسية</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>تاريخ التعيين</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الراتب الأساسي</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>صافي الراتب</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>GOSI</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الحالة</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, idx) => {
                      const totalSal = Number(emp.basic_salary || 0) + Number(emp.housing_allow || 0) + Number(emp.transport_allow || 0) + Number(emp.other_allow || 0)
                      const iqamaDays = emp.iqama_expiry
                        ? Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000)
                        : null
                      const gosi = calcGOSI(emp.nationality || '', Number(emp.basic_salary || 0), Number(emp.housing_allow || 0), Number(emp.transport_allow || 0))
                      const netSal = totalSal - (emp.gosi_enrolled ? gosi.employeeDeduction : 0)
                      const isSaudi = emp.nationality === 'سعودي'
                      const empName = emp.name || '—'
                      const iqamaWarning = iqamaDays !== null && iqamaDays <= 60

                      return (
                        <tr key={emp.id}
                          style={{ borderBottom: '1px solid var(--bg2)', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                          {/* # رقم تسلسلي */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.8rem' }}>
                            {idx + 1}
                          </td>

                          {/* الموظف */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {emp.employee_number ? (
                              <span style={{
                                background: '#eff6ff', color: '#1a56db',
                                borderRadius: '6px', padding: '3px 8px',
                                fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem',
                                display: 'inline-block',
                              }}>
                                {emp.employee_number}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                                background: isSaudi ? '#eff6ff' : '#fffbeb',
                                color: isSaudi ? '#1a56db' : '#e6820a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '1rem',
                              }}>
                                {empName.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{empName}</div>
                                {emp.work_location && (
                                  <div style={{ fontSize: '0.68rem', color: '#1a56db', marginTop: '1px' }}>📍 {emp.work_location}</div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                                  {emp.contract_type || '—'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* القسم / المسمى */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.8rem' }}>{emp.department || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{emp.job_title || '—'}</div>
                          </td>

                          {/* الجنسية */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span className={`badge text-xs ${isSaudi ? 'badge-blue' : 'badge-amber'}`}>
                              {isSaudi ? '🇸🇦 سعودي' : `🌍 ${emp.nationality || "وافد"}`}
                            </span>
                            {iqamaWarning && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px', fontSize: '0.7rem', color: iqamaDays! <= 0 ? '#c81e1e' : '#e6820a' }}>
                                <AlertTriangle style={{ width: '11px', height: '11px' }} />
                                {iqamaDays! <= 0 ? `منتهية ${Math.abs(iqamaDays!)} يوم` : `تنتهي ${iqamaDays} يوم`}
                              </div>
                            )}
                          </td>

                          {/* تاريخ التعيين */}
                          <td style={{ padding: '12px 14px', color: 'var(--text)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            {emp.hire_date ? formatDate(emp.hire_date) : '—'}
                          </td>

                          {/* الراتب الأساسي */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{Number(emp.basic_salary || 0).toLocaleString()} ر.س</div>
                            {totalSal !== Number(emp.basic_salary || 0) && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>إجمالي: {totalSal.toLocaleString()}</div>
                            )}
                          </td>

                          {/* صافي الراتب */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700, color: '#0ea77b', fontSize: '0.9rem' }}>
                              {netSal.toLocaleString()} ر.س
                            </span>
                          </td>

                          {/* GOSI */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {emp.gosi_enrolled ? (
                              <div>
                                <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>✓ مسجل</span>
                                <div style={{ fontSize: '0.7rem', color: '#c81e1e', marginTop: '3px' }}>
                                  -{gosi.employeeDeduction.toLocaleString()} ر.س
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>غير مسجل</span>
                            )}
                          </td>

                          {/* الحالة */}
                          <td style={{ padding: '12px 14px' }}>
                            <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-gray'} text-xs`}>
                              {emp.is_active ? 'نشط' : 'غير نشط'}
                            </span>
                          </td>

                          {/* إجراء */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => router.push(`/hr/employees/${emp.id}`)}
                                className="btn btn-ghost btn-xs"
                                title="ملف الموظف الشامل"
                                style={{ color: '#1a56db' }}>
                                <Eye style={{ width: '14px', height: '14px' }} />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => { setEditEmp(emp); setShowModal(true) }}
                                  className="btn btn-ghost btn-xs"
                                  title="تعديل"
                                  style={{ color: '#e6820a' }}>
                                  <Pencil style={{ width: '14px', height: '14px' }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer + Pagination */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', fontSize: '0.78rem', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  {listMode === 'all'
                    ? <>عرض <strong>{filtered.length}</strong> من <strong>{totalCount}</strong> موظف</>
                    : <>نتائج البحث: <strong>{filtered.length}</strong></>}
                </span>
                {listMode === 'all' && totalCount > PAGE_SIZE && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => loadAll(page - 1)}
                      disabled={page === 1}
                      className="btn btn-ghost btn-xs"
                      style={{ padding: '4px 10px' }}>
                      ‹ السابق
                    </button>
                    <span style={{ padding: '0 8px', fontWeight: 600 }}>
                      {page} / {Math.ceil(totalCount / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => loadAll(page + 1)}
                      disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                      className="btn btn-ghost btn-xs"
                      style={{ padding: '4px 10px' }}>
                      التالي ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal عرض بيانات الموظف */}
          {viewEmp && (
            <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewEmp(null)}>
              <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ fontWeight: 700 }}>بيانات الموظف</h3>
                  <button onClick={() => setViewEmp(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* رأس البطاقة */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'var(--bg2)', borderRadius: '12px' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                      background: viewEmp.nationality === 'سعودي' ? '#eff6ff' : '#fffbeb',
                      color: viewEmp.nationality === 'سعودي' ? '#1a56db' : '#e6820a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1.4rem',
                    }}>
                      {viewEmp.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{viewEmp.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginTop: '2px' }}>{viewEmp.job_title} — {viewEmp.department}</div>
                      {viewEmp.employee_number && (
                        <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px', display: 'inline-block' }}>
                          #{viewEmp.employee_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* البيانات في شبكة */}
                  {[
                    { label: 'رقم الهوية / الإقامة', value: viewEmp.national_id },
                    { label: 'الجنسية', value: viewEmp.nationality },
                    { label: 'تاريخ الميلاد', value: viewEmp.birth_date ? formatDate(viewEmp.birth_date) : '—' },
                    { label: 'الجنس', value: viewEmp.gender },
                    { label: 'الحالة الاجتماعية', value: viewEmp.marital_status },
                    { label: 'تاريخ التعيين', value: viewEmp.hire_date ? formatDate(viewEmp.hire_date) : '—' },
                    { label: 'نوع العقد', value: viewEmp.contract_type },
                    { label: 'المدير المباشر', value: viewEmp.direct_manager ? `#${viewEmp.direct_manager}` : '—' },
                    { label: 'الراتب الأساسي', value: `${viewEmp.basic_salary?.toLocaleString()} ر.س` },
                    { label: 'بدل السكن', value: `${viewEmp.housing_allow?.toLocaleString()} ر.س` },
                    { label: 'بدل النقل', value: `${viewEmp.transport_allow?.toLocaleString()} ر.س` },
                    { label: 'بدلات أخرى', value: `${viewEmp.other_allow?.toLocaleString()} ر.س` },
                    { label: 'البنك', value: viewEmp.bank_name || '—' },
                    { label: 'IBAN', value: viewEmp.iban || '—' },
                    ...(viewEmp.nationality !== 'سعودي' ? [
                      { label: 'رقم الإقامة', value: viewEmp.iqama_number || '—' },
                      { label: 'انتهاء الإقامة', value: viewEmp.iqama_expiry ? formatDate(viewEmp.iqama_expiry) : '—' },
                    ] : []),
                  ].map(row => (
                    <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', alignItems: 'center', borderBottom: '1px solid var(--bg2)', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{row.label}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{row.value || '—'}</span>
                    </div>
                  ))}
                  {viewEmp.notes && (
                    <div style={{ padding: '10px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text3)' }}>
                      <strong>ملاحظات: </strong>{viewEmp.notes}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  {isAdmin && (
                    <button onClick={() => { setEditEmp(viewEmp); setViewEmp(null); setShowModal(true) }} className="btn btn-primary btn-sm">
                      <Pencil style={{ width: '14px', height: '14px' }} /> تعديل البيانات
                    </button>
                  )}
                  <button onClick={() => setViewEmp(null)} className="btn btn-ghost">إغلاق</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ تاب إنهاء الخدمة ══ */}
      {activeTab === 'terminations' && tenant && (
        <TerminationTab tenantId={tenant.id} hrEmployees={hrEmployees} />
      )}

      {/* ══ تاب عروض العمل ══ */}
      {activeTab === 'joboffers' && tenant && (
        <JobOffersTab tenant={tenant} hrEmployees={hrEmployees} />
      )}

      {/* Modal */}
      {showModal && (
        <HREmployeeModal
          emp={editEmp}
          departments={departments}
          managers={managers}
          onClose={() => { setShowModal(false); setEditEmp(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════
// تاب عروض العمل مع توليد PDF
// ══════════════════════════════════════
function JobOffersTab({ tenant, hrEmployees }: { tenant: any; hrEmployees: HREmployee[] }) {
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ceoName, setCeoName] = useState('')

  // نموذج عرض العمل
  const [form, setForm] = useState({
    // المرشح
    candidate_name: '',
    candidate_from_system: false,
    hr_employee_id: '',
    // الوظيفة
    job_title: '',
    department: '',
    division: '',
    contract_type: 'دوام كامل',
    // الراتب
    basic_salary: '',
    housing_allow: '',
    transport_allow: '',
    other_allow: '',
    // التواريخ
    start_date: '',
    offer_date: new Date().toISOString().split('T')[0],
    offer_expiry: '',
    // ملاحظات
    notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const totalSalary = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow)

  useEffect(() => { loadData() }, [tenant?.id])

  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const [offersRes, tenantRes] = await Promise.all([
      supabase.from('hr_job_offers').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('tenants').select('ceo_id').eq('id', tenant.id).single(),
    ])
    setOffers(offersRes.data || [])
    // جلب اسم CEO
    if (tenantRes.data?.ceo_id) {
      const { data: ceo } = await supabase.from('employees').select('name').eq('id', tenantRes.data.ceo_id).single()
      if (ceo) setCeoName(ceo.name)
    }
    setLoading(false)
  }

  // عند اختيار موظف من النظام — تعبئة تلقائية
  function fillFromEmployee(hrEmpId: string) {
    const emp = hrEmployees.find(e => e.id === Number(hrEmpId))
    if (!emp) return
    setForm(f => ({
      ...f,
      hr_employee_id: hrEmpId,
      candidate_name: emp.name || '',
      job_title: emp.job_title || '',
      department: emp.department || '',
      contract_type: emp.contract_type || 'دوام كامل',
      basic_salary: String(emp.basic_salary || ''),
      housing_allow: String(emp.housing_allow || ''),
      transport_allow: String(emp.transport_allow || ''),
      other_allow: String(emp.other_allow || ''),
      start_date: emp.hire_date || '',
    }))
  }

  // حفظ العرض
  async function saveOffer() {
    if (!form.candidate_name.trim()) { toast.error('اسم المرشح مطلوب'); return }
    if (!form.job_title.trim()) { toast.error('المسمى الوظيفي مطلوب'); return }
    if (!form.basic_salary) { toast.error('الراتب الأساسي مطلوب'); return }
    if (!form.start_date) { toast.error('تاريخ المباشرة مطلوب'); return }

    const { error } = await supabase.from('hr_job_offers').insert({
      tenant_id: tenant.id,
      candidate_name: form.candidate_name,
      hr_employee_id: form.hr_employee_id ? Number(form.hr_employee_id) : null,
      job_title: form.job_title,
      department: form.department,
      division: form.division,
      contract_type: form.contract_type,
      basic_salary: Number(form.basic_salary),
      housing_allow: Number(form.housing_allow) || 0,
      transport_allow: Number(form.transport_allow) || 0,
      other_allow: Number(form.other_allow) || 0,
      total_salary: totalSalary,
      start_date: form.start_date,
      offer_date: form.offer_date,
      offer_expiry: form.offer_expiry || null,
      notes: form.notes || null,
      status: 'مسودة',
    })

    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ عرض العمل')
    await loadData()
    setMode('list')
  }

  // توليد PDF
  function generatePDF(offer: any) {
    const offerData = offer || {
      ...form,
      basic_salary: Number(form.basic_salary),
      housing_allow: Number(form.housing_allow) || 0,
      transport_allow: Number(form.transport_allow) || 0,
      other_allow: Number(form.other_allow) || 0,
      total_salary: totalSalary,
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>عرض عمل - ${offerData.candidate_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a1a2e; background: white; direction: rtl; }
  .page { max-width: 794px; margin: 0 auto; padding: 40px 50px; min-height: 1123px; position: relative; }

  /* الهيدر */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1a56db; }
  .company-name { font-size: 22px; font-weight: 800; color: #1a56db; }
  .company-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .offer-badge { background: #1a56db; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 700; }

  /* العنوان */
  .title-section { text-align: center; margin: 30px 0; }
  .title-section h1 { font-size: 26px; font-weight: 800; color: #1a56db; margin-bottom: 6px; }
  .title-section p { font-size: 13px; color: #6b7280; }

  /* بيانات المرشح */
  .candidate-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
  .candidate-name { font-size: 20px; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
  .candidate-sub { font-size: 13px; color: #3b82f6; font-weight: 600; }

  /* الجدول */
  .section-title { font-size: 15px; font-weight: 700; color: #1a56db; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #dbeafe; display: flex; align-items: center; gap: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .info-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .info-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; font-weight: 600; }
  .info-value { font-size: 14px; font-weight: 700; color: #1a1a2e; }

  /* الراتب */
  .salary-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
  .salary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #d1fae5; font-size: 14px; }
  .salary-row:last-child { border-bottom: none; }
  .salary-total { background: #0ea77b; color: white; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; margin-top: 12px; font-weight: 700; font-size: 16px; }

  /* الملاحظات */
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 13px; color: #92400e; line-height: 1.7; }

  /* التوقيعات */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .sig-box { text-align: center; }
  .sig-line { border-bottom: 2px solid #1a56db; margin: 40px 20px 8px; }
  .sig-label { font-size: 12px; color: #6b7280; }
  .sig-name { font-size: 14px; font-weight: 700; margin-top: 4px; }

  /* الفوتر */
  .footer { position: absolute; bottom: 30px; left: 50px; right: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- هيدر -->
  <div class="header">
    <div>
      <div class="company-name">${tenant?.name || 'الشركة'}</div>
      <div class="company-sub">مقاول كهرباء معتمد</div>
    </div>
    <div class="offer-badge">عرض عمل رسمي</div>
  </div>

  <!-- العنوان -->
  <div class="title-section">
    <h1>خطاب عرض العمل</h1>
    <p>تاريخ العرض: ${offerData.offer_date || new Date().toLocaleDateString('ar-SA')}
    ${offerData.offer_expiry ? ` · صالح حتى: ${offerData.offer_expiry}` : ''}</p>
  </div>

  <!-- المرشح -->
  <div class="candidate-box">
    <div class="candidate-name">السيد / السيدة: ${offerData.candidate_name}</div>
    <div class="candidate-sub">${offerData.job_title}</div>
  </div>

  <p style="font-size:14px; line-height:1.8; margin-bottom:20px; color:#374151;">
    يسعدنا إبلاغكم بقبول انضمامكم لفريق عمل شركة <strong>${tenant?.name || 'الشركة'}</strong>،
    ونتشرف بتقديم عرض العمل التالي:
  </p>

  <!-- بيانات الوظيفة -->
  <div class="section-title">📋 تفاصيل الوظيفة</div>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">المسمى الوظيفي</div>
      <div class="info-value">${offerData.job_title}</div>
    </div>
    ${offerData.department ? `<div class="info-item"><div class="info-label">القسم</div><div class="info-value">${offerData.department}</div></div>` : ''}
    ${offerData.division ? `<div class="info-item"><div class="info-label">الإدارة</div><div class="info-value">${offerData.division}</div></div>` : ''}
    <div class="info-item">
      <div class="info-label">نوع العقد</div>
      <div class="info-value">${offerData.contract_type}</div>
    </div>
    <div class="info-item">
      <div class="info-label">تاريخ المباشرة</div>
      <div class="info-value">${offerData.start_date || '—'}</div>
    </div>
  </div>

  <!-- الراتب -->
  <div class="section-title">💰 الراتب والمزايا (شهرياً)</div>
  <div class="salary-box">
    <div class="salary-row"><span>الراتب الأساسي</span><span style="font-weight:700">${Number(offerData.basic_salary).toLocaleString('ar-SA')} ريال</span></div>
    ${offerData.housing_allow > 0 ? `<div class="salary-row"><span>بدل السكن</span><span style="font-weight:700">${Number(offerData.housing_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    ${offerData.transport_allow > 0 ? `<div class="salary-row"><span>بدل النقل</span><span style="font-weight:700">${Number(offerData.transport_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    ${offerData.other_allow > 0 ? `<div class="salary-row"><span>بدلات أخرى</span><span style="font-weight:700">${Number(offerData.other_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    <div class="salary-total">
      <span>إجمالي الراتب الشهري</span>
      <span>${Number(offerData.total_salary || offerData.basic_salary).toLocaleString('ar-SA')} ريال</span>
    </div>
  </div>

  ${offerData.notes ? `
  <!-- ملاحظات -->
  <div class="section-title">📝 ملاحظات وشروط إضافية</div>
  <div class="notes-box">${offerData.notes}</div>
  ` : ''}

  <!-- التوقيعات -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع صاحب العمل</div>
      <div class="sig-name">${ceoName || tenant?.name || ''}</div>
      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">المدير التنفيذي</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المرشح — قبول العرض</div>
      <div class="sig-name">${offerData.candidate_name}</div>
      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">التاريخ: _______________</div>
    </div>
  </div>

  <!-- الفوتر -->
  <div class="footer">
    ${tenant?.name || 'الشركة'} · هذا العرض سري ومخصص للمرشح المذكور فقط
  </div>

</div>

<div class="no-print" style="text-align:center; padding:20px; background:#f9fafb;">
  <button onclick="window.print()" style="padding:10px 30px; background:#1a56db; color:white; border:none; border-radius:8px; cursor:pointer; font-size:15px; font-weight:600; margin-left:10px;">
    🖨️ طباعة / حفظ PDF
  </button>
  <button onclick="window.close()" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:15px;">
    إغلاق
  </button>
</div>

</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <div className="space-y-4">

      {/* شريط الإجراءات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>
          {offers.length} عرض عمل محفوظ
        </div>
        {mode === 'list' ? (
          <button onClick={() => setMode('create')} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إنشاء عرض عمل
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => generatePDF(null)} className="btn btn-ghost" style={{ color: '#0ea77b' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> معاينة PDF
            </button>
            <button onClick={() => setMode('list')} className="btn btn-ghost">
              <X style={{ width: '15px', height: '15px' }} /> إلغاء
            </button>
            <button onClick={saveOffer} className="btn btn-primary">
              <Save style={{ width: '15px', height: '15px' }} /> حفظ العرض
            </button>
          </div>
        )}
      </div>

      {/* ══ نموذج إنشاء عرض ══ */}
      {mode === 'create' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            إنشاء عرض عمل جديد
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* المرشح */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>بيانات المرشح</div>

              {/* اختيار من النظام أو يدوي */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button type="button" onClick={() => set('candidate_from_system', false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, borderColor: !form.candidate_from_system ? '#1a56db' : 'var(--border)', background: !form.candidate_from_system ? '#eff6ff' : 'white', color: !form.candidate_from_system ? '#1a56db' : 'var(--text3)' }}>
                  ✍️ إدخال يدوي
                </button>
                <button type="button" onClick={() => set('candidate_from_system', true)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, borderColor: form.candidate_from_system ? '#1a56db' : 'var(--border)', background: form.candidate_from_system ? '#eff6ff' : 'white', color: form.candidate_from_system ? '#1a56db' : 'var(--text3)' }}>
                  👥 من الموظفين
                </button>
              </div>

              {form.candidate_from_system ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اختر الموظف</label>
                  <select value={form.hr_employee_id} onChange={e => fillFromEmployee(e.target.value)} className="select">
                    <option value="">— اختر موظفاً —</option>
                    {hrEmployees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} — {e.job_title}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المرشح <span className="text-red-500">*</span></label>
                  <input value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)} className="input" placeholder="الاسم الكامل للمرشح" />
                </div>
              )}

              {form.candidate_from_system && form.candidate_name && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46' }}>
                  ✅ تم تعبئة البيانات تلقائياً من ملف الموظف
                </div>
              )}
            </div>

            {/* بيانات الوظيفة */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>بيانات الوظيفة</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي <span className="text-red-500">*</span></label>
                  <input value={form.job_title} onChange={e => set('job_title', e.target.value)} className="input" placeholder="مثال: مهندس كهرباء" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label>
                  <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="مثال: قسم المشاريع" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الإدارة</label>
                  <input value={form.division} onChange={e => set('division', e.target.value)} className="input" placeholder="مثال: إدارة الهندسة" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع العقد</label>
                  <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">
                    {['دوام كامل','دوام جزئي','مؤقت','مياومة'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ المباشرة <span className="text-red-500">*</span></label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">صلاحية العرض حتى</label>
                  <input type="date" value={form.offer_expiry} onChange={e => set('offer_expiry', e.target.value)} className="input" />
                </div>
              </div>
            </div>

            {/* الراتب */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#065f46', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 الراتب والمزايا</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'basic_salary',    l: 'الراتب الأساسي *' },
                  { k: 'housing_allow',   l: 'بدل السكن' },
                  { k: 'transport_allow', l: 'بدل النقل' },
                  { k: 'other_allow',     l: 'بدلات أخرى' },
                ].map(({ k, l }) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" min="0" value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="input" placeholder="0" />
                  </div>
                ))}
              </div>
              {totalSalary > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#0ea77b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', color: 'white', fontWeight: 700 }}>
                  <span>إجمالي الراتب الشهري</span>
                  <span>{totalSalary.toLocaleString()} ريال</span>
                </div>
              )}
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات وشروط إضافية</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }}
                placeholder="مثال: يشمل العرض تأمين طبي — تجربة 3 أشهر..." />
            </div>
          </div>
        </div>
      )}

      {/* ══ قائمة العروض ══ */}
      {mode === 'list' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : offers.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد عروض عمل بعد</p>
            <button onClick={() => setMode('create')} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول عرض
            </button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['المرشح','المسمى الوظيفي','القسم','إجمالي الراتب','تاريخ المباشرة','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{o.candidate_name}</td>
                    <td style={{ padding: '12px 14px' }}>{o.job_title}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{o.department || '—'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0ea77b' }}>{Number(o.total_salary).toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{o.start_date || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${o.status === 'مقبول' ? 'badge-green' : o.status === 'مرفوض' ? 'badge-red' : 'badge-gray'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => generatePDF(o)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #0ea77b', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          <Printer style={{ width: '13px', height: '13px' }} /> PDF
                        </button>
                        <button onClick={async () => {
                          if (!confirm('حذف هذا العرض؟')) return
                          await supabase.from('hr_job_offers').delete().eq('id', o.id)
                          await loadData(); toast.success('تم الحذف')
                        }} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
