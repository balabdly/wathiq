'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Calendar, Plus, Pencil, Trash2, X, Save, Clock, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import toast from 'react-hot-toast'

// ── أنواع الإجازات حسب نظام العمل السعودي ──
const LEAVE_TYPES = [
  { value: 'سنوية',    label: 'سنوية',          icon: '🌴', paid: 'كامل',  maxDays: null,  note: '21 يوم (30 بعد 5 سنوات)' },
  { value: 'مرضية',   label: 'مرضية',           icon: '🏥', paid: 'متدرج', maxDays: 120,   note: '30 كامل + 60 بـ75% + 30 بدون راتب' },
  { value: 'أمومة',   label: 'وضع/أمومة',       icon: '👶', paid: 'كامل',  maxDays: 84,    note: '12 أسبوع (84 يوم)' },
  { value: 'حج',      label: 'حج',              icon: '🕋', paid: 'كامل',  maxDays: 15,    note: 'مرة واحدة طوال الخدمة (10-15 يوم)' },
  { value: 'زواج',    label: 'زواج',            icon: '💍', paid: 'كامل',  maxDays: 5,     note: '5 أيام' },
  { value: 'وفاة',    label: 'وفاة ذوي القربى',  icon: '🖤', paid: 'كامل',  maxDays: 5,     note: '5 أيام' },
  { value: 'مولود',   label: 'مولود جديد',       icon: '🍼', paid: 'كامل',  maxDays: 5,     note: '5 أيام' },
  { value: 'امتحانات',label: 'امتحانات',         icon: '📚', paid: 'كامل',  maxDays: null,  note: 'بحسب جدول الاختبارات' },
  { value: 'بدون راتب',label: 'بدون راتب',       icon: '📋', paid: 'لا',    maxDays: null,  note: 'باتفاق الطرفين' },
]

// ── حساب رصيد الإجازة السنوية ──
function calcAnnualLeaveBalance(hireDateStr: string, takenDays: number): {
  yearsOfService: number
  annualEntitlement: number
  totalEarned: number
  balance: number
} {
  if (!hireDateStr) return { yearsOfService: 0, annualEntitlement: 21, totalEarned: 0, balance: 0 }
  const hireDate = new Date(hireDateStr)
  const today = new Date()
  const diffMs = today.getTime() - hireDate.getTime()
  const yearsOfService = diffMs / (1000 * 60 * 60 * 24 * 365.25)
  const annualEntitlement = yearsOfService >= 5 ? 30 : 21
  const totalEarned = Math.floor(yearsOfService * annualEntitlement)
  const balance = Math.max(0, totalEarned - takenDays)
  return { yearsOfService, annualEntitlement, totalEarned, balance }
}

// ── حساب الأجر للإجازة المرضية ──
function calcSickLeavePay(totalSickDaysThisYear: number, newDays: number): {
  fullPayDays: number
  threeQuarterDays: number
  noPay: number
  breakdown: string
} {
  const prevDays = totalSickDaysThisYear
  const afterDays = prevDays + newDays

  let fullPayDays = 0
  let threeQuarterDays = 0
  let noPay = 0

  for (let d = prevDays + 1; d <= afterDays; d++) {
    if (d <= 30) fullPayDays++
    else if (d <= 90) threeQuarterDays++
    else noPay++
  }

  const parts = []
  if (fullPayDays > 0) parts.push(`${fullPayDays} يوم بأجر كامل`)
  if (threeQuarterDays > 0) parts.push(`${threeQuarterDays} يوم بـ 75%`)
  if (noPay > 0) parts.push(`${noPay} يوم بدون راتب`)

  return { fullPayDays, threeQuarterDays, noPay, breakdown: parts.join(' + ') || 'لا يوجد' }
}

type HREmployee = {
  id: number
  employee_id: number
  hire_date?: string
  nationality: string
  iqama_number?: string
  employee?: { name: string; role: string }
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
  sick_pay_info?: string
  employee?: { name: string }
}

