'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ShieldAlert, Plus, Pencil, Trash2, X, Save, Search, FileText, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════
type ViolationType = {
  id: number; tenant_id?: string; code?: string; name: string
  category: string; is_default: boolean
  first_penalty: string; second_penalty: string; third_penalty: string
  notes?: string
}

type Disciplinary = {
  id: number; tenant_id: string; employee_id: number
  violation_type_id?: number; violation_name: string; category: string
  incident_date: string; penalty_degree: number; penalty_type: string
  penalty_details?: string; salary_deduct_days: number
  notes?: string; status: string; issued_by?: number; created_at: string
  deduct_applied?: boolean; deduct_applied_month?: number; deduct_applied_year?: number
  employee?: { name: string; role: string }
  issuer?: { name: string }
}

const CATEGORY_COLOR: Record<string, string> = {
  'خفيفة':  'badge-amber',
  'متوسطة': 'badge-coral' ,
  'جسيمة':  'badge-red'   ,
}
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

const DEGREE_LABEL: Record<number, string> = {
  1: 'إنذار أول', 2: 'إنذار ثاني', 3: 'إنذار ثالث',
}
const DEGREE_COLOR: Record<number, string> = {
  1: 'badge-amber', 2: 'badge-coral', 3: 'badge-red',
}
const STATUS_COLOR: Record<string, string> = {
  'نافذ': 'badge-green', 'ملغي': 'badge-gray', 'مطعون': 'badge-amber',
}

