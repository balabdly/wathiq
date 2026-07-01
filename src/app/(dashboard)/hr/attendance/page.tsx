'use client'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Clock, Plus, Search, Pencil, Trash2, X, Save, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

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

// ─── ثوابت الاستيراد ────────────────────────────────────────────────────────
const VALID_STATUSES = ['حضور', 'غياب', 'إجازة', 'مأمورية', 'عطلة']

const TEMPLATE_COLUMNS = [
  'اسم الموظف',
  'التاريخ',
  'الحالة',
  'ساعات العمل',
  'ساعات إضافية',
  'ملاحظات',
]

type ImportRow = {
  rowIndex: number
  اسم_الموظف: string
  التاريخ: string
  الحالة: string
  ساعات_العمل: string
  ساعات_إضافية: string
  ملاحظات: string
  employee_id?: number
  errors: string[]
  valid: boolean
}

// ─── تحميل قالب Excel ────────────────────────────────────────────────────────
function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS,
    ['أحمد محمد', new Date().toISOString().split('T')[0], 'حضور', '8', '0', ''],
  ])
  ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'الحضور')
  XLSX.writeFile(wb, 'قالب_الحضور.xlsx')
}

// ─── تحليل وتحقق من صف الاستيراد ─────────────────────────────────────────
function parseAndValidateRow(
  raw: Record<string, unknown>,
  rowIndex: number,
  employees: { id: number; name: string }[]
): ImportRow {
  const errors: string[] = []

  const اسم_الموظف = String(raw['اسم الموظف'] ?? '').trim()
  const التاريخ    = String(raw['التاريخ']    ?? '').trim()
  const الحالة     = String(raw['الحالة']     ?? '').trim()
  const ساعات_العمل   = String(raw['ساعات العمل']   ?? '').trim()
  const ساعات_إضافية  = String(raw['ساعات إضافية']  ?? '').trim()
  const ملاحظات    = String(raw['ملاحظات']    ?? '').trim()

  // التحقق من الموظف
  let employee_id: number | undefined
  if (!اسم_الموظف) {
    errors.push('اسم الموظف مطلوب')
  } else {
    const match = employees.find(e => e.name.trim() === اسم_الموظف)
    if (!match) errors.push(`الموظف "${اسم_الموظف}" غير موجود في النظام`)
    else employee_id = match.id
  }

  // التحقق من التاريخ
  if (!التاريخ) {
    errors.push('التاريخ مطلوب')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(التاريخ) || isNaN(Date.parse(التاريخ))) {
    errors.push('صيغة التاريخ غير صحيحة (المطلوب: YYYY-MM-DD)')
  }

  // التحقق من الحالة
  if (!الحالة) {
    errors.push('الحالة مطلوبة')
  } else if (!VALID_STATUSES.includes(الحالة)) {
    errors.push(`الحالة "${الحالة}" غير مقبولة. القيم المسموح بها: ${VALID_STATUSES.join('، ')}`)
  }

  // التحقق من ساعات العمل (اختياري عند غياب/إجازة/مأمورية/عطلة)
  if (ساعات_العمل !== '') {
    const v = Number(ساعات_العمل)
    if (isNaN(v) || v < 0 || v > 24) errors.push('ساعات العمل يجب أن تكون رقمًا بين 0 و 24')
  }

  // التحقق من ساعات إضافية (اختياري)
  if (ساعات_إضافية !== '') {
    const v = Number(ساعات_إضافية)
    if (isNaN(v) || v < 0 || v > 12) errors.push('ساعات إضافية يجب أن تكون رقمًا بين 0 و 12')
  }

  return {
    rowIndex,
    اسم_الموظف,
    التاريخ,
    الحالة,
    ساعات_العمل,
    ساعات_إضافية,
    ملاحظات,
    employee_id,
    errors,
    valid: errors.length === 0,
  }
}

