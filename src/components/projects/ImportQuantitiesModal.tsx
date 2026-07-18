'use client'
import { useRef, useState } from 'react'
import { X, Upload, FileSpreadsheet, Download, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  type BoqImportLine,
  type BoqMergeMode,
  type FrameworkItemRef,
  readBoqImportFile,
  downloadBoqImportTemplate,
  boqImportSummary,
  mergeBoqLines,
} from '@/lib/project-boq-import'

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  matched: { label: 'مطابق للعقد', color: '#0ea77b', bg: '#ecfdf5' },
  review:  { label: 'للمراجعة', color: '#e6820a', bg: '#fffbeb' },
  manual:  { label: 'يدوي', color: '#6b7280', bg: '#f3f4f6' },
}

export default function ImportQuantitiesModal({
  frameworkItems,
  existingLines,
  onClose,
  onApply,
}: {
  frameworkItems: FrameworkItemRef[]
  existingLines: BoqImportLine[]
  onClose: () => void
  onApply: (lines: BoqImportLine[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<BoqImportLine[]>([])
  const [loading, setLoading] = useState(false)
  const [mergeMode, setMergeMode] = useState<BoqMergeMode>('merge')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setFileName(file.name)
    try {
      const { lines } = await readBoqImportFile(file, frameworkItems)
      const valid = lines.filter(l => !l.importErrors?.length || l.item_code || l.description)
      if (valid.length === 0) {
        toast.error('لم يُعثر على بنود صالحة في الملف')
        setPreview([])
      } else {
        setPreview(valid)
        toast.success(`تم قراءة ${valid.length} بند`)
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل قراءة الملف')
      setPreview([])
    }
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const summary = preview.length ? boqImportSummary(preview) : null
  const mergedPreview = preview.length
    ? mergeBoqLines(existingLines, preview, mergeMode)
    : []

  function handleApply() {
    if (!preview.length) { toast.error('ارفع ملفاً أولاً'); return }
    const invalid = preview.filter(l => l.importErrors?.length && !l.item_code && !l.description)
    if (invalid.length === preview.length) { toast.error('لا بنود صالحة للاستيراد'); return }
    if (mergeMode === 'replace_all' && existingLines.length > 0) {
      if (!confirm('سيتم استبدال جميع البنود الحالية — متابعة؟')) return
    }
    onApply(mergeBoqLines(existingLines, preview.filter(l => (l.qty > 0 && (l.item_code || l.description))), mergeMode))
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '720px', maxHeight: '92vh', overflow: 'auto' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            استيراد كميات — Excel / CSV
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#1a56db', lineHeight: 1.6 }}>
            ارفع ملف UDS أو Excel — البنود المطابقة للعقد الإطاري تُملأ تلقائياً. البنود الناقصة أو غير المطابقة يمكن إضافتها يدوياً بعد الاستيراد.
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => downloadBoqImportTemplate()} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
              <Download style={{ width: '14px', height: '14px' }} /> تحميل النموذج
            </button>
            <label className="btn btn-primary" style={{ fontSize: '0.82rem', cursor: 'pointer', margin: 0 }}>
              <Upload style={{ width: '14px', height: '14px' }} />
              {loading ? 'جاري القراءة...' : 'رفع Excel / CSV'}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
            </label>
          </div>

          {fileName && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>الملف: {fileName}</div>
          )}

          {existingLines.length > 0 && preview.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>طريقة الدمج</label>
              <select value={mergeMode} onChange={e => setMergeMode(e.target.value as BoqMergeMode)} className="select">
                <option value="merge">دمج — تحديث الأكواد الموجودة + إضافة الجديد (يحتفظ باليدوي)</option>
                <option value="append">إضافة فقط — لا يغيّر البنود الحالية</option>
                <option value="replace_all">استبدال الكل — يحذف كل البنود الحالية</option>
              </select>
            </div>
          )}

          {summary && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#eff6ff', color: '#1a56db' }}>{summary.total} بند</span>
              <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#0ea77b' }}>{summary.matched} مطابق</span>
              <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#fffbeb', color: '#e6820a' }}>{summary.review} للمراجعة</span>
              {summary.invalid > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#fef2f2', color: '#c81e1e' }}>{summary.invalid} خطأ</span>
              )}
              {mergeMode !== 'replace_all' && existingLines.length > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280' }}>
                  بعد الدمج: {mergedPreview.length} بند
                </span>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'auto', maxHeight: '280px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['الحالة', 'كود البند', 'الوصف', 'كمية', 'وحدة', 'سعر'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((l, i) => {
                    const st = STATUS_STYLE[l.matchStatus]
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '12px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                            {l.importErrors?.length ? '⚠️' : st.label}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }} dir="ltr">{l.item_code || '—'}</td>
                        <td style={{ padding: '6px 10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</td>
                        <td style={{ padding: '6px 10px' }} dir="ltr">{l.qty}</td>
                        <td style={{ padding: '6px 10px' }}>{l.unit}</td>
                        <td style={{ padding: '6px 10px', color: '#0ea77b' }} dir="ltr">{l.unit_price ? l.unit_price.toLocaleString('ar-SA') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {preview.length > 50 && (
                <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text3)' }}>
                  + {preview.length - 50} بند إضافي
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleApply} disabled={!preview.length || loading} className="btn btn-primary">
            <CheckCircle style={{ width: '14px', height: '14px' }} />
            تطبيق على الجدول
          </button>
        </div>
      </div>
    </div>
  )
}

export function BoqLineStatusBadge({ status }: { status: keyof typeof STATUS_STYLE }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.manual
  return (
    <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  )
}
