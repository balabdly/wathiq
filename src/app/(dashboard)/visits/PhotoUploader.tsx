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
      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Camera className="w-4 h-4" />
        {label || 'الصور'}
        {photos.length > 0 && <span className="badge badge-blue text-xs">{photos.length}</span>}
      </label>
      <div className="flex gap-2 mb-3">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex-1 btn btn-ghost btn-sm border border-gray-200 gap-2 hover:border-primary-300 hover:text-primary-600">
          <Upload className="w-4 h-4" /> رفع من الجهاز
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <button type="button" onClick={() => cameraRef.current?.click()}
          className="flex-1 btn btn-ghost btn-sm border border-primary-200 text-primary-600 gap-2 hover:bg-primary-50">
          <Camera className="w-4 h-4" /> التقاط صورة
        </button>
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-square bg-gray-50">
              <img src={photo.data} alt={photo.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button type="button" onClick={() => setPreview(photo)}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <ZoomIn className="w-4 h-4 text-gray-700" />
                </button>
                {onChange && (
                  <button type="button" onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                    className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
              <div className="absolute bottom-0 right-0 left-0 bg-gradient-to-t from-black/60 p-1.5">
                <div className="text-xs text-white truncate">{photo.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-gray-400 text-sm">
          <ImageIcon className="w-8 h-8 mx-auto mb-1 text-gray-200" />
          لا توجد صور
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-full">
            <img src={preview.data} alt={preview.name} className="max-w-full max-h-[85vh] rounded-xl object-contain" />
            <button onClick={() => setPreview(null)}
              className="absolute top-3 left-3 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
