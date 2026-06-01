'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Search, Pencil, X, Save, AlertTriangle, Briefcase, Building2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type HREmployee = {
  id: number; tenant_id: string; employee_id: number
  national_id?: string; nationality: string; birth_date?: string
  gender: string; marital_status: string; hire_date?: string
  contract_type: string; job_title?: string; department?: string
  basic_salary: number; housing_allow: number; transport_allow: number; other_allow: number
  gosi_enrolled: boolean; gosi_pct: number
  iqama_number?: string; iqama_expiry?: string
  bank_name?: string; iban?: string; notes?: string
  is_active: boolean; direct_manager?: number
  employee?: { name: string; role: string }
}

type Department = {
  id: number; tenant_id: string; name: string; manager_id?: number
  manager?: { name: string; role: string }
}

type JobTitle = {
  id: number; tenant_id: string; name: string; department_id?: number
  department?: { name: string }
}

function calcGOSI(nationality: string, basicSalary: number, housingAllow: number) {
  const base = basicSalary + housingAllow
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
    emp_name:         emp?.employee?.name   || '',
    national_id:      emp?.national_id      || '',
    nationality:      emp?.nationality      || 'سعودي',
    nationality_text: (emp?.nationality && emp.nationality !== 'سعودي') ? emp.nationality : '',
    birth_date:       emp?.birth_date       || '',
    gender:           emp?.gender           || 'ذكر',
    marital_status:   emp?.marital_status   || 'أعزب',
    hire_date:        emp?.hire_date        || '',
    contract_type:    emp?.contract_type    || 'دوام كامل',
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

  const isSaudi = form.nationality === 'سعودي'
  const gosi = calcGOSI(form.nationality, Number(form.basic_salary), Number(form.housing_allow))
  const gosiBase = Number(form.basic_salary) + Number(form.housing_allow)
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
    if (!form.emp_name.trim()) { toast.error('أدخل اسم الموظف'); return }
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
      emp_name: form.emp_name.trim(),
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
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الموظف <span className="text-red-500">*</span></label>
                  <input value={form.emp_name} onChange={e => set('emp_name', e.target.value)} className="input" placeholder="الاسم الكامل" onKeyDown={noEnter} />
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
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function HRPage() {
  const { tenant, currentUser } = useStore()
  const [activeTab, setActiveTab] = useState<'employees' | 'jobtitles' | 'departments'>('employees')
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editEmp, setEditEmp] = useState<HREmployee | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'
  const now = new Date()

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [hrRes, mgRes, deptRes] = await Promise.all([
      // ✅ إصلاح: إضافة فلتر tenant_id + is_active لجلب الموظفين الصحيحين فقط
      supabase
        .from('hr_employees')
        .select('*, employee:employees(name, role)')
        .eq('tenant_id', tenant.id)
        .order('id'),
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
    setHREmployees(hrRes.data || [])
    setManagers(mgRes.data || [])
    setDepartments((deptRes.data || []) as Department[])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    try {
      let employeeId = data.employee_id

      if (!employeeId) {
        // ✅ إنشاء موظف جديد في جدول employees
        const { data: newEmp, error: empError } = await supabase
          .from('employees')
          .insert({
            tenant_id: tenant.id,
            name: data.emp_name,
            role: data.job_title,
            username: `emp_${Date.now()}`,
            password: '1234',
            permissions: [],
            is_active: true,
          })
          .select('id')
          .single()

        if (empError) throw empError
        employeeId = newEmp.id
      } else {
        // تحديث اسم ومسمى الموظف الموجود
        await supabase
          .from('employees')
          .update({ name: data.emp_name, role: data.job_title })
          .eq('id', employeeId)
      }

      // ✅ إصلاح: بناء payload نظيف بدون أي undefined
      const hrPayload: Record<string, any> = {
        tenant_id:      tenant.id,
        employee_id:    employeeId,
        national_id:    data.national_id    || null,
        nationality:    data.nationality,
        birth_date:     data.birth_date     || null,
        gender:         data.gender,
        marital_status: data.marital_status,
        hire_date:      data.hire_date      || null,
        contract_type:  data.contract_type,
        job_title:      data.job_title      || null,
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

      if (data.id) {
        // تعديل موظف موجود
        const { error: updateErr } = await supabase
          .from('hr_employees')
          .update(hrPayload)
          .eq('id', data.id)
        if (updateErr) throw updateErr
      } else {
        // إضافة موظف جديد
        const { error: insertErr } = await supabase
          .from('hr_employees')
          .insert(hrPayload)
        if (insertErr) throw insertErr
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

  const filtered = hrEmployees.filter(e =>
    !search || e.employee?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalSalaries = hrEmployees.reduce((s, e) =>
    s + e.basic_salary + e.housing_allow + e.transport_allow + e.other_allow, 0)
  const active = hrEmployees.filter(e => e.is_active).length
  const saudiCount = hrEmployees.filter(e => e.nationality === 'سعودي').length
  const expats = hrEmployees.filter(e => e.nationality !== 'سعودي').length

  const TABS = [
    { id: 'employees',   label: '👥 ملفات الموظفين',   color: '#1a56db' },
    { id: 'departments', label: '🏢 الأقسام',           color: '#e6820a' },
    { id: 'jobtitles',  label: '💼 المسميات الوظيفية', color: '#0ea77b' },
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

          {/* شريط البحث + زر إضافة */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input"
                style={{ paddingRight: '36px', width: '240px' }}
                placeholder="بحث باسم الموظف..."
              />
            </div>
            {isAdmin && (
              <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة موظف
              </button>
            )}
          </div>

          {/* قائمة الموظفين */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>
                {search ? 'لا توجد نتائج للبحث' : 'لا يوجد موظفون بعد'}
              </p>
              {isAdmin && !search && (
                <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول موظف
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(emp => {
                const totalSal = emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow
                const iqamaDays = emp.iqama_expiry
                  ? Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000)
                  : null
                const gosi = calcGOSI(emp.nationality, emp.basic_salary, emp.housing_allow)
                const netSal = totalSal - (emp.gosi_enrolled ? gosi.employeeDeduction : 0)
                const isSaudi = emp.nationality === 'سعودي'
                const manager = managers.find(m => m.id === emp.direct_manager)
                const empName = emp.employee?.name || '—'

                return (
                  <div key={emp.id} className="card" style={{ padding: '20px' }}>
                    {/* رأس البطاقة */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '46px', height: '46px', borderRadius: '14px',
                          background: isSaudi ? '#eff6ff' : '#fffbeb',
                          color: isSaudi ? '#1a56db' : '#e6820a',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '1.2rem', flexShrink: 0,
                        }}>
                          {empName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{empName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{emp.job_title || '—'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-gray'} text-xs`}>
                          {emp.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                        <span className={`badge text-xs ${isSaudi ? 'badge-blue' : 'badge-amber'}`}>
                          {isSaudi ? '🇸🇦 سعودي' : `🌍 ${emp.nationality}`}
                        </span>
                      </div>
                    </div>

                    {/* تفاصيل */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px', fontSize: '0.8rem' }}>
                      {emp.department && (
                        <div style={{ gridColumn: '1/-1', background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                          <span style={{ color: 'var(--text3)' }}>القسم: </span>
                          <span style={{ fontWeight: 600 }}>{emp.department}</span>
                        </div>
                      )}
                      {manager && (
                        <div style={{ gridColumn: '1/-1', background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                          <span style={{ color: 'var(--text3)' }}>المدير: </span>
                          <span style={{ fontWeight: 600 }}>{manager.name}</span>
                        </div>
                      )}
                      <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                        <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>العقد</div>
                        <div style={{ fontWeight: 600 }}>{emp.contract_type}</div>
                      </div>
                      {emp.hire_date && (
                        <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                          <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>التعيين</div>
                          <div style={{ fontWeight: 600 }}>{formatDate(emp.hire_date)}</div>
                        </div>
                      )}
                    </div>

                    {/* ملخص الراتب */}
                    <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الإجمالي</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{totalSal.toLocaleString()} ر.س</span>
                      </div>
                      {emp.gosi_enrolled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>خصم GOSI ({gosi.employeePct}%)</span>
                          <span style={{ fontWeight: 600, color: '#c81e1e' }}>- {gosi.employeeDeduction.toLocaleString()} ر.س</span>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid rgba(26,86,219,0.15)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>الصافي</span>
                        <span style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1rem' }}>{netSal.toLocaleString()} ر.س</span>
                      </div>
                    </div>

                    {/* شارات */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {emp.gosi_enrolled && <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>✓ GOSI</span>}
                      {emp.bank_name && <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>🏦 {emp.bank_name}</span>}
                    </div>

                    {/* تنبيه الإقامة */}
                    {iqamaDays !== null && iqamaDays <= 60 && (
                      <div style={{
                        background: iqamaDays <= 0 ? '#fef2f2' : '#fffbeb',
                        borderRadius: '8px', padding: '7px 10px', marginBottom: '10px',
                        fontSize: '0.75rem',
                        color: iqamaDays <= 0 ? '#c81e1e' : '#e6820a',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <AlertTriangle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                        {iqamaDays <= 0
                          ? `إقامة منتهية منذ ${Math.abs(iqamaDays)} يوم!`
                          : `إقامة تنتهي خلال ${iqamaDays} يوم`}
                      </div>
                    )}

                    {/* زر التعديل */}
                    {isAdmin && (
                      <div style={{ paddingTop: '10px', borderTop: '1px solid var(--bg2)' }}>
                        <button
                          onClick={() => { setEditEmp(emp); setShowModal(true) }}
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}>
                          <Pencil style={{ width: '14px', height: '14px' }} /> تعديل البيانات
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ تاب الأقسام ══ */}
      {activeTab === 'departments' && tenant && (
        <DepartmentsTab tenantId={tenant.id} managers={managers} onUpdate={load} />
      )}

      {/* ══ تاب المسميات ══ */}
      {activeTab === 'jobtitles' && tenant && (
        <JobTitlesTab tenantId={tenant.id} />
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
