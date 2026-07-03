// src/components/finance/AttachmentUploader.tsx
// مكوّن رفع المرفقات — Pure CSS بنمط وثيق
// يقبل PDF وصور، يخزن base64، بحد أقصى 4MB للملف الواحد

'use client'
import { useRef, useState } from 'react'
import { Paperclip, X, Download, FileText, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import type { FinanceAttachment } from '@/lib/attachments'

const MAX_SIZE_MB = 4
const ACCEPTED    = 'application/pdf,image/png,image/jpeg,image/jpg,image/webp'

export default function AttachmentUploader({ value, onChange, label = 'المرفقات' }: {
  value:    FinanceAttachment[]
  onChange: (files: FinanceAttachment[]) => void
  label?:   string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setReading(true)
    const added: FinanceAttachment[] = []

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`⛔ "${file.name}" يتجاوز ${MAX_SIZE_MB}MB`)
        continue
      }
      if (value.some(v => v.name === file.name)) {
        toast.error(`الملف "${file.name}" مضاف مسبقاً`)
        continue
      }
      try {
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload  = () => res(r.result as string)
          r.onerror = () => rej(new Error('فشل قراءة الملف'))
          r.readAsDataURL(file)
        })
        added.push({ name: file.name, type: file.type, data })
      } catch {
        toast.error(`فشل قراءة "${file.name}"`)
      }
    }

    if (added.length > 0) onChange([...value, ...added])
    setReading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function approxSize(dataUrl: string): string {
    const bytes = Math.round((dataUrl.length * 3) / 4)
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
        {label}
      </label>

      <input ref={inputRef} type="file" multiple accept={ACCEPTED}
        onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />

      {/* زر الإضافة */}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={reading}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center',
          padding: '10px', borderRadius: '10px', border: '2px dashed var(--border)',
          background: '#fafafa', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
        }}>
        <Paperclip style={{ width: '15px', height: '15px' }} />
        {reading ? 'جاري القراءة...' : `إضافة مرفق (PDF / صورة — حتى ${MAX_SIZE_MB}MB)`}
      </button>

      {/* قائمة المرفقات */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {value.map((f, idx) => {
            const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
            return (
              <div key={idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'white',
                }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isPdf ? '#fef2f2' : '#eff6ff',
                  color:      isPdf ? '#c81e1e' : '#1a56db',
                }}>
                  {isPdf
                    ? <FileText  style={{ width: '16px', height: '16px' }} />
                    : <ImageIcon style={{ width: '16px', height: '16px' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="ltr">
                    {f.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{approxSize(f.data)}</div>
                </div>
                {/* تنزيل / معاينة */}
                <a href={f.data} download={f.name} title="تنزيل"
                  style={{ padding: '5px', borderRadius: '7px', color: 'var(--primary)', display: 'flex' }}>
                  <Download style={{ width: '15px', height: '15px' }} />
                </a>
                {/* حذف */}
                <button type="button" onClick={() => onChange(value.filter((_, i) => i !== idx))} title="حذف"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '5px', display: 'flex' }}>
                  <X style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
