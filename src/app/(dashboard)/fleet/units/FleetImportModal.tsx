'use client'
import { useRef, useState } from 'react'
import { Upload, X, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  FLEET_IMPORT_COLUMNS,
  FLEET_IMPORT_REQUIRED,
  downloadFleetImportTemplate,
  parseFleetExcelRows,
  bulkImportFleetUnits,
  type FleetImportRow,
} from '@/lib/fleet-import'

type FinanceAsset = { id: number; asset_no: string }

export function FleetImportModal({
  tenantId,
  assets,
  onClose,
  onDone,
}: {
  tenantId: string
  assets: FinanceAsset[]
  onClose: () => void
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<FleetImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  const validRows = rows.filter(r => r.valid)
  const invalidRows = rows.filter(r => !r.valid && r.preview.name)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      toast.error('نوع الملف غير مدعوم — استخدم .xlsx أو .csv')
      return
    }
    setFileName(file.name)

    const assetMap = new Map(assets.map(a => [a.asset_no.toUpperCase(), a.id]))

    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames.find(n => n.includes('الأسطول')) || wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

        if (json.length === 0) {
          toast.error('الملف فارغ')
          setRows([])
          return
        }

        const headers = Object.keys(json[0])
        const missing = FLEET_IMPORT_REQUIRED.filter(c => !headers.includes(c))
        if (missing.length > 0) {
          toast.error(`أعمدة مفقودة: ${missing.join('، ')} — حمّل النموذج الرسمي`)
          setRows([])
          return
        }

        const parsed = parseFleetExcelRows(json, assetMap)
        setRows(parsed)
        toast.success(`تم قراءة ${parsed.length} صف`)
      } catch {
        toast.error('تعذّر قراءة الملف')
        setRows([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const result = await bulkImportFleetUnits(tenantId, validRows)
      if (result.imported > 0) {
        toast.success(`✅ تم استيراد ${result.imported} معدة/مركبة`)
        onDone()
      }
      if (result.errors.length) {
        toast.error(result.errors.join('\n'), { duration: 8000 })
      }
      if (result.imported === 0) toast.error('لم يُستورد أي سجل')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '820px', width: '95vw' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload style={{ width: '18px', color: '#0d9488' }} />
            استيراد الأسطول من Excel
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '20px' }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => downloadFleetImportTemplate()} className="btn btn-primary" style={{ background: '#0d9488' }}>
              <Download style={{ width: '16px' }} /> تحميل نموذج Excel
            </button>
            <span style={{ fontSize: '0.78rem', color: '#6b7280', alignSelf: 'center' }}>
              النموذج يتضمن 6 أمثلة + 44 صفاً فارغاً + ورقة تعليمات
            </span>
          </div>

          <div
            style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center', background: '#f0fdfa', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload style={{ width: '32px', height: '32px', color: '#0d9488', margin: '0 auto 8px' }} />
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{fileName || 'انقر لرفع ملف Excel المكتمل'}</p>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px' }}>.xlsx · .xls · .csv</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#1d4ed8' }}>
            <strong>إلزامي:</strong> {FLEET_IMPORT_REQUIRED.join(' | ')}
            <br />
            <strong>اختياري:</strong> {FLEET_IMPORT_COLUMNS.filter(c => !(FLEET_IMPORT_REQUIRED as readonly string[]).includes(c)).join(' | ')}
          </div>

          {rows.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ background: '#ecfdf5', color: '#0ea77b', borderRadius: '6px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                  <CheckCircle2 style={{ width: '14px', display: 'inline', marginLeft: '4px' }} />
                  {validRows.length} جاهز للاستيراد
                </span>
                {invalidRows.length > 0 && (
                  <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '6px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                    <AlertCircle style={{ width: '14px', display: 'inline', marginLeft: '4px' }} />
                    {invalidRows.length} به أخطاء (يُتخطى)
                  </span>
                )}
              </div>

              <div className="card" style={{ overflow: 'auto', maxHeight: '280px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                      {['#', 'الاسم', 'الفئة', 'اللوحة', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.68rem', color: 'var(--text3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map(r => (
                      <tr key={r.rowIndex} style={{ borderBottom: '1px solid var(--bg2)', background: r.valid ? 'transparent' : '#fef2f2' }}>
                        <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{r.rowIndex}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.preview.name || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{r.preview.category}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.preview.plate_no || '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.72rem', color: r.valid ? '#0ea77b' : '#c81e1e' }}>
                          {r.valid ? '✓' : r.errors.join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <p style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
                    يُعرض أول 100 صف — الإجمالي {rows.length}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="btn btn-primary"
            style={{ background: '#0d9488' }}
          >
            {importing ? 'جاري الاستيراد...' : `استيراد ${validRows.length} وحدة`}
          </button>
        </div>
      </div>
    </div>
  )
}
