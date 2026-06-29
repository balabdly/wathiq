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

export default function SafetyObservationModal({ projects, employees, onClose, onSave }: {
  projects: Project[]; employees: Employee[]
  onClose: () => void; onSave: () => void
}) {
  const { tenant, currentUser } = useStore()
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ name: string; data: string }[]>([])
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    date:             today,
    location:         '',
    project_id:       '',
    engineer:         currentUser?.name || '',
    description:      '',
    severity:         'متوسط',
    responsible_id:   '',
    responsible_name: '',
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
      const payload: Record<string, any> = {
        tenant_id:        tenant!.id,
        type:             'سلامة',
        entry_type:       'ملاحظة',
        date:             form.date,
        engineer:         form.engineer || currentUser?.name || '',
        location:         form.location,
        specs:            'غير مطابق',
        status:           'مفتوح',
        lifecycle:        'رصد',
        severity:         form.severity,
        corrective:       form.description.trim(),
        notes:            form.corrective || null,
        responsible_name: form.responsible_name || null,
        attachments:      photos.length > 0 ? photos : null,
      }
      if (form.project_id)     payload.project_id     = Number(form.project_id)
      if (form.responsible_id) payload.responsible_id = Number(form.responsible_id)

      const { error } = await supabase.from('visits').insert(payload)
      if (error) throw error

      toast.success('✅ تم تسجيل الملاحظة')
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
            تسجيل ملاحظة سلامة فورية
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

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
            <div><label style={lbl}>الموقع *</label><input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="موقع الملاحظة" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
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
            <label style={lbl}>وصف الملاحظة / المشكلة المرصودة *</label>
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

          {/* المسؤول عن التصحيح */}
          <div>
            <label style={lbl}>المسؤول عن التصحيح</label>
            <select value={form.responsible_id}
              onChange={e => {
                set('responsible_id', e.target.value)
                const emp = employees.find(x => x.id === Number(e.target.value))
                if (emp) set('responsible_name', emp.name)
              }} className="select">
              <option value="">— اختر المسؤول —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
            </select>
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
            📋 ستدخل الملاحظة دورة: <strong>رصد → تصحيح → اعتماد</strong>
            {form.responsible_name && <span> — المسؤول: <strong>{form.responsible_name}</strong></span>}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Save style={{ width: '15px', height: '15px' }} />}
            تسجيل الملاحظة
          </button>
        </div>
      </div>
    </div>
  )
}
