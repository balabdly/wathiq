'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { X } from 'lucide-react'
import type { Project } from '@/types'

interface Props {
  project: Project | null
  onClose: () => void
  onSave: (data: Partial<Project>) => Promise<void>
}

// الجهات المنفذة الشائعة — يمكن تعديلها حسب الحاجة
const CLIENTS = [
  'شركة السعودية للكهرباء',
  'أرامكو السعودية',
  'وزارة الإسكان',
  'أمانة منطقة الرياض',
  'وزارة الصحة',
  'وزارة التعليم',
  'وزارة النقل',
  'الهيئة الملكية للجبيل',
  'شركة معادن',
  'سابك',
  'القطاع الخاص',
  'أخرى',
]

export default function ProjectModal({ project, onClose, onSave }: Props) {
  const { employees } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '', name: '', type: '' as any, status: 'تحت التخطيط' as any,
    engineer: '', value: '', progress: 0, start_date: '', end_date: '',
    client: '',
  })

  const engineers = employees.filter(e =>
    ['مدير مشروع','مدير عام','مهندس مدني','مشرف كهربائي'].includes(e.role)
  )

  useEffect(() => {
    if (project) {
      setForm({
        code:       project.code         || '',
        name:       project.name,
        type:       project.type         || '',
        status:     project.status,
        engineer:   project.engineer     || '',
        value:      project.value?.toString() || '',
        progress:   project.progress,
        start_date: project.start_date   || '',
        end_date:   project.end_date     || '',
        client:     (project as any).client || '',
      })
    }
  }, [project])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...(project ? { id: project.id, stages: project.stages, attachments: project.attachments, history: project.history } : {}),
      code:       form.code       || undefined,
      name:       form.name,
      type:       form.type       || undefined,
      status:     form.status,
      engineer:   form.engineer   || undefined,
      value:      form.value ? parseFloat(form.value) : undefined,
      progress:   form.progress,
      start_date: form.start_date || undefined,
      end_date:   form.end_date   || undefined,
      client:     form.client     || undefined,
    } as any)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{project ? 'تعديل مشروع' : 'مشروع جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المشروع</label>
                <input value={form.code} onChange={e=>set('code',e.target.value)}
                  className="input" placeholder="مثال: 801-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع المشروع</label>
                <select value={form.type} onChange={e=>set('type',e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {['801','802','441','442','805','405','O&M'].map(t=>(
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                اسم المشروع <span className="text-red-500">*</span>
              </label>
              <input value={form.name} onChange={e=>set('name',e.target.value)}
                className="input" placeholder="اسم المشروع" required />
            </div>

            {/* ── الجهة المنفذة ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                الجهة المنفذ لها
              </label>
              <select value={form.client} onChange={e=>set('client',e.target.value)} className="select">
                <option value="">— اختر الجهة —</option>
                {CLIENTS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المهندس المسؤول</label>
                <select value={form.engineer} onChange={e=>set('engineer',e.target.value)} className="select">
                  <option value="">— اختر المهندس —</option>
                  {engineers.map(e=>(
                    <option key={e.id} value={e.name}>{e.name} — {e.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">قيمة المشروع</label>
                <input type="number" value={form.value} onChange={e=>set('value',e.target.value)}
                  className="input" placeholder="0" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e=>set('status',e.target.value)} className="select">
                  {['تحت التخطيط','قيد التنفيذ','متأخر','مكتمل','موقوف'].map(s=>(
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة الإنجاز</label>
                <div className="flex items-center gap-2">
                  <input type="range" value={form.progress} onChange={e=>set('progress',parseInt(e.target.value))}
                    className="flex-1" min="0" max="100" step="5" />
                  <span className="text-sm font-bold text-primary-600 w-10 text-center">{form.progress}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ البداية</label>
                <input type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التسليم</label>
                <input type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} className="input" />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {project ? 'حفظ التعديلات' : 'إضافة المشروع'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
