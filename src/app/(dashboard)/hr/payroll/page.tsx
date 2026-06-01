'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Banknote, Pencil, X, Save, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react'
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

type PayrollRow = {
  employee_id: number
  name: string
  role: string
  included: boolean        // ← مربع الاختيار
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
  gross: number
  net: number
  existingId?: number
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const STATUS_COLOR: Record<string, string> = { 'مسودة': 'badge-gray', 'معتمد': 'badge-blue', 'مدفوع': 'badge-green' }

function calcRow(r: PayrollRow): PayrollRow {
  const gross = r.basic_salary + r.housing_allow + r.transport_allow + r.other_allow + r.overtime_pay + r.bonuses
  const net = gross - r.gosi_deduction - r.absence_deduct - r.other_deduct
  return { ...r, gross, net }
}

// ══════════════════════════════════════
// نافذة تعديل كشف راتب موجود
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
          <h3 className="font-bold text-gray-800">تعديل راتب — {payroll.employee?.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
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
              <div style={{ background: '#fff5f5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الخصومات</div><div style={{ fontWeight: 700, color: '#c81e1e' }}>{(form.gosi_deduction + form.absence_deduct + form.other_deduct).toLocaleString()}</div></div>
              <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '10px' }}><div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الصافي</div><div style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1rem' }}>{net.toLocaleString()}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الحضور</label><input type="number" value={form.present_days} onChange={e => set('present_days', Number(e.target.value))} className="input" min="0" max="31" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة','معتمد','مدفوع'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" /></div>
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
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function PayrollPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [mode, setMode] = useState<'view' | 'create'>('view')  // ← وضع العرض أو الإنشاء
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from('hr_payroll')
        .select('*, employee:employees!hr_payroll_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id)
        .order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('hr_employees')
        .select('id, employee_id, basic_salary, housing_allow, transport_allow, other_allow, gosi_enrolled, gosi_pct, nationality, employee:employees!hr_employees_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id).order('id'),
    ])
    setPayrolls(p.data || [])
    setHREmployees((e.data || []) as any[])
    setLoading(false)
  }

  // بناء صفوف المسير عند الدخول لوضع الإنشاء
  function enterCreateMode() {
    const existing = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
    const built: PayrollRow[] = hrEmployees.map(emp => {
      const ex = existing.find(p => p.employee_id === emp.employee_id)
      const gosiAmt = emp.gosi_enrolled
        ? Math.round((emp.basic_salary + emp.housing_allow) * (emp.gosi_pct / 100))
        : 0
      return calcRow({
        employee_id:     emp.employee_id,
        name:            emp.employee?.name || '—',
        role:            emp.employee?.role || '—',
        included:        true,   // كل الموظفين مُفعَّلون افتراضياً
        basic_salary:    ex?.basic_salary    ?? emp.basic_salary,
        housing_allow:   ex?.housing_allow   ?? emp.housing_allow,
        transport_allow: ex?.transport_allow ?? emp.transport_allow,
        other_allow:     ex?.other_allow     ?? emp.other_allow,
        overtime_pay:    ex?.overtime_pay    ?? 0,
        bonuses:         ex?.bonuses         ?? 0,
        gosi_deduction:  ex?.gosi_deduction  ?? gosiAmt,
        absence_deduct:  ex?.absence_deduct  ?? 0,
        other_deduct:    ex?.other_deduct    ?? 0,
        present_days:    ex?.present_days    ?? 26,
        notes:           ex?.notes           ?? '',
        gross: 0, net: 0,
        existingId: ex?.id,
      })
    })
    setRows(built)
    setExpandedRow(null)
    setMode('create')
  }

  function updateRow(idx: number, k: keyof PayrollRow, v: any) {
    setRows(prev => {
      const next = [...prev]
      next[idx] = calcRow({ ...next[idx], [k]: v })
      return next
    })
  }

  function toggleAll(val: boolean) {
    setRows(prev => prev.map(r => ({ ...r, included: val })))
  }

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
    await load()
    setMode('view')
    setSaving(false)
    toast.success(`✅ تم حفظ مسير ${ARABIC_MONTHS[filterMonth - 1]} — ${includedRows.length} موظف`)
  }

  async function handleEditSave(data: any) {
    await supabase.from('hr_payroll').update({ ...data, tenant_id: tenant?.id }).eq('id', data.id)
    await load(); setEditPayroll(null); toast.success('تم التعديل ✅')
  }

  const filteredPayrolls = payrolls.filter(p => p.month === filterMonth && p.year === filterYear)
  const vGross = filteredPayrolls.reduce((s, p) => s + p.gross_salary, 0)
  const vDeduct = filteredPayrolls.reduce((s, p) => s + p.gosi_deduction + p.absence_deduct + p.other_deduct, 0)
  const vNet = filteredPayrolls.reduce((s, p) => s + p.net_salary, 0)

  // ── input style مصغر للجدول ──
  const cellInput = (color?: string): React.CSSProperties => ({
    width: '76px', padding: '4px 6px', border: `1px solid ${color || 'var(--border)'}`,
    borderRadius: '6px', fontSize: '0.78rem', textAlign: 'left' as const,
    background: color === '#fca5a5' ? '#fff5f5' : 'var(--bg2)',
    direction: 'ltr',
  })

  return (
    <div className="space-y-5 fade-in">

      {/* ── العنوان ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Banknote style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            {mode === 'create'
              ? `مسير رواتب — ${ARABIC_MONTHS[filterMonth - 1]} ${filterYear}`
              : 'الرواتب'}
          </h1>
          <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة كشوف الرواتب الشهرية</p>
        </div>

        {/* أزرار رأس الصفحة */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* فلتر الشهر والسنة */}
          <select value={filterMonth} onChange={e => { setFilterMonth(Number(e.target.value)); setMode('view') }} className="select" style={{ width: 'auto' }}>
            {ARABIC_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setMode('view') }}
            className="input" style={{ width: '88px' }} min="2020" max="2030" />

          {mode === 'view' ? (
            isAdmin && (
              <button onClick={enterCreateMode} className="btn btn-primary">
                <Banknote style={{ width: '16px', height: '16px' }} />
                {filteredPayrolls.length > 0 ? 'تعديل المسير' : 'إنشاء مسير'}
              </button>
            )
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setMode('view')} className="btn btn-ghost">
                <X style={{ width: '15px', height: '15px' }} /> إلغاء
              </button>
              <button type="button" onClick={handleSaveBulk} disabled={saving} className="btn btn-primary">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save style={{ width: '15px', height: '15px' }} />}
                حفظ المسير ({includedRows.length} موظف)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      {(mode === 'view' ? filteredPayrolls.length > 0 : includedRows.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المستحقات', value: (mode === 'view' ? vGross : totalGross).toLocaleString() + ' ر.س', color: 'var(--primary)', bg: 'var(--primary-light)' },
            { label: 'إجمالي الخصومات', value: (mode === 'view' ? vDeduct : totalDeduct).toLocaleString() + ' ر.س', color: '#c81e1e', bg: '#fef2f2' },
            { label: 'إجمالي الصافي',   value: (mode === 'view' ? vNet : totalNet).toLocaleString() + ' ر.س',   color: '#0ea77b', bg: '#ecfdf5' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '14px', textAlign: 'center', background: kpi.bg }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>

      ) : mode === 'create' ? (
        /* ════════════════════════════════
           وضع الإنشاء — جدول المسير
        ════════════════════════════════ */
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* تلميح */}
          <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>💡</span>
            <span>أزل علامة الاختيار عن الموظفين في إجازة أو لا يستحقون راتب هذا الشهر — اضغط على السهم لتعديل التفاصيل</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {/* checkbox الكل */}
                  <th style={{ padding: '10px 12px', width: '40px' }}>
                    <button type="button" onClick={() => toggleAll(!rows.every(r => r.included))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      {rows.every(r => r.included)
                        ? <CheckSquare style={{ width: '18px', height: '18px' }} />
                        : <Square style={{ width: '18px', height: '18px', color: 'var(--text3)' }} />}
                    </button>
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>الموظف</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>الأساسي</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>السكن</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>النقل</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>بدلات أخرى</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>إضافي</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>مكافأة</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>تأمينات</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>غياب</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>خصم آخر</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>الإجمالي</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', fontSize: '0.72rem', whiteSpace: 'nowrap', background: '#ecfdf5' }}>الصافي</th>
                  <th style={{ padding: '10px 8px', width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <>
                    <tr key={row.employee_id}
                      style={{
                        borderBottom: expandedRow === idx ? 'none' : '1px solid var(--bg2)',
                        opacity: row.included ? 1 : 0.4,
                        background: !row.included ? '#fafafa' : expandedRow === idx ? '#f0f9ff' : 'transparent',
                        transition: 'opacity 0.2s',
                      }}>

                      {/* checkbox */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button type="button" onClick={() => updateRow(idx, 'included', !row.included)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {row.included
                            ? <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
                            : <Square style={{ width: '18px', height: '18px', color: '#d1d5db' }} />}
                        </button>
                      </td>

                      {/* اسم الموظف */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.82rem' }}>{row.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{row.role}</div>
                        {row.existingId && <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 5px' }}>محفوظ</span>}
                        {!row.included && <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', padding: '1px 5px', marginRight: '4px' }}>خارج المسير</span>}
                      </td>

                      {/* حقول المستحقات */}
                      {(['basic_salary','housing_allow','transport_allow','other_allow','overtime_pay','bonuses'] as const).map(k => (
                        <td key={k} style={{ padding: '6px 4px' }}>
                          <input type="number" min="0" value={row[k] as number}
                            disabled={!row.included}
                            onChange={e => updateRow(idx, k, Number(e.target.value))}
                            style={cellInput()}
                          />
                        </td>
                      ))}

                      {/* حقول الخصومات */}
                      {(['gosi_deduction','absence_deduct','other_deduct'] as const).map(k => (
                        <td key={k} style={{ padding: '6px 4px' }}>
                          <input type="number" min="0" value={row[k] as number}
                            disabled={!row.included}
                            onChange={e => updateRow(idx, k, Number(e.target.value))}
                            style={cellInput('#fca5a5')}
                          />
                        </td>
                      ))}

                      {/* الإجمالي والصافي */}
                      <td style={{ padding: '8px', fontWeight: 700, color: row.included ? 'var(--primary)' : 'var(--text3)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {row.included ? row.gross.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700, color: row.included ? '#0ea77b' : 'var(--text3)', whiteSpace: 'nowrap', fontSize: '0.9rem', background: row.included ? '#f0fdf4' : 'transparent' }}>
                        {row.included ? row.net.toLocaleString() : '—'}
                      </td>

                      {/* زر التوسيع */}
                      <td style={{ padding: '8px 6px' }}>
                        <button type="button" onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                          {expandedRow === idx
                            ? <ChevronUp style={{ width: '15px', height: '15px' }} />
                            : <ChevronDown style={{ width: '15px', height: '15px' }} />}
                        </button>
                      </td>
                    </tr>

                    {/* صف التفاصيل */}
                    {expandedRow === idx && (
                      <tr key={`exp-${row.employee_id}`} style={{ background: '#f0f9ff', borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={15} style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>أيام الحضور</label>
                              <input type="number" min="0" max="31" value={row.present_days}
                                onChange={e => updateRow(idx, 'present_days', Number(e.target.value))}
                                style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>ملاحظات</label>
                              <input type="text" value={row.notes} placeholder="مثال: في إجازة نصف الشهر..."
                                onChange={e => updateRow(idx, 'notes', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
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
              {/* الإجماليات */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={2} style={{ padding: '10px 12px' }}>
                    الإجمالي — {includedRows.length} من {rows.length} موظف
                  </td>
                  <td colSpan={9}></td>
                  <td style={{ padding: '10px 8px', color: 'var(--primary)' }}>{totalGross.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', color: '#0ea77b', background: '#ecfdf5' }}>{totalNet.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* زر الحفظ أسفل الجدول */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
              {includedRows.length} موظف في المسير — {rows.length - includedRows.length} خارج المسير
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setMode('view')} className="btn btn-ghost">
                <X style={{ width: '15px', height: '15px' }} /> إلغاء
              </button>
              <button type="button" onClick={handleSaveBulk} disabled={saving || includedRows.length === 0} className="btn btn-primary">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save style={{ width: '15px', height: '15px' }} />}
                حفظ مسير {ARABIC_MONTHS[filterMonth - 1]} ({includedRows.length} موظف)
              </button>
            </div>
          </div>
        </div>

      ) : filteredPayrolls.length === 0 ? (
        /* ── لا توجد رواتب ── */
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Banknote style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد كشوف رواتب لهذا الشهر</p>
          {isAdmin && (
            <button onClick={enterCreateMode} className="btn btn-primary">
              <Banknote style={{ width: '16px', height: '16px' }} /> إنشاء مسير رواتب
            </button>
          )}
        </div>

      ) : (
        /* ════════════════════════════════
           وضع العرض — جدول الرواتب المحفوظة
        ════════════════════════════════ */
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
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>الحضور</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>الحالة</th>
                  {isAdmin && <th style={{ padding: '11px 14px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map(p => {
                  const allowances = p.housing_allow + p.transport_allow + p.other_allow
                  const extras = p.overtime_pay + p.bonuses
                  const otherDeduct = p.absence_deduct + p.other_deduct
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)' }}
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
                      <td style={{ padding: '12px 14px', color: extras > 0 ? '#0ea77b' : 'var(--text3)' }}>{extras > 0 ? `+${extras.toLocaleString()} ر.س` : '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 700 }}>{p.gross_salary.toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px', color: '#c81e1e' }}>{p.gosi_deduction > 0 ? `-${p.gosi_deduction.toLocaleString()} ر.س` : '—'}</td>
                      <td style={{ padding: '12px 14px', color: otherDeduct > 0 ? '#c81e1e' : 'var(--text3)' }}>{otherDeduct > 0 ? `-${otherDeduct.toLocaleString()} ر.س` : '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#0ea77b', fontWeight: 700, fontSize: '1rem', background: '#f0fdf4' }}>{p.net_salary.toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.82rem' }}>{p.present_days}/26</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}><span className={`badge ${STATUS_COLOR[p.status] || 'badge-gray'}`}>{p.status}</span></td>
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
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700 }}>
                  <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>الإجمالي ({filteredPayrolls.length} موظف)</td>
                  <td style={{ padding: '10px 14px' }}>{filteredPayrolls.reduce((s,p)=>s+p.basic_salary,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px' }}>{filteredPayrolls.reduce((s,p)=>s+p.housing_allow+p.transport_allow+p.other_allow,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px' }}>{filteredPayrolls.reduce((s,p)=>s+p.overtime_pay+p.bonuses,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: 'var(--primary)' }}>{vGross.toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{filteredPayrolls.reduce((s,p)=>s+p.gosi_deduction,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{filteredPayrolls.reduce((s,p)=>s+p.absence_deduct+p.other_deduct,0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#0ea77b', fontSize: '1rem', background: '#ecfdf5' }}>{vNet.toLocaleString()} ر.س</td>
                  <td colSpan={isAdmin ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* مودال تعديل كشف واحد */}
      {editPayroll && (
        <EditPayrollModal payroll={editPayroll} onClose={() => setEditPayroll(null)} onSave={handleEditSave} />
      )}
    </div>
  )
}
