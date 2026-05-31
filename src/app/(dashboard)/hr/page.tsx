'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Search, Pencil, X, Save, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

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

function HREmployeeModal({ emp, employees, onClose, onSave }: {
  emp: HREmployee | null; employees: any[]; onClose: () => void; onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'personal'|'salary'|'docs'>('personal')
  const [form, setForm] = useState({
    employee_id: emp?.employee_id || '', national_id: emp?.national_id || '',
    nationality: emp?.nationality || 'سعودي', birth_date: emp?.birth_date || '',
    gender: emp?.gender || 'ذكر', marital_status: emp?.marital_status || 'أعزب',
    hire_date: emp?.hire_date || '', contract_type: emp?.contract_type || 'دوام كامل',
    job_title: emp?.job_title || '', department: emp?.department || '',
    basic_salary: emp?.basic_salary ?? 0, housing_allow: emp?.housing_allow ?? 0,
    transport_allow: emp?.transport_allow ?? 0, other_allow: emp?.other_allow ?? 0,
    gosi_enrolled: emp?.gosi_enrolled ?? false, gosi_pct: emp?.gosi_pct ?? 10,
    iqama_number: emp?.iqama_number || '', iqama_expiry: emp?.iqama_expiry || '',
    bank_name: emp?.bank_name || '', iban: emp?.iban || '', notes: emp?.notes || '',
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{emp ? 'تعديل بيانات الموظف' : 'إضافة موظف للموارد البشرية'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div style={{ display: 'flex', gap: '4px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          {[{id:'personal',label:'البيانات الشخصية'},{id:'salary',label:'الراتب والتأمينات'},{id:'docs',label:'البنك والإقامة'}].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as any)}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--primary)' : 'transparent', color: tab === t.id ? 'white' : 'var(--text3)' }}>{t.label}</button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهوية / الإقامة</label><input value={form.national_id} onChange={e => set('national_id', e.target.value)} className="input" dir="ltr" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الجنسية</label><input value={form.nationality} onChange={e => set('nationality', e.target.value)} className="input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الميلاد</label><input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الجنس</label><select value={form.gender} onChange={e => set('gender', e.target.value)} className="select"><option>ذكر</option><option>أنثى</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة الاجتماعية</label><select value={form.marital_status} onChange={e => set('marital_status', e.target.value)} className="select">{['أعزب','متزوج','مطلق','أرمل'].map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التعيين</label><input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">نوع العقد</label><select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">{['دوام كامل','دوام جزئي','مؤقت','مياومة'].map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي</label><input value={form.job_title} onChange={e => set('job_title', e.target.value)} className="input" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label><input value={form.department} onChange={e => set('department', e.target.value)} className="input" /></div>
              </div>
            )}
            {tab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الراتب الأساسي</label><input type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} className="input" min="0" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">بدل السكن</label><input type="number" value={form.housing_allow} onChange={e => set('housing_allow', e.target.value)} className="input" min="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">بدل النقل</label><input type="number" value={form.transport_allow} onChange={e => set('transport_allow', e.target.value)} className="input" min="0" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">بدلات أخرى</label><input type="number" value={form.other_allow} onChange={e => set('other_allow', e.target.value)} className="input" min="0" /></div>
                </div>
                <div style={{ background: 'var(--primary-light)', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي المستحقات</div><div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{totalSalary.toLocaleString()} ر.س</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>خصم التأمينات</div><div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c81e1e' }}>{gosiDeduct.toLocaleString()} ر.س</div></div>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', paddingTop: '8px' }}><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الصافي المتوقع</div><div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0ea77b' }}>{(totalSalary - gosiDeduct).toLocaleString()} ر.س</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg2)', borderRadius: '10px' }}>
                  <input type="checkbox" checked={form.gosi_enrolled} onChange={e => set('gosi_enrolled', e.target.checked)} className="w-4 h-4" id="gosi" />
                  <label htmlFor="gosi" className="text-sm font-medium text-gray-700">مسجل في التأمينات الاجتماعية (GOSI)</label>
                </div>
                {form.gosi_enrolled && <div><label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة اشتراك الموظف %</label><input type="number" value={form.gosi_pct} onChange={e => set('gosi_pct', e.target.value)} className="input" min="0" max="100" step="0.5" /></div>}
              </div>
            )}
            {tab === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">اسم البنك</label><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN</label><input value={form.iban} onChange={e => set('iban', e.target.value)} className="input" dir="ltr" placeholder="SA..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الإقامة</label><input value={form.iqama_number} onChange={e => set('iqama_number', e.target.value)} className="input" dir="ltr" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">انتهاء الإقامة</label><input type="date" value={form.iqama_expiry} onChange={e => set('iqama_expiry', e.target.value)} className="input" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }} /></div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function HRPage() {
  const { tenant, employees, currentUser } = useStore()
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
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
    const { data } = await supabase.from('hr_employees')
      .select('*, employee:employees(name, role, username)')
      .eq('tenant_id', tenant.id)
      .order('id')
    setHREmployees(data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_employees').update(payload).eq('id', data.id)
    else await supabase.from('hr_employees').insert(payload)
    await load()
    setShowModal(false); setEditEmp(null)
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  const filtered = hrEmployees.filter(e =>
    !search || e.employee?.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalSalaries = hrEmployees.reduce((s, e) => s + e.basic_salary + e.housing_allow + e.transport_allow + e.other_allow, 0)
  const active = hrEmployees.filter(e => e.is_active).length
  const saudiCount = hrEmployees.filter(e => e.nationality === 'سعودي').length
  const expats = hrEmployees.filter(e => e.nationality !== 'سعودي').length

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> ملفات الموظفين
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>بيانات الموظفين الشاملة والرواتب والتأمينات</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'الموظفون النشطون', value: active, color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي الرواتب', value: `${totalSalaries.toLocaleString()} ر.س`, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'سعوديون', value: saudiCount, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'وافدون', value: expats, color: '#e6820a', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '240px' }} placeholder="بحث باسم الموظف..." />
        </div>
        {isAdmin && (
          <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة موظف
          </button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا يوجد موظفون بعد</p>
          {isAdmin && (
            <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول موظف
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => {
            const totalSal = emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow
            const iqamaDays = emp.iqama_expiry ? Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000) : null
            return (
              <div key={emp.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>
                      {emp.employee?.name?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{emp.employee?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{emp.job_title || emp.employee?.role}</div>
                    </div>
                  </div>
                  <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-gray'} text-xs`}>
                    {emp.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </div>

                {/* Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px', fontSize: '0.8rem' }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>الجنسية</div>
                    <div style={{ fontWeight: 600 }}>{emp.nationality}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>نوع العقد</div>
                    <div style={{ fontWeight: 600 }}>{emp.contract_type}</div>
                  </div>
                  {emp.department && (
                    <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px', gridColumn: '1/-1' }}>
                      <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>القسم</div>
                      <div style={{ fontWeight: 600 }}>{emp.department}</div>
                    </div>
                  )}
                  {emp.hire_date && (
                    <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '6px 10px', gridColumn: '1/-1' }}>
                      <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>تاريخ التعيين</div>
                      <div style={{ fontWeight: 600 }}>{formatDate(emp.hire_date)}</div>
                    </div>
                  )}
                </div>

                {/* Salary */}
                <div style={{ background: 'linear-gradient(135deg, var(--primary-light), #e0e7ff)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>إجمالي الراتب</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{totalSal.toLocaleString()} ر.س</span>
                </div>

                {/* GOSI + Iqama alerts */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {emp.gosi_enrolled && (
                    <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>✓ GOSI</span>
                  )}
                  {emp.bank_name && (
                    <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>🏦 {emp.bank_name}</span>
                  )}
                </div>

                {iqamaDays !== null && iqamaDays <= 60 && (
                  <div style={{ background: iqamaDays <= 0 ? '#fef2f2' : '#fffbeb', borderRadius: '8px', padding: '7px 10px', marginBottom: '10px', fontSize: '0.75rem', color: iqamaDays <= 0 ? '#c81e1e' : '#e6820a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                    {iqamaDays <= 0 ? `إقامة منتهية منذ ${Math.abs(iqamaDays)} يوم!` : `إقامة تنتهي خلال ${iqamaDays} يوم`}
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div style={{ paddingTop: '10px', borderTop: '1px solid var(--bg2)' }}>
                    <button onClick={() => { setEditEmp(emp); setShowModal(true) }} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                      <Pencil style={{ width: '14px', height: '14px' }} /> تعديل البيانات
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <HREmployeeModal emp={editEmp} employees={employees}
          onClose={() => { setShowModal(false); setEditEmp(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
