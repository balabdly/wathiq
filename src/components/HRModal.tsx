'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { X, Save, Building2, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import type { HREmployee, Department } from './hr_types'
import { calcGOSI } from './hr_utils'

export default function HREmployeeModal({ emp, departments, managers, onClose, onSave }: {
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
      direct_manager: form.direct_manager && Number(form.direct_manager) > 0 ? Number(form.direct_manager) : null,
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
