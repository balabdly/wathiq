'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Calendar, Plus, Pencil, Trash2, X, Save, Clock, CheckCircle2, XCircle, AlertTriangle, Info, Search, ChevronDown, ChevronUp, FileText, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

// ── أنواع الإجازات ──
const LEAVE_TYPES = [
  { value: 'سنوية',     label: 'سنوية',          icon: '🌴', paid: 'كامل',  maxDays: null, note: '21 يوم (30 بعد 5 سنوات)' },
  { value: 'مرضية',    label: 'مرضية',           icon: '🏥', paid: 'متدرج', maxDays: 120,  note: '30 كامل + 60 بـ75% + 30 بدون راتب' },
  { value: 'أمومة',    label: 'وضع/أمومة',       icon: '👶', paid: 'كامل',  maxDays: 84,   note: '12 أسبوع (84 يوم)' },
  { value: 'حج',       label: 'حج',              icon: '🕋', paid: 'كامل',  maxDays: 15,   note: 'مرة واحدة طوال الخدمة' },
  { value: 'زواج',     label: 'زواج',            icon: '💍', paid: 'كامل',  maxDays: 5,    note: '5 أيام' },
  { value: 'وفاة',     label: 'وفاة ذوي القربى', icon: '🖤', paid: 'كامل',  maxDays: 5,    note: '5 أيام' },
  { value: 'مولود',    label: 'مولود جديد',      icon: '🍼', paid: 'كامل',  maxDays: 5,    note: '5 أيام' },
  { value: 'امتحانات', label: 'امتحانات',        icon: '📚', paid: 'كامل',  maxDays: null, note: 'بحسب جدول الاختبارات' },
  { value: 'بدون راتب',label: 'بدون راتب',       icon: '📋', paid: 'لا',    maxDays: null, note: 'باتفاق الطرفين' },
]

// ── حساب رصيد الإجازة السنوية ──
function calcAnnualLeaveBalance(hireDateStr: string, takenDays: number) {
  if (!hireDateStr) return { yearsOfService: 0, annualEntitlement: 21, totalEarned: 0, balance: 0 }
  const hireDate = new Date(hireDateStr)
  const today = new Date()
  const yearsOfService = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const annualEntitlement = yearsOfService >= 5 ? 30 : 21
  const totalEarned = Math.floor(yearsOfService * annualEntitlement)
  const balance = Math.max(0, totalEarned - takenDays)
  return { yearsOfService, annualEntitlement, totalEarned, balance }
}

// ── حساب أجر الإجازة المرضية ──
function calcSickLeavePay(totalSickDaysThisYear: number, newDays: number) {
  const prevDays = totalSickDaysThisYear
  const afterDays = prevDays + newDays
  let fullPayDays = 0, threeQuarterDays = 0, noPay = 0
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
  id: number; employee_id?: number; hire_date?: string
  nationality?: string; iqama_number?: string
  name?: string; job_title?: string
}

type Leave = {
  id: number; employee_id: number; leave_type: string
  start_date: string; end_date: string; days: number
  status: string; reason?: string; sick_pay_info?: string
  employee?: { name: string }
}

const STATUS_COLOR: Record<string, string> = {
  'بانتظار الموافقة': 'badge-amber',
  'موافق': 'badge-green',
  'مرفوض': 'badge-red',
}

