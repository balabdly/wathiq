'use client'
import { useState } from 'react'
import { X, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Visit } from '@/types'
import PhotoUploader from './PhotoUploader'

export default function NcrModal({ visit, onClose, onResolve }: {
  visit: Visit
  onClose: () => void
  onResolve: (id: number, report: string) => Promise<void>
}) {
  const [photos,    setPhotos]    = useState<{name:string;data:string}[]>(
    (visit as any).resolved_files?.map((f:any) => ({ name: f.name, data: f.data||f.url||'' })) || []
  )
  const [report,    setReport]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [resolving, setResolving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!report.trim()) return
    setResolving(true)
    const fullReport = notes ? `${report}\n\nملاحظات إضافية: ${notes}` : report
    await onResolve(visit.id, fullReport)
    setResolving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#1a1a2e' }}>
              <ClipboardList style={{ width: 18, height: 18, color: '#f59e0b' }} />
              الإجراء التصحيحي
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
              {visit.type} · {formatDate(visit.date)} · {visit.engineer}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* تفاصيل المخالفة */}
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertTriangle style={{ width: 14, height: 14, color: '#c81e1e' }} />
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c81e1e' }}>تفاصيل المخالفة</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#c81e1e' }}>{visit.corrective || visit.notes || 'لا توجد ملاحظات'}</p>
            {visit.location && <p style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 4 }}>📍 {visit.location}</p>}
          </div>

          {visit.resolved_report ? (
            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CheckCircle2 style={{ width: 14, height: 14, color: '#0ea77b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0ea77b' }}>تم إغلاق NCR</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#065f46', whiteSpace: 'pre-line' }}>{visit.resolved_report}</p>
              {visit.resolved_date && (
                <p style={{ fontSize: '0.72rem', color: '#6ee7b7', marginTop: 8 }}>
                  بواسطة {visit.resolved_by} — {formatDate(visit.resolved_date)}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                  تقرير الإجراء التصحيحي <span style={{ color: '#c81e1e' }}>*</span>
                </label>
                <textarea value={report} onChange={e => setReport(e.target.value)}
                  className="input" style={{ minHeight: 90, resize: 'none' }}
                  placeholder="اكتب تفاصيل الإجراء التصحيحي المتخذ..." required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>ملاحظات إضافية</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="input" style={{ minHeight: 60, resize: 'none' }} placeholder="أي ملاحظات إضافية..." />
              </div>
              <PhotoUploader photos={photos} onChange={setPhotos} label="صور الإجراء التصحيحي" />
              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
                <button type="submit" disabled={resolving} className="btn btn-primary" style={{ background: '#0ea77b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {resolving
                    ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    : <CheckCircle2 style={{ width: 14, height: 14 }} />}
                  إغلاق NCR
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
