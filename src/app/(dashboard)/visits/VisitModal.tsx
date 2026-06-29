'use client'
import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import type { Visit, Project } from '@/types'
import PhotoUploader from './PhotoUploader'

const ENGINEERING_TITLES = ['مهندس', 'مدير مشروع', 'مهندس مشروع', 'مهندس كهرباء', 'مهندس ميداني', 'مشرف', 'مشرف مشروع']

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px'
}

export default function VisitModal({ visit, projects, allowedTypes, onClose, onSave }: {
  visit: Visit | null
  projects: Project[]
  allowedTypes?: string[]
  onClose: () => void
  onSave: (data: Partial<Visit>) => Promise<void>
}) {
  const availableTypes = allowedTypes && allowedTypes.length > 0
    ? allowedTypes
    : ['جودة', 'سلامة', 'كهربائية', 'ميدانية']
  const { tenant } = useStore()
  const [saving,    setSaving]   = useState(false)
  const [engineers, setEngineers]= useState<{ id: number; name: string; job_title?: string }[]>([])
  const [photos, setPhotos] = useState<{ name: string; data: string }[]>(
    visit?.attachments?.map(a => ({ name: a.name, data: a.data || a.url || '' })) || []
  )
  const [form, setForm] = useState({
    type:             (visit?.type      || 'جودة') as Visit['type'],
    date:             visit?.date       || new Date().toISOString().split('T')[0],
    engineer:         visit?.engineer   || '',
    project_id:       visit?.project_id || ('' as any),
    location:         visit?.location   || '',
    specs:            (visit?.specs     || 'مطابق') as Visit['specs'],
    corrective:       visit?.corrective || '',
    notes:            visit?.notes      || '',
    severity:         (visit as any)?.severity          || 'متوسط',
    responsible_id:   (visit as any)?.responsible_id    || '',
    responsible_name: (visit as any)?.responsible_name  || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!tenant) return
    supabase.from('hr_employees')
      .select('id, name, job_title')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const all = data || []
        const eng = all.filter(e => ENGINEERING_TITLES.some(t => (e.job_title || '').includes(t)))
        setEngineers(eng.length > 0 ? eng : all)
      })
  }, [tenant?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.engineer.trim()) return
    setSaving(true)
    const payload: Partial<Visit> = {
      ...(visit ? { id: visit.id } : {}),
      type:        form.type,
      date:        form.date,
      engineer:    form.engineer,
      project_id:  form.project_id || undefined,
      location:    form.location   || undefined,
      notes:       form.notes      || undefined,
      attachments: photos.length > 0 ? photos.map(p => ({ name: p.name, data: p.data })) : undefined,
    }
    // حقول إضافية
    ;(payload as any).severity         = form.severity
    ;(payload as any).responsible_id   = form.responsible_id   || null
    ;(payload as any).responsible_name = form.responsible_name || null
    ;(payload as any).lifecycle        = 'رصد'
    // specs و corrective فقط عند الإضافة الجديدة
    if (!visit) {
      payload.specs      = form.specs
      payload.status     = form.specs === 'مطابق' ? 'مغلق' : 'مفتوح'
      payload.corrective = form.specs === 'غير مطابق' ? form.corrective : undefined
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {visit ? '✏️ تعديل زيارة' : '➕ زيارة جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* نوع + تاريخ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>نوع الزيارة</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                {(availableTypes as any[]).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="input" required />
              </div>
            </div>

            {/* المهندس المسؤول — قائمة من HR */}
            <div>
              <label style={lbl}>
                المهندس المسؤول <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {engineers.length === 0 ? (
                /* fallback: إدخال يدوي إذا لم يوجد موظفون */
                <input
                  value={form.engineer}
                  onChange={e => set('engineer', e.target.value)}
                  className="input" placeholder="اسم المهندس" required
                />
              ) : (
                <select
                  value={form.engineer}
                  onChange={e => set('engineer', e.target.value)}
                  className="select"
                  required
                >
                  <option value="">— اختر المهندس —</option>
                  {engineers.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}{m.job_title ? ` — ${m.job_title}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* المشروع + الموقع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>المشروع (اختياري)</label>
                <select value={form.project_id}
                  onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')}
                  className="select">
                  <option value="">— غير مرتبط —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="input" placeholder="اسم الموقع" />
              </div>
            </div>

            {/* نتيجة الفحص — فقط عند الإضافة الجديدة */}
            {!visit && (
              <div>
                <label style={lbl}>نتيجة الفحص</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['مطابق', 'غير مطابق'] as const).map(s => (
                    <button key={s} type="button" onClick={() => set('specs', s)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', fontSize: '0.875rem',
                        fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px solid ${form.specs === s
                          ? s === 'مطابق' ? '#0ea77b' : '#c81e1e'
                          : '#e5e7eb'}`,
                        background: form.specs === s
                          ? s === 'مطابق' ? '#ecfdf5' : '#fef2f2'
                          : 'white',
                        color: form.specs === s
                          ? s === 'مطابق' ? '#0ea77b' : '#c81e1e'
                          : '#9ca3af',
                      }}>
                      {s === 'مطابق' ? '✅' : '❌'} {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* وصف المخالفة — فقط عند الإضافة وغير مطابق */}
            {!visit && form.specs === 'غير مطابق' && (
              <div>
                <label style={lbl}>وصف المخالفة / الإجراء التصحيحي المطلوب</label>
                <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
                  className="input" style={{ minHeight: '80px', resize: 'none' }}
                  placeholder="صف المخالفة والإجراء التصحيحي المطلوب..." />
              </div>
            )}

            {/* مستوى الخطورة — فقط عند غير مطابق */}
            {(!visit || (visit as any).specs === 'غير مطابق') && form.specs === 'غير مطابق' && (
              <div>
                <label style={lbl}>مستوى الخطورة</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { val: 'عالي',   color: '#c81e1e', bg: '#fef2f2', icon: '🔴' },
                    { val: 'متوسط',  color: '#e6820a', bg: '#fffbeb', icon: '🟡' },
                    { val: 'منخفض', color: '#0ea77b', bg: '#ecfdf5', icon: '🟢' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => set('severity', opt.val)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
                        borderColor: form.severity === opt.val ? opt.color : 'var(--border)',
                        background:  form.severity === opt.val ? opt.bg : 'white',
                        color:       form.severity === opt.val ? opt.color : 'var(--text3)',
                      }}>
                      {opt.icon} {opt.val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* المسؤول عن التصحيح — فقط عند غير مطابق */}
            {form.specs === 'غير مطابق' && (
              <div>
                <label style={lbl}>المسؤول عن التصحيح</label>
                <select value={form.responsible_id}
                  onChange={e => {
                    const emp = engineers.find(x => x.id === Number(e.target.value))
                    set('responsible_id', e.target.value)
                    set('responsible_name', emp?.name || '')
                  }} className="select">
                  <option value="">— اختر المسؤول —</option>
                  {engineers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{m.job_title ? ` — ${m.job_title}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ملاحظات */}
            <div>
              <label style={lbl}>ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="ملاحظات إضافية..." />
            </div>

            {/* صور الزيارة */}
            <PhotoUploader photos={photos} onChange={setPhotos} label="صور الزيارة" />

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || !form.engineer} className="btn btn-primary">
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Save style={{ width: '14px', height: '14px' }} />}
              {visit ? 'حفظ التعديلات' : 'إضافة الزيارة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
