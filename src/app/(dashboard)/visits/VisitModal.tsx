'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import type { Visit, Project } from '@/types'
import PhotoUploader from './PhotoUploader'

export default function VisitModal({ visit, projects, onClose, onSave }: {
  visit: Visit | null
  projects: Project[]
  onClose: () => void
  onSave: (data: Partial<Visit>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ name: string; data: string }[]>(
    visit?.attachments?.map(a => ({ name: a.name, data: a.data || a.url || '' })) || []
  )
  const [form, setForm] = useState({
    type:       (visit?.type      || 'جودة') as Visit['type'],
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
      type:       form.type,
      date:       form.date,
      engineer:   form.engineer,
      project_id: form.project_id || undefined,
      location:   form.location   || undefined,
      specs:      form.specs,
      status:     form.specs === 'مطابق' ? 'مغلق' : 'مفتوح',
      corrective: form.specs === 'غير مطابق' ? form.corrective : undefined,
      notes:      form.notes      || undefined,
      attachments: photos.length > 0 ? photos.map(p => ({ name: p.name, data: p.data })) : undefined,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{visit ? 'تعديل زيارة' : 'زيارة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الزيارة</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                  {(['جودة','سلامة','كهربائية','ميدانية'] as const).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المهندس المسؤول <span className="text-red-500">*</span></label>
              <input value={form.engineer} onChange={e => set('engineer', e.target.value)} className="input" placeholder="اسم المهندس" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع (اختياري)</label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— غير مرتبط —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="اسم الموقع" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نتيجة الفحص</label>
              <div className="flex gap-3">
                {(['مطابق','غير مطابق'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('specs', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.specs === s
                        ? s === 'مطابق' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {s === 'مطابق' ? '✅' : '❌'} {s}
                  </button>
                ))}
              </div>
            </div>
            {form.specs === 'غير مطابق' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجراء التصحيحي</label>
                <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
                  className="input min-h-[80px] resize-none" placeholder="وصف الإجراء التصحيحي..." />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input min-h-[70px] resize-none" placeholder="ملاحظات إضافية..." />
            </div>
            <PhotoUploader photos={photos} onChange={setPhotos} label="صور الزيارة" />
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {visit ? 'حفظ التعديلات' : 'إضافة الزيارة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
