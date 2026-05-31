import { useSearchParams } from 'next/navigation'
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Users, Plus, Search, Pencil, Trash2, X, Save,
  FileText, Calendar, Clock, Shield, TrendingUp,
  ChevronDown, ChevronUp, Download, Upload, AlertTriangle,
  CheckCircle2, XCircle, Eye, BarChart3, Banknote,
  UserCheck, UserX, ClipboardList
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── أنواع البيانات ──
type HREmployee = {
  id: number
  tenant_id: string
  employee_id: number
  national_id?: string
  nationality: string
  birth_date?: string
  gender: string
  marital_status: string
  hire_date?: string
  contract_type: string
  job_title?: string
  department?: string
  basic_salary: number
  housing_allow: number
  transport_allow: number
  other_allow: number
  gosi_enrolled: boolean
  gosi_pct: number
  iqama_number?: string
  iqama_expiry?: string
  bank_name?: string
  iban?: string
  notes?: string
  is_active: boolean
  employee?: { name: string; role: string; username: string }
}

type Leave = {
  id: number
  employee_id: number
  leave_type: string
  start_date: string
  end_date: string
  days: number
  status: string
  reason?: string
  employee?: { name: string }
}

type Attendance = {
  id: number
  employee_id: number
  date: string
  status: string
  hours_worked?: number
  overtime_hours?: number
  project_id?: number
  notes?: string
  employee?: { name: string }
}

type Document = {
  id: number
  employee_id: number
  doc_type: string
  name: string
  doc_number?: string
  issue_date?: string
  expiry_date?: string
  notify_days: number
  file_data?: string
  file_name?: string
  employee?: { name: string }
}

