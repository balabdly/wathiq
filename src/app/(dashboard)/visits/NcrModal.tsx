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
  const [notes,     setNotes]     = useState('')
  const [report,    setReport]    = useState('')
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
      <div className="modal-box" style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              الإجراء التصحيحي
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {visit.type} · {formatDate(visit.date)} · {visit.engineer}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="modal-body">
          {/* تفاصيل المخالفة */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-700 text-sm">تفاصيل المخالفة</span>
            </div>
            <p className="text-sm text-red-600">{visit.corrective || visit.notes || 'لا توجد ملاحظات'}</p>
            {visit.location && <p className="text-xs text-red-400 mt-1">📍 {visit.location}</p>}
          </div>

          {visit.resolved_report ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-emerald-700 text-sm">تم إغلاق NCR</span>
                </div>
                <p className="text-sm text-emerald-600 whitespace-pre-line">{visit.resolved_report}</p>
                {visit.resolved_date && (
                  <p className="text-xs text-emerald-400 mt-2">
                    بواسطة {visit.resolved_by} — {formatDate(visit.resolved_date)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  تقرير الإجراء التصحيحي <span className="text-red-500">*</span>
                </label>
                <textarea value={report} onChange={e => setReport(e.target.value)}
                  className="input min-h-[90px] resize-none"
                  placeholder="اكتب تفاصيل الإجراء التصحيحي المتخذ..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات إضافية</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="input min-h-[60px] resize-none" placeholder="أي ملاحظات إضافية..." />
              </div>
              <PhotoUploader photos={photos} onChange={setPhotos} label="صور الإجراء التصحيحي" />
              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
                <button type="submit" disabled={resolving} className="btn btn-primary" style={{background:'#0ea77b'}}>
                  {resolving
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />}
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