// ─── مودال الاستيراد ─────────────────────────────────────────────────────────
function ImportModal({
  employees,
  tenantId,
  branchId,
  onClose,
  onDone,
}: {
  employees: { id: number; name: string }[]
  tenantId: string
  branchId?: number
  onClose: () => void
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  const validRows   = rows.filter(r => r.valid)
  const invalidRows = rows.filter(r => !r.valid)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      toast.error('نوع الملف غير مدعوم. يُرجى رفع ملف .xlsx أو .csv')
      return
    }
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: false })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: '',
          raw: false,
        })

        if (json.length === 0) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات')
          return
        }

        // التحقق من وجود الأعمدة المطلوبة
        const headers = Object.keys(json[0])
        const missing = TEMPLATE_COLUMNS.filter(c => !headers.includes(c))
        if (missing.length > 0) {
          toast.error(`الأعمدة التالية مفقودة: ${missing.join('، ')}`)
          setRows([])
          return
        }

        const parsed = json.map((raw, i) => parseAndValidateRow(raw, i + 2, employees))
        setRows(parsed)
      } catch {
        toast.error('تعذّر قراءة الملف. تأكد أن الملف غير تالف.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const payload = validRows.map(r => ({
        tenant_id: tenantId,
        branch_id: branchId ?? null,
        employee_id: r.employee_id!,
        date: r.التاريخ,
        status: r.الحالة,
        hours_worked: r.ساعات_العمل !== '' ? Number(r.ساعات_العمل) : null,
        overtime_hours: r.ساعات_إضافية !== '' ? Number(r.ساعات_إضافية) : null,
        notes: r.ملاحظات || null,
      }))

      const { error } = await supabase.from('hr_attendance').insert(payload)
      if (error) throw error

      toast.success(`تم استيراد ${validRows.length} سجل بنجاح ✅`)
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', width: '95vw' }} onClick={e => e.stopPropagation()}>
        {/* رأس المودال */}
        <div className="modal-header">
          <h3 className="font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            استيراد سجلات الحضور من Excel
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* قسم رفع الملف */}
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
              background: 'var(--bg2)',
              cursor: 'pointer',
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload style={{ width: '32px', height: '32px', color: 'var(--text3)', margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem', fontWeight: 600 }}>
              {fileName || 'انقر أو اسحب ملف Excel هنا'}
            </p>
            <p style={{ color: 'var(--text3)', fontSize: '0.78rem', marginTop: '4px' }}>
              الصيغ المدعومة: .xlsx، .xls، .csv
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          {/* ملاحظة أسماء الأعمدة */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#1d4ed8' }}>
            <strong>الأعمدة المطلوبة: </strong>{TEMPLATE_COLUMNS.join(' | ')}
            <br />
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              تأكد أن أسماء الأعمدة مطابقة تمامًا. اسم الموظف يجب أن يطابق الاسم المُسجّل في النظام.
            </span>
          </div>

          {/* ملخص */}
          {rows.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ background: '#ecfdf5', color: '#0ea77b', borderRadius: '6px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', display: 'inline', marginLeft: '4px' }} />
                {validRows.length} صف صحيح
              </span>
              {invalidRows.length > 0 && (
                <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '6px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                  <AlertCircle style={{ width: '14px', height: '14px', display: 'inline', marginLeft: '4px' }} />
                  {invalidRows.length} صف به أخطاء
                </span>
              )}
            </div>
          )}

          {/* جدول المعاينة */}
          {rows.length > 0 && (
            <div style={{ maxHeight: '320px', overflowY: 'auto', overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>الصف</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>اسم الموظف</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>التاريخ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>الحالة</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>ساعات العمل</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>ساعات إضافية</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>ملاحظات</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr
                      key={r.rowIndex}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: r.valid ? undefined : '#fff5f5',
                      }}
                    >
                      <td style={{ padding: '7px 10px', color: 'var(--text3)' }}>{r.rowIndex}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.اسم_الموظف || '—'}</td>
                      <td style={{ padding: '7px 10px' }}>{r.التاريخ || '—'}</td>
                      <td style={{ padding: '7px 10px' }}>{r.الحالة || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>{r.ساعات_العمل || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>{r.ساعات_إضافية || '—'}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text3)' }}>{r.ملاحظات || '—'}</td>
                      <td style={{ padding: '7px 10px', minWidth: '160px' }}>
                        {r.valid ? (
                          <span style={{ color: '#0ea77b', fontSize: '0.75rem', fontWeight: 600 }}>✓ صحيح</span>
                        ) : (
                          <div>
                            {r.errors.map((err, i) => (
                              <div key={i} style={{ color: '#c81e1e', fontSize: '0.73rem', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                <AlertCircle style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '2px' }} />
                                {err}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* تذييل المودال */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {rows.length > 0 && validRows.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="btn btn-primary"
            >
              {importing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Upload className="w-4 h-4" />
              }
              استيراد {validRows.length} سجل صحيح
              {invalidRows.length > 0 && ` (تجاهل ${invalidRows.length} صف بأخطاء)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
  const [showImport, setShowImport] = useState(false)
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={downloadTemplate} className="btn btn-ghost btn-sm" title="تحميل قالب Excel">
              <Download style={{ width: '15px', height: '15px' }} /> قالب Excel
            </button>
            <button onClick={() => setShowImport(true)} className="btn btn-ghost btn-sm" title="استيراد من Excel">
              <Upload style={{ width: '15px', height: '15px' }} /> استيراد
            </button>
            <button onClick={() => { setEditRecord(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> تسجيل حضور
            </button>
          </div>
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

      {showImport && tenant && (
        <ImportModal
          employees={hrEmployees.map(e => ({ id: e.id, name: e.name }))}
          tenantId={tenant.id}
          branchId={activeBranch?.id}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