type Payroll = {
  id: number
  employee_id: number
  month: number
  year: number
  basic_salary: number
  housing_allow: number
  transport_allow: number
  other_allow: number
  overtime_pay: number
  bonuses: number
  gosi_deduction: number
  absence_deduct: number
  other_deduct: number
  gross_salary: number
  net_salary: number
  working_days: number
  present_days: number
  absent_days: number
  overtime_hours: number
  notes?: string
  status: string
  employee?: { name: string; role: string }
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

// ══════════════════════════════════════
// نافذة إضافة/تعديل موظف HR
// ══════════════════════════════════════
function HREmployeeModal({ emp, employees, onClose, onSave }: {
  emp: HREmployee | null
  employees: any[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'personal'|'salary'|'docs'>('personal')
  const [form, setForm] = useState({
    employee_id:    emp?.employee_id    || '',
    national_id:    emp?.national_id    || '',
    nationality:    emp?.nationality    || 'سعودي',
    birth_date:     emp?.birth_date     || '',
    gender:         emp?.gender         || 'ذكر',
    marital_status: emp?.marital_status || 'أعزب',
    hire_date:      emp?.hire_date      || '',
    contract_type:  emp?.contract_type  || 'دوام كامل',
    job_title:      emp?.job_title      || '',
    department:     emp?.department     || '',
    basic_salary:   emp?.basic_salary   ?? 0,
    housing_allow:  emp?.housing_allow  ?? 0,
    transport_allow:emp?.transport_allow?? 0,
    other_allow:    emp?.other_allow    ?? 0,
    gosi_enrolled:  emp?.gosi_enrolled  ?? false,
    gosi_pct:       emp?.gosi_pct       ?? 10,
    iqama_number:   emp?.iqama_number   || '',
    iqama_expiry:   emp?.iqama_expiry   || '',
    bank_name:      emp?.bank_name      || '',
    iban:           emp?.iban           || '',
    notes:          emp?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const totalSalary = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow)
  const gosiDeduct = form.gosi_enrolled ? Math.round(Number(form.basic_salary) * Number(form.gosi_pct) / 100) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    setSaving(true)
    await onSave({ ...(emp ? { id: emp.id } : {}), ...form, employee_id: Number(form.employee_id) })
    setSaving(false)
  }

  const TABS = [
    { id: 'personal', label: 'البيانات الشخصية' },
    { id: 'salary',   label: 'الراتب والتأمينات' },
    { id: 'docs',     label: 'البنك والإقامة' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{emp ? 'تعديل بيانات HR' : 'إضافة موظف للموارد البشرية'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Sub tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as any)}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--primary)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--text3)',
              }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* البيانات الشخصية */}
            {tab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
                  <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                    <option value="">— اختر موظف —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهوية / الإقامة</label>
                    <input value={form.national_id} onChange={e => set('national_id', e.target.value)} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الجنسية</label>
                    <input value={form.nationality} onChange={e => set('nationality', e.target.value)} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الميلاد</label>
                    <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الجنس</label>
                    <select value={form.gender} onChange={e => set('gender', e.target.value)} className="select">
                      <option value="ذكر">ذكر</option>
                      <option value="أنثى">أنثى</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة الاجتماعية</label>
                    <select value={form.marital_status} onChange={e => set('marital_status', e.target.value)} className="select">
                      {['أعزب','متزوج','مطلق','أرمل'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التعيين</label>
                    <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع العقد</label>
                    <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">
                      {['دوام كامل','دوام جزئي','مؤقت','مياومة'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي</label>
                    <input value={form.job_title} onChange={e => set('job_title', e.target.value)} className="input" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label>
                  <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="مثال: قسم المشاريع، قسم السلامة" />
                </div>
              </div>
            )}

            {/* الراتب والتأمينات */}
            {tab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الراتب الأساسي</label>
                    <input type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} className="input" min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدل السكن</label>
                    <input type="number" value={form.housing_allow} onChange={e => set('housing_allow', e.target.value)} className="input" min="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدل النقل</label>
                    <input type="number" value={form.transport_allow} onChange={e => set('transport_allow', e.target.value)} className="input" min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">بدلات أخرى</label>
                    <input type="number" value={form.other_allow} onChange={e => set('other_allow', e.target.value)} className="input" min="0" />
                  </div>
                </div>

                {/* ملخص الراتب */}
                <div style={{ background: 'var(--primary-light)', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي المستحقات</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{totalSalary.toLocaleString()} ر.س</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>خصم التأمينات</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c81e1e' }}>{gosiDeduct.toLocaleString()} ر.س</div>
                  </div>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الصافي المتوقع</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0ea77b' }}>{(totalSalary - gosiDeduct).toLocaleString()} ر.س</div>
                  </div>
                </div>

                {/* التأمينات */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg2)', borderRadius: '10px' }}>
                  <input type="checkbox" checked={form.gosi_enrolled} onChange={e => set('gosi_enrolled', e.target.checked)} className="w-4 h-4" id="gosi" />
                  <label htmlFor="gosi" className="text-sm font-medium text-gray-700">مسجل في التأمينات الاجتماعية (GOSI)</label>
                </div>
                {form.gosi_enrolled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة اشتراك الموظف %</label>
                    <input type="number" value={form.gosi_pct} onChange={e => set('gosi_pct', e.target.value)} className="input" min="0" max="100" step="0.5" />
                  </div>
                )}
              </div>
            )}

            {/* البنك والإقامة */}
            {tab === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم البنك</label>
                    <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" placeholder="مثال: الراجحي، الأهلي" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN</label>
                    <input value={form.iban} onChange={e => set('iban', e.target.value)} className="input" dir="ltr" placeholder="SA..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الإقامة (للوافدين)</label>
                    <input value={form.iqama_number} onChange={e => set('iqama_number', e.target.value)} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">انتهاء الإقامة</label>
                    <input type="date" value={form.iqama_expiry} onChange={e => set('iqama_expiry', e.target.value)} className="input" />
                  </div>
                </div>
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
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// نافذة الإجازة
// ══════════════════════════════════════
function LeaveModal({ leave, hrEmployees, onClose, onSave }: {
  leave: Leave | null
  hrEmployees: HREmployee[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: leave?.employee_id || '',
    leave_type:  leave?.leave_type  || 'سنوية',
    start_date:  leave?.start_date  || '',
    end_date:    leave?.end_date    || '',
    reason:      leave?.reason      || '',
    status:      leave?.status      || 'بانتظار الموافقة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const days = form.start_date && form.end_date
    ? Math.max(0, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1)
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...(leave ? { id: leave.id } : {}), ...form, employee_id: Number(form.employee_id), days })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{leave ? 'تعديل إجازة' : 'طلب إجازة جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {hrEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإجازة</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['سنوية','مرضية','طارئة','أمومة','حج','بدون راتب'].map(t => (
                  <button key={t} type="button" onClick={() => set('leave_type', t)}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                      border: '2px solid', cursor: 'pointer',
                      borderColor: form.leave_type === t ? 'var(--primary)' : 'var(--border)',
                      background: form.leave_type === t ? 'var(--primary-light)' : 'white',
                      color: form.leave_type === t ? 'var(--primary)' : 'var(--text3)',
                    }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">من تاريخ</label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">إلى تاريخ</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input" required />
              </div>
            </div>
            {days > 0 && (
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{days} يوم</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">السبب</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['بانتظار الموافقة','موافق','مرفوض'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {leave ? 'حفظ' : 'تقديم الطلب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// نافذة كشف الراتب
// ══════════════════════════════════════
function PayrollModal({ payroll, hrEmployees, onClose, onSave }: {
  payroll: Payroll | null
  hrEmployees: HREmployee[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const [form, setForm] = useState({
    employee_id:    payroll?.employee_id    || '',
    month:          payroll?.month          || now.getMonth() + 1,
    year:           payroll?.year           || now.getFullYear(),
    basic_salary:   payroll?.basic_salary   ?? 0,
    housing_allow:  payroll?.housing_allow  ?? 0,
    transport_allow:payroll?.transport_allow?? 0,
    other_allow:    payroll?.other_allow    ?? 0,
    overtime_pay:   payroll?.overtime_pay   ?? 0,
    bonuses:        payroll?.bonuses        ?? 0,
    gosi_deduction: payroll?.gosi_deduction ?? 0,
    absence_deduct: payroll?.absence_deduct ?? 0,
    other_deduct:   payroll?.other_deduct   ?? 0,
    present_days:   payroll?.present_days   ?? 26,
    absent_days:    payroll?.absent_days    ?? 0,
    overtime_hours: payroll?.overtime_hours ?? 0,
    status:         payroll?.status         || 'مسودة',
    notes:          payroll?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const gross = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow) + Number(form.overtime_pay) + Number(form.bonuses)
  const deductions = Number(form.gosi_deduction) + Number(form.absence_deduct) + Number(form.other_deduct)
  const net = gross - deductions

  // عند اختيار موظف نملأ بياناته تلقائياً
  function handleEmpChange(empId: string) {
    set('employee_id', empId)
    const emp = hrEmployees.find(e => e.employee_id === Number(empId))
    if (emp) {
      set('basic_salary', emp.basic_salary)
      set('housing_allow', emp.housing_allow)
      set('transport_allow', emp.transport_allow)
      set('other_allow', emp.other_allow)
      if (emp.gosi_enrolled) set('gosi_deduction', Math.round(emp.basic_salary * emp.gosi_pct / 100))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      ...(payroll ? { id: payroll.id } : {}),
      ...form,
      employee_id: Number(form.employee_id),
      gross_salary: gross,
      net_salary: net,
      working_days: 26,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{payroll ? 'تعديل كشف الراتب' : 'إنشاء كشف راتب'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-3 gap-3">
              <div style={{ gridColumn: '1/-1' }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف</label>
                <select value={form.employee_id} onChange={e => handleEmpChange(e.target.value)} className="select" required>
                  <option value="">— اختر موظف —</option>
                  {hrEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee?.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الشهر</label>
                <select value={form.month} onChange={e => set('month', Number(e.target.value))} className="select">
                  {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">السنة</label>
                <input type="number" value={form.year} onChange={e => set('year', Number(e.target.value))} className="input" min="2020" max="2030" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الحضور</label>
                <input type="number" value={form.present_days} onChange={e => set('present_days', Number(e.target.value))} className="input" min="0" max="31" />
              </div>
            </div>

            {/* المستحقات */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#0ea77b', marginBottom: '10px', fontSize: '0.875rem' }}>✅ المستحقات</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'basic_salary', l: 'الراتب الأساسي' },
                  { k: 'housing_allow', l: 'بدل السكن' },
                  { k: 'transport_allow', l: 'بدل النقل' },
                  { k: 'other_allow', l: 'بدلات أخرى' },
                  { k: 'overtime_pay', l: 'أجر الإضافي' },
                  { k: 'bonuses', l: 'مكافآت' },
                ].map(({ k, l }) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" />
                  </div>
                ))}
              </div>
            </div>

            {/* الخصومات */}
            <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#c81e1e', marginBottom: '10px', fontSize: '0.875rem' }}>❌ الخصومات</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: 'gosi_deduction', l: 'التأمينات' },
                  { k: 'absence_deduct', l: 'خصم الغياب' },
                  { k: 'other_deduct', l: 'خصومات أخرى' },
                ].map(({ k, l }) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" />
                  </div>
                ))}
              </div>
            </div>

            {/* الملخص */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الإجمالي</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{gross.toLocaleString()}</div>
              </div>
              <div style={{ background: '#fff5f5', borderRadius: '10px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الخصومات</div>
                <div style={{ fontWeight: 700, color: '#c81e1e' }}>{deductions.toLocaleString()}</div>
              </div>
              <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الصافي</div>
                <div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1rem' }}>{net.toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة','معتمد','مدفوع'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ كشف الراتب
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function HRPage() {
  const { tenant, activeBranch, employees, currentUser } = useStore()
import { useSearchParams } from 'next/navigation'
// داخل الـ component:
const searchParams = useSearchParams()
const tabParam = searchParams.get('tab')
const [activeTab, setActiveTab] = useState<'employees'|'attendance'|'leaves'|'payroll'|'documents'>(
  (tabParam as any) || 'employees'
)
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Modals
  const [showEmpModal, setEmpModal] = useState(false)
  const [editEmp, setEditEmp] = useState<HREmployee | null>(null)
  const [showLeaveModal, setLeaveModal] = useState(false)
  const [editLeave, setEditLeave] = useState<Leave | null>(null)
  const [showPayrollModal, setPayrollModal] = useState(false)
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null)

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id, activeTab])

  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id

    if (activeTab === 'employees') {
      const { data } = await supabase.from('hr_employees').select('*, employee:employees(name, role, username)').eq('tenant_id', tid).order('id')
      setHREmployees(data || [])
    } else if (activeTab === 'leaves') {
      const { data } = await supabase.from('hr_leaves').select('*, employee:employees(name)').eq('tenant_id', tid).order('start_date', { ascending: false })
      setLeaves(data || [])
    } else if (activeTab === 'attendance') {
      const { data } = await supabase.from('hr_attendance').select('*, employee:employees(name)').eq('tenant_id', tid).order('date', { ascending: false }).limit(100)
      setAttendance(data || [])
    } else if (activeTab === 'payroll') {
      const { data } = await supabase.from('hr_payroll').select('*, employee:employees(name, role)').eq('tenant_id', tid).order('year', { ascending: false }).order('month', { ascending: false })
      setPayrolls(data || [])
    } else if (activeTab === 'documents') {
      const { data } = await supabase.from('hr_documents').select('*, employee:employees(name)').eq('tenant_id', tid).order('expiry_date')
      setDocuments(data || [])
    }

    setLoading(false)
  }

  // ── CRUD ──
  async function saveHREmployee(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_employees').update(payload).eq('id', data.id)
    else await supabase.from('hr_employees').insert(payload)
    await loadData()
    setEmpModal(false); setEditEmp(null)
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  async function saveLeave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch?.id }
    if (data.id) await supabase.from('hr_leaves').update(payload).eq('id', data.id)
    else await supabase.from('hr_leaves').insert(payload)
    await loadData()
    setLeaveModal(false); setEditLeave(null)
    toast.success('تم الحفظ ✅')
  }

  async function savePayroll(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch?.id }
    if (data.id) await supabase.from('hr_payroll').update(payload).eq('id', data.id)
    else await supabase.from('hr_payroll').insert(payload)
    await loadData()
    setPayrollModal(false); setEditPayroll(null)
    toast.success('تم حفظ كشف الراتب ✅')
  }

  // ── KPIs ──
  const totalEmployees = hrEmployees.filter(e => e.is_active).length
  const totalSalaries = hrEmployees.reduce((s, e) => s + e.basic_salary + e.housing_allow + e.transport_allow + e.other_allow, 0)
  const pendingLeaves = leaves.filter(l => l.status === 'بانتظار الموافقة').length
  const now = new Date()
  const expiringDocs = documents.filter(d => {
    if (!d.expiry_date) return false
    const days = Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000)
    return days <= 30 && days > 0
  }).length

  const TABS = [
    { id: 'employees',  label: 'الموظفون',       icon: <Users className="w-4 h-4" /> },
    { id: 'attendance', label: 'الحضور والغياب', icon: <Clock className="w-4 h-4" /> },
    { id: 'leaves',     label: 'الإجازات',        icon: <Calendar className="w-4 h-4" /> },
    { id: 'payroll',    label: 'الرواتب',         icon: <Banknote className="w-4 h-4" /> },
    { id: 'documents',  label: 'الوثائق',         icon: <FileText className="w-4 h-4" /> },
  ]

  const STATUS_COLOR: Record<string, string> = {
    'بانتظار الموافقة': 'badge-amber',
    'موافق': 'badge-green',
    'مرفوض': 'badge-red',
    'مسودة': 'badge-gray',
    'معتمد': 'badge-blue',
    'مدفوع': 'badge-green',
    'حضور': 'badge-green',
    'غياب': 'badge-red',
    'إجازة': 'badge-amber',
    'مأمورية': 'badge-blue',
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          الموارد البشرية
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة شاملة للموظفين والرواتب والإجازات</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'الموظفون النشطون', value: totalEmployees, color: '#1a56db', bg: '#eff6ff', icon: <UserCheck style={{ width: '18px', height: '18px' }} /> },
          { label: 'إجمالي الرواتب', value: `${totalSalaries.toLocaleString()} ر.س`, color: '#0ea77b', bg: '#ecfdf5', icon: <Banknote style={{ width: '18px', height: '18px' }} /> },
          { label: 'إجازات معلقة', value: pendingLeaves, color: pendingLeaves > 0 ? '#e6820a' : '#0ea77b', bg: pendingLeaves > 0 ? '#fffbeb' : '#ecfdf5', icon: <Calendar style={{ width: '18px', height: '18px' }} /> },
          { label: 'وثائق قريبة الانتهاء', value: expiringDocs, color: expiringDocs > 0 ? '#c81e1e' : '#0ea77b', bg: expiringDocs > 0 ? '#fef2f2' : '#ecfdf5', icon: <AlertTriangle style={{ width: '18px', height: '18px' }} /> },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem',
              fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px rgba(26,86,219,0.3)' : 'none',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ الموظفون ══ */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '240px' }} placeholder="بحث..." />
            </div>
            {isAdmin && (
              <button onClick={() => { setEditEmp(null); setEmpModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة موظف
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : hrEmployees.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا يوجد موظفون في الموارد البشرية بعد</p>
              {isAdmin && (
                <button onClick={() => { setEditEmp(null); setEmpModal(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول موظف
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {hrEmployees.filter(e => !search || e.employee?.name.toLowerCase().includes(search.toLowerCase())).map(emp => {
                const totalSal = emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow
                return (
                  <div key={emp.id} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                          {emp.employee?.name?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{emp.employee?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{emp.job_title || emp.employee?.role}</div>
                        </div>
                      </div>
                      <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-gray'} text-xs`}>
                        {emp.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: 'var(--text3)' }}>الجنسية: </span>
                        <span style={{ fontWeight: 600 }}>{emp.nationality}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text3)' }}>العقد: </span>
                        <span style={{ fontWeight: 600 }}>{emp.contract_type}</span>
                      </div>
                      {emp.hire_date && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <span style={{ color: 'var(--text3)' }}>تاريخ التعيين: </span>
                          <span style={{ fontWeight: 600 }}>{formatDate(emp.hire_date)}</span>
                        </div>
                      )}
                    </div>

                    {/* الراتب */}
                    <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي الراتب</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{totalSal.toLocaleString()} ر.س</span>
                      </div>
                      {emp.gosi_enrolled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>مسجل في GOSI</span>
                          <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>✓</span>
                        </div>
                      )}
                    </div>

                    {/* إنذارات الإقامة */}
                    {emp.iqama_expiry && (() => {
                      const days = Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000)
                      return days <= 60 ? (
                        <div style={{ background: days <= 0 ? '#fef2f2' : '#fffbeb', borderRadius: '8px', padding: '8px', marginBottom: '10px', fontSize: '0.75rem', color: days <= 0 ? '#c81e1e' : '#e6820a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle style={{ width: '14px', height: '14px' }} />
                          {days <= 0 ? 'إقامة منتهية!' : `إقامة تنتهي خلال ${days} يوم`}
                        </div>
                      ) : null
                    })()}

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--bg2)' }}>
                        <button onClick={() => { setEditEmp(emp); setEmpModal(true) }} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                          <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ الحضور والغياب ══ */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--text)' }}>سجل الحضور والغياب</h3>
            {isAdmin && (
              <button onClick={async () => {
                const empId = prompt('رقم الموظف:')
                const date = new Date().toISOString().split('T')[0]
                const status = 'حضور'
                if (!empId || !tenant) return
                await supabase.from('hr_attendance').insert({ tenant_id: tenant.id, employee_id: Number(empId), branch_id: activeBranch?.id, date, status })
                await loadData()
                toast.success('تم تسجيل الحضور ✅')
              }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> تسجيل حضور
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : attendance.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Clock style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد سجلات حضور بعد</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>الموظف</th><th>التاريخ</th><th>الحالة</th><th>ساعات العمل</th><th>الإضافي</th><th>ملاحظات</th></tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.employee?.name || `#${a.employee_id}`}</td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text2)' }}>{formatDate(a.date)}</td>
                      <td><span className={`badge ${STATUS_COLOR[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                      <td style={{ textAlign: 'center' }}>{a.hours_worked || '—'}</td>
                      <td style={{ textAlign: 'center', color: a.overtime_hours ? '#e6820a' : 'var(--text3)' }}>{a.overtime_hours || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{a.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ الإجازات ══ */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text)' }}>طلبات الإجازات</h3>
              {pendingLeaves > 0 && <span className="badge badge-amber">{pendingLeaves} بانتظار الموافقة</span>}
            </div>
            <button onClick={() => { setEditLeave(null); setLeaveModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> طلب إجازة
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Calendar style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد طلبات إجازة</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>السبب</th><th></th></tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.employee?.name || `#${l.employee_id}`}</td>
                      <td><span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{l.leave_type}</span></td>
                      <td style={{ fontSize: '0.875rem' }}>{formatDate(l.start_date)}</td>
                      <td style={{ fontSize: '0.875rem' }}>{formatDate(l.end_date)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.days}</td>
                      <td><span className={`badge ${STATUS_COLOR[l.status] || 'badge-gray'}`}>{l.status}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text3)', maxWidth: '150px' }} className="truncate">{l.reason || '—'}</td>
                      <td>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setEditLeave(l); setLeaveModal(true) }} className="btn btn-ghost btn-xs">
                              <Pencil style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ الرواتب ══ */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--text)' }}>كشوف الرواتب</h3>
            {isAdmin && (
              <button onClick={() => { setEditPayroll(null); setPayrollModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إنشاء كشف راتب
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : payrolls.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Banknote style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد كشوف رواتب بعد</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>الموظف</th><th>الشهر</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th><th></th></tr>
                </thead>
                <tbody>
                  {payrolls.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.employee?.name || `#${p.employee_id}`}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{p.employee?.role}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{ARABIC_MONTHS[p.month - 1]} {p.year}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                      <td style={{ color: '#c81e1e', fontWeight: 600 }}>{(p.gosi_deduction + p.absence_deduct + p.other_deduct).toLocaleString()} ر.س</td>
                      <td style={{ color: '#0ea77b', fontWeight: 700, fontSize: '1rem' }}>{p.net_salary.toLocaleString()} ر.س</td>
                      <td><span className={`badge ${STATUS_COLOR[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                      <td>
                        {isAdmin && (
                          <button onClick={() => { setEditPayroll(p); setPayrollModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '14px', height: '14px' }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ملخص الرواتب */}
          {payrolls.length > 0 && (
            <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي المستحقات</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{payrolls.reduce((s, p) => s + p.gross_salary, 0).toLocaleString()} ر.س</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي الخصومات</div>
                <div style={{ fontWeight: 700, color: '#c81e1e', fontSize: '1.1rem' }}>{payrolls.reduce((s, p) => s + p.gosi_deduction + p.absence_deduct + p.other_deduct, 0).toLocaleString()} ر.س</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي الصافي</div>
                <div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1.1rem' }}>{payrolls.reduce((s, p) => s + p.net_salary, 0).toLocaleString()} ر.س</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ الوثائق ══ */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text)' }}>وثائق الموظفين</h3>
              {expiringDocs > 0 && <span className="badge badge-amber">⚠ {expiringDocs} قريبة الانتهاء</span>}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد وثائق مضافة</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>الموظف</th><th>نوع الوثيقة</th><th>الاسم</th><th>الرقم</th><th>تاريخ الإصدار</th><th>تاريخ الانتهاء</th><th>الحالة</th></tr>
                </thead>
                <tbody>
                  {documents.map(d => {
                    const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000) : null
                    const isExpired = days !== null && days <= 0
                    const isSoon = days !== null && days > 0 && days <= 30
                    return (
                      <tr key={d.id} style={{ background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : '' }}>
                        <td style={{ fontWeight: 600 }}>{d.employee?.name || `#${d.employee_id}`}</td>
                        <td><span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{d.doc_type}</span></td>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{d.doc_number || '—'}</td>
                        <td style={{ fontSize: '0.875rem' }}>{formatDate(d.issue_date)}</td>
                        <td style={{ fontSize: '0.875rem' }}>{formatDate(d.expiry_date)}</td>
                        <td>
                          {days !== null ? (
                            <span className={`badge ${isExpired ? 'badge-red' : isSoon ? 'badge-amber' : 'badge-green'}`}>
                              {isExpired ? `منتهي منذ ${Math.abs(days)} يوم` : isSoon ? `${days} يوم` : `✓ ${days} يوم`}
                            </span>
                          ) : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showEmpModal && (
        <HREmployeeModal emp={editEmp} employees={employees} onClose={() => { setEmpModal(false); setEditEmp(null) }} onSave={saveHREmployee} />
      )}
      {showLeaveModal && (
        <LeaveModal leave={editLeave} hrEmployees={hrEmployees} onClose={() => { setLeaveModal(false); setEditLeave(null) }} onSave={saveLeave} />
      )}
      {showPayrollModal && (
        <PayrollModal payroll={editPayroll} hrEmployees={hrEmployees} onClose={() => { setPayrollModal(false); setEditPayroll(null) }} onSave={savePayroll} />
      )}
    </div>
  )
}