// ══════════════════════════════════════
// مودال إصدار إنذار
// ══════════════════════════════════════
function DisciplinaryModal({ record, employees, violationTypes, onClose, onSave }: {
  record: Disciplinary | null
  employees: any[]
  violationTypes: ViolationType[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id:       record?.employee_id      ? String(record.employee_id) : '',
    violation_type_id: record?.violation_type_id ? String(record.violation_type_id) : '',
    violation_name:    record?.violation_name    || '',
    category:          record?.category          || 'متوسطة',
    incident_date:     record?.incident_date     || new Date().toISOString().split('T')[0],
    penalty_degree:    record?.penalty_degree    || 1,
    penalty_type:      record?.penalty_type      || '',
    penalty_details:   record?.penalty_details   || '',
    salary_deduct_days: record?.salary_deduct_days || 0,
    notes:             record?.notes             || '',
    status:            record?.status            || 'نافذ',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  // عند اختيار نوع المخالفة — تعبئة تلقائية
  function handleViolationChange(id: string) {
    set('violation_type_id', id)
    const v = violationTypes.find(x => String(x.id) === id)
    if (v) {
      set('violation_name', v.name)
      set('category', v.category)
      autoSetPenalty(v, form.penalty_degree)
    }
  }

  // عند تغيير درجة الإنذار — تحديث العقوبة تلقائياً
  function handleDegreeChange(deg: number) {
    set('penalty_degree', deg)
    const v = violationTypes.find(x => String(x.id) === form.violation_type_id)
    if (v) autoSetPenalty(v, deg)
  }

  function autoSetPenalty(v: ViolationType, deg: number) {
    const p = deg === 1 ? v.first_penalty : deg === 2 ? v.second_penalty : v.third_penalty
    set('penalty_type', p || '')
    // استخراج أيام الخصم من النص
    const match = p?.match(/خصم (\d+) يوم/)
    set('salary_deduct_days', match ? parseInt(match[1]) : 0)
  }

  // حساب عدد الإنذارات السابقة للموظف المختار
  const [prevCount, setPrevCount] = useState(0)
  useEffect(() => {
    if (!form.employee_id) { setPrevCount(0); return }
    // الدرجة المقترحة = عدد الإنذارات السابقة + 1
    supabase.from('hr_disciplinary')
      .select('id', { count: 'exact' })
      .eq('employee_id', Number(form.employee_id))
      .eq('status', 'نافذ')
      .then(({ count }) => {
        const prev = count || 0
        setPrevCount(prev)
        const suggested = Math.min(prev + 1, 3)
        set('penalty_degree', suggested)
        const v = violationTypes.find(x => String(x.id) === form.violation_type_id)
        if (v) autoSetPenalty(v, suggested)
      })
  }, [form.employee_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { toast.error('اختر الموظف'); return }
    if (!form.violation_name.trim()) { toast.error('حدد نوع المخالفة'); return }
    if (!form.incident_date) { toast.error('أدخل تاريخ الحادثة'); return }
    setSaving(true)
    await onSave({
      ...(record ? { id: record.id } : {}),
      ...form,
      employee_id: Number(form.employee_id),
      violation_type_id: form.violation_type_id ? Number(form.violation_type_id) : null,
      penalty_degree: Number(form.penalty_degree),
      salary_deduct_days: Number(form.salary_deduct_days),
    })
    setSaving(false)
  }

  const selectedEmp = employees.find(e => String(e.employee_id) === form.employee_id)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{record ? 'تعديل إنذار' : 'إصدار إنذار جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* الموظف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select" required>
                <option value="">— اختر موظف —</option>
                {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} — {e.job_title || e.role}</option>)}
              </select>
              {prevCount > 0 && (
                <div style={{ marginTop: '6px', padding: '6px 10px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle style={{ width: '13px', height: '13px' }} />
                  لهذا الموظف {prevCount} إنذار نافذ — الدرجة المقترحة: <strong>{DEGREE_LABEL[Math.min(prevCount + 1, 3)]}</strong>
                </div>
              )}
            </div>

            {/* نوع المخالفة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع المخالفة <span className="text-red-500">*</span></label>
              <select value={form.violation_type_id} onChange={e => handleViolationChange(e.target.value)} className="select">
                <option value="">— اختر من اللائحة —</option>
                {['خفيفة','متوسطة','جسيمة'].map(cat => (
                  <optgroup key={cat} label={`● ${cat}`}>
                    {violationTypes.filter(v => v.category === cat).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {/* أو كتابة يدوية */}
              <input
                value={form.violation_name}
                onChange={e => set('violation_name', e.target.value)}
                className="input" style={{ marginTop: '6px' }}
                placeholder="أو اكتب وصف المخالفة يدوياً..."
                onKeyDown={noEnter}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* الفئة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">فئة المخالفة</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                  {['خفيفة','متوسطة','جسيمة'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {/* تاريخ الحادثة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الحادثة <span className="text-red-500">*</span></label>
                <input type="date" value={form.incident_date} onChange={e => set('incident_date', e.target.value)} className="input" />
              </div>
            </div>

            {/* درجة الإنذار */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">درجة الإنذار</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1,2,3].map(deg => (
                  <button key={deg} type="button" onClick={() => handleDegreeChange(deg)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.85rem',
                      borderColor: form.penalty_degree === deg ? (deg === 1 ? '#e6820a' : deg === 2 ? '#D85A30' : '#c81e1e') : 'var(--border)',
                      background: form.penalty_degree === deg ? (deg === 1 ? '#fffbeb' : deg === 2 ? '#FAECE7' : '#fef2f2') : 'white',
                      color: form.penalty_degree === deg ? (deg === 1 ? '#92400e' : deg === 2 ? '#712B13' : '#c81e1e') : 'var(--text3)',
                    }}>
                    {DEGREE_LABEL[deg]}
                  </button>
                ))}
              </div>
            </div>

            {/* العقوبة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">العقوبة المقررة</label>
              <input value={form.penalty_type} onChange={e => set('penalty_type', e.target.value)}
                className="input" placeholder="مثال: إنذار كتابي + خصم يومين" onKeyDown={noEnter} />
            </div>

            {/* خصم الراتب */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">أيام الخصم من الراتب</label>
                <input type="number" value={form.salary_deduct_days}
                  onChange={e => set('salary_deduct_days', e.target.value)}
                  className="input" min="0" max="30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">حالة الإنذار</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['نافذ','ملغي','مطعون'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات إضافية</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              إصدار الإنذار
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// مودال لائحة المخالفات
// ══════════════════════════════════════
function ViolationTypesModal({ tenantId, types, onClose, onRefresh }: {
  tenantId: string; types: ViolationType[]
  onClose: () => void; onRefresh: () => void
}) {
  const [form, setForm] = useState({ name:'', category:'متوسطة', first_penalty:'', second_penalty:'', third_penalty:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('أدخل اسم المخالفة'); return }
    setSaving(true)
    await supabase.from('hr_violation_types').insert({ ...form, tenant_id: tenantId, is_default: false })
    toast.success('تمت الإضافة ✅')
    setForm({ name:'', category:'متوسطة', first_penalty:'', second_penalty:'', third_penalty:'', notes:'' })
    onRefresh()
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه المخالفة؟')) return
    await supabase.from('hr_violation_types').delete().eq('id', id).eq('tenant_id', tenantId)
    onRefresh()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">لائحة المخالفات والعقوبات</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* العرض حسب الفئة */}
          {['خفيفة','متوسطة','جسيمة'].map(cat => {
            const catTypes = types.filter(t => t.category === cat)
            if (catTypes.length === 0) return null
            return (
              <div key={cat}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: cat === 'خفيفة' ? '#92400e' : cat === 'متوسطة' ? '#712B13' : '#c81e1e', marginBottom: '8px' }}>
                  {cat === 'خفيفة' ? '🟡' : cat === 'متوسطة' ? '🟠' : '🔴'} مخالفات {cat}
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)' }}>
                        {['المخالفة','إنذار أول','إنذار ثاني','إنذار ثالث',''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {catTypes.map(t => (
                        <tr key={t.id} style={{ borderTop: '1px solid var(--bg2)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {t.name}
                            {t.is_default && <span style={{ fontSize: '0.65rem', color: '#0ea77b', marginRight: '4px' }}>نظام العمل</span>}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text3)' }}>{t.first_penalty || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text3)' }}>{t.second_penalty || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text3)' }}>{t.third_penalty || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {!t.is_default && (
                              <button onClick={() => handleDelete(t.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                                <Trash2 style={{ width: '13px', height: '13px' }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* إضافة مخالفة مخصصة */}
          <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px', color: 'var(--text3)' }}>+ إضافة مخالفة مخصصة</div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المخالفة <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: استخدام الجوال أثناء العمل" onKeyDown={noEnter} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                    {['خفيفة','متوسطة','جسيمة'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عقوبة الإنذار الأول</label>
                  <input value={form.first_penalty} onChange={e => set('first_penalty', e.target.value)} className="input" placeholder="إنذار كتابي" onKeyDown={noEnter} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عقوبة الإنذار الثاني</label>
                  <input value={form.second_penalty} onChange={e => set('second_penalty', e.target.value)} className="input" placeholder="خصم يوم" onKeyDown={noEnter} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عقوبة الإنذار الثالث</label>
                  <input value={form.third_penalty} onChange={e => set('third_penalty', e.target.value)} className="input" placeholder="خصم 3 أيام" onKeyDown={noEnter} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                  {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus style={{ width: '14px', height: '14px' }} />}
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// توليد PDF الإنذار
// ══════════════════════════════════════
function printWarningLetter(record: Disciplinary, tenant: any) {
  const empName = record.employee?.name || '—'
  const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
  const incidentDate = record.incident_date ? new Date(record.incident_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const deductText = record.salary_deduct_days > 0 ? `<p>وسيتم خصم <strong>${record.salary_deduct_days} يوم</strong> من راتبكم عن هذا الشهر.</p>` : ''

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 14px; color: #111; background: white; padding: 40px; direction: rtl; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a56db; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { max-height: 90px; max-width: 220px; object-fit: contain; image-rendering: high-quality; }
  .company-info { text-align: left; font-size: 12px; color: #555; }
  .title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-decoration: underline; }
  .ref { text-align: right; font-size: 12px; color: #555; margin-bottom: 20px; }
  .body-text { line-height: 2; margin-bottom: 16px; }
  .violation-box { border: 1px solid #ddd; border-radius: 8px; padding: 14px; margin: 16px 0; background: #fafafa; }
  .violation-box table { width: 100%; border-collapse: collapse; }
  .violation-box td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
  .violation-box td:first-child { font-weight: bold; width: 140px; color: #444; }
  .warning { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 13px; color: #92400e; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
  .sig-box { text-align: center; width: 200px; }
  .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 6px; font-size: 12px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  ${tenant?.logo_url ? `<img src="${tenant.logo_url}" class="logo" alt="شعار الشركة" />` : `<div style="font-size:18px;font-weight:bold;color:#1a56db">${tenant?.name || 'الشركة'}</div>`}
  <div class="company-info">
    <div>${tenant?.name || ''}</div>
    ${tenant?.cr_number ? `<div>السجل التجاري: ${tenant.cr_number}</div>` : ''}
    ${tenant?.phone ? `<div>هاتف: ${tenant.phone}</div>` : ''}
    ${tenant?.address ? `<div>${tenant.address}</div>` : ''}
  </div>
</div>

<div class="ref">التاريخ: ${today}</div>

<div class="title">خطاب إنذار رسمي — ${DEGREE_LABEL[record.penalty_degree] || 'إنذار'}</div>

<p class="body-text">السيد / السيدة: <strong>${empName}</strong> — المحترم/ة</p>
<p class="body-text">
  بناءً على صلاحياتنا الإدارية وما تقتضيه متطلبات العمل والمسؤولية المهنية،
  وبعد التحقق من الوقائع المشار إليها أدناه، نوجّه إليكم هذا الإنذار الرسمي.
</p>

<div class="violation-box">
  <table>
    <tr><td>المخالفة المرتكبة</td><td>${record.violation_name}</td></tr>
    <tr><td>تصنيف المخالفة</td><td>${record.category}</td></tr>
    <tr><td>تاريخ الحادثة</td><td>${incidentDate}</td></tr>
    <tr><td>درجة الإنذار</td><td>${DEGREE_LABEL[record.penalty_degree] || '—'}</td></tr>
    <tr><td>العقوبة المقررة</td><td>${record.penalty_type || '—'}</td></tr>
    ${record.salary_deduct_days > 0 ? `<tr><td>أيام الخصم</td><td>${record.salary_deduct_days} يوم</td></tr>` : ''}
  </table>
</div>

<p class="body-text">
  نأمل منكم الالتزام التام بأنظمة وتعليمات العمل المعمول بها في الشركة،
  وتجنّب تكرار مثل هذه المخالفات مستقبلاً.
</p>

${deductText}

${record.notes ? `<p class="body-text"><strong>ملاحظات إضافية:</strong> ${record.notes}</p>` : ''}

<div class="warning">
  ⚠️ تنبيه: في حال تكرار هذه المخالفة أو ارتكاب مخالفات أخرى،
  سيتعرض صاحبها لعقوبات أشد وفقاً للوائح الشركة ونظام العمل السعودي.
</div>

<div class="signatures">
  <div class="sig-box">
    <div class="sig-line">توقيع الموظف واستلامه</div>
  </div>
  <div class="sig-box">
    <div class="sig-line">المدير المباشر</div>
  </div>
  <div class="sig-box">
    <div class="sig-line">مدير الموارد البشرية</div>
  </div>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 800)
  }
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function DisciplinaryPage() {
  const { tenant, currentUser } = useStore()
  const [records, setRecords] = useState<Disciplinary[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showLائحة, setShowLائحة] = useState(false)
  const [editRecord, setEditRecord] = useState<Disciplinary | null>(null)
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [recRes, empRes, vtRes] = await Promise.all([
      supabase.from('hr_disciplinary')
        .select('*, employee:hr_employees!hr_disciplinary_employee_id_fkey(name, job_title)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }),
      supabase.from('hr_employees')
        .select('id, name, job_title')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
      supabase.from('hr_violation_types')
        .select('*')
        .or(`tenant_id.eq.${tenant.id},tenant_id.is.null`)
        .order('category')
        .order('name'),
    ])
    setRecords(recRes.data || [])
    setEmployees((empRes.data || []).map((e: any) => ({
      employee_id: e.id,
      name: e.name || '—',
      role: '',
      job_title: e.job_title || '',
    })))
    setViolationTypes(vtRes.data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id, issued_by: currentUser?.id || null }
    if (data.id) await supabase.from('hr_disciplinary').update(payload).eq('id', data.id).eq('tenant_id', tenant.id)
    else await supabase.from('hr_disciplinary').insert(payload)
    await load()
    setShowModal(false); setEditRecord(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا الإنذار؟')) return
    await supabase.from('hr_disciplinary').delete().eq('id', id).eq('tenant_id', tenant?.id || '')
    setRecords(r => r.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const filtered = records.filter(r =>
    (!search || r.employee?.name?.includes(search)) &&
    (!filterCat || r.category === filterCat)
  )

  // إحصائيات
  const totalActive   = records.filter(r => r.status === 'نافذ').length
  const degree1       = records.filter(r => r.penalty_degree === 1 && r.status === 'نافذ').length
  const degree3plus   = records.filter(r => r.penalty_degree >= 3 && r.status === 'نافذ').length
  const thisMonth     = records.filter(r => {
    const d = new Date(r.created_at)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  // تجميع الإنذارات حسب الموظف
  const byEmployee: Record<number, Disciplinary[]> = {}
  filtered.forEach(r => {
    if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = []
    byEmployee[r.employee_id].push(r)
  })

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert style={{ width: '20px', height: '20px', color: '#c81e1e' }} /> التأديب والجزاءات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>سجل الإنذارات والمخالفات التأديبية للموظفين</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإنذارات النافذة', value: totalActive,  color: '#c81e1e', bg: '#fef2f2' },
          { label: 'إنذار أول',                value: degree1,      color: '#e6820a', bg: '#fffbeb' },
          { label: 'مؤهلون للفصل (3+)',        value: degree3plus,  color: '#c81e1e', bg: '#fef2f2' },
          { label: 'هذا الشهر',                value: thisMonth,    color: '#1a56db', bg: '#eff6ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* شريط الأدوات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: '15px', height: '15px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input"
              style={{ paddingRight: '32px', width: '200px' }} placeholder="بحث بالاسم..." />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="select" style={{ width: 'auto' }}>
            <option value="">كل الفئات</option>
            {['خفيفة','متوسطة','جسيمة'].map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowLائحة(true)} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
            <FileText style={{ width: '14px', height: '14px' }} /> لائحة المخالفات
          </button>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditRecord(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إصدار إنذار
          </button>
        )}
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <ShieldAlert style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد إنذارات مسجلة</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* تجميع حسب الموظف */}
          {Object.entries(byEmployee).map(([empIdStr, empRecords]) => {
            const empId = Number(empIdStr)
            const emp = empRecords[0]
            const activeCount = empRecords.filter(r => r.status === 'نافذ').length
            const isExpanded = expandedEmp === empId
            const maxDegree = Math.max(...empRecords.map(r => r.penalty_degree))

            return (
              <div key={empId} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* رأس الموظف */}
                <div
                  onClick={() => setExpandedEmp(isExpanded ? null : empId)}
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isExpanded ? 'var(--bg2)' : 'transparent' }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg2)' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: maxDegree >= 3 ? '#fef2f2' : maxDegree === 2 ? '#FAECE7' : '#fffbeb',
                      color: maxDegree >= 3 ? '#c81e1e' : maxDegree === 2 ? '#712B13' : '#92400e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    }}>
                      {emp.employee?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{emp.employee?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{emp.employee?.role}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
                      <span className={`badge ${DEGREE_COLOR[maxDegree] || 'badge-gray'}`} style={{ fontSize: '0.72rem' }}>
                        أعلى درجة: {DEGREE_LABEL[maxDegree]}
                      </span>
                      <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{empRecords.length} إنذار</span>
                      {activeCount > 0 && <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>{activeCount} نافذ</span>}
                      {maxDegree >= 3 && activeCount >= 3 && (
                        <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>
                          ⚠ مؤهل للفصل
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px', color: 'var(--text3)' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text3)' }} />}
                </div>

                {/* تفاصيل الإنذارات */}
                {isExpanded && (
                  <div style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['تاريخ الحادثة','المخالفة','الفئة','الدرجة','العقوبة','خصم','الحالة',''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {empRecords.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{formatDate(r.incident_date)}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.violation_name}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className={`badge ${CATEGORY_COLOR[r.category] || 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>{r.category}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className={`badge ${DEGREE_COLOR[r.penalty_degree] || 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>{DEGREE_LABEL[r.penalty_degree]}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{r.penalty_type}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {r.salary_deduct_days > 0 ? (
                                <div>
                                  <span style={{ color: '#c81e1e', fontWeight: 600 }}>{r.salary_deduct_days} يوم</span>
                                  {r.deduct_applied ? (
                                    <div style={{ fontSize: '0.65rem', color: '#0ea77b', marginTop: '2px' }}>
                                      ✓ مُطبَّق {r.deduct_applied_month && MONTHS[r.deduct_applied_month - 1]} {r.deduct_applied_year}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.65rem', color: '#e6820a', marginTop: '2px' }}>⏳ لم يُطبَّق</div>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className={`badge ${STATUS_COLOR[r.status] || 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>{r.status}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => printWarningLetter(r, tenant)} className="btn btn-ghost btn-xs" title="طباعة خطاب الإنذار" style={{ color: '#1a56db' }}>
                                  <FileText style={{ width: '13px', height: '13px' }} />
                                </button>
                                {isAdmin && (
                                  <>
                                    <button onClick={() => { setEditRecord(r); setShowModal(true) }} className="btn btn-ghost btn-xs" title="تعديل">
                                      <Pencil style={{ width: '13px', height: '13px' }} />
                                    </button>
                                    <button onClick={() => handleDelete(r.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }} title="حذف">
                                      <Trash2 style={{ width: '13px', height: '13px' }} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <DisciplinaryModal
          record={editRecord}
          employees={employees}
          violationTypes={violationTypes}
          onClose={() => { setShowModal(false); setEditRecord(null) }}
          onSave={handleSave}
        />
      )}
      {showLائحة && tenant && (
        <ViolationTypesModal
          tenantId={tenant.id}
          types={violationTypes}
          onClose={() => setShowLائحة(false)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
