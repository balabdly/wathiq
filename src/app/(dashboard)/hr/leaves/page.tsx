'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Calendar, Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

type Leave = {
  id: number
  employee_id: number
  leave_type: string
  start_date: string
  end_date: string
  days: number
  status: string
  reason?: string
  employee?: { name: string; role: string }
}

function LeaveModal({ leave, employees, onClose, onSave }: {
  leave: Leave | null; employees: any[]; onClose: () => void; onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: leave?.employee_id || '',
    leave_type: leave?.leave_type || 'سنوية',
    start_date: leave?.start_date || '',
    end_date: leave?.end_date || '',
    reason: leave?.reason || '',
    status: leave?.status || 'بانتظار الموافقة',
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
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإجازة</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['سنوية','مرضية','طارئة','أمومة','حج','بدون راتب'].map(t => (
                  <button key={t} type="button" onClick={() => set('leave_type', t)}
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: '2px solid', cursor: 'pointer',
                      borderColor: form.leave_type === t ? 'var(--primary)' : 'var(--border)',
                      background: form.leave_type === t ? 'var(--primary-light)' : 'white',
                      color: form.leave_type === t ? 'var(--primary)' : 'var(--text3)' }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">من تاريخ</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">إلى تاريخ</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input" required /></div>
            </div>
            {days > 0 && (
              <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{days} يوم</span>
              </div>
            )}
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">السبب</label><textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['بانتظار الموافقة','موافق','مرفوض'].map(s => <option key={s}>{s}</option>)}
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

export default function LeavesPage() {
  const { tenant, activeBranch, employees, currentUser } = useStore()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editLeave, setEditLeave] = useState<Leave | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('hr_leaves')
      .select('*, employee:employees(name, role)')
      .eq('tenant_id', tenant.id)
      .order('start_date', { ascending: false })
    setLeaves(data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch?.id }
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

  const filtered = filterStatus ? leaves.filter(l => l.status === filterStatus) : leaves
  const pending = leaves.filter(l => l.status === 'بانتظار الموافقة').length
  const approved = leaves.filter(l => l.status === 'موافق').length
  const totalDays = leaves.filter(l => l.status === 'موافق').reduce((s, l) => s + l.days, 0)

  const STATUS_COLOR: Record<string, string> = {
    'بانتظار الموافقة': 'badge-amber', 'موافق': 'badge-green', 'مرفوض': 'badge-red'
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> الإجازات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة طلبات الإجازات والموافقة عليها</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'بانتظار الموافقة', value: pending, color: pending > 0 ? '#e6820a' : '#0ea77b', bg: pending > 0 ? '#fffbeb' : '#ecfdf5' },
          { label: 'موافق عليها', value: approved, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي الأيام المعتمدة', value: `${totalDays} يوم`, color: '#1a56db', bg: '#eff6ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الطلبات</option>
          {['بانتظار الموافقة','موافق','مرفوض'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => { setEditLeave(null); setShowModal(true) }} className="btn btn-primary">
          <Plus style={{ width: '16px', height: '16px' }} /> طلب إجازة
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Calendar style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد طلبات إجازة</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>نوع الإجازة</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>السبب</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td><div style={{ fontWeight: 600 }}>{l.employee?.name || `#${l.employee_id}`}</div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{l.employee?.role}</div></td>
                  <td><span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{l.leave_type}</span></td>
                  <td>{formatDate(l.start_date)}</td>
                  <td>{formatDate(l.end_date)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.days}</td>
                  <td><span className={`badge ${STATUS_COLOR[l.status] || 'badge-gray'}`}>{l.status}</span></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text3)', maxWidth: '150px' }}>{l.reason || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditLeave(l); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '14px', height: '14px' }} /></button>
                      {isAdmin && <button onClick={() => handleDelete(l.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <LeaveModal leave={editLeave} employees={employees}
          onClose={() => { setShowModal(false); setEditLeave(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
