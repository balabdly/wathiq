'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Banknote, Pencil, X, Save, ChevronDown, ChevronUp, CheckSquare, Square, FileText, Palmtree, Download } from 'lucide-react'
import toast from 'react-hot-toast'

type HREmployee = {
  id: number; employee_id: number; name?: string; basic_salary: number; housing_allow: number
  transport_allow: number; other_allow: number; gosi_enrolled: boolean; gosi_pct: number
  nationality: string; hire_date?: string; department?: string; job_title?: string; is_active?: boolean
}
type PendingDeduct = {
  id: number; employee_id: number; violation_name: string
  salary_deduct_days: number; incident_date: string; penalty_degree: number
}

type Payroll = {
  id: number; employee_id: number; month: number; year: number
  basic_salary: number; housing_allow: number; transport_allow: number; other_allow: number
  overtime_pay: number; bonuses: number; gosi_deduction: number; absence_deduct: number
  other_deduct: number; gross_salary: number; net_salary: number
  present_days: number; absent_days: number; notes?: string; status: string; emp_name?: string
}
type PayrollRow = {
  employee_id: number; name: string; role: string; included: boolean
  basic_salary: number; housing_allow: number; transport_allow: number; other_allow: number
  overtime_pay: number; bonuses: number; gosi_deduction: number; absence_deduct: number
  other_deduct: number; present_days: number; notes: string; gross: number; net: number; existingId?: number
  _pendingDeductIds?: number[]
}
type Termination = {
  id: number; employee_id: number; hr_employee_id: number
  termination_type: string; termination_date: string; last_working_day: string
  years_of_service: number; gratuity_amount: number; notes?: string; emp_name?: string
}
type Settlement = {
  id: number; tenant_id: string; employee_id: number; termination_id: number
  termination_date: string; last_working_day: string; termination_type: string
  gratuity_amount: number; month_salary_days: number; month_salary_amount: number
  leave_balance_days: number; leave_compensation: number
  other_entitlements: number; other_entitlements_note: string
  advances_deduct: number; other_deduct: number; other_deduct_note: string
  total_entitlements: number; total_deductions: number; net_settlement: number
  status: string; notes?: string; emp_name?: string
}
type LeaveCompensation = {
  id: number; tenant_id: string; employee_id: number
  compensation_date: string; leave_days: number; daily_salary: number; total_amount: number
  reason: string; status: string; notes?: string; emp_name?: string
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const STATUS_COLOR: Record<string, string> = { 'مسودة': 'badge-gray', 'معتمد': 'badge-blue', 'مدفوع': 'badge-green' }

function calcRow(r: PayrollRow): PayrollRow {
  const gross = r.basic_salary + r.housing_allow + r.transport_allow + r.other_allow + r.overtime_pay + r.bonuses
  const net = gross - r.gosi_deduction - r.absence_deduct - r.other_deduct
  return { ...r, gross, net }
}
function dailySalary(emp: HREmployee) {
  return (emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow) / 30
}
function buildEmpNameMap(hrEmps: HREmployee[]): Record<number, string> {
  const map: Record<number, string> = {}
  hrEmps.forEach(e => { map[e.employee_id] = e.name || `موظف #${e.employee_id}` })
  return map
}

function EditPayrollModal({ payroll, onClose, onSave }: { payroll: Payroll; onClose: () => void; onSave: (d: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    basic_salary: payroll.basic_salary, housing_allow: payroll.housing_allow,
    transport_allow: payroll.transport_allow, other_allow: payroll.other_allow,
    overtime_pay: payroll.overtime_pay, bonuses: payroll.bonuses,
    gosi_deduction: payroll.gosi_deduction, absence_deduct: payroll.absence_deduct,
    other_deduct: payroll.other_deduct, present_days: payroll.present_days,
    status: payroll.status, notes: payroll.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const gross = form.basic_salary + form.housing_allow + form.transport_allow + form.other_allow + form.overtime_pay + form.bonuses
  const net = gross - form.gosi_deduction - form.absence_deduct - form.other_deduct
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await onSave({ id: payroll.id, ...form, gross_salary: gross, net_salary: net })
    setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">تعديل راتب — {payroll.emp_name || '#' + payroll.employee_id}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div style={{ background: '#fff5f5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الخصومات</div><div style={{ fontWeight: 700, color: '#c81e1e' }}>{(form.gosi_deduction+form.absence_deduct+form.other_deduct).toLocaleString()}</div></div>
              <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الصافي</div><div style={{ fontWeight: 700, color: '#0ea77b' }}>{net.toLocaleString()}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الحضور</label><input type="number" value={form.present_days} onChange={e => set('present_days', Number(e.target.value))} className="input" min="0" max="31" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label><select value={form.status} onChange={e => set('status', e.target.value)} className="select">{['مسودة','معتمد','مدفوع'].map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" /></div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ التعديل
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SettlementsTab({ tenant, hrEmployees }: { tenant: any; hrEmployees: HREmployee[] }) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [terminations, setTerminations] = useState<Termination[]>([])
  const [loading, setLoading] = useState(false)
  const empNameMap = buildEmpNameMap(hrEmployees)
  useEffect(() => { loadData() }, [tenant?.id])
  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const [sRes, tRes] = await Promise.all([
      supabase.from('hr_settlements').select('*').eq('tenant_id', tenant.id).order('termination_date', { ascending: false }),
      supabase.from('hr_terminations').select('*').eq('tenant_id', tenant.id).order('termination_date', { ascending: false }),
    ])
    setSettlements((sRes.data || []).map((s: any) => ({ ...s, emp_name: empNameMap[s.employee_id] || '#' + s.employee_id })))
    setTerminations((tRes.data || []).map((t: any) => ({ ...t, emp_name: empNameMap[t.employee_id] || '#' + t.employee_id })))
    setLoading(false)
  }
  async function createFromTermination(term: Termination) {
    const emp = hrEmployees.find(e => e.employee_id === term.employee_id)
    if (!emp) { toast.error('لم يتم العثور على بيانات الموظف'); return }
    const lastDay = new Date(term.last_working_day)
    const workedDays = lastDay.getDate()
    const daily = dailySalary(emp)
    const monthSalaryAmt = Math.round(daily * workedDays)
    const { data: leaveData } = await supabase.from('hr_leaves').select('days, leave_type').eq('employee_id', term.employee_id).eq('tenant_id', tenant.id).eq('status', 'معتمد')
    const totalEntitled = Math.floor(term.years_of_service * 21)
    const takenDays = (leaveData || []).filter((l: any) => l.leave_type === 'سنوية').reduce((s: number, l: any) => s + (l.days || 0), 0)
    const leaveBalance = Math.max(0, totalEntitled - takenDays)
    const leaveCompensation = Math.round(daily * leaveBalance)
    const totalEnt = term.gratuity_amount + monthSalaryAmt + leaveCompensation
    const { error } = await supabase.from('hr_settlements').insert({
      tenant_id: tenant.id, employee_id: term.employee_id, termination_id: term.id,
      termination_date: term.termination_date, last_working_day: term.last_working_day,
      termination_type: term.termination_type, gratuity_amount: term.gratuity_amount,
      month_salary_days: workedDays, month_salary_amount: monthSalaryAmt,
      leave_balance_days: leaveBalance, leave_compensation: leaveCompensation,
      other_entitlements: 0, other_entitlements_note: '',
      advances_deduct: 0, other_deduct: 0, other_deduct_note: '',
      total_entitlements: totalEnt, total_deductions: 0, net_settlement: totalEnt,
      status: 'مسودة', notes: '',
    })
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadData(); toast.success('✅ تم إنشاء التسوية تلقائياً')
  }
  const pendingTerminations = terminations.filter(t => !settlements.find(s => s.termination_id === t.id))
  return (
    <div className="space-y-5">
      {pendingTerminations.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '12px', fontSize: '0.875rem' }}>⏳ إنهاءات خدمة بانتظار التسوية ({pendingTerminations.length})</div>
          {pendingTerminations.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: '8px', padding: '10px 14px', border: '1px solid #fde68a', marginBottom: '8px' }}>
              <div><div style={{ fontWeight: 700 }}>{t.emp_name}</div><div style={{ fontSize: '0.75rem', color: '#92400e' }}>{t.termination_type} — {t.last_working_day}</div></div>
              <button onClick={() => createFromTermination(t)} className="btn btn-primary btn-sm" style={{ background: '#e6820a' }}>⚡ إنشاء تسوية تلقائية</button>
            </div>
          ))}
        </div>
      )}
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      : settlements.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}><FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} /><p style={{ color: 'var(--text3)' }}>لا توجد تسويات بعد</p></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الموظف','نوع الإنهاء','آخر يوم','مكافأة','راتب الشهر','تعويض إجازات','صافي التسوية','الحالة'].map(h => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{s.emp_name}</td>
                    <td style={{ padding: '12px', fontSize: '0.82rem' }}>{s.termination_type}</td>
                    <td style={{ padding: '12px', fontSize: '0.82rem' }}>{s.last_working_day}</td>
                    <td style={{ padding: '12px', color: '#0ea77b', fontWeight: 600 }}>{s.gratuity_amount.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px', fontSize: '0.82rem' }}>{s.month_salary_amount.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px', fontSize: '0.82rem' }}>{s.leave_compensation.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--primary)' }}>{s.net_settlement.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px' }}><span className={'badge ' + (STATUS_COLOR[s.status] || 'badge-gray')}>{s.status}</span></td>
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

