'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

const CHECKLIST = [
  'مستوعبات النفايات مُغلقة ومُوسومة',
  'مناطق تخزين المواد الكيميائية مُحكمة',
  'لا توجد تسربات ظاهرة',
  'أحواض احتجاز التسرب (Secondary Containment) سليمة',
  'طفايات الحريق البيئية موجودة وصالحة',
  'أكياس امتصاص التسرب (Spill Kits) جاهزة',
  'قنوات الصرف خالية من الملوثات',
  'سجلات النفايات محدّثة وموثقة',
  'صحائف MSDS متاحة لكل مادة كيميائية',
  'لوحات التحذير البيئي موجودة',
]

export default function EnvInspectionModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [checklist, setChecklist] = useState<Record<number, 'مطابق' | 'غير مطابق' | 'لا ينطبق'>>(
    editItem?.findings?.reduce((acc: any, f: any) => ({ ...acc, [f.no-1]: f.result }), {}) || {}
  )
  const [form, setForm] = useState({
    date:           editItem?.date           || new Date().toISOString().split('T')[0],
    location:       editItem?.location       || '',
    inspector_name: editItem?.inspector_name || '',
    notes:          editItem?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const violations = Object.values(checklist).filter(v => v === 'غير مطابق').length
  const answered   = Object.keys(checklist).length

  async function handleSave() {
    if (!form.location || !form.inspector_name) { toast.error('الموقع واسم المفتش مطلوبان'); return }
    setSaving(true)
    const findings = CHECKLIST.map((item, i) => ({
      no: i + 1, item, result: checklist[i] || 'لا ينطبق'
    }))
    const payload = {
      ...form, tenant_id: tenant?.id,
      checklist_items: CHECKLIST.length,
      violations,
      findings,
      overall_result: violations === 0 ? 'مطابق' : 'غير مطابق',
      status: violations === 0 ? 'مطابق' : 'قيد التصحيح',
    }
    const { error } = editItem
      ? await supabase.from('env_inspections').update(payload).eq('id', editItem.id)
      : await supabase.from('env_inspections').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success(violations === 0 ? '✅ تسجيل زيارة مطابقة' : `⚠️ تسجيل زيارة بـ ${violations} مخالفة`)
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>🔍 {editItem ? 'تعديل' : 'زيارة تفتيشية'} بيئية — ISO 14001 الفقرة 9.1</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التاريخ</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الموقع *</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="ورشة الإنتاج" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المفتش *</label>
              <input value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} className="input" />
            </div>
          </div>

          {/* قائمة الفحص */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>قائمة الفحص البيئي ({answered}/{CHECKLIST.length})</span>
              {violations > 0 && <span style={{ color: '#c81e1e', fontWeight: 700, fontSize: '0.8rem' }}>❌ {violations} مخالفة</span>}
              {answered === CHECKLIST.length && violations === 0 && <span style={{ color: '#0ea77b', fontWeight: 700, fontSize: '0.8rem' }}>✅ مطابق تماماً</span>}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', background: '#059669', color: 'white', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, gap: 8 }}>
                <div>#</div><div>بند الفحص</div><div style={{ minWidth: 200, textAlign: 'center' }}>النتيجة</div>
              </div>
              {CHECKLIST.map((item, i) => {
                const result = checklist[i]
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', padding: '8px 12px', gap: 8, alignItems: 'center', borderBottom: i < CHECKLIST.length - 1 ? '1px solid #f1f5f9' : 'none', background: result === 'مطابق' ? '#f0fdf4' : result === 'غير مطابق' ? '#fef2f2' : 'white' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textAlign: 'center' }}>{i+1}</div>
                    <div style={{ fontSize: '0.8rem', lineHeight: 1.4, color: result === 'غير مطابق' ? '#c81e1e' : 'var(--text)' }}>{item}</div>
                    <div style={{ display: 'flex', gap: 4, minWidth: 200, justifyContent: 'flex-end' }}>
                      {(['مطابق','غير مطابق','لا ينطبق'] as const).map(val => (
                        <button key={val} type="button" onClick={() => setChecklist(c => ({ ...c, [i]: val }))}
                          style={{ padding: '3px 8px', borderRadius: 6, border: '1.5px solid', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.1s',
                            borderColor: result === val ? (val === 'مطابق' ? '#0ea77b' : val === 'غير مطابق' ? '#c81e1e' : '#6b7280') : 'var(--border)',
                            background: result === val ? (val === 'مطابق' ? '#ecfdf5' : val === 'غير مطابق' ? '#fef2f2' : '#f3f4f6') : 'white',
                            color: result === val ? (val === 'مطابق' ? '#0ea77b' : val === 'غير مطابق' ? '#c81e1e' : '#6b7280') : 'var(--text3)' }}>
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات عامة</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#059669' }}>
            {saving ? '...' : <><Save size={14} /> حفظ الزيارة</>}
          </button>
        </div>
      </div>
    </div>
  )
}
