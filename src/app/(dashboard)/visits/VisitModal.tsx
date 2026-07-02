'use client'
import { useState, useEffect } from 'react'
import { X, Save, ExternalLink } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Visit, Project } from '@/types'
import PhotoUploader from './PhotoUploader'

const ENGINEERING_TITLES = ['مهندس', 'مدير مشروع', 'مهندس مشروع', 'مهندس كهرباء', 'مهندس ميداني', 'مشرف', 'مشرف مشروع']

// أنواع المتابعة البسيطة — لا تحتاج checklist أو دورة حياة
const FOLLOWUP_TYPES = ['كهربائية', 'ميدانية', 'متابعة']

// أنواع QHSE المتخصصة — تحتاج صفحاتها الخاصة
const QHSE_TYPES: Record<string, { label: string; icon: string; path: string; color: string }> = {
  'سلامة': { label: 'زيارة سلامة',  icon: '🛡️', path: '/qhse/safety',      color: '#e6820a' },
  'جودة':  { label: 'زيارة جودة',   icon: '🔍', path: '/qhse/quality',     color: '#1a56db' },
  'بيئة':  { label: 'زيارة بيئية',  icon: '🌿', path: '/qhse/environment', color: '#059669' },
}

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
  const router = useRouter()
  const { tenant } = useStore()
  const [saving,    setSaving]    = useState(false)
  const [engineers, setEngineers] = useState<{ id: number; name: string; job_title?: string }[]>([])
  const [photos,    setPhotos]    = useState<{ name: string; data: string }[]>(
    visit?.attachments?.map(a => ({ name: a.name, data: a.data || a.url || '' })) || []
  )
  const [form, setForm] = useState({
    type:     (visit?.type    || 'كهربائية') as string,
    date:     visit?.date     || new Date().toISOString().split('T')[0],
    engineer: visit?.engineer || '',
    project_id:  visit?.project_id || ('' as any),
    location:    visit?.location   || '',
    specs:    (visit?.specs   || 'مطابق') as Visit['specs'],
    corrective:  visit?.corrective || '',
    notes:       visit?.notes      || '',
    severity: (visit as any)?.severity || 'متوسط',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // الأنواع المتاحة في هذا المودال (متابعة فقط بشكل افتراضي)
  const availableTypes = (allowedTypes && allowedTypes.length > 0
    ? allowedTypes
    : FOLLOWUP_TYPES
  ).filter(t => !Object.keys(QHSE_TYPES).includes(t))

  // هل النوع المحدد هو QHSE؟
  const isQhseType = Object.keys(QHSE_TYPES).includes(form.type)
  const qhseInfo   = QHSE_TYPES[form.type]

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
      type:        form.type as any,
      date:        form.date,
      engineer:    form.engineer,
      project_id:  form.project_id || undefined,
      location:    form.location   || undefined,
      notes:       form.notes      || undefined,
      attachments: photos.length > 0 ? photos.map(p => ({ name: p.name, data: p.data })) : undefined,
    }
    ;(payload as any).lifecycle = 'رصد'
    if (!visit) {
      payload.specs  = form.specs
      payload.status = form.specs === 'مطابق' ? 'مغلق' : 'مفتوح'
      payload.corrective = form.specs === 'غير مطابق' ? form.corrective : undefined
      ;(payload as any).severity = form.specs === 'غير مطابق' ? form.severity : null
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

            {/* نوع الزيارة */}
            <div>
              <label style={lbl}>نوع الزيارة</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* أنواع المتابعة */}
                {FOLLOWUP_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                      borderColor: form.type === t ? '#0ea77b' : 'var(--border)',
                      background:  form.type === t ? '#ecfdf5' : 'white',
                      color:       form.type === t ? '#0ea77b' : 'var(--text3)' }}>
                    {t === 'كهربائية' ? '⚡' : t === 'ميدانية' ? '🏗️' : '📋'} {t}
                  </button>
                ))}
                {/* فاصل */}
                <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '2px 0' }} />
                {/* أنواع QHSE — للتوجيه فقط */}
                {Object.entries(QHSE_TYPES).map(([t, info]) => (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                      borderColor: form.type === t ? info.color : 'var(--border)',
                      background:  form.type === t ? info.color + '15' : 'white',
                      color:       form.type === t ? info.color : 'var(--text3)' }}>
                    {info.icon} {t}
                  </button>
                ))}
              </div>

              {/* توجيه QHSE */}
              {isQhseType && (
                <div style={{ marginTop: 10, padding: '12px 14px', background: '#f0f9ff', border: `1px solid ${qhseInfo.color}40`, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: qhseInfo.color, marginBottom: 6 }}>
                    {qhseInfo.icon} زيارات {form.type} تُدار من صفحتها المتخصصة
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
                    لأن زيارات {form.type} تتطلب قائمة فحص متخصصة ودورة حياة كاملة (رصد → إسناد → تصحيح → اعتماد)،
                    يُرجى إنشاؤها من صفحة {form.type} في QHSE.
                  </div>
                  <button type="button"
                    onClick={() => { onClose(); router.push(qhseInfo.path) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, background: qhseInfo.color, color: 'white' }}>
                    <ExternalLink size={14} />
                    الانتقال لصفحة {form.type}
                  </button>
                </div>
              )}
            </div>

            {/* باقي الحقول — تظهر فقط لأنواع المتابعة */}
            {!isQhseType && (
              <>
                {/* تاريخ */}
                <div>
                  <label style={lbl}>التاريخ</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
                </div>

                {/* المهندس */}
                <div>
                  <label style={lbl}>المهندس المسؤول <span style={{ color: '#c81e1e' }}>*</span></label>
                  {engineers.length === 0 ? (
                    <input value={form.engineer} onChange={e => set('engineer', e.target.value)} className="input" placeholder="اسم المهندس" required />
                  ) : (
                    <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select" required>
                      <option value="">— اختر المهندس —</option>
                      {engineers.map(m => (
                        <option key={m.id} value={m.name}>{m.name}{m.job_title ? ` — ${m.job_title}` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* المشروع + الموقع */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>المشروع <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text3)' }}>(اختياري)</span></label>
                    <select value={form.project_id}
                      onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')}
                      className="select">
                      <option value="">— لا يوجد مشروع محدد —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>الموقع</label>
                    <input value={form.location} onChange={e => set('location', e.target.value)}
                      className="input" placeholder="مكتب / مستودع / ساحة..." />
                  </div>
                </div>

                {/* نتيجة الفحص — فقط عند الإضافة */}
                {!visit && (
                  <div>
                    <label style={lbl}>نتيجة الفحص</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(['مطابق', 'غير مطابق'] as const).map(s => (
                        <button key={s} type="button" onClick={() => set('specs', s)}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                            border: `2px solid ${form.specs === s ? (s === 'مطابق' ? '#0ea77b' : '#c81e1e') : '#e5e7eb'}`,
                            background: form.specs === s ? (s === 'مطابق' ? '#ecfdf5' : '#fef2f2') : 'white',
                            color: form.specs === s ? (s === 'مطابق' ? '#0ea77b' : '#c81e1e') : '#9ca3af' }}>
                          {s === 'مطابق' ? '✅' : '❌'} {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* وصف المخالفة */}
                {!visit && form.specs === 'غير مطابق' && (
                  <>
                    <div>
                      <label style={lbl}>وصف المخالفة</label>
                      <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
                        className="input" style={{ minHeight: '80px', resize: 'none' }}
                        placeholder="صف المخالفة والإجراء التصحيحي المطلوب..." />
                    </div>
                    <div>
                      <label style={lbl}>مستوى الخطورة</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { val: 'عالي',   color: '#c81e1e', bg: '#fef2f2', icon: '🔴' },
                          { val: 'متوسط',  color: '#e6820a', bg: '#fffbeb', icon: '🟡' },
                          { val: 'منخفض', color: '#0ea77b', bg: '#ecfdf5', icon: '🟢' },
                        ].map(opt => (
                          <button key={opt.val} type="button" onClick={() => set('severity', opt.val)}
                            style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer',
                              fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
                              borderColor: form.severity === opt.val ? opt.color : 'var(--border)',
                              background:  form.severity === opt.val ? opt.bg : 'white',
                              color:       form.severity === opt.val ? opt.color : 'var(--text3)' }}>
                            {opt.icon} {opt.val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ملاحظات */}
                <div>
                  <label style={lbl}>ملاحظات</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    className="input" style={{ minHeight: '70px', resize: 'none' }}
                    placeholder="ملاحظات إضافية..." />
                </div>

                {/* صور */}
                <PhotoUploader photos={photos} onChange={setPhotos} label="صور الزيارة" />
              </>
            )}
          </div>

          {!isQhseType && (
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
              <button type="submit" disabled={saving || !form.engineer} className="btn btn-primary">
                {saving
                  ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  : <Save style={{ width: '14px', height: '14px' }} />}
                {visit ? 'حفظ التعديلات' : 'إضافة الزيارة'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
