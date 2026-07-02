'use client'
import { useState, useRef } from 'react'
import { Upload, Camera, ImageIcon, X, ZoomIn } from 'lucide-react'

export default function PhotoUploader({ photos, onChange, label }: {
  photos: { name: string; data: string }[]
  onChange: (photos: { name: string; data: string }[]) => void
  label?: string
}) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ name: string; data: string } | null>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      if (file.size > 10 * 1024 * 1024) { alert(`الصورة "${file.name}" أكبر من 10MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        const data = e.target?.result as string
        onChange([...photos, { name: file.name, data }])
      }
      reader.readAsDataURL(file)
    })
  }

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        <Camera style={{ width: 14, height: 14 }} />
        {label || 'الصور'}
        {photos.length > 0 && (
          <span style={{ background: '#eff6ff', color: '#1a56db', padding: '1px 6px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700 }}>
            {photos.length}
          </span>
        )}
      </label>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text3)', fontFamily: 'inherit' }}>
          <Upload style={{ width: 13, height: 13 }} /> رفع من الجهاز
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
        <button type="button" onClick={() => cameraRef.current?.click()}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#1a56db', fontFamily: 'inherit' }}>
          <Camera style={{ width: 13, height: 13 }} /> التقاط صورة
        </button>
      </div>

      {photos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {photos.map((photo, idx) => (
            <div key={idx} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1', background: '#f8fafc' }}
              onMouseEnter={e => { const ov = (e.currentTarget as any)._ov; if (ov) ov.style.opacity = '1' }}
              onMouseLeave={e => { const ov = (e.currentTarget as any)._ov; if (ov) ov.style.opacity = '0' }}>
              <img src={photo.data} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* overlay */}
              <div ref={el => { if (el) (el.parentElement as any)._ov = el }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = '0' }}>
                <button type="button" onClick={() => setPreview(photo)}
                  style={{ width: 28, height: 28, background: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomIn style={{ width: 13, height: 13, color: '#374151' }} />
                </button>
                <button type="button" onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                  style={{ width: 28, height: 28, background: '#c81e1e', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: 13, height: 13, color: 'white' }} />
                </button>
              </div>
              {/* اسم الصورة */}
              <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', padding: '8px 6px 4px' }}>
                <div style={{ fontSize: '0.65rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
          <ImageIcon style={{ width: 28, height: 28, margin: '0 auto 6px', color: '#d1d5db' }} />
          لا توجد صور
        </div>
      )}

      {/* مودال المعاينة */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreview(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={preview.data} alt={preview.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 10, objectFit: 'contain' }} />
            <button onClick={() => setPreview(null)}
              style={{ position: 'absolute', top: 10, left: 10, width: 32, height: 32, background: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 16, height: 16, color: '#374151' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
