'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Banknote, Plus, Pencil, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

type HREmployee = {
  id: number; employee_id: number; basic_salary: number; housing_allow: number
  transport_allow: number; other_allow: number; gosi_enrolled: boolean; gosi_pct: number
  employee?: { name: string; role: string }
}

type Payroll = {
  id: number; employee_id: number; month: number; year: number
  basic_salary: number; housing_allow: number; transport_allow: number; other_allow: number
  overtime_pay: number; bonuses: number; gosi_deduction: number; absence_deduct: number
  other_deduct: number; gross_salary: number; net_salary: number
  present_days: number; absent_days: number; overtime_hours: number
  notes?: string; status: string
  employee?: { name: string; role: string }
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

function PayrollModal({ payroll, hrEmployees, onClose, onSave }: {
  payroll: Payroll | null; hrEmployees: HREmployee[]; onClose: () => void; onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const [form, setForm] = useState({
    employee_id: payroll?.employee_id || '', month: payroll?.month || now.getMonth() + 1,
    year: payroll?.year || now.getFullYear(), basic_salary: payroll?.basic_salary ?? 0,
    housing_allow: payroll?.housing_allow ?? 0, transport_allow: payroll?.transport_allow ?? 0,
    other_allow: payroll?.other_allow ?? 0, overtime_pay: payroll?.overtime_pay ?? 0,
    bonuses: payroll?.bonuses ?? 0, gosi_deduction: payroll?.gosi_deduction ?? 0,
    absence_deduct: payroll?.absence_deduct ?? 0, other_deduct: payroll?.other_deduct ?? 0,
    present_days: payroll?.present_days ?? 26, absent_days: payroll?.absent_days ?? 0,
    overtime_hours: payroll?.overtime_hours ?? 0, status: payroll?.status || 'مسودة', notes: payroll?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const gross = Number(form.basic_salary)+Number(form.housing_allow)+Number(form.transport_allow)+Number(form.other_allow)+Number(form.overtime_pay)+Number(form.bonuses)
  const deductions = Number(form.gosi_deduction)+Number(form.absence_deduct)+Number(form.other_deduct)
  const net = gross - deductions

  function handleEmpChange(empId: string) {
    set('employee_id', empId)
    const emp = hrEmployees.find(e => e.employee_id === Number(empId))
    if (emp) {
      set('basic_salary', emp.basic_salary); set('housing_allow', emp.housing_allow)
      set('transport_allow', emp.transport_allow); set('other_allow', emp.other_allow)
      if (emp.gosi_enrolled) set('gosi_deduction', Math.round(emp.basic_salary * emp.gosi_pct / 100))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...(payroll ? { id: payroll.id } : {}), ...form, employee_id: Number(form.employee_id), gross_salary: gross, net_salary: net, working_days: 26 })
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
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">السنة</label><input type="number" value={form.year} onChange={e => set('year', Number(e.target.value))} className="input" min="2020" max="2030" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الحضور</label><input type="number" value={form.present_days} onChange={e => set('present_days', Number(e.target.value))} className="input" min="0" max="31" /></div>
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#0ea77b', marginBottom: '10px', fontSize: '0.875rem' }}>✅ المستحقات</div>
              <div className="grid grid-cols-2 gap-3">
                {[{k:'basic_salary',l:'الراتب الأساسي'},{k:'housing_allow',l:'بدل السكن'},{k:'transport_allow',l:'بدل النقل'},{k:'other_allow',l:'بدلات أخرى'},{k:'overtime_pay',l:'أجر الإضافي'},{k:'bonuses',l:'مكافآت'}].map(({k,l}) => (
                  <div key={k}><label className="block text-xs text-gray-500 mb-1">{l}</label><input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" /></div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#c81e1e', marginBottom: '10px', fontSize: '0.875rem' }}>❌ الخصومات</div>
              <div className="grid grid-cols-3 gap-3">
                {[{k:'gosi_deduction',l:'التأمينات'},{k:'absence_deduct',l:'خصم الغياب'},{k:'other_deduct',l:'خصومات أخرى'}].map(({k,l}) => (
                  <div key={k}><label className="block text-xs text-gray-500 mb-1">{l}</label><input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" /></div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الإجمالي</div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{gross.toLocaleString()}</div></div>
              <div style={{ background: '#fff5f5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الخصومات</div><div style={{ fontWeight: 700, color: '#c81e1e' }}>{deductions.toLocaleString()}</div></div>
              <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الصافي</div><div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1rem' }}>{net.toLocaleString()}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة','معتمد','مدفوع'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" /></div>
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

export default function PayrollPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from('hr_payroll').select('*, employee:employees(name, role)').eq('tenant_id', tenant.id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('hr_employees').select('*, employee:employees(name, role)').eq('tenant_id', tenant.id)
    ])
    setPayrolls(p.data || [])
    setHREmployees(e.data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch?.id }
    if (data.id) await supabase.from('hr_payroll').update(payload).eq('id', data.id)
    else await supabase.from('hr_payroll').insert(payload)
    await load(); setShowModal(false); setEditPayroll(null)
    toast.success('تم حفظ كشف الراتب ✅')
  }

  const filtered = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
  const totalGross = filtered.reduce((s, p) => s + p.gross_salary, 0)
  const totalDeduct = filtered.reduce((s, p) => s + p.gosi_deduction + p.absence_deduct + p.other_deduct, 0)
  const totalNet = filtered.reduce((s, p) => s + p.net_salary, 0)

  const STATUS_COLOR: Record<string, string> = { 'مسودة': 'badge-gray', 'معتمد': 'badge-blue', 'مدفوع': 'badge-green' }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Banknote style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> الرواتب
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة كشوف الرواتب الشهرية</p>
      </div>

      {/* فلتر الشهر */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="select" style={{ width: 'auto' }}>
            {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="input" style={{ width: '90px' }} min="2020" max="2030" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>{filtered.length} موظف</span>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditPayroll(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إنشاء كشف راتب
          </button>
        )}
      </div>

      {/* ملخص الشهر */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المستحقات', value: `${totalGross.toLocaleString()} ر.س`, color: 'var(--primary)', bg: 'var(--primary-light)' },
            { label: 'إجمالي الخصومات', value: `${totalDeduct.toLocaleString()} ر.س`, color: '#c81e1e', bg: '#fef2f2' },
            { label: 'إجمالي الصافي', value: `${totalNet.toLocaleString()} ر.س`, color: '#0ea77b', bg: '#ecfdf5' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Banknote style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد كشوف رواتب لهذا الشهر</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>الراتب الأساسي</th><th>البدلات</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th>أيام الحضور</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><div style={{ fontWeight: 600 }}>{p.employee?.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{p.employee?.role}</div></td>
                  <td style={{ fontWeight: 600 }}>{p.basic_salary.toLocaleString()} ر.س</td>
                  <td style={{ color: 'var(--text2)' }}>{(p.housing_allow + p.transport_allow + p.other_allow).toLocaleString()} ر.س</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                  <td style={{ color: '#c81e1e' }}>{(p.gosi_deduction + p.absence_deduct + p.other_deduct).toLocaleString()} ر.س</td>
                  <td style={{ color: '#0ea77b', fontWeight: 700, fontSize: '1rem' }}>{p.net_salary.toLocaleString()} ر.س</td>
                  <td style={{ textAlign: 'center' }}>{p.present_days}/26</td>
                  <td><span className={`badge ${STATUS_COLOR[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                  <td>
                    {isAdmin && (
                      <button onClick={() => { setEditPayroll(p); setShowModal(true) }} className="btn btn-ghost btn-xs">
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

      {showModal && (
        <PayrollModal payroll={editPayroll} hrEmployees={hrEmployees}
          onClose={() => { setShowModal(false); setEditPayroll(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
