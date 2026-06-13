'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { FileText, Plus, Pencil, Trash2, X, Save, Upload, Download, AlertTriangle, Search, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════
type Document = {
  id: number; employee_id: number; doc_type: string; name: string
  doc_number?: string; issue_date?: string; expiry_date?: string
  place_of_issue?: string; notify_days: number
  file_data?: string; file_name?: string
  notes?: string; employee?: { name: string; role: string }
}

type HREmployee = {
  id: number; employee_id: number; employee_number?: string
  employee?: { name: string; role: string }
}

// ══════════════════════════════════════
// حساب مستوى التنبيه
// ══════════════════════════════════════
function getAlertLevel(days: number | null): {
  level: 'none' | 'early' | 'warning' | 'critical' | 'urgent' | 'expired'
  label: string; color: string; bg: string; rowBg: string
} {
  if (days === null) return { level: 'none', label: 'بدون انتهاء', color: 'var(--text3)', bg: 'transparent', rowBg: 'transparent' }
  if (days <= 0)  return { level: 'expired',  label: `منتهي منذ ${Math.abs(days)} يوم`, color: '#7f1d1d', bg: '#fee2e2', rowBg: '#fff5f5' }
  if (days <= 3)  return { level: 'urgent',   label: `⚡ ${days} يوم — حرج جداً`,        color: '#c81e1e', bg: '#fecaca', rowBg: '#fff5f5' }
  if (days <= 10) return { level: 'critical', label: `🔴 ${days} يوم — حرج`,             color: '#dc2626', bg: '#fef2f2', rowBg: '#fff8f8' }
  if (days <= 30) return { level: 'warning',  label: `🟠 ${days} يوم — تحذير`,           color: '#c2410c', bg: '#ffedd5', rowBg: '#fffbf5' }
  if (days <= 60) return { level: 'early',    label: `🟡 ${days} يوم — تحذير مبكر`,      color: '#92400e', bg: '#fef9c3', rowBg: '#fefff5' }
  return { level: 'none', label: `✓ ${days} يوم`, color: '#0ea77b', bg: '#dcfce7', rowBg: 'transparent' }
}

