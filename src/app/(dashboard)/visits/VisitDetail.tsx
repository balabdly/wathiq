'use client'
import { X, AlertTriangle, CheckCircle2, Clock, Shield } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Visit } from '@/types'
import PhotoUploader from './PhotoUploader'

const SEVERITY_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'عالي':   { bg: '#fef2f2', color: '#c81e1e', icon: '🔴' },
  'متوسط':  { bg: '#fffbeb', color: '#e6820a', icon: '🟡' },
  'منخفض': { bg: '#ecfdf5', color: '#0ea77b', icon: '🟢' },
}

const LIFECYCLE_STEPS = ['رصد', 'تصحيح', 'اعتماد']

export default function VisitDetail({ visit, onClose, onEdit }: {
  visit: Visit
  onClose: () => void
  onEdit?: () => void
}) {
  const v        = visit as any
  const isNCR    = visit.specs === 'غير مطابق'
  const lifecycle = v.lifecycle || (visit.resolved_report ? 'اعتماد' : 'رصد')
  const isOpen   = !visit.resolved_report

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl">
        <div className="modal-header">
          <div>
            <h3 style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '1rem' }}>تفاصيل الزيارة</h3>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>{visit.type} · {formatDate(visit.date)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--text3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* شريط دورة الحياة */}
          {isNCR && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', border: '1px solid var(--border)' }}>
              {LIFECYCLE_STEPS.map((step, i) => {
                const stepIdx    = LIFECYCLE_STEPS.indexOf(lifecycle)
                const isDone     = i < stepIdx
                const isCurrent  = i === stepIdx
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.75rem',
                        background: isDone ? '#0ea77b' : isCurrent ? '#1a56db' : '#e5e7eb',
                        color: isDone || isCurrent ? 'white' : '#9ca3af',
                      }}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: isCurrent ? 700 : 400, color: isDone ? '#0ea77b' : isCurrent ? '#1a56db' : '#9ca3af' }}>{step}</span>
                    </div>
                    {i < LIFECYCLE_STEPS.length - 1 && (
                      <div style={{ height: '2px', flex: 1, background: isDone ? '#0ea77b' : '#e5e7eb', margin: '0 4px', marginBottom: '18px' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* البيانات الأساسية */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'نوع الزيارة', value: visit.type },
              { label: 'المهندس',     value: visit.engineer },
              { label: 'التاريخ',     value: formatDate(visit.date) },
              { label: 'الموقع',      value: visit.location || '—' },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>{item.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* مستوى الخطورة والمسؤول */}
          {isNCR && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {v.severity && (() => {
                const s = SEVERITY_STYLE[v.severity] || SEVERITY_STYLE['متوسط']
                return (
                  <div style={{ padding: '10px 12px', background: s.bg, borderRadius: '8px', border: `1px solid ${s.color}30` }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>مستوى الخطورة</div>
                    <div style={{ fontWeight: 700, color: s.color }}>{s.icon} {v.severity}</div>
                  </div>
                )
              })()}
              {v.responsible_name && (
                <div style={{ padding: '10px 12px', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>المسؤول عن التصحيح</div>
                  <div style={{ fontWeight: 700, color: '#7c3aed' }}>👤 {v.responsible_name}</div>
                </div>
              )}
            </div>
          )}

          {/* وصف المخالفة */}
          {visit.corrective && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: '#c81e1e', fontWeight: 600, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle style={{ width: '13px', height: '13px' }} /> وصف المخالفة
              </div>
              <div style={{ fontSize: '0.85rem', color: '#c81e1e' }}>{visit.corrective}</div>
            </div>
          )}

          {/* الملاحظات */}
          {visit.notes && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '4px', fontWeight: 600 }}>ملاحظات</div>
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{visit.notes}</div>
            </div>
          )}

          {/* صور الزيارة */}
          {visit.attachments && visit.attachments.length > 0 && (
            <PhotoUploader
              photos={visit.attachments.map((a: any) => ({ name: a.name, data: a.data || a.url || '' }))}
              onChange={() => {}}
              label={`📷 صور الزيارة (${visit.attachments.length})`}
            />
          )}

          {/* قسم التصحيح */}
          {isNCR && (v.correction_notes || (v.correction_files && v.correction_files.length > 0)) && (
            <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ background: '#ecfdf5', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', color: '#0ea77b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0ea77b' }}>
                  تقرير التصحيح {v.correction_date ? `— ${formatDate(v.correction_date)}` : ''}
                </span>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {v.correction_notes && <div style={{ fontSize: '0.85rem' }}>{v.correction_notes}</div>}
                {v.correction_files && v.correction_files.length > 0 && (
                  <PhotoUploader
                    photos={v.correction_files.map((f: any) => ({ name: f.name, data: f.data || f.url || '' }))}
                    onChange={() => {}}
                    label={`📎 مرفقات التصحيح (${v.correction_files.length})`}
                  />
                )}
              </div>
            </div>
          )}

          {/* قسم الاعتماد */}
          {isNCR && lifecycle === 'اعتماد' && (visit.resolved_report || v.approval_notes) && (
            <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ background: '#eff6ff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield style={{ width: '14px', height: '14px', color: '#1a56db' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a56db' }}>
                  اعتماد مهندس السلامة/الجودة
                </span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{v.approval_notes || visit.resolved_report}</div>
                {visit.resolved_by && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '6px' }}>
                    ✅ {visit.resolved_by} — {formatDate(visit.resolved_date || '')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تنبيه إذا ما زالت مفتوحة */}
          {isNCR && lifecycle === 'رصد' && (
            <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 14px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#e6820a', fontWeight: 600 }}>
              ⚠️ هذه الزيارة تنتظر الإجراء التصحيحي
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
          {onEdit && (
            <button onClick={onEdit} className="btn btn-primary" style={{ background: '#1a56db', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✏️ تعديل
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
