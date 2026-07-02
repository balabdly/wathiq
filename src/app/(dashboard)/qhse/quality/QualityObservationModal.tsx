'use client'
import { useState } from 'react'
import { X, Save, AlertTriangle, Camera } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Project  = { id: number; name: string }
type Employee = { id: number; name: string; job_title?: string }

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem',
  fontWeight: 600, color: 'var(--text)', marginBottom: '6px'
}

export default function QualityObservationModal({ projects, employees, onClose, onSave }: {
  projects: Project[]; employees: Employee[]
  onClose: () => void; onSave: () => void
}) {
  const { tenant, currentUser, activeBranch } = useStore()
  const [saving, setSaving] = useState(false)
  const [photos,   setPhotos]   = useState<{ name: string; data: string }[]>([])
  const [locating, setLocating] = useState(false)
  const [coords,   setCoords]   = useState<{ lat: number; lng: number } | null>(null)
  const [isNCR,    setIsNCR]    = useState(false)

  async function detectLocation() {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`)
        const data = await res.json()
        const addr = data.display_name || ''
        set('location', addr.split(',').slice(0,3).join('،') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        setCoords({ lat, lng })
        toast.success('✅ تم تحديد الموقع')
      } catch {
        set('location', `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        setCoords({ lat, lng })
      }
      setLocating(false)
    }, () => { toast.error('تعذّر تحديد الموقع'); setLocating(false) })
  }
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    date:             today,
    location:         '',
    project_id:       '',
    location_name:    '',
    engineer:         currentUser?.name || '',
    description:      '',
    severity:         'متوسط',
    corrective:       '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = ev => setPhotos(p => [...p, { name: file.name, data: ev.target?.result as string }])
      reader.readAsDataURL(file)
    })
  }

  async function handleSave() {
    if (!form.description.trim()) { toast.error('وصف الملاحظة مطلوب'); return }
    if (!form.location.trim())    { toast.error('الموقع مطلوب'); return }
    setSaving(true)
    try {
      let ncrNo: string | null = null
      if (isNCR) {
        const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id).eq('type', 'جودة').not('ncr_no', 'is', null)
        ncrNo = `NCR-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
      }

      const payload: Record<string, any> = {
        tenant_id:        tenant!.id,
        branch_id:        activeBranch?.id || 1,
        type:             'جودة',
        entry_type:       isNCR ? 'مطابقة' : 'ملاحظة',
        ncr_no:           ncrNo,
        date:             form.date,
        engineer:         form.engineer || currentUser?.name || '',
        location:         form.project_id ? form.location : (form.location_name || form.location),
        specs:            'غير مطابق',
        status:           'مفتوح',
        lifecycle:        'رصد',
        severity:         form.severity,
        corrective:       form.description.trim(),
        notes:            form.corrective || null,
        attachments:      photos.length > 0 ? photos : null,
        latitude:         coords?.lat || null,
        longitude:        coords?.lng || null,
      }
      if (form.project_id) payload.project_id = Number(form.project_id)

      const { error } = await supabase.from('visits').insert(payload)
      if (error) throw error

      toast.success(isNCR ? `✅ تم تسجيل ${ncrNo}` : '✅ تم تسجيل الملاحظة')
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  const SEV = [
    { val: 'عالي',   icon: '🔴', color: '#c81e1e', bg: '#fef2f2' },
    { val: 'متوسط',  icon: '🟡', color: '#e6820a', bg: '#fffbeb' },
    { val: 'منخفض', icon: '🟢', color: '#0ea77b', bg: '#ecfdf5' },
  ]

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            تسجيل ملاحظة جودة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* تصنيف القيد */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => setIsNCR(false)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                borderColor: !isNCR ? '#1a56db' : 'var(--border)', background: !isNCR ? '#eff6ff' : 'white', color: !isNCR ? '#1a56db' : 'var(--text3)' }}>
              📝 ملاحظة عادية
            </button>
            <button type="button" onClick={() => setIsNCR(true)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                borderColor: isNCR ? '#c81e1e' : 'var(--border)', background: isNCR ? '#fef2f2' : 'white', color: isNCR ? '#c81e1e' : 'var(--text3)' }}>
              🚫 عدم مطابقة (NCR)
            </button>
          </div>
          {isNCR && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.76rem', color: '#c81e1e' }}>
              سيُسجَّل برقم مرجعي رسمي (NCR) ويتطلب توثيقاً أدق في التصحيح والاعتماد
            </div>
          )}

          {/* مستوى الخطورة */}
          <div>
            <label style={lbl}>مستوى الخطورة *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {SEV.map(s => (
                <button key={s.val} type="button" onClick={() => set('severity', s.val)}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                    borderColor: form.severity === s.val ? s.color : 'var(--border)',
                    background:  form.severity === s.val ? s.bg : 'white',
                    color:       form.severity === s.val ? s.color : 'var(--text3)' }}>
                  {s.icon} {s.val}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>التاريخ *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" /></div>
            <div>
              <label style={lbl}>الموقع *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="موقع الملاحظة" style={{ flex: 1 }} />
                <button type="button" onClick={detectLocation} disabled={locating}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #1a56db', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {locating ? '...' : '📍 موقعي'}
                </button>
              </div>
              {coords && <div style={{ fontSize: '0.68rem', color: '#0ea77b', marginTop: '3px' }}>✅ {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المشروع <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.72rem' }}>(اختياري)</span></label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— لا يوجد مشروع محدد —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {!form.project_id && (
                <input value={form.location_name || ''} onChange={e => set('location_name', e.target.value)}
                  className="input" style={{ marginTop: 6 }}
                  placeholder="مكتب / مستودع / ساحة / موقع آخر..." />
              )}
            </div>
            <div><label style={lbl}>المراقب / المهندس</label>
              <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
          </div>

          {/* وصف الملاحظة */}
          <div>
            <label style={lbl}>{isNCR ? 'وصف عدم المطابقة *' : 'وصف الملاحظة / المشكلة المرصودة *'}</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: '80px', resize: 'none' }}
              placeholder="صف المخالفة أو الملاحظة التي رصدتها..." autoFocus />
          </div>

          {/* الإجراء التصحيحي المطلوب */}
          <div>
            <label style={lbl}>الإجراء التصحيحي المطلوب</label>
            <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
              className="input" style={{ minHeight: '60px', resize: 'none' }}
              placeholder="ما يجب فعله لمعالجة الملاحظة..." />
          </div>

          {/* صور الملاحظة */}
          <div>
            <label style={lbl}>
              <Camera style={{ width: '14px', height: '14px', display: 'inline', marginLeft: '4px' }} />
              صور الملاحظة
              {photos.length > 0 && <span style={{ marginRight: '6px', fontSize: '0.72rem', background: '#eff6ff', color: '#1a56db', padding: '1px 6px', borderRadius: '10px' }}>{photos.length}</span>}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', border: '2px dashed var(--border)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text3)', justifyContent: 'center' }}>
              <Camera style={{ width: '16px', height: '16px' }} />
              اضغط لإضافة صور
              <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotos} style={{ display: 'none' }} />
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' }}>
                    <img src={p.data} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => setPhotos(ph => ph.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: '4px', left: '4px', width: '20px', height: '20px', borderRadius: '50%', background: '#c81e1e', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* تنبيه دورة الحياة */}
          <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e' }}>
            📋 ست{isNCR ? 'دخل عدم المطابقة' : 'دخل الملاحظة'} دورة: <strong>رصد → إسناد → تصحيح → اعتماد</strong> — سيقوم مهندس الجودة بتحديد المسؤول عن التصحيح لاحقاً
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: isNCR ? '#c81e1e' : '#e6820a' }}>
            {saving
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Save style={{ width: '15px', height: '15px' }} />}
            {isNCR ? 'تسجيل عدم المطابقة' : 'تسجيل الملاحظة'}
          </button>
        </div>
      </div>
    </div>
  )
}
