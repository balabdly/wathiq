'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Clock, Plus, Search, Pencil, Trash2, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

type Attendance = {
  id: number
  employee_id: number
  date: string
  status: string
  hours_worked?: number
  overtime_hours?: number
  notes?: string
  employee?: { name: string; job_title?: string }
}

function AttendanceModal({ record, employees, onClose, onSave }: {
  record: Attendance | null
  employees: any[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: record?.employee_id || '',
    date: record?.date || new Date().toISOString().split('T')[0],
    status: record?.status || 'حضور',
    hours_worked: record?.hours_worked || 8,
    overtime_hours: record?.overtime_hours || 0,
    notes: record?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...(record ? { id: record.id } : {}), ...form, employee_id: Number(form.employee_id) })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{record ? 'تعديل سجل حضور' : 'تسجيل حضور'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['حضور','غياب','إجازة','مأمورية','عطلة'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {form.status === 'حضور' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ساعات العمل</label>
                  <input type="number" value={form.hours_worked} onChange={e => set('hours_worked', Number(e.target.value))} className="input" min="0" max="24" step="0.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ساعات إضافية</label>
                  <input type="number" value={form.overtime_hours} onChange={e => set('overtime_hours', Number(e.target.value))} className="input" min="0" max="12" step="0.5" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
            </div>
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

export default function AttendancePage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [records, setRecords] = useState<Attendance[]>([])
  const [hrEmployees, setHrEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<Attendance | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [attendanceRes, empRes] = await Promise.all([
      supabase.from('hr_attendance')
        .select('*, employee:hr_employees!hr_attendance_employee_id_fkey(name, job_title)')
        .eq('tenant_id', tenant.id)
        .order('date', { ascending: false })
        .limit(200),
      supabase.from('hr_employees')
        .select('id, name, job_title')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
    ])
    setRecords(attendanceRes.data || [])
    setHrEmployees(empRes.data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch?.id }
    if (data.id) await supabase.from('hr_attendance').update(payload).eq('id', data.id)
    else await supabase.from('hr_attendance').insert(payload)
    await load()
    setShowModal(false); setEditRecord(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السجل؟')) return
    await supabase.from('hr_attendance').delete().eq('id', id)
    setRecords(r => r.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const filtered = records.filter(r =>
    (!search || r.employee?.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterDate || r.date === filterDate)
  )

  const STATUS_COLOR: Record<string, string> = {
    'حضور': 'badge-green', 'غياب': 'badge-red',
    'إجازة': 'badge-amber', 'مأمورية': 'badge-blue', 'عطلة': 'badge-gray'
  }

  const totalPresent = records.filter(r => r.status === 'حضور').length
  const totalAbsent = records.filter(r => r.status === 'غياب').length
  const totalOvertime = records.reduce((s, r) => s + (r.overtime_hours || 0), 0)

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> الحضور والغياب
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>تسجيل ومتابعة حضور وغياب الموظفين</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي الحضور', value: totalPresent, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي الغياب', value: totalAbsent, color: totalAbsent > 0 ? '#c81e1e' : '#0ea77b', bg: totalAbsent > 0 ? '#fef2f2' : '#ecfdf5' },
          { label: 'ساعات إضافية', value: `${totalOvertime} س`, color: '#e6820a', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '200px' }} placeholder="بحث بالاسم..." />
          </div>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="input" style={{ width: 'auto' }} />
          {filterDate && <button onClick={() => setFilterDate('')} className="btn btn-ghost btn-sm">مسح</button>}
        </div>
        {isAdmin && (
          <button onClick={() => { setEditRecord(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل حضور
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Clock style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد سجلات حضور</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>الموظف</th><th>الدور</th><th>التاريخ</th><th>الحالة</th><th>ساعات العمل</th><th>الإضافي</th><th>ملاحظات</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.employee?.name || `#${r.employee_id}`}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{r.employee?.job_title}</td>
                  <td style={{ fontSize: '0.875rem' }}>{formatDate(r.date)}</td>
                  <td><span className={`badge ${STATUS_COLOR[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.hours_worked || '—'}</td>
                  <td style={{ textAlign: 'center', color: r.overtime_hours ? '#e6820a' : 'var(--text3)', fontWeight: 600 }}>{r.overtime_hours || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{r.notes || '—'}</td>
                  <td>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditRecord(r); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '14px', height: '14px' }} /></button>
                        <button onClick={() => handleDelete(r.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AttendanceModal record={editRecord} employees={hrEmployees}
          onClose={() => { setShowModal(false); setEditRecord(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
