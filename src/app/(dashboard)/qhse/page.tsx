'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { visitsApi, projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Shield, ClipboardCheck, Plus, Search, X, Save, Upload,
  AlertTriangle, CheckCircle2, Eye, Pencil, Trash2, FileText,
  Award, ArrowRight, Download, Calendar, Building2, User,
  ChevronDown, ChevronUp, BookOpen, ClipboardList
} from 'lucide-react'
import type { Visit, Project } from '@/types'
import toast from 'react-hot-toast'

// ══════════════════════════════════════════════════════════════════
// ── نافذة إضافة / تعديل زيارة ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function VisitModal({ visit, projects, type, onClose, onSave }: {
  visit: Visit | null; projects: Project[]
  type: 'جودة' | 'سلامة'; onClose: () => void
  onSave: (data: Partial<Visit>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type:       visit?.type       || type,
    date:       visit?.date       || new Date().toISOString().split('T')[0],
    engineer:   visit?.engineer   || '',
    project_id: visit?.project_id || ('' as any),
    location:   visit?.location   || '',
    specs:      (visit?.specs     || 'مطابق') as Visit['specs'],
    corrective: visit?.corrective || '',
    notes:      visit?.notes      || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.engineer.trim()) return
    setSaving(true)
    await onSave({
      ...(visit ? { id: visit.id } : {}),
      type: form.type as Visit['type'],
      date: form.date, engineer: form.engineer,
      project_id: form.project_id || undefined,
      location: form.location || undefined,
      specs: form.specs,
      status: form.specs === 'مطابق' ? 'مغلق' : 'مفتوح',
      corrective: form.specs === 'غير مطابق' ? form.corrective : undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{visit ? 'تعديل زيارة' : `زيارة ${type} جديدة`}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المهندس <span className="text-red-500">*</span></label>
                <input value={form.engineer} onChange={e => set('engineer', e.target.value)} className="input" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— اختياري —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نتيجة الفحص</label>
              <div className="flex gap-3">
                {(['مطابق','غير مطابق'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('specs', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.specs === s ? s === 'مطابق' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                    {s === 'مطابق' ? '✅' : '❌'} {s}
                  </button>
                ))}
              </div>
            </div>
            {form.specs === 'غير مطابق' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجراء التصحيحي</label>
                <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)} className="input min-h-[80px] resize-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input min-h-[60px] resize-none" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {visit ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── نافذة إضافة شهادة / وثيقة ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function CertModal({ cert, category, onClose, onSave }: {
  cert: any | null; category: 'quality' | 'safety'; onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fileData, setFileData] = useState<{ name: string; data: string } | null>(cert?.file || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    type:          cert?.type          || 'شهادة',
    name:          cert?.name          || '',
    cert_no:       cert?.cert_no       || '',
    issuer:        cert?.issuer        || '',
    issue_date:    cert?.issue_date    || '',
    expiry_date:   cert?.expiry_date   || '',
    notify_days:   cert?.notify_days   || 30,
    notes:         cert?.notes         || '',
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
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({ ...(cert ? { id: cert.id } : {}), ...form, category, file: fileData })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{cert ? 'تعديل' : 'إضافة'} {form.type}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">النوع</label>
              <div className="flex gap-2">
                {['شهادة','وثيقة','سياسة'].map(t => (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${form.type === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                    {t === 'شهادة' ? '🏆' : t === 'وثيقة' ? '📄' : '📋'} {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder={`مثال: ${form.type === 'شهادة' ? 'ISO 9001:2015' : 'دليل الجودة'}`} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الشهادة / المرجع</label>
                <input value={form.cert_no} onChange={e => set('cert_no', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجهة المُصدِرة</label>
                <input value={form.issuer} onChange={e => set('issuer', e.target.value)} className="input" />
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
            {form.expiry_date && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تنبيه قبل الانتهاء بـ (يوم)</label>
                <input type="number" value={form.notify_days} onChange={e => set('notify_days', Number(e.target.value))} className="input" min="1" max="365" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رفع ملف (PDF/صورة)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="btn btn-ghost btn-sm border border-gray-200 gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> {fileData ? 'تغيير الملف' : 'رفع ملف'}
                </button>
                {fileData && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <FileText className="w-4 h-4" />
                    <span className="truncate max-w-[150px]">{fileData.name}</span>
                    <button type="button" onClick={() => setFileData(null)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input min-h-[60px] resize-none" />
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

// ══════════════════════════════════════════════════════════════════
// ── نافذة تسجيل حادثة / Near Miss ────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function IncidentModal({ incident, projects, onClose, onSave }: {
  incident: any | null; projects: Project[]; onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type:        incident?.type        || 'near_miss',
    date:        incident?.date        || new Date().toISOString().split('T')[0],
    time:        incident?.time        || '',
    location:    incident?.location    || '',
    project_id:  incident?.project_id  || ('' as any),
    severity:    incident?.severity    || 'منخفض',
    description: incident?.description || '',
    injured:     incident?.injured     || '',
    action:      incident?.action      || '',
    lesson:      incident?.lesson      || '',
    reported_by: incident?.reported_by || '',
    status:      incident?.status      || 'مفتوح',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    await onSave({ ...(incident ? { id: incident.id } : {}), ...form, project_id: form.project_id || undefined })
    setSaving(false)
  }

  const isIncident = form.type === 'incident'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">
            {incident ? 'تعديل' : 'تسجيل'} {isIncident ? '🔴 حادثة' : '⚠️ كادثة (Near Miss)'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* النوع */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => set('type', 'near_miss')}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${form.type === 'near_miss' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500'}`}>
                ⚠️ كادثة (Near Miss)
              </button>
              <button type="button" onClick={() => set('type', 'incident')}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${form.type === 'incident' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                🔴 حادثة فعلية
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الوقت</label>
                <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className="input" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— اختياري —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* درجة الخطورة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">درجة الخطورة</label>
              <div className="flex gap-2">
                {[{v:'منخفض',c:'border-emerald-400 bg-emerald-50 text-emerald-700'},{v:'متوسط',c:'border-amber-400 bg-amber-50 text-amber-700'},{v:'عالي',c:'border-red-400 bg-red-50 text-red-700'}].map(s => (
                  <button key={s.v} type="button" onClick={() => set('severity', s.v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${form.severity === s.v ? s.c : 'border-gray-200 text-gray-500'}`}>
                    {s.v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">وصف {isIncident ? 'الحادثة' : 'الكادثة'} <span className="text-red-500">*</span></label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className="input min-h-[80px] resize-none" placeholder="صف ما حدث بالتفصيل..." required />
            </div>

            {isIncident && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المصابون (إن وجد)</label>
                <input value={form.injured} onChange={e => set('injured', e.target.value)} className="input" placeholder="أسماء المصابين وطبيعة الإصابة" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجراء المتخذ</label>
              <textarea value={form.action} onChange={e => set('action', e.target.value)}
                className="input min-h-[70px] resize-none" placeholder="ما الذي تم فعله فوراً؟" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary-500" />
                الدرس المستفاد <span className="text-xs text-gray-400 font-normal">(مهم جداً)</span>
              </label>
              <textarea value={form.lesson} onChange={e => set('lesson', e.target.value)}
                className="input min-h-[70px] resize-none" placeholder="ماذا تعلمنا؟ وكيف نمنع تكراره؟" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المُبلِّغ</label>
                <input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  <option value="مفتوح">مفتوح — قيد المعالجة</option>
                  <option value="مغلق">مغلق — تمت المعالجة</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {incident ? 'حفظ' : 'تسجيل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── نافذة التدقيق (داخلي / خارجي) ───────────────────────────────
// ══════════════════════════════════════════════════════════════════
function AuditModal({ audit, auditType, onClose, onSave }: {
  audit: any | null; auditType: 'internal' | 'external'; onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    audit_no:       audit?.audit_no       || '',
    date:           audit?.date           || new Date().toISOString().split('T')[0],
    auditor:        audit?.auditor        || '',
    scope:          audit?.scope          || '',
    standard:       audit?.standard       || '',
    result:         audit?.result         || 'مطابق',
    major_nc:       audit?.major_nc       || 0,
    minor_nc:       audit?.minor_nc       || 0,
    observations:   audit?.observations   || '',
    corrective:     audit?.corrective     || '',
    followup_date:  audit?.followup_date  || '',
    status:         audit?.status         || 'مفتوح',
    notes:          audit?.notes          || '',
    // للخارجي فقط
    org_name:       audit?.org_name       || '',
    audit_type_ext: audit?.audit_type_ext || 'شهادة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...(audit ? { id: audit.id } : {}), ...form, audit_type: auditType })
    setSaving(false)
  }

  const STANDARDS = auditType === 'internal'
    ? ['ISO 9001:2015','ISO 45001:2018','متطلبات داخلية','متطلبات تعاقدية','أخرى']
    : ['ISO 9001:2015','ISO 45001:2018','SASO','متطلبات شركة الكهرباء','متطلبات عميل','أخرى']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800">
              {audit ? 'تعديل' : 'إضافة'} {auditType === 'internal' ? '🔍 تدقيق داخلي' : '🏢 تدقيق خارجي'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {auditType === 'internal' ? 'تدقيق بواسطة فريق داخلي' : 'تدقيق بواسطة جهة خارجية'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم التدقيق</label>
                <input value={form.audit_no} onChange={e => set('audit_no', e.target.value)} className="input" dir="ltr" placeholder="AUD-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
            </div>

            {auditType === 'external' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">جهة التدقيق <span className="text-red-500">*</span></label>
                  <input value={form.org_name} onChange={e => set('org_name', e.target.value)} className="input" placeholder="اسم الجهة المدققة" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع التدقيق</label>
                  <select value={form.audit_type_ext} onChange={e => set('audit_type_ext', e.target.value)} className="select">
                    {['شهادة','مراقبة','عميل','تعاقدي'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{auditType === 'internal' ? 'المدقق الداخلي' : 'اسم المدقق'}</label>
                <input value={form.auditor} onChange={e => set('auditor', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المعيار المرجعي</label>
                <select value={form.standard} onChange={e => set('standard', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نطاق التدقيق</label>
              <input value={form.scope} onChange={e => set('scope', e.target.value)} className="input" placeholder="المشروع / القسم / الموقع" />
            </div>

            {/* النتيجة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">النتيجة</label>
              <div className="flex gap-2">
                {[{v:'مطابق',c:'border-emerald-500 bg-emerald-50 text-emerald-700'},{v:'مطابق جزئياً',c:'border-amber-500 bg-amber-50 text-amber-700'},{v:'غير مطابق',c:'border-red-500 bg-red-50 text-red-700'}].map(r => (
                  <button key={r.v} type="button" onClick={() => set('result', r.v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.result === r.v ? r.c : 'border-gray-200 text-gray-500'}`}>
                    {r.v}
                  </button>
                ))}
              </div>
            </div>

            {/* المخالفات */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مخالفات رئيسية (Major NC)</label>
                <input type="number" value={form.major_nc} onChange={e => set('major_nc', Number(e.target.value))} className="input" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مخالفات ثانوية (Minor NC)</label>
                <input type="number" value={form.minor_nc} onChange={e => set('minor_nc', Number(e.target.value))} className="input" min="0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الملاحظات والمخالفات</label>
              <textarea value={form.observations} onChange={e => set('observations', e.target.value)}
                className="input min-h-[80px] resize-none" placeholder="تفاصيل المخالفات والملاحظات..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجراءات التصحيحية المطلوبة</label>
              <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
                className="input min-h-[70px] resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ المتابعة</label>
                <input type="date" value={form.followup_date} onChange={e => set('followup_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  <option value="مفتوح">مفتوح</option>
                  <option value="قيد المتابعة">قيد المتابعة</option>
                  <option value="مغلق">مغلق</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التدقيق
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── مكون قسم الشهادات والوثائق ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function CertsSection({ category, tenant, activeBranch }: {
  category: 'quality' | 'safety'; tenant: any; activeBranch: any
}) {
  const [certs, setCerts]         = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [showModal, setModal]     = useState(false)
  const [editCert, setEdit]       = useState<any>(null)
  const [loaded, setLoaded]       = useState(false)
  const [expanded, setExpanded]   = useState(false)

  async function load() {
    if (!tenant || !activeBranch || loaded) return
    setLoading(true)
    const { data } = await supabase.from('qhse_certs')
      .select('*').eq('tenant_id', tenant.id).eq('category', category).order('expiry_date')
    setCerts(data || [])
    setLoaded(true); setLoading(false)
  }

  async function handleSave(data: any) {
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id, category }
    if (data.id) {
      await supabase.from('qhse_certs').update(payload).eq('id', data.id)
    } else {
      await supabase.from('qhse_certs').insert(payload)
    }
    setLoaded(false); await load()
    setModal(false); setEdit(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السجل؟')) return
    await supabase.from('qhse_certs').delete().eq('id', id)
    setCerts(c => c.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const now = new Date()
  const expiringSoon = certs.filter(c => {
    if (!c.expiry_date) return false
    const days = Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000)
    return days <= (c.notify_days || 30) && days > 0
  })
  const expired = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < now)

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary-500" />
          <h3 className="font-semibold text-gray-700 text-sm">الشهادات والوثائق</h3>
          <span className="badge badge-gray text-xs">{certs.length}</span>
          {expiringSoon.length > 0 && <span className="badge badge-amber text-xs">⚠ {expiringSoon.length} قريبة الانتهاء</span>}
          {expired.length > 0 && <span className="badge badge-red text-xs">⛔ {expired.length} منتهية</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { load(); setExpanded(!expanded) }}
            className="btn btn-ghost btn-sm gap-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'إخفاء' : 'عرض'}
          </button>
          <button onClick={() => { setEdit(null); setModal(true); load() }} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>
      </div>

      {expanded && (
        loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : certs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">لا توجد شهادات أو وثائق مضافة</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {certs.map(cert => {
              const days = cert.expiry_date ? Math.ceil((new Date(cert.expiry_date).getTime() - now.getTime()) / 86400000) : null
              const isExpired = days !== null && days <= 0
              const isSoon    = days !== null && days > 0 && days <= (cert.notify_days || 30)
              return (
                <div key={cert.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 ${isExpired ? 'bg-red-50/30' : isSoon ? 'bg-amber-50/30' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-red-100 text-red-500' : isSoon ? 'bg-amber-100 text-amber-500' : 'bg-primary-50 text-primary-500'}`}>
                    {cert.type === 'شهادة' ? <Award className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{cert.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                      {cert.cert_no && <span>#{cert.cert_no}</span>}
                      {cert.issuer && <span>📍 {cert.issuer}</span>}
                      {cert.issue_date && <span>إصدار: {formatDate(cert.issue_date)}</span>}
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    {cert.expiry_date ? (
                      <div>
                        <div className="text-xs text-gray-500">ينتهي: {formatDate(cert.expiry_date)}</div>
                        <div className={`text-xs font-bold ${isExpired ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {isExpired ? `⛔ منتهي منذ ${Math.abs(days!)} يوم` : isSoon ? `⚠ ${days} يوم متبقي` : `✓ ${days} يوم`}
                        </div>
                      </div>
                    ) : <span className="text-xs text-gray-300">بدون انتهاء</span>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {cert.file && (
                      <a href={cert.file.data} download={cert.file.name}
                        className="btn btn-ghost btn-xs text-blue-500 hover:bg-blue-50" title="تحميل الملف">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => { setEdit(cert); setModal(true) }} className="btn btn-ghost btn-xs">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cert.id)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {showModal && (
        <CertModal cert={editCert} category={category}
          onClose={() => { setModal(false); setEdit(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── الصفحة الرئيسية ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
export default function QhsePage() {
  const { tenant, activeBranch, visits, setVisits, currentUser } = useStore()
  const [activeTab, setTab]     = useState<'quality'|'safety'>('quality')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  // زيارات
  const [showVisitModal, setVisitModal] = useState(false)
  const [editVisit, setEditVisit]       = useState<Visit | null>(null)
  const [search, setSearch]             = useState('')
  // حوادث
  const [incidents, setIncidents]       = useState<any[]>([])
  const [incLoaded, setIncLoaded]       = useState(false)
  const [showIncModal, setIncModal]     = useState(false)
  const [editInc, setEditInc]           = useState<any>(null)
  // تدقيق
  const [audits, setAudits]             = useState<any[]>([])
  const [audLoaded, setAudLoaded]       = useState(false)
  const [showAudModal, setAudModal]     = useState(false)
  const [editAud, setEditAud]           = useState<any>(null)
  const [audType, setAudType]           = useState<'internal'|'external'>('internal')

  const canEdit = currentUser?.permissions?.some(p => p.startsWith('visits') || p === 'qhse')

  useEffect(() => { loadVisits() }, [tenant?.id, activeBranch?.id])

  async function loadVisits() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [v, p] = await Promise.all([
      supabase.from('visits').select('*').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('date', { ascending: false }),
      projectsApi.getAll(tenant.id, activeBranch.id),
    ])
    setVisits(v.data || [])
    setProjects(p.data || [])
    setLoading(false)
  }

  async function loadIncidents() {
    if (!tenant || !activeBranch || incLoaded) return
    const { data } = await supabase.from('qhse_incidents').select('*')
      .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('date', { ascending: false })
    setIncidents(data || [])
    setIncLoaded(true)
  }

  async function loadAudits() {
    if (!tenant || !activeBranch || audLoaded) return
    const { data } = await supabase.from('qhse_audits').select('*')
      .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('date', { ascending: false })
    setAudits(data || [])
    setAudLoaded(true)
  }

  async function handleSaveVisit(data: Partial<Visit>) {
    if (!tenant || !activeBranch) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id, project_id: data.project_id ? Number(data.project_id) : undefined }
    if (editVisit) await supabase.from('visits').update(payload).eq('id', editVisit.id)
    else await supabase.from('visits').insert(payload)
    await loadVisits()
    setVisitModal(false); setEditVisit(null)
    toast.success(editVisit ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  async function handleDeleteVisit(v: Visit) {
    if (!confirm('حذف هذه الزيارة؟')) return
    await supabase.from('visits').delete().eq('id', v.id)
    setVisits(visits.filter(x => x.id !== v.id))
    toast.success('تم الحذف')
  }

  async function handleSaveIncident(data: any) {
    if (!tenant || !activeBranch) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id }
    if (data.id) await supabase.from('qhse_incidents').update(payload).eq('id', data.id)
    else await supabase.from('qhse_incidents').insert(payload)
    setIncLoaded(false); await loadIncidents()
    setIncModal(false); setEditInc(null)
    toast.success('تم الحفظ ✅')
  }

  async function handleSaveAudit(data: any) {
    if (!tenant || !activeBranch) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id }
    if (data.id) await supabase.from('qhse_audits').update(payload).eq('id', data.id)
    else await supabase.from('qhse_audits').insert(payload)
    setAudLoaded(false); await loadAudits()
    setAudModal(false); setEditAud(null)
    toast.success('تم الحفظ ✅')
  }

  // بيانات الزيارات حسب التاب
  const tabType = activeTab === 'quality' ? 'جودة' : 'سلامة'
  const tabVisits = visits.filter(v =>
    v.type === tabType &&
    (!search || v.engineer.toLowerCase().includes(search.toLowerCase()) || (v.location||'').toLowerCase().includes(search.toLowerCase()))
  )
  const openNcr  = tabVisits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk  = tabVisits.filter(v => v.specs === 'مطابق').length
  const matchPct = tabVisits.length ? Math.round(totalOk / tabVisits.length * 100) : 0

  // إحصائيات الحوادث
  const safetyIncidents = incidents.filter(i => i.type === 'incident')
  const nearMisses      = incidents.filter(i => i.type === 'near_miss')
  const openIncidents   = incidents.filter(i => i.status === 'مفتوح').length

  const SEVERITY_COLOR: Record<string, string> = {
    'منخفض': 'badge-green', 'متوسط': 'badge-amber', 'عالي': 'badge-red'
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-500" />
          الجودة والسلامة (QHSE)
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">إدارة الجودة والسلامة والبيئة</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('quality')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'quality' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <ClipboardCheck className="w-4 h-4" /> الجودة (QA)
        </button>
        <button onClick={() => { setTab('safety'); loadIncidents() }}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'safety' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Shield className="w-4 h-4" /> السلامة (HSE)
        </button>
      </div>

      {/* ══════════ تاب الجودة ══════════ */}
      {activeTab === 'quality' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{tabVisits.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">زيارات الجودة</div>
            </div>
            <div className={`card p-4 text-center ${openNcr > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
              <div className={`text-2xl font-bold ${openNcr > 0 ? 'text-red-600' : 'text-gray-800'}`}>{openNcr}</div>
              <div className="text-xs text-gray-400 mt-0.5">NCR معلقة</div>
            </div>
            <div className="card p-4 text-center border-emerald-100 bg-emerald-50/30">
              <div className="text-2xl font-bold text-emerald-600">{matchPct}%</div>
              <div className="text-xs text-gray-400 mt-0.5">نسبة المطابقة</div>
            </div>
          </div>

          {/* زيارات الجودة */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-700 text-sm">زيارات الجودة</h3>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} className="input pr-8 py-1.5 text-xs w-40" placeholder="بحث..." />
                </div>
                {canEdit && (
                  <button onClick={() => { setEditVisit(null); setVisitModal(true) }} className="btn btn-primary btn-sm">
                    <Plus className="w-3.5 h-3.5" /> زيارة
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : tabVisits.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد زيارات جودة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>التاريخ</th><th>المهندس</th><th>الموقع</th><th>النتيجة</th><th>NCR</th><th></th></tr>
                  </thead>
                  <tbody>
                    {tabVisits.map(v => (
                      <tr key={v.id}>
                        <td className="text-sm text-gray-600">{formatDate(v.date)}</td>
                        <td className="font-medium text-gray-800 text-sm">{v.engineer}</td>
                        <td className="text-gray-500 text-sm">{v.location || '—'}</td>
                        <td><span className={`badge ${v.specs === 'مطابق' ? 'badge-green' : 'badge-red'}`}>{v.specs}</span></td>
                        <td>
                          {v.specs === 'غير مطابق' && (
                            <span className={`badge ${v.resolved_report ? 'badge-green' : 'badge-amber'}`}>
                              {v.resolved_report ? '✓ مغلق' : '⚠ معلق'}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEdit && (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => { setEditVisit(v); setVisitModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteVisit(v)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

          {/* التدقيق الداخلي */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-700 text-sm">التدقيق الداخلي</h3>
                <span className="badge badge-gray text-xs">{audits.filter(a => a.audit_type === 'internal').length}</span>
              </div>
              {canEdit && (
                <button onClick={() => { setEditAud(null); setAudType('internal'); setAudModal(true); loadAudits() }} className="btn btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> تدقيق
                </button>
              )}
            </div>
            {(() => {
              const internalAudits = audits.filter(a => a.audit_type === 'internal')
              return internalAudits.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">لا توجد سجلات تدقيق داخلي</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>الرقم</th><th>التاريخ</th><th>المدقق</th><th>النطاق</th><th>المعيار</th><th>النتيجة</th><th>Major</th><th>Minor</th><th>الحالة</th><th></th></tr>
                    </thead>
                    <tbody>
                      {internalAudits.map(a => (
                        <tr key={a.id}>
                          <td className="font-mono text-xs text-gray-500">{a.audit_no || `#${a.id}`}</td>
                          <td className="text-sm text-gray-600">{formatDate(a.date)}</td>
                          <td className="text-sm text-gray-700">{a.auditor || '—'}</td>
                          <td className="text-sm text-gray-600 max-w-[120px] truncate">{a.scope || '—'}</td>
                          <td><span className="badge badge-blue text-xs">{a.standard || '—'}</span></td>
                          <td><span className={`badge ${a.result === 'مطابق' ? 'badge-green' : a.result === 'مطابق جزئياً' ? 'badge-amber' : 'badge-red'}`}>{a.result}</span></td>
                          <td className="text-center font-bold text-red-600">{a.major_nc || 0}</td>
                          <td className="text-center font-bold text-amber-600">{a.minor_nc || 0}</td>
                          <td><span className={`badge ${a.status === 'مغلق' ? 'badge-green' : 'badge-amber'}`}>{a.status}</span></td>
                          <td>
                            {canEdit && (
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => { setEditAud(a); setAudType('internal'); setAudModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          {/* التدقيق الخارجي */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-gray-700 text-sm">التدقيق الخارجي</h3>
                <span className="badge badge-gray text-xs">{audits.filter(a => a.audit_type === 'external').length}</span>
              </div>
              {canEdit && (
                <button onClick={() => { setEditAud(null); setAudType('external'); setAudModal(true); loadAudits() }} className="btn btn-primary btn-sm" style={{background:'#8b5cf6'}}>
                  <Plus className="w-3.5 h-3.5" /> تدقيق خارجي
                </button>
              )}
            </div>
            {(() => {
              const externalAudits = audits.filter(a => a.audit_type === 'external')
              return externalAudits.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">لا توجد سجلات تدقيق خارجي</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>الرقم</th><th>التاريخ</th><th>جهة التدقيق</th><th>النوع</th><th>المعيار</th><th>النتيجة</th><th>Major</th><th>الحالة</th><th></th></tr>
                    </thead>
                    <tbody>
                      {externalAudits.map(a => (
                        <tr key={a.id}>
                          <td className="font-mono text-xs text-gray-500">{a.audit_no || `#${a.id}`}</td>
                          <td className="text-sm text-gray-600">{formatDate(a.date)}</td>
                          <td className="font-medium text-gray-800 text-sm">{a.org_name || '—'}</td>
                          <td><span className="badge badge-purple text-xs">{a.audit_type_ext || '—'}</span></td>
                          <td><span className="badge badge-blue text-xs">{a.standard || '—'}</span></td>
                          <td><span className={`badge ${a.result === 'مطابق' ? 'badge-green' : a.result === 'مطابق جزئياً' ? 'badge-amber' : 'badge-red'}`}>{a.result}</span></td>
                          <td className="text-center font-bold text-red-600">{a.major_nc || 0}</td>
                          <td><span className={`badge ${a.status === 'مغلق' ? 'badge-green' : 'badge-amber'}`}>{a.status}</span></td>
                          <td>
                            {canEdit && (
                              <button onClick={() => { setEditAud(a); setAudType('external'); setAudModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          {/* شهادات الجودة */}
          <CertsSection category="quality" tenant={tenant} activeBranch={activeBranch} />
        </div>
      )}

      {/* ══════════ تاب السلامة ══════════ */}
      {activeTab === 'safety' && (
        <div className="space-y-5">
          {/* KPIs السلامة */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{tabVisits.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">زيارات السلامة</div>
            </div>
            <div className={`card p-4 text-center ${safetyIncidents.length > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
              <div className={`text-2xl font-bold ${safetyIncidents.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>{safetyIncidents.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">🔴 حوادث</div>
            </div>
            <div className={`card p-4 text-center ${nearMisses.length > 0 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
              <div className={`text-2xl font-bold ${nearMisses.length > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{nearMisses.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">⚠️ كوادث (Near Miss)</div>
            </div>
            <div className={`card p-4 text-center ${openIncidents > 0 ? 'border-red-200 bg-red-50/30' : 'border-emerald-100 bg-emerald-50/30'}`}>
              <div className={`text-2xl font-bold ${openIncidents > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{openIncidents}</div>
              <div className="text-xs text-gray-400 mt-0.5">قيد المعالجة</div>
            </div>
          </div>

          {/* زيارات السلامة */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-700 text-sm">زيارات السلامة</h3>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} className="input pr-8 py-1.5 text-xs w-40" placeholder="بحث..." />
                </div>
                {canEdit && (
                  <button onClick={() => { setEditVisit(null); setVisitModal(true) }} className="btn btn-primary btn-sm" style={{background:'#ef4444'}}>
                    <Plus className="w-3.5 h-3.5" /> زيارة
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : tabVisits.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد زيارات سلامة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>التاريخ</th><th>المهندس</th><th>الموقع</th><th>النتيجة</th><th>الحالة</th><th></th></tr>
                  </thead>
                  <tbody>
                    {tabVisits.map(v => (
                      <tr key={v.id}>
                        <td className="text-sm text-gray-600">{formatDate(v.date)}</td>
                        <td className="font-medium text-gray-800 text-sm">{v.engineer}</td>
                        <td className="text-gray-500 text-sm">{v.location || '—'}</td>
                        <td><span className={`badge ${v.specs === 'مطابق' ? 'badge-green' : 'badge-red'}`}>{v.specs}</span></td>
                        <td><span className={`badge ${v.status === 'مغلق' ? 'badge-green' : 'badge-amber'}`}>{v.status}</span></td>
                        <td>
                          {canEdit && (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => { setEditVisit(v); setVisitModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteVisit(v)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

          {/* سجل الحوادث والكوادث */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-700 text-sm">سجل الحوادث والكوادث</h3>
                {openIncidents > 0 && <span className="badge badge-red text-xs">{openIncidents} مفتوح</span>}
              </div>
              {canEdit && (
                <button onClick={() => { setEditInc(null); setIncModal(true); loadIncidents() }} className="btn btn-primary btn-sm" style={{background:'#ef4444'}}>
                  <Plus className="w-3.5 h-3.5" /> تسجيل
                </button>
              )}
            </div>
            {incidents.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-emerald-500 text-2xl mb-2">✅</div>
                <p className="text-gray-400 text-sm">لا توجد حوادث مسجلة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>النوع</th><th>التاريخ</th><th>الموقع</th><th>الخطورة</th><th>الوصف</th><th>الدرس المستفاد</th><th>الحالة</th><th></th></tr>
                  </thead>
                  <tbody>
                    {incidents.map(inc => (
                      <tr key={inc.id} className={inc.severity === 'عالي' ? 'bg-red-50/20' : ''}>
                        <td>
                          <span className={`badge ${inc.type === 'incident' ? 'badge-red' : 'badge-amber'}`}>
                            {inc.type === 'incident' ? '🔴 حادثة' : '⚠️ كادثة'}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600">{formatDate(inc.date)}</td>
                        <td className="text-sm text-gray-600">{inc.location || '—'}</td>
                        <td><span className={`badge ${SEVERITY_COLOR[inc.severity]} text-xs`}>{inc.severity}</span></td>
                        <td className="text-sm text-gray-700 max-w-[150px] truncate">{inc.description}</td>
                        <td className="text-sm text-gray-500 max-w-[150px] truncate">
                          {inc.lesson ? <span className="text-primary-600">{inc.lesson}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td><span className={`badge ${inc.status === 'مغلق' ? 'badge-green' : 'badge-red'}`}>{inc.status}</span></td>
                        <td>
                          {canEdit && (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => { setEditInc(inc); setIncModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={async () => {
                                if (!confirm('حذف؟')) return
                                await supabase.from('qhse_incidents').delete().eq('id', inc.id)
                                setIncidents(i => i.filter(x => x.id !== inc.id))
                                toast.success('تم الحذف')
                              }} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

          {/* شهادات السلامة */}
          <CertsSection category="safety" tenant={tenant} activeBranch={activeBranch} />
        </div>
      )}

      {/* ══ Modals ══ */}
      {showVisitModal && (
        <VisitModal visit={editVisit} projects={projects} type={tabType as 'جودة'|'سلامة'}
          onClose={() => { setVisitModal(false); setEditVisit(null) }}
          onSave={handleSaveVisit} />
      )}
      {showIncModal && (
        <IncidentModal incident={editInc} projects={projects}
          onClose={() => { setIncModal(false); setEditInc(null) }}
          onSave={handleSaveIncident} />
      )}
      {showAudModal && (
        <AuditModal audit={editAud} auditType={audType}
          onClose={() => { setAudModal(false); setEditAud(null) }}
          onSave={handleSaveAudit} />
      )}
    </div>
  )
}