// ══════════════════════════════════════
// نافذة تقديم إجازة
// ══════════════════════════════════════
function LeaveModal({ leave, hrEmployees, sickDaysMap, annualTakenMap, onClose, onSave }: {
  leave: Leave | null
  hrEmployees: HREmployee[]
  sickDaysMap: Record<number, number>
  annualTakenMap: Record<number, number>
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: leave?.employee_id ? String(leave.employee_id) : '',
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

  const selectedEmp = hrEmployees.find(e => e.employee_id === Number(form.employee_id))
  const leaveTypeInfo = LEAVE_TYPES.find(t => t.value === form.leave_type)

  // حساب رصيد الإجازة السنوية للموظف المختار
  const annualTaken = selectedEmp ? (annualTakenMap[selectedEmp.employee_id] || 0) : 0
  const annualBalance = selectedEmp ? calcAnnualLeaveBalance(selectedEmp.hire_date || '', annualTaken) : null

  // حساب الإجازة المرضية
  const sickDaysThisYear = selectedEmp ? (sickDaysMap[selectedEmp.employee_id] || 0) : 0
  const sickPayInfo = form.leave_type === 'مرضية' && days > 0
    ? calcSickLeavePay(sickDaysThisYear, days)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    if (!form.start_date || !form.end_date) { toast.error('أدخل تاريخ البداية والنهاية'); return }

    // تحقق رصيد الإجازة السنوية
    if (form.leave_type === 'سنوية' && annualBalance && days > annualBalance.balance) {
      if (!confirm(`تنبيه: الرصيد المتاح ${annualBalance.balance} يوم فقط، هل تريد المتابعة؟`)) return
    }

    setSaving(true)
    await onSave({
      ...(leave ? { id: leave.id } : {}),
      ...form,
      employee_id: Number(form.employee_id),
      days,
      sick_pay_info: sickPayInfo?.breakdown || null,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{leave ? 'تعديل طلب إجازة' : 'تقديم طلب إجازة'}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* الموظف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {hrEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee?.name}</option>)}
              </select>
            </div>

            {/* رصيد الموظف السنوي */}
            {selectedEmp && annualBalance && form.leave_type === 'سنوية' && (
              <div style={{ background: annualBalance.balance > 0 ? '#ecfdf5' : '#fef2f2', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text3)' }}>سنوات الخدمة</span>
                  <span style={{ fontWeight: 600 }}>{annualBalance.yearsOfService.toFixed(1)} سنة</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text3)' }}>الاستحقاق السنوي</span>
                  <span style={{ fontWeight: 600 }}>{annualBalance.annualEntitlement} يوم</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text3)' }}>مأخوذ</span>
                  <span style={{ fontWeight: 600, color: '#c81e1e' }}>{annualTaken} يوم</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '6px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 700 }}>الرصيد المتاح</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: annualBalance.balance > 0 ? '#0ea77b' : '#c81e1e' }}>{annualBalance.balance} يوم</span>
                </div>
              </div>
            )}

            {/* نوع الإجازة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإجازة <span className="text-red-500">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {LEAVE_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set('leave_type', t.value)}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', textAlign: 'right',
                      borderColor: form.leave_type === t.value ? 'var(--primary)' : 'var(--border)',
                      background: form.leave_type === t.value ? 'var(--primary-light)' : 'white',
                      color: form.leave_type === t.value ? 'var(--primary)' : 'var(--text2)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.icon} {t.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>{t.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* التواريخ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">من تاريخ <span className="text-red-500">*</span></label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">إلى تاريخ <span className="text-red-500">*</span></label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input" required />
              </div>
            </div>

            {/* عدد الأيام */}
            {days > 0 && (
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '1.1rem' }}>{days} يوم</span>
                {leaveTypeInfo?.maxDays && days > leaveTypeInfo.maxDays && (
                  <span style={{ fontSize: '0.75rem', color: '#c81e1e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle style={{ width: '14px', height: '14px' }} />
                    الحد الأقصى {leaveTypeInfo.maxDays} يوم
                  </span>
                )}
              </div>
            )}

            {/* معلومات الإجازة المرضية */}
            {sickPayInfo && days > 0 && (
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 14px', background: '#1a56db', color: 'white', fontSize: '0.8rem', fontWeight: 700 }}>
                  🏥 احتساب أجر الإجازة المرضية
                </div>
                <div style={{ padding: '10px 14px', background: '#f9fafb', fontSize: '0.8rem' }}>
                  <div style={{ marginBottom: '6px', color: 'var(--text3)' }}>
                    إجازات مرضية مستهلكة هذا العام: <strong>{sickDaysThisYear} يوم</strong>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{sickPayInfo.breakdown}</div>
                  {sickPayInfo.noPay > 0 && (
                    <div style={{ marginTop: '6px', color: '#c81e1e', fontSize: '0.75rem' }}>
                      ⚠️ {sickPayInfo.noPay} يوم بدون راتب (تجاوز الـ 90 يوم)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* السبب */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">السبب / الملاحظات</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
            </div>

            {/* الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">حالة الطلب</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option value="بانتظار الموافقة">⏳ بانتظار الموافقة</option>
                <option value="موافق">✅ موافق</option>
                <option value="مرفوض">❌ مرفوض</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {leave ? 'حفظ التعديل' : 'تقديم الطلب'}
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
export default function LeavesPage() {
  const { tenant, currentUser } = useStore()
  const [activeTab, setActiveTab] = useState<'balance'|'requests'>('balance')
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editLeave, setEditLeave] = useState<Leave | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [empRes, leavesRes] = await Promise.all([
      supabase.from('hr_employees').select('id, employee_id, hire_date, nationality, iqama_number, employee:employees!hr_employees_employee_id_fkey(name, role)').eq('tenant_id', tenant.id).order('id'),
      supabase.from('hr_leaves').select('*, employee:employees!hr_leaves_employee_id_fkey(name)').eq('tenant_id', tenant.id).order('start_date', { ascending: false }),
    ])
    setHREmployees((empRes.data || []) as any[])
    setLeaves(leavesRes.data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_leaves').update(payload).eq('id', data.id)
    else await supabase.from('hr_leaves').insert(payload)
    await load(); setShowModal(false); setEditLeave(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا الطلب؟')) return
    await supabase.from('hr_leaves').delete().eq('id', id)
    setLeaves(l => l.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  // ── قبول الإجازة ──
  async function handleApprove(id: number) {
    await supabase.from('hr_leaves').update({ status: 'موافق' }).eq('id', id)
    setLeaves(l => l.map(x => x.id === id ? { ...x, status: 'موافق' } : x))
    toast.success('✅ تم قبول الإجازة')
  }

  // ── رفض الإجازة ──
  async function handleReject(id: number) {
    await supabase.from('hr_leaves').update({ status: 'مرفوض' }).eq('id', id)
    setLeaves(l => l.map(x => x.id === id ? { ...x, status: 'مرفوض' } : x))
    toast.error('❌ تم رفض الإجازة')
  }

  // حساب الأيام المرضية لكل موظف في السنة الحالية
  const currentYear = new Date().getFullYear()
  const sickDaysMap: Record<number, number> = {}
  leaves.filter(l => l.leave_type === 'مرضية' && l.status === 'موافق' && new Date(l.start_date).getFullYear() === currentYear)
    .forEach(l => { sickDaysMap[l.employee_id] = (sickDaysMap[l.employee_id] || 0) + l.days })

  // حساب الأيام السنوية المأخوذة لكل موظف
  const annualTakenMap: Record<number, number> = {}
  leaves.filter(l => l.leave_type === 'سنوية' && l.status === 'موافق')
    .forEach(l => { annualTakenMap[l.employee_id] = (annualTakenMap[l.employee_id] || 0) + l.days })

  // آخر إجازة لكل موظف
  const lastLeaveMap: Record<number, string> = {}
  leaves.filter(l => l.status === 'موافق').forEach(l => {
    if (!lastLeaveMap[l.employee_id] || l.start_date > lastLeaveMap[l.employee_id]) {
      lastLeaveMap[l.employee_id] = l.start_date
    }
  })

  const filteredLeaves = leaves.filter(l =>
    (!filterStatus || l.status === filterStatus) &&
    (!filterType || l.leave_type === filterType)
  )

  const pending = leaves.filter(l => l.status === 'بانتظار الموافقة').length

  const STATUS_COLOR: Record<string, string> = {
    'بانتظار الموافقة': 'badge-amber',
    'موافق': 'badge-green',
    'مرفوض': 'badge-red',
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> إدارة الإجازات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>وفق نظام العمل السعودي</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'طلبات معلقة', value: pending, color: pending > 0 ? '#e6820a' : '#0ea77b', bg: pending > 0 ? '#fffbeb' : '#ecfdf5' },
          { label: 'موافق عليها', value: leaves.filter(l => l.status === 'موافق').length, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي الطلبات', value: leaves.length, color: '#1a56db', bg: '#eff6ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        <button type="button" onClick={() => setActiveTab('balance')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === 'balance' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'balance' ? 'white' : 'var(--text3)',
            boxShadow: activeTab === 'balance' ? '0 2px 8px rgba(26,86,219,0.3)' : 'none' }}>
          <Clock style={{ width: '16px', height: '16px' }} /> رصيد الإجازات
        </button>
        <button type="button" onClick={() => setActiveTab('requests')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === 'requests' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'requests' ? 'white' : 'var(--text3)',
            boxShadow: activeTab === 'requests' ? '0 2px 8px rgba(26,86,219,0.3)' : 'none' }}>
          <Calendar style={{ width: '16px', height: '16px' }} /> طلبات الإجازة
          {pending > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '20px', padding: '1px 6px', fontSize: '0.7rem' }}>{pending}</span>}
        </button>
      </div>

      {/* ══ تاب رصيد الإجازات ══ */}
      {activeTab === 'balance' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', fontSize: '0.8rem', color: '#1a56db' }}>
            <Info style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            الاستحقاق: 21 يوم/سنة للأقل من 5 سنوات خدمة — 30 يوم/سنة لمن أمضى 5 سنوات فأكثر
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : hrEmployees.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Calendar style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا يوجد موظفون في الموارد البشرية</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الدور</th>
                    <th>الإقامة</th>
                    <th>تاريخ المباشرة</th>
                    <th>سنوات الخدمة</th>
                    <th>الاستحقاق/سنة</th>
                    <th>مأخوذ</th>
                    <th>آخر إجازة</th>
                    <th>الرصيد المتاح</th>
                  </tr>
                </thead>
                <tbody>
                  {hrEmployees.map(emp => {
                    const taken = annualTakenMap[emp.employee_id] || 0
                    const bal = calcAnnualLeaveBalance(emp.hire_date || '', taken)
                    const lastLeave = lastLeaveMap[emp.employee_id]
                    const isLow = bal.balance <= 5 && bal.balance > 0
                    const isZero = bal.balance === 0

                    return (
                      <tr key={emp.id} style={{ background: isZero ? '#fff5f5' : isLow ? '#fffbeb' : '' }}>
                        <td style={{ fontWeight: 600 }}>{emp.employee?.name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{emp.employee?.role}</td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text3)' }}>
                          {emp.nationality !== 'سعودي' ? (emp.iqama_number || '—') : '—'}
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{formatDate(emp.hire_date)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{bal.yearsOfService.toFixed(1)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${bal.annualEntitlement === 30 ? 'badge-green' : 'badge-blue'}`}>
                            {bal.annualEntitlement} يوم
          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: '#c81e1e', fontWeight: 600 }}>{taken}</td>
                        <td style={{ fontSize: '0.875rem' }}>{lastLeave ? formatDate(lastLeave) : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: isZero ? '#c81e1e' : isLow ? '#e6820a' : '#0ea77b' }}>
                            {bal.balance}
                            {isZero && ' ⚠️'}
                            {isLow && !isZero && ' ⚡'}
                          </span>
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

      {/* ══ تاب طلبات الإجازة ══ */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
                <option value="">كل الحالات</option>
                <option value="بانتظار الموافقة">بانتظار الموافقة</option>
                <option value="موافق">موافق</option>
                <option value="مرفوض">مرفوض</option>
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select" style={{ width: 'auto' }}>
                <option value="">كل الأنواع</option>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { setEditLeave(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> تقديم طلب إجازة
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Calendar style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد طلبات إجازة</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>نوع الإجازة</th>
                    <th>من</th>
                    <th>إلى</th>
                    <th>الأيام</th>
                    <th>الحالة</th>
                    <th>الأجر</th>
                    <th>السبب</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map(l => {
                    const typeInfo = LEAVE_TYPES.find(t => t.value === l.leave_type)
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.employee?.name || `#${l.employee_id}`}</td>
                        <td>
                          <span style={{ fontSize: '0.875rem' }}>{typeInfo?.icon} {l.leave_type}</span>
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{formatDate(l.start_date)}</td>
                        <td style={{ fontSize: '0.875rem' }}>{formatDate(l.end_date)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.days}</td>
                        <td><span className={`badge ${STATUS_COLOR[l.status] || 'badge-gray'}`}>{l.status}</span></td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text3)', maxWidth: '120px' }}>
                          {l.leave_type === 'مرضية' && l.sick_pay_info ? (
                            <span title={l.sick_pay_info} style={{ cursor: 'help', color: '#1a56db' }}>🏥 {l.sick_pay_info.split('+')[0]?.trim()}</span>
                          ) : typeInfo?.paid === 'كامل' ? <span style={{ color: '#0ea77b' }}>✓ كامل</span>
                          : typeInfo?.paid === 'لا' ? <span style={{ color: '#c81e1e' }}>بدون راتب</span>
                          : '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text3)', maxWidth: '120px' }} className="truncate">{l.reason || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            {/* أزرار القبول والرفض — للمدير فقط وعلى الطلبات المعلقة */}
                            {isAdmin && l.status === 'بانتظار الموافقة' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(l.id)}
                                  title="قبول الإجازة"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#ecfdf5', color: '#0ea77b', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  <CheckCircle2 style={{ width: '14px', height: '14px' }} /> قبول
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(l.id)}
                                  title="رفض الإجازة"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#c81e1e', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  <XCircle style={{ width: '14px', height: '14px' }} /> رفض
                                </button>
                              </>
                            )}
                            {/* زر إعادة للمعلق — على الموافق أو المرفوض */}
                            {isAdmin && l.status !== 'بانتظار الموافقة' && (
                              <button
                                type="button"
                                onClick={() => { supabase.from('hr_leaves').update({ status: 'بانتظار الموافقة' }).eq('id', l.id).then(() => { setLeaves(prev => prev.map(x => x.id === l.id ? { ...x, status: 'بانتظار الموافقة' } : x)); toast.success('أُعيد الطلب للمراجعة') }) }}
                                title="إعادة للمراجعة"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#fffbeb', color: '#e6820a', fontSize: '0.72rem', fontWeight: 600 }}>
                                ↩ إعادة
                              </button>
                            )}
                            <button type="button" onClick={() => { setEditLeave(l); setShowModal(true) }} className="btn btn-ghost btn-xs" title="تعديل">
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                            {isAdmin && (
                              <button type="button" onClick={() => handleDelete(l.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }} title="حذف">
                                <Trash2 style={{ width: '13px', height: '13px' }} />
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
          )}
        </div>
      )}

      {showModal && (
        <LeaveModal
          leave={editLeave}
          hrEmployees={hrEmployees}
          sickDaysMap={sickDaysMap}
          annualTakenMap={annualTakenMap}
          onClose={() => { setShowModal(false); setEditLeave(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
