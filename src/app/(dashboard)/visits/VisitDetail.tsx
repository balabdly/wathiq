'use client'
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Visit } from '@/types'
import PhotoUploader from './PhotoUploader'

export default function VisitDetail({ visit, onClose }: {
  visit: Visit
  onClose: () => void

}) {
  const isNCR  = visit.specs === 'غير مطابق'
  const isOpen = !visit.resolved_report

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl">
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800">تفاصيل الزيارة</h3>
            <p className="text-xs text-gray-400 mt-0.5">{visit.type} · {formatDate(visit.date)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body">
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isNCR && isOpen ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
            {isNCR && isOpen
              ? <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
            <div>
              <div className="font-semibold text-sm">
                {isNCR && isOpen ? 'NCR معلقة — تحتاج إجراء تصحيحي' : visit.specs === 'مطابق' ? 'مطابق للمواصفات' : 'تم إغلاق NCR'}
              </div>
              {visit.resolved_date && (
                <div className="text-xs text-gray-500 mt-0.5">أُغلق في {formatDate(visit.resolved_date)} بواسطة {visit.resolved_by}</div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'نوع الزيارة',     value: visit.type },
              { label: 'المهندس',         value: visit.engineer },
              { label: 'التاريخ',         value: formatDate(visit.date) },
              { label: 'الموقع',          value: visit.location || '—' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                <div className="font-semibold text-gray-800 text-sm">{item.value}</div>
              </div>
            ))}
          </div>
          {visit.corrective && (
            <div>
              <div className="text-xs text-gray-400 mb-1">الإجراء التصحيحي المطلوب</div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{visit.corrective}</div>
            </div>
          )}
          {visit.notes && (
            <div>
              <div className="text-xs text-gray-400 mb-1">الملاحظات</div>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">{visit.notes}</div>
            </div>
          )}
          {visit.attachments && visit.attachments.length > 0 && (
            <PhotoUploader
              photos={visit.attachments.map(a => ({ name: a.name, data: a.data || a.url || '' }))}
              onChange={() => {}}
              label="صور الزيارة"
            />
          )}
          {isNCR && isOpen && (
            <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '12px 14px', border: '1px solid #fcd34d', fontSize: '0.82rem', color: '#e6820a', fontWeight: 600 }}>
              ⚠️ هذه الزيارة تحتاج إجراء تصحيحي — استخدم زر "إجراء تصحيحي" في قائمة الزيارات
            </div>
          )}
          {isNCR && !isOpen && visit.resolved_report && (
            <div>
              <div className="text-xs text-gray-400 mb-1">تقرير الإغلاق</div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">{visit.resolved_report}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