function LeaveCompensationTab({ tenant, hrEmployees }: { tenant: any; hrEmployees: HREmployee[] }) {
  const [records, setRecords] = useState<LeaveCompensation[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', compensation_date: new Date().toISOString().split('T')[0], leave_days: '', reason: 'صرف رصيد نقدي', notes: '', status: 'مسودة' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const selectedEmp = hrEmployees.find(e => e.employee_id === Number(form.employee_id))
  const daily = selectedEmp ? dailySalary(selectedEmp) : 0
  const totalAmt = Math.round(daily * Number(form.leave_days || 0))
  const empNameMap = buildEmpNameMap(hrEmployees)
  useEffect(() => { loadData() }, [tenant?.id])
  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('hr_leave_compensations').select('*').eq('tenant_id', tenant.id).order('compensation_date', { ascending: false })
    setRecords((data || []).map((r: any) => ({ ...r, emp_name: empNameMap[r.employee_id] || '#' + r.employee_id })))
    setLoading(false)
  }
  async function handleSave() {
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    if (!form.leave_days || Number(form.leave_days) <= 0) { toast.error('أدخل عدد الأيام'); return }
    setSaving(true)
    const { error } = await supabase.from('hr_leave_compensations').insert({
      tenant_id: tenant.id, employee_id: Number(form.employee_id),
      compensation_date: form.compensation_date, leave_days: Number(form.leave_days),
      daily_salary: Math.round(daily), total_amount: totalAmt,
      reason: form.reason, status: form.status, notes: form.notes || null,
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    await loadData()
    setForm({ employee_id: '', compensation_date: new Date().toISOString().split('T')[0], leave_days: '', reason: 'صرف رصيد نقدي', notes: '', status: 'مسودة' })
    setShowForm(false); setSaving(false); toast.success('✅ تم حفظ تعويض الإجازة')
  }
  return (
    <div className="space-y-4">
      {!showForm && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setShowForm(true)} className="btn btn-primary"><Palmtree style={{ width: '16px', height: '16px' }} /> إضافة تعويض إجازة</button></div>}
      {showForm && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: '16px' }}><Palmtree style={{ width: '18px', height: '18px', color: '#0ea77b', display: 'inline', marginLeft: '8px' }} /> تعويض رصيد إجازة نقداً</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف *</label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select">
                <option value="">— اختر الموظف —</option>
                {hrEmployees.filter(e => e.is_active !== false).map(e => (
                  <option key={e.employee_id} value={e.employee_id}>{e.name || `موظف #${e.employee_id}`} — {e.job_title || e.department || ''}</option>
                ))}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الصرف *</label><input type="date" value={form.compensation_date} onChange={e => set('compensation_date', e.target.value)} className="input" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">عدد الأيام *</label><input type="number" min="1" value={form.leave_days} onChange={e => set('leave_days', e.target.value)} className="input" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">السبب</label>
              <select value={form.reason} onChange={e => set('reason', e.target.value)} className="select">
                <option>صرف رصيد نقدي</option><option>تعويض إجازة لم تُستخدم</option><option>تعويض عند نهاية الخدمة</option><option>أخرى</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label><select value={form.status} onChange={e => set('status', e.target.value)} className="select">{['مسودة','معتمد','مدفوع'].map(s => <option key={s}>{s}</option>)}</select></div>
            {selectedEmp && Number(form.leave_days) > 0 && (
              <div style={{ gridColumn: '1/-1', background: '#ecfdf5', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '10px', fontSize: '0.875rem' }}>🧮 حساب التعويض</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>الراتب اليومي</div><div style={{ fontWeight: 700 }}>{Math.round(daily).toLocaleString()} ر.س</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>× عدد الأيام</div><div style={{ fontWeight: 700 }}>{form.leave_days} يوم</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>= إجمالي</div><div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1.1rem' }}>{totalAmt.toLocaleString()} ر.س</div></div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">إلغاء</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />} حفظ التعويض
            </button>
          </div>
        </div>
      )}
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      : records.length === 0 ? <div className="card" style={{ padding: '60px', textAlign: 'center' }}><Palmtree style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} /><p style={{ color: 'var(--text3)' }}>لا توجد تعويضات إجازات بعد</p></div>
      : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الموظف','تاريخ الصرف','عدد الأيام','الراتب اليومي','إجمالي التعويض','السبب','الحالة'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{r.emp_name}</td>
                    <td style={{ padding: '12px 14px' }}>{r.compensation_date}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>{r.leave_days} يوم</td>
                    <td style={{ padding: '12px 14px' }}>{r.daily_salary.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0ea77b' }}>{r.total_amount.toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{r.reason}</td>
                    <td style={{ padding: '12px 14px' }}><span className={'badge ' + (STATUS_COLOR[r.status] || 'badge-gray')}>{r.status}</span></td>
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

function ArchiveTab({ payrolls, isAdmin, onEdit, onEditPayroll, exportCSV }: { payrolls: Payroll[]; isAdmin: boolean; onEdit: (p: Payroll) => void; onEditPayroll: (month: number, year: number) => void; exportCSV: (data: Payroll[], month: number, year: number) => void }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [archiveYear, setArchiveYear] = useState(currentYear)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const groups: Record<string, Payroll[]> = {}
  payrolls.forEach(p => {
    if (p.year !== archiveYear) return
    const key = p.year + '-' + p.month
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  })
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))
  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select value={archiveYear} onChange={e => { setArchiveYear(Number(e.target.value)); setExpandedKey(null) }} className="select" style={{ width: 'auto' }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>{sortedKeys.length} مسير</span>
      </div>
      {sortedKeys.length === 0
        ? <div className="card" style={{ padding: '60px', textAlign: 'center' }}><FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} /><p style={{ color: 'var(--text3)' }}>لا توجد مسيرات لسنة {archiveYear}</p></div>
        : sortedKeys.map(key => {
            const [yr, mo] = key.split('-').map(Number)
            const group = groups[key]
            const gNet = group.reduce((s, p) => s + p.net_salary, 0)
            const isOpen = expandedKey === key
            const allPaid = group.every(p => p.status === 'مدفوع')
            return (
              <div key={key} className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setExpandedKey(isOpen ? null : key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: isOpen ? 'var(--primary-light)' : 'white', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: allPaid ? '#ecfdf5' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>{allPaid ? '✅' : '⏳'}</div>
                    <div><div style={{ fontWeight: 700 }}>مسير {ARABIC_MONTHS[mo - 1]} {yr}</div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{group.length} موظف</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '4px 14px', textAlign: 'center' }}><div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>الصافي</div><div style={{ fontWeight: 700, color: '#0ea77b' }}>{gNet.toLocaleString()} ر.س</div></div>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px' }}>
                      {isAdmin && !allPaid && (
                        <button
                          onClick={() => onEditPayroll(mo, yr)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1a56db', background: '#eff6ff', cursor: 'pointer', fontSize: '0.78rem', color: '#1a56db', fontWeight: 600 }}>
                          <Pencil style={{ width: '13px', height: '13px' }} /> تعديل المسير
                        </button>
                      )}
                      <button onClick={() => exportCSV(group, mo, yr)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <Download style={{ width: '13px', height: '13px' }} /> CSV
                      </button>
                    </div>
                    {isOpen ? <ChevronUp style={{ width: '18px', height: '18px', color: 'var(--text3)' }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: 'var(--text3)' }} />}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: '2px solid var(--primary)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead><tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                        {['الموظف','الأساسي','البدلات','الإجمالي','الخصومات','الصافي','حضور','الحالة'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', background: h==='الصافي'?'#ecfdf5':'transparent', color: h==='الصافي'?'#0ea77b':h==='الخصومات'?'#c81e1e':h==='الإجمالي'?'var(--primary)':'var(--text3)' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {group.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '11px 14px', fontWeight: 700 }}>{p.emp_name || '#' + p.employee_id}</td>
                            <td style={{ padding: '11px 14px' }}>{p.basic_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px' }}>{(p.housing_allow+p.transport_allow+p.other_allow).toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', color: '#c81e1e' }}>{(p.gosi_deduction+p.absence_deduct+p.other_deduct) > 0 ? '-' + (p.gosi_deduction+p.absence_deduct+p.other_deduct).toLocaleString() + ' ر.س' : '—'}</td>
                            <td style={{ padding: '11px 14px', color: '#0ea77b', fontWeight: 700, background: '#f0fdf4' }}>{p.net_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>{p.present_days}/26</td>
                            <td style={{ padding: '11px 14px' }}><span className={'badge ' + (STATUS_COLOR[p.status] || 'badge-gray')}>{p.status}</span></td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
      }
    </div>
  )
}

export default function PayrollPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  // تحديد التاب الافتراضي: إذا مضى 7 أيام على نهاية الشهر → مسيرات سابقة
  const defaultTab = (() => {
    const now = new Date()
    const day = now.getDate()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    // احسب نهاية الشهر الحالي
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    // إذا كنا في شهر جديد وتجاوزنا 7 أيام من بدايته
    // يعني الشهر السابق انتهى منذ أكثر من 7 أيام
    if (day > 7) return 'archive'
    return 'payroll'
  })()
  const [activeTab, setActiveTab] = useState<'payroll' | 'archive' | 'settlements' | 'leave_comp'>(defaultTab as any)
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null)
  // filterMonth/Year = الشهر الحالي دائماً (للمسير الجديد)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear())
  const [mode, setMode] = useState<'view' | 'create'>('view')
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [expandedPayrollKey, setExpandedPayrollKey] = useState<string | null>(null)
  const [pendingDeducts, setPendingDeducts] = useState<PendingDeduct[]>([])
  const [approvedDeducts, setApprovedDeducts] = useState<Set<number>>(new Set())
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => {
    if (!tenant?.id) return
    const timer = setTimeout(() => load(), 100)
    return () => clearTimeout(timer)
  }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [p, e, d] = await Promise.all([
      supabase.from('hr_payroll').select('*').eq('tenant_id', tenant.id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('hr_employees').select('id, employee_id, name, basic_salary, housing_allow, transport_allow, other_allow, gosi_enrolled, gosi_pct, nationality, hire_date, department, job_title, is_active').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_disciplinary')
        .select('id, employee_id, violation_name, salary_deduct_days, incident_date, penalty_degree')
        .eq('tenant_id', tenant.id)
        .eq('status', 'نافذ')
        .eq('deduct_applied', false)
        .gt('salary_deduct_days', 0),
    ])
    const empNameMap = buildEmpNameMap((e.data || []) as HREmployee[])
    setPayrolls((p.data || []).map((pay: any) => ({ ...pay, emp_name: empNameMap[pay.employee_id] || `موظف #${pay.employee_id}` })))
    setHREmployees((e.data || []) as HREmployee[])
    setPendingDeducts((d.data || []) as PendingDeduct[])
    setApprovedDeducts(new Set())
    setLoading(false)
  }

  const activeHREmployees = hrEmployees.filter(e => e.is_active !== false)

  function canCreatePayroll(month: number, year: number): { allowed: boolean; reason?: string } {
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()
    if (year > todayYear || (year === todayYear && month > todayMonth)) {
      return { allowed: false, reason: `لا يمكن إنشاء مسير لشهر مستقبلي` }
    }
    if (year === todayYear && month === todayMonth && todayDay < 20) {
      return { allowed: false, reason: `يمكن إنشاء مسير ${ARABIC_MONTHS[month-1]} بعد يوم 20 من الشهر (اليوم الحالي: ${todayDay})` }
    }
    return { allowed: true }
  }

  // الانتقال لتعديل مسير سابق — يفتح تاب المسير الحالي بشهر وسنة المسير
  function handleEditPayroll(month: number, year: number) {
    setFilterMonth(month)
    setFilterYear(year)
    setActiveTab('payroll')
    setMode('view')
    toast('📋 جاري تحميل مسير ' + ARABIC_MONTHS[month - 1] + ' ' + year, { icon: '✏️' })
  }

  function enterCreateMode() {
    const check = canCreatePayroll(filterMonth, filterYear)
    if (!check.allowed) { toast.error(check.reason || 'غير مسموح بإنشاء مسير لهذا الشهر'); return }
    const existing = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
    if (existing.length > 0 && existing.every(p => p.status === 'مدفوع')) {
      toast.error('لا يمكن تعديل مسير مدفوع'); return
    }
    const built: PayrollRow[] = activeHREmployees.map(emp => {
      const ex = existing.find(p => p.employee_id === emp.employee_id)
      const gosiAmt = emp.gosi_enrolled ? Math.round((emp.basic_salary + emp.housing_allow) * (emp.gosi_pct / 100)) : 0
      return calcRow({
        employee_id: emp.employee_id,
        name: emp.name || `موظف #${emp.employee_id}`,
        role: emp.job_title || emp.department || '—',
        included: true,
        basic_salary: ex?.basic_salary ?? emp.basic_salary, housing_allow: ex?.housing_allow ?? emp.housing_allow,
        transport_allow: ex?.transport_allow ?? emp.transport_allow, other_allow: ex?.other_allow ?? emp.other_allow,
        overtime_pay: ex?.overtime_pay ?? 0, bonuses: ex?.bonuses ?? 0,
        gosi_deduction: ex?.gosi_deduction ?? gosiAmt, absence_deduct: ex?.absence_deduct ?? 0,
        other_deduct: ex?.other_deduct ?? 0, present_days: ex?.present_days ?? 26,
        notes: ex?.notes ?? '', gross: 0, net: 0, existingId: ex?.id,
        _pendingDeductIds: pendingDeducts.filter(d => d.employee_id === emp.employee_id).map(d => d.id),
      })
    })
    setRows(built); setExpandedRow(null); setMode('create')
  }

  function updateRow(idx: number, k: keyof PayrollRow, v: any) {
    setRows(prev => { const next = [...prev]; next[idx] = calcRow({ ...next[idx], [k]: v }); return next })
  }
  function toggleAll(val: boolean) { setRows(prev => prev.map(r => ({ ...r, included: val }))) }

  const includedRows = rows.filter(r => r.included)
  const totalGross = includedRows.reduce((s, r) => s + r.gross, 0)
  const totalDeduct = includedRows.reduce((s, r) => s + r.gosi_deduction + r.absence_deduct + r.other_deduct, 0)
  const totalNet = includedRows.reduce((s, r) => s + r.net, 0)

  async function handleSaveBulk() {
    if (!tenant || includedRows.length === 0) { toast.error('اختر موظفاً واحداً على الأقل'); return }
    setSaving(true)
    for (const row of includedRows) {
      const payload = {
        tenant_id: tenant.id, branch_id: activeBranch?.id || null,
        employee_id: row.employee_id, month: filterMonth, year: filterYear,
        basic_salary: row.basic_salary, housing_allow: row.housing_allow,
        transport_allow: row.transport_allow, other_allow: row.other_allow,
        overtime_pay: row.overtime_pay, bonuses: row.bonuses,
        gosi_deduction: row.gosi_deduction, absence_deduct: row.absence_deduct,
        other_deduct: row.other_deduct, present_days: row.present_days,
        absent_days: 26 - row.present_days, overtime_hours: 0,
        gross_salary: row.gross, net_salary: row.net,
        notes: row.notes || null, status: 'مسودة', working_days: 26,
      }
      if (row.existingId) await supabase.from('hr_payroll').update(payload).eq('id', row.existingId)
      else await supabase.from('hr_payroll').insert(payload)
    }
    await load(); setMode('view'); setSaving(false)
    // تسجيل الإنذارات المطبقة كـ deduct_applied
    if (approvedDeducts.size > 0) {
      await supabase.from('hr_disciplinary')
        .update({
          deduct_applied: true,
          deduct_applied_month: filterMonth,
          deduct_applied_year: filterYear,
        })
        .in('id', Array.from(approvedDeducts))
      setPendingDeducts(prev => prev.filter(d => !approvedDeducts.has(d.id)))
      setApprovedDeducts(new Set())
    }

    toast.success('✅ تم حفظ مسير ' + ARABIC_MONTHS[filterMonth - 1] + ' — ' + includedRows.length + ' موظف')
  }

  async function handleEditSave(data: any) {
    await supabase.from('hr_payroll').update({ ...data, tenant_id: tenant?.id }).eq('id', data.id)
    await load(); setEditPayroll(null); toast.success('تم التعديل ✅')
  }

  function exportCSV(data: Payroll[], month: number, year: number) {
    const headers = ['الموظف','الراتب الأساسي','السكن','النقل','بدلات أخرى','إضافي','مكافآت','الإجمالي','تأمينات','خصم غياب','خصومات أخرى','صافي الراتب','أيام الحضور','الحالة']
    const csvRows = data.map(p => [p.emp_name||'',p.basic_salary,p.housing_allow,p.transport_allow,p.other_allow,p.overtime_pay,p.bonuses,p.gross_salary,p.gosi_deduction,p.absence_deduct,p.other_deduct,p.net_salary,p.present_days,p.status])
    const csv = [headers, ...csvRows].map(r => r.map(c => '"' + c + '"').join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'مسير_رواتب_' + ARABIC_MONTHS[month-1] + '_' + year + '.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const filteredPayrolls = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
  const vGross = filteredPayrolls.reduce((s, p) => s + p.gross_salary, 0)
  const vDeduct = filteredPayrolls.reduce((s, p) => s + p.gosi_deduction + p.absence_deduct + p.other_deduct, 0)
  const vNet = filteredPayrolls.reduce((s, p) => s + p.net_salary, 0)
  const cellInput = (color?: string): React.CSSProperties => ({ width: '76px', padding: '4px 6px', border: '1px solid ' + (color || 'var(--border)'), borderRadius: '6px', fontSize: '0.78rem', textAlign: 'left' as const, background: color === '#fca5a5' ? '#fff5f5' : 'var(--bg2)', direction: 'ltr' })

  const TABS = [
    { id: 'payroll', label: '📋 مسير الرواتب', color: '#1a56db' },
    { id: 'archive', label: '📂 المسيرات السابقة', color: '#6b7280' },
    { id: 'settlements', label: '💼 تسوية نهاية الخدمة', color: '#c81e1e' },
    { id: 'leave_comp', label: '🏖️ تعويض الإجازات', color: '#0ea77b' },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Banknote style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> الرواتب والتعويضات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>مسير الرواتب — تسوية نهاية الخدمة — تعويض الإجازات</p>
      </div>
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === t.id ? t.color : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text3)', boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'payroll' && (
        <>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select value={filterMonth} onChange={e => { setFilterMonth(Number(e.target.value)); setMode('view') }} className="select" style={{ width: 'auto' }}>
                {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <input type="number" value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setMode('view') }} className="input" style={{ width: '88px' }} min="2020" max="2030" />
              {mode === 'view' && <span style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>{filteredPayrolls.length} موظف</span>}
            </div>
            {mode === 'view' ? (
              isAdmin && (() => {
                const check = canCreatePayroll(filterMonth, filterYear)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <button onClick={enterCreateMode} disabled={!check.allowed} className="btn btn-primary" style={{ opacity: check.allowed ? 1 : 0.5 }}>
                      <Banknote style={{ width: '16px', height: '16px' }} /> {filteredPayrolls.length > 0 ? 'تعديل المسير' : 'إنشاء مسير'}
                    </button>
                    {!check.allowed && <span style={{ fontSize: '0.72rem', color: '#c81e1e' }}>{check.reason}</span>}
                  </div>
                )
              })()
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setMode('view')} className="btn btn-ghost"><X style={{ width: '15px', height: '15px' }} /> إلغاء</button>
                <button type="button" onClick={handleSaveBulk} disabled={saving} className="btn btn-primary">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />} حفظ المسير ({includedRows.length} موظف)
                </button>
              </div>
            )}
          </div>

          {(mode === 'view' ? filteredPayrolls.length > 0 : includedRows.length > 0) && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'إجمالي المستحقات', value: (mode==='view'?vGross:totalGross).toLocaleString()+' ر.س', color: 'var(--primary)', bg: 'var(--primary-light)' },
                { label: 'إجمالي الخصومات', value: (mode==='view'?vDeduct:totalDeduct).toLocaleString()+' ر.س', color: '#c81e1e', bg: '#fef2f2' },
                { label: 'إجمالي الصافي', value: (mode==='view'?vNet:totalNet).toLocaleString()+' ر.س', color: '#0ea77b', bg: '#ecfdf5' },
              ].map(kpi => (
                <div key={kpi.label} className="card" style={{ padding: '14px', textAlign: 'center', background: kpi.bg }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
                </div>
              ))}
            </div>
          )}

          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : mode === 'create' ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>💡</span><span>أزل علامة الاختيار عن الموظفين في إجازة أو لا يستحقون راتب هذا الشهر</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '10px 12px', width: '40px' }}>
                        <button type="button" onClick={() => toggleAll(!rows.every(r => r.included))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                          {rows.every(r => r.included) ? <CheckSquare style={{ width: '18px', height: '18px' }} /> : <Square style={{ width: '18px', height: '18px', color: 'var(--text3)' }} />}
                        </button>
                      </th>
                      {['الموظف','الأساسي','السكن','النقل','بدلات','إضافي','مكافأة','تأمينات','غياب','خصم آخر','الإجمالي','الصافي',''].map(h => (
                        <th key={h} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', background: h==='الصافي'?'#ecfdf5':'transparent', color: ['تأمينات','غياب','خصم آخر'].includes(h)?'#c81e1e':['الأساسي','السكن','النقل','بدلات','إضافي','مكافأة'].includes(h)?'#0ea77b':h==='الإجمالي'?'var(--primary)':h==='الصافي'?'#0ea77b':'var(--text3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <>
                        <tr key={row.employee_id} style={{ borderBottom: expandedRow===idx?'none':'1px solid var(--bg2)', opacity: row.included?1:0.4, background: !row.included?'#fafafa':expandedRow===idx?'#f0f9ff':'transparent' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button type="button" onClick={() => updateRow(idx, 'included', !row.included)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {row.included ? <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--primary)' }} /> : <Square style={{ width: '18px', height: '18px', color: '#d1d5db' }} />}
                            </button>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{row.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{row.role}</div>
                          </td>
                          {(['basic_salary','housing_allow','transport_allow','other_allow','overtime_pay','bonuses'] as const).map(k => (
                            <td key={k} style={{ padding: '6px 4px' }}><input type="number" min="0" value={row[k] as number} disabled={!row.included} onChange={e => updateRow(idx, k, Number(e.target.value))} style={cellInput()} /></td>
                          ))}
                          {(['gosi_deduction','absence_deduct','other_deduct'] as const).map(k => (
                            <td key={k} style={{ padding: '6px 4px' }}><input type="number" min="0" value={row[k] as number} disabled={!row.included} onChange={e => updateRow(idx, k, Number(e.target.value))} style={cellInput('#fca5a5')} /></td>
                          ))}
                          <td style={{ padding: '8px', fontWeight: 700, color: row.included?'var(--primary)':'var(--text3)', whiteSpace: 'nowrap' }}>{row.included?row.gross.toLocaleString():'—'}</td>
                          <td style={{ padding: '8px', fontWeight: 700, color: row.included?'#0ea77b':'var(--text3)', whiteSpace: 'nowrap', background: row.included?'#f0fdf4':'transparent' }}>{row.included?row.net.toLocaleString():'—'}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <button type="button" onClick={() => setExpandedRow(expandedRow===idx?null:idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                              {expandedRow===idx ? <ChevronUp style={{ width: '15px', height: '15px' }} /> : <ChevronDown style={{ width: '15px', height: '15px' }} />}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === idx && (
                          <tr key={'exp-' + row.employee_id} style={{ background: '#f0f9ff', borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={15} style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div><label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>أيام الحضور</label><input type="number" min="0" max="31" value={row.present_days} onChange={e => updateRow(idx, 'present_days', Number(e.target.value))} style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} /></div>
                                <div style={{ flex: 1, minWidth: '180px' }}><label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>ملاحظات</label><input type="text" value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} /></div>
                              </div>
                              {/* اقتراحات خصم الإنذارات */}
                              {(row._pendingDeductIds || []).length > 0 && (
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700 }}>⚠ خصومات إنذارات مقترحة:</div>
                                  {(row._pendingDeductIds || []).map(did => {
                                    const deduct = pendingDeducts.find(d => d.id === did)
                                    if (!deduct) return null
                                    const isApproved = approvedDeducts.has(did)
                                    const dailySalary = Math.round((row.basic_salary + row.housing_allow + row.transport_allow + row.other_allow) / 30)
                                    const deductAmt = dailySalary * deduct.salary_deduct_days
                                    return (
                                      <div key={did} style={{
                                        padding: '8px 12px', borderRadius: '8px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                        background: isApproved ? '#fef2f2' : '#fffbeb',
                                        border: `1px solid ${isApproved ? '#fca5a5' : '#fcd34d'}`,
                                      }}>
                                        <div style={{ fontSize: '0.78rem' }}>
                                          <span style={{ fontWeight: 700, color: isApproved ? '#c81e1e' : '#92400e' }}>
                                            {deduct.violation_name}
                                          </span>
                                          <span style={{ color: 'var(--text3)', marginRight: '8px' }}>
                                            خصم {deduct.salary_deduct_days} يوم = {deductAmt.toLocaleString()} ر.س
                                          </span>
                                        </div>
                                        <button type="button"
                                          onClick={() => {
                                            const next = new Set(approvedDeducts)
                                            if (isApproved) {
                                              next.delete(did)
                                              updateRow(idx, 'other_deduct', Math.max(0, row.other_deduct - deductAmt))
                                            } else {
                                              next.add(did)
                                              updateRow(idx, 'other_deduct', row.other_deduct + deductAmt)
                                            }
                                            setApprovedDeducts(next)
                                          }}
                                          style={{
                                            flexShrink: 0, padding: '4px 12px', borderRadius: '6px',
                                            border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                            background: isApproved ? '#fee2e2' : '#ecfdf5',
                                            color: isApproved ? '#c81e1e' : '#0ea77b',
                                          }}>
                                          {isApproved ? '✕ إلغاء الخصم' : '✓ تطبيق الخصم'}
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                      <td colSpan={2} style={{ padding: '10px 12px' }}>الإجمالي — {includedRows.length} من {rows.length} موظف</td>
                      <td colSpan={9}></td>
                      <td style={{ padding: '10px 8px', color: 'var(--primary)' }}>{totalGross.toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', color: '#0ea77b', background: '#ecfdf5' }}>{totalNet.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{includedRows.length} موظف في المسير — {rows.length - includedRows.length} خارج المسير</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setMode('view')} className="btn btn-ghost"><X style={{ width: '15px', height: '15px' }} /> إلغاء</button>
                  <button type="button" onClick={handleSaveBulk} disabled={saving || includedRows.length === 0} className="btn btn-primary">
                    {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />} حفظ مسير {ARABIC_MONTHS[filterMonth - 1]} ({includedRows.length} موظف)
                  </button>
                </div>
              </div>
            </div>
          ) : filteredPayrolls.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Banknote style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد كشوف رواتب لهذا الشهر</p>
              {isAdmin && <button onClick={enterCreateMode} className="btn btn-primary"><Banknote style={{ width: '16px', height: '16px' }} /> إنشاء مسير رواتب</button>}
            </div>
          ) : (() => {
            const currentKey = filterYear + '-' + filterMonth
            const gNet = filteredPayrolls.reduce((s, p) => s + p.net_salary, 0)
            const allPaid = filteredPayrolls.every(p => p.status === 'مدفوع')
            const allApproved = filteredPayrolls.every(p => p.status === 'معتمد' || p.status === 'مدفوع')
            const isOpen = expandedPayrollKey === currentKey
            return (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setExpandedPayrollKey(isOpen ? null : currentKey)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: isOpen ? 'var(--primary-light)' : 'white', flexWrap: 'wrap', gap: '10px', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: allPaid ? '#ecfdf5' : allApproved ? '#eff6ff' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>{allPaid ? '✅' : allApproved ? '📋' : '⏳'}</div>
                    <div><div style={{ fontWeight: 700, fontSize: '1rem' }}>مسير {ARABIC_MONTHS[filterMonth - 1]} {filterYear}</div><div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>{filteredPayrolls.length} موظف</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '4px 14px', textAlign: 'center' }}><div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>الصافي</div><div style={{ fontWeight: 700, color: '#0ea77b' }}>{gNet.toLocaleString()} ر.س</div></div>
                    <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => exportCSV(filteredPayrolls, filterMonth, filterYear)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.78rem' }}><Download style={{ width: '13px', height: '13px' }} /> CSV</button>
                      {isAdmin && <button onClick={() => enterCreateMode()} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /> تعديل</button>}
                    </div>
                    {isOpen ? <ChevronUp style={{ width: '18px', height: '18px', color: 'var(--text3)' }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: 'var(--text3)' }} />}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: '2px solid var(--primary)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead><tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                        {['الموظف','الأساسي','البدلات','إضافي+مكافآت','الإجمالي','تأمينات','خصومات','الصافي','حضور','الحالة'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', background: h==='الصافي'?'#ecfdf5':'transparent', color: h==='الصافي'?'#0ea77b':['تأمينات','خصومات'].includes(h)?'#c81e1e':h==='الإجمالي'?'var(--primary)':'var(--text3)' }}>{h}</th>
                        ))}
                        {isAdmin && <th></th>}
                      </tr></thead>
                      <tbody>
                        {filteredPayrolls.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '11px 14px', fontWeight: 700 }}>{p.emp_name || '#' + p.employee_id}</td>
                            <td style={{ padding: '11px 14px' }}>{p.basic_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px' }}>{(p.housing_allow+p.transport_allow+p.other_allow).toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', color: (p.overtime_pay+p.bonuses) > 0 ? '#0ea77b' : 'var(--text3)' }}>{(p.overtime_pay+p.bonuses) > 0 ? '+' + (p.overtime_pay+p.bonuses).toLocaleString() + ' ر.س' : '—'}</td>
                            <td style={{ padding: '11px 14px', color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', color: '#c81e1e' }}>{p.gosi_deduction > 0 ? '-' + p.gosi_deduction.toLocaleString() + ' ر.س' : '—'}</td>
                            <td style={{ padding: '11px 14px', color: (p.absence_deduct+p.other_deduct) > 0 ? '#c81e1e' : 'var(--text3)' }}>{(p.absence_deduct+p.other_deduct) > 0 ? '-' + (p.absence_deduct+p.other_deduct).toLocaleString() + ' ر.س' : '—'}</td>
                            <td style={{ padding: '11px 14px', color: '#0ea77b', fontWeight: 700, background: '#f0fdf4' }}>{p.net_salary.toLocaleString()} ر.س</td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>{p.present_days}/26</td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}><span className={'badge ' + (STATUS_COLOR[p.status] || 'badge-gray')}>{p.status}</span></td>
                            {isAdmin && <td style={{ padding: '11px 14px' }}><button onClick={() => setEditPayroll(p)} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}
      {activeTab === 'archive' && <ArchiveTab payrolls={payrolls} isAdmin={isAdmin} onEdit={p => setEditPayroll(p)} onEditPayroll={handleEditPayroll} exportCSV={exportCSV} />}
      {activeTab === 'settlements' && <SettlementsTab tenant={tenant} hrEmployees={hrEmployees} />}
      {activeTab === 'leave_comp' && <LeaveCompensationTab tenant={tenant} hrEmployees={hrEmployees} />}
      {editPayroll && <EditPayrollModal payroll={editPayroll} onClose={() => setEditPayroll(null)} onSave={handleEditSave} />}
    </div>
  )
}