// ══════════════════════════════════════
// نافذة تقديم إجازة
// ══════════════════════════════════════
function LeaveModal({ leave, hrEmployees, sickDaysMap, annualTakenMap, onClose, onSave }: {
  leave: Leave | null; hrEmployees: HREmployee[]
  sickDaysMap: Record<number, number>; annualTakenMap: Record<number, number>
  onClose: () => void; onSave: (d: any) => Promise<void>
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

  const selectedEmp = hrEmployees.find(e => e.id === Number(form.employee_id))
  const leaveTypeInfo = LEAVE_TYPES.find(t => t.value === form.leave_type)
  const annualTaken = selectedEmp ? (annualTakenMap[selectedEmp.id] || 0) : 0
  const annualBalance = selectedEmp ? calcAnnualLeaveBalance(selectedEmp.hire_date || '', annualTaken) : null
  const sickDaysThisYear = selectedEmp ? (sickDaysMap[selectedEmp.id] || 0) : 0
  const sickPayInfo = form.leave_type === 'مرضية' && days > 0 ? calcSickLeavePay(sickDaysThisYear, days) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    if (!form.start_date || !form.end_date) { toast.error('أدخل التواريخ'); return }
    if (form.leave_type === 'سنوية' && annualBalance && days > annualBalance.balance) {
      if (!confirm(`تنبيه: الرصيد المتاح ${annualBalance.balance} يوم فقط، هل تريد المتابعة؟`)) return
    }
    setSaving(true)
    await onSave({ ...(leave ? { id: leave.id } : {}), ...form, employee_id: Number(form.employee_id), days, sick_pay_info: sickPayInfo?.breakdown || null })
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {hrEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {selectedEmp && annualBalance && form.leave_type === 'سنوية' && (
              <div style={{ background: annualBalance.balance > 0 ? '#ecfdf5' : '#fef2f2', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem' }}>
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

            {days > 0 && (
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '1.1rem' }}>{days} يوم</span>
                {leaveTypeInfo?.maxDays && days > leaveTypeInfo.maxDays && (
                  <span style={{ fontSize: '0.75rem', color: '#c81e1e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle style={{ width: '14px', height: '14px' }} /> الحد الأقصى {leaveTypeInfo.maxDays} يوم
                  </span>
                )}
              </div>
            )}

            {sickPayInfo && days > 0 && (
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 14px', background: '#1a56db', color: 'white', fontSize: '0.8rem', fontWeight: 700 }}>🏥 احتساب أجر الإجازة المرضية</div>
                <div style={{ padding: '10px 14px', background: '#f9fafb', fontSize: '0.8rem' }}>
                  <div style={{ marginBottom: '6px', color: 'var(--text3)' }}>مستهلك هذا العام: <strong>{sickDaysThisYear} يوم</strong></div>
                  <div style={{ fontWeight: 600 }}>{sickPayInfo.breakdown}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">السبب / الملاحظات</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
            </div>

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
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {leave ? 'حفظ التعديل' : 'تقديم الطلب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// نافذة سجل موظف كاملة (المستوى الثاني)
// ══════════════════════════════════════
function EmployeeLeaveHistory({ emp, leaves, onClose }: {
  emp: HREmployee; leaves: Leave[]; onClose: () => void
}) {
  // تجميع الإجازات حسب السنة
  const byYear: Record<number, Leave[]> = {}
  leaves.forEach(l => {
    const year = new Date(l.start_date).getFullYear()
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(l)
  })
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  const totalAnnual = leaves.filter(l => l.leave_type === 'سنوية' && l.status === 'موافق').reduce((s, l) => s + l.days, 0)
  const bal = calcAnnualLeaveBalance(emp.hire_date || '', totalAnnual)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">
            سجل إجازات — {emp.name}
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="modal-body">
          {/* ملخص الرصيد */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a56db' }}>{bal.yearsOfService.toFixed(1)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>سنوات الخدمة</div>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c81e1e' }}>{totalAnnual}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>إجمالي الأيام المأخوذة</div>
            </div>
            <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea77b' }}>{bal.balance}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>الرصيد المتاح</div>
            </div>
          </div>

          {/* السجل السنوي */}
          {years.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>لا توجد إجازات مسجلة</div>
          ) : years.map(year => {
            const yearLeaves = byYear[year]
            const yearTotal = yearLeaves.filter(l => l.status === 'موافق').reduce((s, l) => s + l.days, 0)
            return (
              <div key={year} style={{ marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>سنة {year}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{yearTotal} يوم معتمد</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['النوع','من','إلى','الأيام','الحالة'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearLeaves.map(l => {
                      const t = LEAVE_TYPES.find(x => x.value === l.leave_type)
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid var(--bg2)' }}>
                          <td style={{ padding: '8px 12px' }}>{t?.icon} {l.leave_type}</td>
                          <td style={{ padding: '8px 12px' }}>{l.start_date}</td>
                          <td style={{ padding: '8px 12px' }}>{l.end_date}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>{l.days}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className={`badge ${STATUS_COLOR[l.status] || 'badge-gray'}`}>{l.status}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">إغلاق</button>
        </div>
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

  // ── بيانات الموظفين (تُجلب مرة واحدة) ──
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [empLoaded, setEmpLoaded] = useState(false)

  // ── فلاتر الطلبات ──
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [filterEmpId, setFilterEmpId]   = useState('')
  const [filterYear, setFilterYear]     = useState(String(new Date().getFullYear()))

  // ── بيانات الإجازات (تُجلب عند الحاجة) ──
  const [leaves, setLeaves]   = useState<Leave[]>([])
  const [leavesLoading, setLeavesLoading] = useState(false)
  const [page, setPage]       = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 30

  // ── Modal ──
  const [showModal, setShowModal]       = useState(false)
  const [editLeave, setEditLeave]       = useState<Leave | null>(null)
  const [historyEmp, setHistoryEmp]     = useState<HREmployee | null>(null)

  const isAdmin = currentUser?.role === 'مدير عام'

  // ── جلب الموظفين مرة واحدة ──
  useEffect(() => {
    if (!tenant || empLoaded) return
    setEmpLoading(true)
    supabase.from('hr_employees')
      .select('id, employee_id, hire_date, nationality, iqama_number, name, job_title')
      .eq('tenant_id', tenant.id).eq('is_active', true).order('id')
      .then(({ data }) => {
        setHREmployees((data || []) as any[])
        setEmpLoading(false)
        setEmpLoaded(true)
      })
  }, [tenant?.id])

  // ── جلب الإجازات مع الفلاتر — Lazy Loading ──
  async function fetchLeaves(reset = false) {
    if (!tenant) return
    setLeavesLoading(true)
    const currentPage = reset ? 0 : page

    let query = supabase.from('hr_leaves')
      .select('*, employee:hr_employees!hr_leaves_employee_id_fkey(name)')
      .eq('tenant_id', tenant.id)
      .order('start_date', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    if (filterStatus)                query = query.eq('status', filterStatus)
    if (filterType)                  query = query.eq('leave_type', filterType)
    if (filterEmpId)                 query = query.eq('employee_id', Number(filterEmpId))
    if (filterYear) {
      query = query
        .gte('start_date', `${filterYear}-01-01`)
        .lte('start_date', `${filterYear}-12-31`)
    }

    const { data } = await query
    const newData = data || []

    if (reset) setLeaves(newData)
    else setLeaves(prev => [...prev, ...newData])

    setHasMore(newData.length === PAGE_SIZE)
    setPage(reset ? 1 : currentPage + 1)
    setLeavesLoading(false)
  }

  // ── جلب عند تغيير الفلاتر أو تغيير التاب ──
  useEffect(() => {
    if (activeTab === 'requests') fetchLeaves(true)
  }, [activeTab, filterStatus, filterType, filterEmpId, filterYear, tenant?.id])

  // ── جلب كل الإجازات لحساب الأرصدة (تاب رصيد) ──
  const [allLeaves, setAllLeaves] = useState<Leave[]>([])
  useEffect(() => {
    if (!tenant || activeTab !== 'balance') return
    supabase.from('hr_leaves')
      .select('id, employee_id, leave_type, days, status, start_date, end_date, reason, sick_pay_info')
      .eq('tenant_id', tenant.id)
      .eq('status', 'موافق')
      .then(({ data }) => setAllLeaves(data || []))
  }, [tenant?.id, activeTab])

  // ── الحسابات ──
  const currentYear = new Date().getFullYear()
  const sickDaysMap: Record<number, number> = {}
  allLeaves.filter(l => l.leave_type === 'مرضية' && new Date(l.start_date).getFullYear() === currentYear)
    .forEach(l => { sickDaysMap[l.employee_id] = (sickDaysMap[l.employee_id] || 0) + l.days })

  const annualTakenMap: Record<number, number> = {}
  allLeaves.filter(l => l.leave_type === 'سنوية')
    .forEach(l => { annualTakenMap[l.employee_id] = (annualTakenMap[l.employee_id] || 0) + l.days })

  const lastLeaveMap: Record<number, string> = {}
  allLeaves.forEach(l => {
    if (!lastLeaveMap[l.employee_id] || l.start_date > lastLeaveMap[l.employee_id])
      lastLeaveMap[l.employee_id] = l.start_date
  })

  // ── حفظ الإجازة ──
  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_leaves').update(payload).eq('id', data.id)
    else await supabase.from('hr_leaves').insert(payload)
    setShowModal(false); setEditLeave(null)
    toast.success('تم الحفظ ✅')
    fetchLeaves(true)
    // تحديث allLeaves للأرصدة
    supabase.from('hr_leaves').select('id, employee_id, leave_type, days, status, start_date, end_date, reason, sick_pay_info')
      .eq('tenant_id', tenant.id).eq('status', 'موافق')
      .then(({ data: d }) => setAllLeaves(d || []))
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا الطلب؟')) return
    await supabase.from('hr_leaves').delete().eq('id', id)
    setLeaves(l => l.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  async function handleApprove(id: number) {
    await supabase.from('hr_leaves').update({ status: 'موافق' }).eq('id', id)
    setLeaves(l => l.map(x => x.id === id ? { ...x, status: 'موافق' } : x))
    toast.success('✅ تم قبول الإجازة')
  }

  async function handleReject(id: number) {
    await supabase.from('hr_leaves').update({ status: 'مرفوض' }).eq('id', id)
    setLeaves(l => l.map(x => x.id === id ? { ...x, status: 'مرفوض' } : x))
    toast.error('❌ تم رفض الإجازة')
  }

  const pending = leaves.filter(l => l.status === 'بانتظار الموافقة').length
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i))

  // ── موظفون للسجل التاريخي ──
  const historyLeaves = historyEmp
    ? allLeaves.filter(l => l.employee_id === historyEmp.id) as Leave[]
    : []

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> إدارة الإجازات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>وفق نظام العمل السعودي</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        {[
          { id: 'balance',  label: 'رصيد الإجازات', icon: <Clock style={{ width: '16px', height: '16px' }} /> },
          { id: 'requests', label: 'طلبات الإجازة',  icon: <Calendar style={{ width: '16px', height: '16px' }} />, badge: pending },
        ].map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px rgba(26,86,219,0.3)' : 'none' }}>
            {t.icon} {t.label}
            {(t as any).badge > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '20px', padding: '1px 6px', fontSize: '0.7rem' }}>{(t as any).badge}</span>}
          </button>
        ))}
      </div>

      {/* ══ تاب رصيد الإجازات ══ */}
      {activeTab === 'balance' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', fontSize: '0.8rem', color: '#1a56db' }}>
            <Info style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            الاستحقاق: 21 يوم/سنة للأقل من 5 سنوات خدمة — 30 يوم/سنة لمن أمضى 5 سنوات فأكثر · اضغط على اسم الموظف لرؤية سجله الكامل
          </div>

          {empLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['الموظف','تاريخ المباشرة','سنوات الخدمة','الاستحقاق/سنة','مأخوذ','آخر إجازة','الرصيد المتاح'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hrEmployees.map(emp => {
                      const taken = annualTakenMap[emp.id] || 0
                      const bal = calcAnnualLeaveBalance(emp.hire_date || '', taken)
                      const lastLeave = lastLeaveMap[emp.id]
                      const isLow = bal.balance <= 5 && bal.balance > 0
                      const isZero = bal.balance === 0
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg2)', background: isZero ? '#fff5f5' : isLow ? '#fffbeb' : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = isZero ? '#fff5f5' : isLow ? '#fffbeb' : 'transparent')}>
                          {/* اسم الموظف + زر السجل */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{emp.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{emp.job_title}</div>
                              </div>
                              <button type="button"
                                title="عرض سجل الإجازات"
                                onClick={() => {
                                  setHistoryEmp(emp)
                                  supabase.from('hr_leaves').select('*, employee:hr_employees!hr_leaves_employee_id_fkey(name)')
                                    .eq('tenant_id', tenant?.id || '').eq('employee_id', emp.id)
                                    .order('start_date', { ascending: false })
                                    .then(({ data }) => setAllLeaves(prev => {
                                      const others = prev.filter(l => l.employee_id !== emp.id)
                                      return [...others, ...(data || [])]
                                    }))
                                }}
                                style={{
                                  background: '#eff6ff', border: '1px solid #bfdbfe',
                                  borderRadius: '8px', padding: '5px 8px',
                                  cursor: 'pointer', color: '#1a56db',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                                }}>
                                <Eye style={{ width: '13px', height: '13px' }} /> السجل
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '0.875rem' }}>{emp.hire_date ? formatDate(emp.hire_date) : '—'}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>{bal.yearsOfService.toFixed(1)}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span className={`badge ${bal.annualEntitlement === 30 ? 'badge-green' : 'badge-blue'}`}>{bal.annualEntitlement} يوم</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#c81e1e', fontWeight: 600 }}>{taken}</td>
                          <td style={{ padding: '12px 14px', fontSize: '0.875rem' }}>{lastLeave ? formatDate(lastLeave) : '—'}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: isZero ? '#c81e1e' : isLow ? '#e6820a' : '#0ea77b' }}>
                              {bal.balance}{isZero ? ' ⚠️' : isLow ? ' ⚡' : ''}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب طلبات الإجازة ══ */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* شريط الفلاتر */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* فلتر الموظف */}
              <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)} className="select" style={{ width: 'auto', minWidth: '150px' }}>
                <option value="">كل الموظفين</option>
                {hrEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {/* فلتر السنة */}
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="select" style={{ width: 'auto' }}>
                <option value="">كل السنوات</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {/* فلتر الحالة */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
                <option value="">كل الحالات</option>
                <option value="بانتظار الموافقة">⏳ بانتظار الموافقة</option>
                <option value="موافق">✅ موافق</option>
                <option value="مرفوض">❌ مرفوض</option>
              </select>
              {/* فلتر النوع */}
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select" style={{ width: 'auto' }}>
                <option value="">كل الأنواع</option>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { setEditLeave(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> تقديم طلب إجازة
            </button>
          </div>

          {leavesLoading && leaves.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Calendar style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text3)' }}>لا توجد طلبات إجازة لهذا الفلتر</p>
            </div>
          ) : (
            <>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                        {['الموظف','نوع الإجازة','من','إلى','الأيام','الحالة','الأجر','السبب',''].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map(l => {
                        const typeInfo = LEAVE_TYPES.find(t => t.value === l.leave_type)
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '12px 14px', fontWeight: 600 }}>{l.employee?.name || `#${l.employee_id}`}</td>
                            <td style={{ padding: '12px 14px' }}>{typeInfo?.icon} {l.leave_type}</td>
                            <td style={{ padding: '12px 14px', fontSize: '0.875rem' }}>{formatDate(l.start_date)}</td>
                            <td style={{ padding: '12px 14px', fontSize: '0.875rem' }}>{formatDate(l.end_date)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>{l.days}</td>
                            <td style={{ padding: '12px 14px' }}><span className={`badge ${STATUS_COLOR[l.status] || 'badge-gray'}`}>{l.status}</span></td>
                            <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                              {l.leave_type === 'مرضية' && l.sick_pay_info
                                ? <span style={{ color: '#1a56db' }}>🏥 {l.sick_pay_info.split('+')[0]?.trim()}</span>
                                : typeInfo?.paid === 'كامل' ? <span style={{ color: '#0ea77b' }}>✓ كامل</span>
                                : typeInfo?.paid === 'لا' ? <span style={{ color: '#c81e1e' }}>بدون راتب</span>
                                : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text3)', maxWidth: '120px' }}>{l.reason || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                {isAdmin && l.status === 'بانتظار الموافقة' && (
                                  <>
                                    <button type="button" onClick={() => handleApprove(l.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#ecfdf5', color: '#0ea77b', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      <CheckCircle2 style={{ width: '14px', height: '14px' }} /> قبول
                                    </button>
                                    <button type="button" onClick={() => handleReject(l.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#c81e1e', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      <XCircle style={{ width: '14px', height: '14px' }} /> رفض
                                    </button>
                                  </>
                                )}
                                {isAdmin && l.status !== 'بانتظار الموافقة' && (
                                  <button type="button"
                                    onClick={() => { supabase.from('hr_leaves').update({ status: 'بانتظار الموافقة' }).eq('id', l.id).then(() => { setLeaves(prev => prev.map(x => x.id === l.id ? { ...x, status: 'بانتظار الموافقة' } : x)); toast.success('أُعيد الطلب للمراجعة') }) }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#fffbeb', color: '#e6820a', fontSize: '0.72rem', fontWeight: 600 }}>
                                    ↩ إعادة
                                  </button>
                                )}
                                <button type="button" onClick={() => { setEditLeave(l); setShowModal(true) }} className="btn btn-ghost btn-xs">
                                  <Pencil style={{ width: '13px', height: '13px' }} />
                                </button>
                                {isAdmin && (
                                  <button type="button" onClick={() => handleDelete(l.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
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

                {/* تحميل المزيد */}
                {hasMore && (
                  <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                    <button type="button" onClick={() => fetchLeaves(false)} disabled={leavesLoading}
                      style={{ padding: '8px 24px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {leavesLoading ? '⏳ جاري التحميل...' : `تحميل المزيد`}
                    </button>
                  </div>
                )}

                {/* عداد النتائج */}
                <div style={{ padding: '8px 16px', fontSize: '0.78rem', color: 'var(--text3)', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                  {leaves.length} طلب معروض {hasMore ? '(يوجد المزيد)' : '(جميع النتائج)'}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal تقديم/تعديل */}
      {showModal && (
        <LeaveModal
          leave={editLeave} hrEmployees={hrEmployees}
          sickDaysMap={sickDaysMap} annualTakenMap={annualTakenMap}
          onClose={() => { setShowModal(false); setEditLeave(null) }}
          onSave={handleSave}
        />
      )}

      {/* Modal سجل الموظف */}
      {historyEmp && (
        <EmployeeLeaveHistory
          emp={historyEmp}
          leaves={allLeaves.filter(l => l.employee_id === historyEmp.id) as Leave[]}
          onClose={() => setHistoryEmp(null)}
        />
      )}
    </div>
  )
}
