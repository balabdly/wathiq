'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { FileText, Plus, Pencil, Trash2, X, Save, Upload, Download, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

type Document = {
  id: number; employee_id: number; doc_type: string; name: string
  doc_number?: string; issue_date?: string; expiry_date?: string
  notify_days: number; file_data?: string; file_name?: string
  notes?: string; employee?: { name: string; role: string }
}

function DocumentModal({ doc, employees, onClose, onSave }: {
  doc: Document | null; employees: any[]; onClose: () => void; onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fileData, setFileData] = useState<{ name: string; data: string } | null>(
    doc?.file_data ? { name: doc.file_name || 'file', data: doc.file_data } : null
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    employee_id: doc?.employee_id || '',
    doc_type: doc?.doc_type || 'هوية وطنية',
    name: doc?.name || '',
    doc_number: doc?.doc_number || '',
    issue_date: doc?.issue_date || '',
    expiry_date: doc?.expiry_date || '',
    notify_days: doc?.notify_days || 30,
    notes: doc?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('الملف أكبر من 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setFileData({ name: file.name, data: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      ...(doc ? { id: doc.id } : {}), ...form,
      employee_id: Number(form.employee_id),
      file_data: fileData?.data || null,
      file_name: fileData?.name || null,
    })
    setSaving(false)
  }

  const DOC_TYPES = ['هوية وطنية','إقامة','جواز سفر','عقد عمل','شهادة خبرة','شهادة دراسية','رخصة قيادة','تأمين صحي','أخرى']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{doc ? 'تعديل وثيقة' : 'إضافة وثيقة'}</h3>
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
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label><input value={form.doc_number} onChange={e => set('doc_number', e.target.value)} className="input" dir="ltr" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تنبيه قبل الانتهاء (يوم)</label><input type="number" value={form.notify_days} onChange={e => set('notify_days', Number(e.target.value))} className="input" min="1" max="365" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار</label><input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label><input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" /></div>
            </div>
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
                    <button type="button" onClick={() => setFileData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}><X style={{ width: '14px', height: '14px' }} /></button>
                  </div>
                )}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
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

export default function DocumentsPage() {
  const { tenant, employees, currentUser } = useStore()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [filterType, setFilterType] = useState('')
  const isAdmin = currentUser?.role === 'مدير عام'
  const now = new Date()

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('hr_documents')
      .select('*, employee:employees(name, role)')
      .eq('tenant_id', tenant.id)
      .order('expiry_date')
    setDocs(data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) await supabase.from('hr_documents').update(payload).eq('id', data.id)
    else await supabase.from('hr_documents').insert(payload)
    await load(); setShowModal(false); setEditDoc(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه الوثيقة؟')) return
    await supabase.from('hr_documents').delete().eq('id', id)
    setDocs(d => d.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const filtered = filterType ? docs.filter(d => d.doc_type === filterType) : docs
  const expired = docs.filter(d => d.expiry_date && new Date(d.expiry_date) < now).length
  const expiringSoon = docs.filter(d => {
    if (!d.expiry_date) return false
    const days = Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000)
    return days > 0 && days <= 30
  }).length

  const docTypes = [...new Set(docs.map(d => d.doc_type))]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> وثائق الموظفين
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>حفظ ومتابعة وثائق وهويات الموظفين</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي الوثائق', value: docs.length, color: '#1a56db', bg: '#eff6ff' },
          { label: 'قريبة الانتهاء', value: expiringSoon, color: expiringSoon > 0 ? '#e6820a' : '#0ea77b', bg: expiringSoon > 0 ? '#fffbeb' : '#ecfdf5' },
          { label: 'منتهية الصلاحية', value: expired, color: expired > 0 ? '#c81e1e' : '#0ea77b', bg: expired > 0 ? '#fef2f2' : '#ecfdf5' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد وثائق مضافة</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>نوع الوثيقة</th><th>الاسم</th><th>الرقم</th><th>تاريخ الإصدار</th><th>تاريخ الانتهاء</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {filtered.map(d => {
                const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000) : null
                const isExpired = days !== null && days <= 0
                const isSoon = days !== null && days > 0 && days <= (d.notify_days || 30)
                return (
                  <tr key={d.id} style={{ background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : '' }}>
                    <td><div style={{ fontWeight: 600 }}>{d.employee?.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{d.employee?.role}</div></td>
                    <td><span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{d.doc_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{d.doc_number || '—'}</td>
                    <td>{formatDate(d.issue_date)}</td>
                    <td>{formatDate(d.expiry_date)}</td>
                    <td>
                      {days !== null ? (
                        <span className={`badge ${isExpired ? 'badge-red' : isSoon ? 'badge-amber' : 'badge-green'}`}>
                          {isExpired ? (
                            <><AlertTriangle style={{ width: '12px', height: '12px', display: 'inline' }} /> منتهي منذ {Math.abs(days)} يوم</>
                          ) : isSoon ? `⚠ ${days} يوم` : `✓ ${days} يوم`}
                        </span>
                      ) : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>بدون انتهاء</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        {d.file_data && (
                          <a href={d.file_data} download={d.file_name} className="btn btn-ghost btn-xs" style={{ color: '#1a56db' }}>
                            <Download style={{ width: '14px', height: '14px' }} />
                          </a>
                        )}
                        {isAdmin && <button onClick={() => { setEditDoc(d); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '14px', height: '14px' }} /></button>}
                        {isAdmin && <button onClick={() => handleDelete(d.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DocumentModal doc={editDoc} employees={employees}
          onClose={() => { setShowModal(false); setEditDoc(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
