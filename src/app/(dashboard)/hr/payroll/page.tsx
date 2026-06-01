'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Banknote, Plus, Pencil, X, Save, Users, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

type HREmployee = {
  id: number; employee_id: number; basic_salary: number; housing_allow: number
  transport_allow: number; other_allow: number; gosi_enrolled: boolean; gosi_pct: number
  nationality: string
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

// صف واحد في جدول المسير — قابل للتعديل inline
type PayrollRow = {
  employee_id: number
  name: string
  role: string
  basic_salary: number
  housing_allow: number
  transport_allow: number
  other_allow: number
  overtime_pay: number
  bonuses: number
  gosi_deduction: number
  absence_deduct: number
  other_deduct: number
  present_days: number
  notes: string
  // computed
  gross: number
  net: number
  // existing record id if already saved
  existingId?: number
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const STATUS_COLOR: Record<string, string> = { 'مسودة': 'badge-gray', 'معتمد': 'badge-blue', 'مدفوع': 'badge-green' }

function calcRow(r: PayrollRow): PayrollRow {
  const gross = r.basic_salary + r.housing_allow + r.transport_allow + r.other_allow + r.overtime_pay + r.bonuses
  const deductions = r.gosi_deduction + r.absence_deduct + r.other_deduct
  return { ...r, gross, net: gross - deductions }
}

// ══════════════════════════════════════
// نافذة تعديل كشف راتب موجود (موظف واحد)
// ══════════════════════════════════════
function EditPayrollModal({ payroll, onClose, onSave }: {
  payroll: Payroll; onClose: () => void; onSave: (d: any) => Promise<void>
}) {
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
  const deductions = form.gosi_deduction + form.absence_deduct + form.other_deduct
  const net = gross - deductions

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ id: payroll.id, ...form, gross_salary: gross, net_salary: net })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">تعديل راتب — {payroll.employee?.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#0ea77b', marginBottom: '10px', fontSize: '0.875rem' }}>✅ المستحقات</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {k:'basic_salary',l:'الراتب الأساسي'},{k:'housing_allow',l:'بدل السكن'},
                  {k:'transport_allow',l:'بدل النقل'},{k:'other_allow',l:'بدلات أخرى'},
                  {k:'overtime_pay',l:'أجر الإضافي'},{k:'bonuses',l:'مكافآت'},
                ].map(({k,l}) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#c81e1e', marginBottom: '10px', fontSize: '0.875rem' }}>❌ الخصومات</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {k:'gosi_deduction',l:'التأمينات'},{k:'absence_deduct',l:'خصم الغياب'},{k:'other_deduct',l:'خصومات أخرى'},
                ].map(({k,l}) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))} className="input" min="0" />
                  </div>
                ))}
              </div>
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الحضور</label>
                <input type="number" value={form.present_days} onChange={e => set('present_days', Number(e.target.value))} className="input" min="0" max="31" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة','معتمد','مدفوع'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التعديل
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// نافذة إنشاء مسير رواتب كامل
// ══════════════════════════════════════
function CreatePayrollModal({ hrEmployees, month, year, existingPayrolls, onClose, onSave }: {
  hrEmployees: HREmployee[]
  month: number; year: number
  existingPayrolls: Payroll[]
  onClose: () => void
  onSave: (rows: PayrollRow[], month: number, year: number) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [selMonth, setSelMonth] = useState(month)
  const [selYear, setSelYear] = useState(year)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  // بناء صفوف المسير من hr_employees
  const [rows, setRows] = useState<PayrollRow[]>(() =>
    hrEmployees.map(emp => {
      const existing = existingPayrolls.find(p => p.employee_id === emp.employee_id && p.month === month && p.year === year)
      const gosiAmt = emp.gosi_enrolled
        ? Math.round((emp.basic_salary + emp.housing_allow) * (emp.gosi_pct / 100))
        : 0
      const r: PayrollRow = {
        employee_id: emp.employee_id,
        name: emp.employee?.name || '—',
        role: emp.employee?.role || '—',
        basic_salary:    existing?.basic_salary    ?? emp.basic_salary,
        housing_allow:   existing?.housing_allow   ?? emp.housing_allow,
        transport_allow: existing?.transport_allow ?? emp.transport_allow,
        other_allow:     existing?.other_allow     ?? emp.other_allow,
        overtime_pay:    existing?.overtime_pay    ?? 0,
        bonuses:         existing?.bonuses         ?? 0,
        gosi_deduction:  existing?.gosi_deduction  ?? gosiAmt,
        absence_deduct:  existing?.absence_deduct  ?? 0,
        other_deduct:    existing?.other_deduct    ?? 0,
        present_days:    existing?.present_days    ?? 26,
        notes:           existing?.notes           ?? '',
        gross: 0, net: 0,
        existingId: existing?.id,
      }
      return calcRow(r)
    })
  )

  function updateRow(idx: number, k: keyof PayrollRow, v: any) {
    setRows(prev => {
      const next = [...prev]
      next[idx] = calcRow({ ...next[idx], [k]: v })
      return next
    })
  }

  const totalGross = rows.reduce((s, r) => s + r.gross, 0)
  const totalDeduct = rows.reduce((s, r) => s + r.gosi_deduction + r.absence_deduct + r.other_deduct, 0)
  const totalNet = rows.reduce((s, r) => s + r.net, 0)

  async function handleSave() {
    setSaving(true)
    await onSave(rows, selMonth, selYear)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '95vw', width: '1100px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            إنشاء مسير رواتب — {rows.length} موظف
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* الشهر والسنة */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <div>
              <label className="block text-xs text-gray-500 mb-1">الشهر</label>
              <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">السنة</label>
              <input type="number" value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="input" style={{ width: '90px' }} min="2020" max="2030" />
            </div>
            <div style={{ marginTop: '18px', fontSize: '0.8rem', color: 'var(--text3)' }}>
              ✏️ اضغط على اسم الموظف لتعديل تفاصيله
            </div>
          </div>

          {/* جدول المسير */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الموظف</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الأساسي</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>السكن</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>النقل</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>بدلات أخرى</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>إضافي</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>مكافأة</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>تأمينات</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>غياب</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>خصم آخر</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--primary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الإجمالي</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap', background: '#ecfdf5' }}>الصافي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <>
                    <tr key={row.employee_id}
                      style={{ borderBottom: expandedRow === idx ? 'none' : '1px solid var(--bg2)', background: expandedRow === idx ? '#f0f9ff' : 'transparent' }}
                    >
                      {/* اسم الموظف — قابل للضغط للتوسيع */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--text)', fontSize: '0.82rem' }}
                        >
                          {expandedRow === idx
                            ? <ChevronUp style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
                            : <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text3)' }} />}
                          {row.name}
                          {row.existingId && <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 5px' }}>محفوظ</span>}
                        </button>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', paddingRight: '20px' }}>{row.role}</div>
                      </td>

                      {/* خلايا قابلة للتعديل */}
                      {(['basic_salary','housing_allow','transport_allow','other_allow','overtime_pay','bonuses'] as const).map(k => (
                        <td key={k} style={{ padding: '6px 8px' }}>
                          <input
                            type="number" min="0"
                            value={row[k] as number}
                            onChange={e => updateRow(idx, k, Number(e.target.value))}
                            style={{ width: '80px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'left', background: 'var(--bg2)' }}
                          />
                        </td>
                      ))}

                      {/* خصومات */}
                      {(['gosi_deduction','absence_deduct','other_deduct'] as const).map(k => (
                        <td key={k} style={{ padding: '6px 8px' }}>
                          <input
                            type="number" min="0"
                            value={row[k] as number}
                            onChange={e => updateRow(idx, k, Number(e.target.value))}
                            style={{ width: '75px', padding: '5px 8px', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'left', background: '#fff5f5' }}
                          />
                        </td>
                      ))}

                      {/* الإجمالي والصافي */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {row.gross.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0ea77b', whiteSpace: 'nowrap', background: '#f0fdf4', fontSize: '0.9rem' }}>
                        {row.net.toLocaleString()}
                      </td>
                    </tr>

                    {/* صف التفاصيل الموسّعة */}
                    {expandedRow === idx && (
                      <tr key={`exp-${row.employee_id}`} style={{ background: '#f0f9ff', borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={13} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>أيام الحضور</label>
                              <input type="number" min="0" max="31" value={row.present_days}
                                onChange={e => updateRow(idx, 'present_days', Number(e.target.value))}
                                style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>ملاحظات</label>
                              <input type="text" value={row.notes}
                                onChange={e => updateRow(idx, 'notes', e.target.value)}
                                placeholder="ملاحظات اختيارية..."
                                style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>صافي الراتب</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0ea77b' }}>{row.net.toLocaleString()} ر.س</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>

              {/* صف الإجماليات */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: '0.82rem' }}>
                    الإجمالي ({rows.length} موظف)
                  </td>
                  <td colSpan={9}></td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)' }}>
                    {totalGross.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0ea77b', background: '#ecfdf5' }}>
                    {totalNet.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ملخص أسفل */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>إجمالي المستحقات</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{totalGross.toLocaleString()} ر.س</div>
            </div>
            <div style={{ background: '#fff5f5', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>إجمالي الخصومات</div>
              <div style={{ fontWeight: 700, color: '#c81e1e', fontSize: '1rem' }}>{totalDeduct.toLocaleString()} ر.س</div>
            </div>
            <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>إجمالي الصافي</div>
              <div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1.1rem' }}>{totalNet.toLocaleString()} ر.س</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button type="button" disabled={saving} onClick={handleSave} className="btn btn-primary">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            حفظ مسير {ARABIC_MONTHS[selMonth - 1]} {selYear}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function PayrollPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from('hr_payroll')
        .select('*, employee:employees!hr_payroll_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false }),
      supabase.from('hr_employees')
        .select('id, employee_id, basic_salary, housing_allow, transport_allow, other_allow, gosi_enrolled, gosi_pct, nationality, employee:employees!hr_employees_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id)
        .order('id'),
    ])
    setPayrolls(p.data || [])
    setHREmployees((e.data || []) as any[])
    setLoading(false)
  }

  // حفظ مسير رواتب كامل (كل الموظفين)
  async function handleSaveBulk(rows: PayrollRow[], month: number, year: number) {
    if (!tenant) return
    let saved = 0
    for (const row of rows) {
      const payload = {
        tenant_id: tenant.id,
        branch_id: activeBranch?.id || null,
        employee_id: row.employee_id,
        month, year,
        basic_salary: row.basic_salary,
        housing_allow: row.housing_allow,
        transport_allow: row.transport_allow,
        other_allow: row.other_allow,
        overtime_pay: row.overtime_pay,
        bonuses: row.bonuses,
        gosi_deduction: row.gosi_deduction,
        absence_deduct: row.absence_deduct,
        other_deduct: row.other_deduct,
        present_days: row.present_days,
        absent_days: 26 - row.present_days,
        overtime_hours: 0,
        gross_salary: row.gross,
        net_salary: row.net,
        notes: row.notes || null,
        status: 'مسودة',
        working_days: 26,
      }
      if (row.existingId) {
        await supabase.from('hr_payroll').update(payload).eq('id', row.existingId)
      } else {
        await supabase.from('hr_payroll').insert(payload)
      }
      saved++
    }
    await load()
    setShowCreateModal(false)
    toast.success(`✅ تم حفظ مسير ${ARABIC_MONTHS[month - 1]} — ${saved} موظف`)
  }

  // تعديل كشف راتب موجود
  async function handleEditSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    await supabase.from('hr_payroll').update(payload).eq('id', data.id)
    await load()
    setEditPayroll(null)
    toast.success('تم التعديل ✅')
  }

  const filtered = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
  const totalGross = filtered.reduce((s, p) => s + p.gross_salary, 0)
  const totalDeduct = filtered.reduce((s, p) => s + p.gosi_deduction + p.absence_deduct + p.other_deduct, 0)
  const totalNet = filtered.reduce((s, p) => s + p.net_salary, 0)

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Banknote style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> الرواتب
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة كشوف الرواتب الشهرية</p>
      </div>

      {/* فلتر الشهر + زر إنشاء مسير */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="select" style={{ width: 'auto' }}>
            {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="input" style={{ width: '90px' }} min="2020" max="2030" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>{filtered.length} موظف</span>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Users style={{ width: '16px', height: '16px' }} /> إنشاء مسير رواتب
          </button>
        )}
      </div>

      {/* ملخص الشهر */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المستحقات', value: `${totalGross.toLocaleString()} ر.س`, color: 'var(--primary)', bg: 'var(--primary-light)' },
            { label: 'إجمالي الخصومات', value: `${totalDeduct.toLocaleString()} ر.س`, color: '#c81e1e', bg: '#fef2f2' },
            { label: 'إجمالي الصافي',   value: `${totalNet.toLocaleString()} ر.س`,   color: '#0ea77b', bg: '#ecfdf5' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* جدول الرواتب */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Banknote style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد كشوف رواتب لهذا الشهر</p>
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Users style={{ width: '16px', height: '16px' }} /> إنشاء مسير رواتب
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الموظف</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الراتب الأساسي</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>البدلات</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>إضافي + مكافآت</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الإجمالي</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#c81e1e', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>تأمينات</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#c81e1e', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>خصومات أخرى</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea77b', fontSize: '0.75rem', whiteSpace: 'nowrap', background: '#ecfdf5' }}>صافي الراتب</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الحضور</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الحالة</th>
                  {isAdmin && <th style={{ padding: '11px 14px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const allowances = p.housing_allow + p.transport_allow + p.other_allow
                  const extras = p.overtime_pay + p.bonuses
                  const otherDeduct = p.absence_deduct + p.other_deduct
                  return (
                    <tr key={p.id}
                      style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{p.employee?.name || `#${p.employee_id}`}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{p.employee?.role}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.basic_salary.toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>
                        {allowances.toLocaleString()} ر.س
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                          {[p.housing_allow && `سكن ${p.housing_allow.toLocaleString()}`, p.transport_allow && `نقل ${p.transport_allow.toLocaleString()}`].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: extras > 0 ? '#0ea77b' : 'var(--text3)' }}>
                        {extras > 0 ? `+${extras.toLocaleString()} ر.س` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px', color: '#c81e1e' }}>
                        {p.gosi_deduction > 0 ? `-${p.gosi_deduction.toLocaleString()} ر.س` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: otherDeduct > 0 ? '#c81e1e' : 'var(--text3)' }}>
                        {otherDeduct > 0 ? `-${otherDeduct.toLocaleString()} ر.س` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#0ea77b', fontWeight: 700, fontSize: '1rem', background: '#f0fdf4' }}>
                        {p.net_salary.toLocaleString()} ر.س
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.82rem' }}>{p.present_days}/26</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className={`badge ${STATUS_COLOR[p.status] || 'badge-gray'}`}>{p.status}</span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button onClick={() => setEditPayroll(p)} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {/* صف الإجماليات */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700 }}>
                  <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>الإجمالي</td>
                  <td style={{ padding: '10px 14px' }}>{filtered.reduce((s,p) => s+p.basic_salary,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px' }}>{filtered.reduce((s,p) => s+p.housing_allow+p.transport_allow+p.other_allow,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px' }}>{filtered.reduce((s,p) => s+p.overtime_pay+p.bonuses,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: 'var(--primary)' }}>{totalGross.toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{filtered.reduce((s,p) => s+p.gosi_deduction,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{filtered.reduce((s,p) => s+p.absence_deduct+p.other_deduct,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#0ea77b', fontSize: '1rem', background: '#ecfdf5' }}>{totalNet.toLocaleString()} ر.س</td>
                  <td colSpan={isAdmin ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* مودال إنشاء مسير */}
      {showCreateModal && (
        <CreatePayrollModal
          hrEmployees={hrEmployees}
          month={filterMonth}
          year={filterYear}
          existingPayrolls={payrolls}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveBulk}
        />
      )}

      {/* مودال تعديل كشف واحد */}
      {editPayroll && (
        <EditPayrollModal
          payroll={editPayroll}
          onClose={() => setEditPayroll(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  )
}
