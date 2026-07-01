'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Project  = { id: number; name: string }
type Employee = { id: number; name: string; job_title?: string }
type Props = { projects: Project[]; employees: Employee[]; editItem?: any; onClose: () => void; onSave: () => void }

export default function CustomerFeedbackModal({ projects, employees, editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type:             editItem?.type             || 'شكوى',
    source:           editItem?.source           || 'عميل مباشر',
    date:             editItem?.date             || new Date().toISOString().split('T')[0],
    project_id:       editItem?.project_id       || '',
    client_name:      editItem?.client_name      || '',
    contact_info:     editItem?.contact_info     || '',
    description:      editItem?.description      || '',
    category:         editItem?.category         || '',
    severity:         editItem?.severity         || 'متوسطة',
    assigned_to_id:   editItem?.assigned_to_id   || '',
    assigned_to_name: editItem?.assigned_to_name || '',
    response_due:     editItem?.response_due     || '',
    response_text:    editItem?.response_text    || '',
    response_date:    editItem?.response_date    || '',
    resolution:       editItem?.resolution       || '',
    satisfaction_rating: editItem?.satisfaction_rating || '',
    status:           editItem?.status           || 'مفتوح',
    notes:            editItem?.notes            || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const TYPE_COLORS: Record<string, string> = {
    'شكوى':      '#dc2626',
    'اقتراح':    '#1a56db',
    'إطراء':     '#0ea77b',
    'استفسار':   '#e6820a',
  }

  async function handleSave() {
    if (!form.client_name || !form.description || !form.date) {
      toast.error('اسم العميل والوصف والتاريخ مطلوبة'); return
    }
    setSaving(true)
    // توليد الرقم المرجعي
    let refNo = editItem?.ref_no
    if (!refNo) {
      const { count } = await supabase.from('quality_customer_feedback')
        .select('*', { count: 'exact', head: true }).eq('tenant_id', tenant?.id)
      refNo = `QF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
    }
    const payload: Record<string, any> = {
      ...form,
      ref_no:    refNo,
      tenant_id: tenant?.id,
      satisfaction_rating: form.satisfaction_rating ? Number(form.satisfaction_rating) : null,
    }
    if (form.project_id)     payload.project_id     = Number(form.project_id)
    if (form.assigned_to_id) payload.assigned_to_id = Number(form.assigned_to_id)
    else delete payload.assigned_to_id

    const { error } = editItem
      ? await supabase.from('quality_customer_feedback').update(payload).eq('id', editItem.id)
      : await supabase.from('quality_customer_feedback').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success(editItem ? '✅ تم التحديث' : `✅ تم تسجيل ${refNo}`)
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>
            {editItem ? 'تعديل' : 'تسجيل'} — رضا العملاء والشكاوى
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400, marginRight: 8 }}>ISO 9001 §9.1.2</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* نوع القيد */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['شكوى','اقتراح','إطراء','استفسار'].map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.type === t ? TYPE_COLORS[t] : 'var(--border)',
                  background:  form.type === t ? TYPE_COLORS[t] + '15' : 'white',
                  color:       form.type === t ? TYPE_COLORS[t] : 'var(--text3)' }}>
                {t === 'شكوى' ? '⚠️' : t === 'اقتراح' ? '💡' : t === 'إطراء' ? '⭐' : '❓'} {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المصدر</label>
              <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                {['عميل مباشر','شركة الطاقة SEC','مفتش خارجي','جهة حكومية','أخرى'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التاريخ *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>درجة الخطورة</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)} className="select">
                <option>منخفضة</option><option>متوسطة</option><option>عالية</option><option>حرجة</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم العميل / الجهة *</label>
              <input value={form.client_name} onChange={e => set('client_name', e.target.value)} className="input" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>بيانات التواصل</label>
              <input value={form.contact_info} onChange={e => set('contact_info', e.target.value)} className="input" placeholder="جوال / بريد إلكتروني" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المشروع المعني</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['جودة التنفيذ','التأخير في الإنجاز','التوثيق والمستندات','سلوك الموظفين','المواصفات التقنية','أخرى'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>
              {form.type === 'شكوى' ? 'وصف الشكوى' : form.type === 'اقتراح' ? 'تفاصيل الاقتراح' : form.type === 'إطراء' ? 'تفاصيل الإطراء' : 'تفاصيل الاستفسار'} *
            </label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: 70, resize: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المسؤول عن المعالجة</label>
              <select value={form.assigned_to_id} onChange={e => {
                const emp = employees.find(x => x.id === Number(e.target.value))
                set('assigned_to_id', e.target.value)
                if (emp) set('assigned_to_name', emp.name)
              }} className="select">
                <option value="">— اختر —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الموعد النهائي للرد</label>
              <input type="date" value={form.response_due} onChange={e => set('response_due', e.target.value)} className="input" />
            </div>
          </div>

          {(form.status === 'قيد المعالجة' || form.status === 'مغلق') && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الرد على العميل</label>
                <textarea value={form.response_text} onChange={e => set('response_text', e.target.value)}
                  className="input" style={{ minHeight: 60, resize: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الحل المتخذ</label>
                <textarea value={form.resolution} onChange={e => set('resolution', e.target.value)}
                  className="input" style={{ minHeight: 60, resize: 'none' }} />
              </div>
            </>
          )}

          {form.status === 'مغلق' && form.type === 'شكوى' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 8 }}>تقييم رضا العميل بعد المعالجة</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => set('satisfaction_rating', n)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '1.2rem', fontFamily: 'inherit',
                      borderColor: Number(form.satisfaction_rating) === n ? '#1a56db' : 'var(--border)',
                      background: Number(form.satisfaction_rating) === n ? '#eff6ff' : 'white' }}>
                    {'⭐'.repeat(n)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option>مفتوح</option><option>قيد المعالجة</option><option>مغلق</option>
              </select>
            </div>
            {form.status === 'مغلق' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ الإغلاق</label>
                <input type="date" value={form.response_date} onChange={e => set('response_date', e.target.value)} className="input" />
              </div>
            )}
          </div>

          <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: '0.76rem', color: '#1a56db' }}>
            💡 إذا أفضت هذه الشكوى لإجراء تحسين، يمكنك إنشاء CAPA مرتبطة من تاب "إجراءات التحسين المستمر"
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary"
            style={{ background: TYPE_COLORS[form.type] || '#1a56db' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