// ══════════════════════════════════════
// مودال إضافة / تعديل وثيقة
// ══════════════════════════════════════
function DocumentModal({ doc, employees, defaultEmployeeId, onClose, onSave }: {
  doc: Document | null
  employees: HREmployee[]
  defaultEmployeeId?: number
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fileData, setFileData] = useState<{ name: string; data: string } | null>(
    doc?.file_data ? { name: doc.file_name || 'file', data: doc.file_data } : null
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    employee_id:    doc?.employee_id    || defaultEmployeeId || '',
    doc_type:       doc?.doc_type       || 'هوية وطنية',
    name:           doc?.name           || '',
    doc_number:     doc?.doc_number     || '',
    place_of_issue: doc?.place_of_issue || '',
    issue_date:     doc?.issue_date     || '',
    expiry_date:    doc?.expiry_date    || '',
    notify_days:    doc?.notify_days    || 60,
    notes:          doc?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // تعبئة اسم الوثيقة تلقائياً عند اختيار الموظف والنوع
  useEffect(() => {
    if (!form.name && form.employee_id && form.doc_type) {
      const emp = employees.find(e => String(e.employee_id) === String(form.employee_id))
      const empName = emp?.employee?.name?.split(' ')[0] || ''
      if (empName) set('name', `${form.doc_type} — ${empName}`)
    }
  }, [form.employee_id, form.doc_type])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('الملف أكبر من 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setFileData({ name: file.name, data: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    if (!form.name.trim()) { toast.error('أدخل اسم الوثيقة'); return }
    setSaving(true)
    await onSave({
      ...(doc ? { id: doc.id } : {}), ...form,
      employee_id: Number(form.employee_id),
      file_data: fileData?.data || null,
      file_name: fileData?.name || null,
    })
    setSaving(false)
  }

  const DOC_TYPES = ['هوية وطنية','إقامة','جواز سفر','عقد عمل','شهادة خبرة','شهادة دراسية','رخصة قيادة','تأمين صحي','تصريح عمل','أخرى']
  const selectedEmp = employees.find(e => String(e.employee_id) === String(form.employee_id))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{doc ? 'تعديل وثيقة' : 'إضافة وثيقة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* الموظف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {employees.map(e => (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.employee_number ? `#${e.employee_number} — ` : ''}{e.employee?.name} — {e.employee?.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الوثيقة</label>
                <select value={form.doc_type} onChange={e => set('doc_type', e.target.value)} className="select">
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required placeholder="مثال: هوية محمد" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label>
                <input value={form.doc_number} onChange={e => set('doc_number', e.target.value)} className="input" dir="ltr" placeholder="1XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مكان الإصدار</label>
                <input value={form.place_of_issue} onChange={e => set('place_of_issue', e.target.value)} className="input" placeholder="مثال: الرياض، جدة..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار</label>
                <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label>
                <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
              </div>
            </div>

            {/* مستويات التنبيه المرئية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                التنبيه قبل الانتهاء
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)', marginRight: '8px' }}>
                  (التنبيه يظهر تلقائياً عند 60، 30، 10، 3 أيام)
                </span>
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { days: 60, label: '60 يوم', color: '#92400e', bg: '#fef9c3' },
                  { days: 30, label: '30 يوم', color: '#c2410c', bg: '#ffedd5' },
                  { days: 10, label: '10 أيام', color: '#dc2626', bg: '#fef2f2' },
                  { days: 3,  label: '3 أيام',  color: '#c81e1e', bg: '#fecaca' },
                ].map(opt => (
                  <button key={opt.days} type="button"
                    onClick={() => set('notify_days', opt.days)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', border: '2px solid',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      borderColor: form.notify_days === opt.days ? opt.color : 'var(--border)',
                      background: form.notify_days === opt.days ? opt.bg : 'transparent',
                      color: form.notify_days === opt.days ? opt.color : 'var(--text3)',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* رفع ملف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رفع ملف (PDF/صورة)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                  <Upload className="w-3.5 h-3.5" /> {fileData ? 'تغيير' : 'رفع ملف'}
                </button>
                {fileData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#0ea77b' }}>
                    <FileText style={{ width: '16px', height: '16px' }} />
                    <span>{fileData.name}</span>
                    <button type="button" onClick={() => setFileData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
            </div>
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

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function DocumentsPage() {
  const { tenant, currentUser } = useStore()
  const [docs, setDocs] = useState<Document[]>([])
  const [hrEmployees, setHrEmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState<'by_employee' | 'alerts' | 'all'>('by_employee')
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null)
  const [searchEmp, setSearchEmp] = useState('')
  const [filterType, setFilterType] = useState('')
  const isAdmin = currentUser?.role === 'مدير عام'
  const now = new Date()

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [docsRes, empRes] = await Promise.all([
      supabase.from('hr_documents')
        .select('*, employee:employees(name, role)')
        .eq('tenant_id', tenant.id)
        .order('expiry_date'),
      supabase.from('hr_employees')
        .select('id, employee_id, employee_number, employee:employees!hr_employees_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('employee_number'),
    ])
    setDocs(docsRes.data || [])
    setHrEmployees(empRes.data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_documents').update(payload).eq('id', data.id)
    else await supabase.from('hr_documents').insert(payload)
    await load()
    setShowModal(false); setEditDoc(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه الوثيقة؟')) return
    await supabase.from('hr_documents').delete().eq('id', id)
    setDocs(d => d.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  // ── حسابات التنبيهات ──
  const getDays = (d: Document) => d.expiry_date
    ? Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000)
    : null

  const expired   = docs.filter(d => { const days = getDays(d); return days !== null && days <= 0 }).length
  const urgent    = docs.filter(d => { const days = getDays(d); return days !== null && days > 0 && days <= 3 }).length
  const critical  = docs.filter(d => { const days = getDays(d); return days !== null && days > 3 && days <= 10 }).length
  const warning   = docs.filter(d => { const days = getDays(d); return days !== null && days > 10 && days <= 30 }).length
  const early     = docs.filter(d => { const days = getDays(d); return days !== null && days > 30 && days <= 60 }).length
  const alertCount = expired + urgent + critical + warning + early

  // ── الموظفون المفلترون للبحث ──
  const filteredEmps = hrEmployees.filter(e =>
    !searchEmp || e.employee?.name?.includes(searchEmp) ||
    (e.employee_number && e.employee_number.includes(searchEmp))
  )

  // ── وثائق الموظف المختار ──
  const empDocs = selectedEmpId
    ? docs.filter(d => {
        const emp = hrEmployees.find(e => e.employee_id === selectedEmpId)
        return d.employee_id === selectedEmpId || d.employee_id === emp?.employee_id
      })
    : []

  // ── وثائق التنبيهات مرتبة ──
  const alertDocs = docs
    .filter(d => { const days = getDays(d); return days !== null && days <= 60 })
    .sort((a, b) => getDays(a)! - getDays(b)!)

  // ── كل الوثائق مع فلتر ──
  const allFiltered = filterType ? docs.filter(d => d.doc_type === filterType) : docs
  const docTypes = Array.from(new Set(docs.map(d => d.doc_type)))

  // ── جدول الوثائق المشترك ──
  function DocsTable({ list, showEmp = true }: { list: Document[]; showEmp?: boolean }) {
    if (list.length === 0) return (
      <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
        <FileText style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 10px' }} />
        <p>لا توجد وثائق</p>
      </div>
    )
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
              {showEmp && <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>الموظف</th>}
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>نوع الوثيقة</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>الرقم</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>مكان الإصدار</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>تاريخ الإصدار</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>تاريخ الانتهاء</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(d => {
              const days = getDays(d)
              const alert = getAlertLevel(days)
              const isUrgent = alert.level === 'urgent'
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--bg2)', background: alert.rowBg }}>
                  {showEmp && (
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.employee?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{d.employee?.role}</div>
                    </td>
                  )}
                  <td style={{ padding: '10px 14px' }}>
                    <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{d.doc_type}</span>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '2px' }}>{d.name}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text3)' }}>{d.doc_number || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text3)' }}>{d.place_of_issue || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{formatDate(d.issue_date)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: days !== null && days <= 10 ? 700 : 400 }}>{formatDate(d.expiry_date)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {days !== null ? (
                      <span style={{
                        background: alert.bg, color: alert.color,
                        borderRadius: '20px', padding: '3px 10px',
                        fontSize: '0.72rem', fontWeight: 700,
                        animation: isUrgent ? 'pulse 1.5s infinite' : 'none',
                        display: 'inline-block',
                      }}>
                        {alert.label}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>بدون انتهاء</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      {d.file_data && (
                        <a href={d.file_data} download={d.file_name} className="btn btn-ghost btn-xs" style={{ color: '#1a56db' }}>
                          <Download style={{ width: '13px', height: '13px' }} />
                        </a>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setEditDoc(d); setShowModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(d.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
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
    )
  }

  return (
    <div className="space-y-5 fade-in">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> وثائق الموظفين
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة ومتابعة وثائق وهويات الموظفين مع تنبيهات الانتهاء</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'إجمالي الوثائق', value: docs.length,  color: '#1a56db', bg: '#eff6ff' },
          { label: 'تحذير مبكر (60)',  value: early,       color: '#92400e', bg: '#fef9c3' },
          { label: 'تحذير (30)',       value: warning,     color: '#c2410c', bg: '#ffedd5' },
          { label: 'حرج (10)',         value: critical,    color: '#dc2626', bg: '#fef2f2' },
          { label: 'حرج جداً (3)',     value: urgent,      color: '#c81e1e', bg: '#fecaca' },
          { label: 'منتهية',           value: expired,     color: '#7f1d1d', bg: '#fee2e2' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { id: 'by_employee', label: '👤 بالموظف' },
          { id: 'alerts',      label: `🔔 التنبيهات${alertCount > 0 ? ` (${alertCount})` : ''}` },
          { id: 'all',         label: '📋 كل الوثائق' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '7px 16px', borderRadius: '8px', fontSize: '0.85rem',
              fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? 'white' : 'transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ تاب بالموظف ══ */}
      {activeTab === 'by_employee' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* قائمة الموظفين */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                <input value={searchEmp} onChange={e => setSearchEmp(e.target.value)}
                  className="input" style={{ paddingRight: '28px', fontSize: '0.82rem' }}
                  placeholder="بحث بالاسم أو الرقم..." />
              </div>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filteredEmps.map(e => {
                const empDocCount = docs.filter(d => d.employee_id === e.employee_id).length
                const empAlerts = docs.filter(d => {
                  if (d.employee_id !== e.employee_id) return false
                  const days = getDays(d)
                  return days !== null && days <= 60
                }).length
                const isSelected = selectedEmpId === e.employee_id
                return (
                  <div key={e.employee_id}
                    onClick={() => setSelectedEmpId(isSelected ? null : e.employee_id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bg2)',
                      background: isSelected ? 'var(--primary-light)' : 'transparent',
                      borderRight: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e2 => { if (!isSelected) e2.currentTarget.style.background = 'var(--bg2)' }}
                    onMouseLeave={e2 => { if (!isSelected) e2.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{e.employee?.name}</div>
                        {e.employee_number && <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>#{e.employee_number}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {empAlerts > 0 && (
                          <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 }}>
                            ⚠{empAlerts}
                          </span>
                        )}
                        <span style={{ background: 'var(--bg2)', color: 'var(--text3)', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem' }}>
                          {empDocCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* وثائق الموظف المختار */}
          <div style={{ gridColumn: 'span 3' }}>
            {!selectedEmpId ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <Users style={{ width: '44px', height: '44px', color: 'var(--border)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text3)' }}>اختر موظفاً من القائمة لعرض وثائقه</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>
                    {hrEmployees.find(e => e.employee_id === selectedEmpId)?.employee?.name} —
                    <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.82rem', marginRight: '6px' }}>{empDocs.length} وثيقة</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => { setEditDoc(null); setShowModal(true) }} className="btn btn-primary btn-sm">
                      <Plus style={{ width: '14px', height: '14px' }} /> إضافة وثيقة
                    </button>
                  )}
                </div>
                <DocsTable list={empDocs} showEmp={false} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ تاب التنبيهات ══ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alertDocs.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Bell style={{ width: '44px', height: '44px', color: '#0ea77b', margin: '0 auto 12px' }} />
              <p style={{ color: '#0ea77b', fontWeight: 600 }}>✅ لا توجد وثائق تحتاج تجديد خلال 60 يوم</p>
            </div>
          ) : (
            <>
              {/* تجميع حسب المستوى */}
              {[
                { level: 'expired',  title: 'منتهية الصلاحية',      color: '#7f1d1d' },
                { level: 'urgent',   title: 'حرج جداً — أقل من 3 أيام', color: '#c81e1e' },
                { level: 'critical', title: 'حرج — أقل من 10 أيام',  color: '#dc2626' },
                { level: 'warning',  title: 'تحذير — أقل من 30 يوم', color: '#c2410c' },
                { level: 'early',    title: 'تحذير مبكر — أقل من 60 يوم', color: '#92400e' },
              ].map(group => {
                const groupDocs = alertDocs.filter(d => getAlertLevel(getDays(d)).level === group.level)
                if (groupDocs.length === 0) return null
                return (
                  <div key={group.level}>
                    <div style={{ fontWeight: 700, color: group.color, marginBottom: '8px', fontSize: '0.875rem' }}>
                      {group.title} ({groupDocs.length})
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      <DocsTable list={groupDocs} showEmp={true} />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ══ تاب كل الوثائق ══ */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select" style={{ width: 'auto' }}>
              <option value="">كل الأنواع</option>
              {docTypes.map(t => <option key={t}>{t}</option>)}
            </select>
            {isAdmin && (
              <button onClick={() => { setEditDoc(null); setShowModal(true) }} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة وثيقة
              </button>
            )}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : (
              <DocsTable list={allFiltered} showEmp={true} />
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DocumentModal
          doc={editDoc}
          employees={hrEmployees}
          defaultEmployeeId={selectedEmpId || undefined}
          onClose={() => { setShowModal(false); setEditDoc(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// مكوّن Users للاستخدام داخل الصفحة
function Users({ style }: { style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
