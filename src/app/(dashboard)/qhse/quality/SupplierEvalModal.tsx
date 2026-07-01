'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Supplier = { id: number; name: string; category: string }
type Project  = { id: number; name: string }
type Props = { suppliers: Supplier[]; projects: Project[]; editItem?: any; onClose: () => void; onSave: () => void }

export default function SupplierEvalModal({ suppliers, projects, editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    supplier_id:       editItem?.supplier_id       || '',
    project_id:        editItem?.project_id        || '',
    eval_date:         editItem?.eval_date         || new Date().toISOString().split('T')[0],
    eval_period:       editItem?.eval_period        || '',
    quality_score:     editItem?.quality_score     || '',
    delivery_score:    editItem?.delivery_score    || '',
    compliance_score:  editItem?.compliance_score  || '',
    safety_score:      editItem?.safety_score      || '',
    evaluator_name:    editItem?.evaluator_name    || '',
    strengths:         editItem?.strengths         || '',
    weaknesses:        editItem?.weaknesses        || '',
    corrective_needed: editItem?.corrective_needed || false,
    notes:             editItem?.notes             || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // حساب المتوسط تلقائياً
  const scores = [form.quality_score, form.delivery_score, form.compliance_score, form.safety_score]
    .map(Number).filter(s => s > 0)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null

  const ScoreRow = ({ label, field, color }: { label: string; field: string; color: string }) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => set(field, n)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', transition: 'all 0.1s',
              borderColor: Number((form as any)[field]) === n ? color : 'var(--border)',
              background: Number((form as any)[field]) === n ? color + '15' : 'white',
              color: Number((form as any)[field]) === n ? color : 'var(--text3)', fontWeight: Number((form as any)[field]) === n ? 700 : 400 }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  async function handleSave() {
    if (!form.supplier_id || !form.eval_date) { toast.error('المورد والتاريخ مطلوبان'); return }
    setSaving(true)
    const payload: Record<string, any> = {
      ...form,
      tenant_id: tenant?.id,
      supplier_id: Number(form.supplier_id),
      quality_score:    form.quality_score    ? Number(form.quality_score)    : null,
      delivery_score:   form.delivery_score   ? Number(form.delivery_score)   : null,
      compliance_score: form.compliance_score ? Number(form.compliance_score) : null,
      safety_score:     form.safety_score     ? Number(form.safety_score)     : null,
      overall_score:    avgScore ? Number(avgScore) : null,
    }
    if (form.project_id) payload.project_id = Number(form.project_id)
    else delete payload.project_id

    const { error } = editItem
      ? await supabase.from('quality_supplier_evaluations').update(payload).eq('id', editItem.id)
      : await supabase.from('quality_supplier_evaluations').insert(payload)

    // تحديث التقييم الكلي للمورد تلقائياً
    if (!error && avgScore) {
      await supabase.from('quality_suppliers').update({ overall_rating: Number(avgScore) }).eq('id', Number(form.supplier_id))
    }

    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم حفظ التقييم' + (avgScore ? ` — المتوسط: ${avgScore}/5` : ''))
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>
            {editItem ? 'تعديل' : 'تقييم'} مورد
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400, marginRight: 8 }}>ISO 9001 §8.4</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المورد *</label>
              <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المشروع المرتبط</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ التقييم *</label>
              <input type="date" value={form.eval_date} onChange={e => set('eval_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الفترة</label>
              <input value={form.eval_period} onChange={e => set('eval_period', e.target.value)} className="input" placeholder="Q1-2025" dir="ltr" />
            </div>
          </div>

          {/* محاور التقييم */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>محاور التقييم (1 = ضعيف جداً، 5 = ممتاز)</div>
            <ScoreRow label="جودة المنتج / الخدمة" field="quality_score" color="#1a56db" />
            <ScoreRow label="الالتزام بالتسليم في الوقت المحدد" field="delivery_score" color="#7c3aed" />
            <ScoreRow label="الامتثال للمواصفات التقنية" field="compliance_score" color="#0ea77b" />
            <ScoreRow label="السلامة والبيئة (QHSE ترابط)" field="safety_score" color="#e6820a" />

            {avgScore && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, marginTop: 4,
                background: Number(avgScore) >= 4 ? '#ecfdf5' : Number(avgScore) >= 3 ? '#fffbeb' : '#fef2f2',
                border: `1px solid ${Number(avgScore) >= 4 ? '#bbf7d0' : Number(avgScore) >= 3 ? '#fde68a' : '#fecaca'}` }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>المتوسط الكلي</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800,
                  color: Number(avgScore) >= 4 ? '#0ea77b' : Number(avgScore) >= 3 ? '#e6820a' : '#c81e1e' }}>
                  {avgScore} / 5
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المقيِّم</label>
            <input value={form.evaluator_name} onChange={e => set('evaluator_name', e.target.value)} className="input" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نقاط القوة</label>
              <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نقاط الضعف</label>
              <textarea value={form.weaknesses} onChange={e => set('weaknesses', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.corrective_needed} onChange={e => set('corrective_needed', e.target.checked)} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>يتطلب إجراء تصحيحي (CAPA)</span>
          </label>

          {form.corrective_needed && (
            <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: 8, fontSize: '0.76rem', color: '#92400e' }}>
              ⚠️ بعد الحفظ، اذهب لتاب "إجراءات التحسين المستمر" وأنشئ CAPA مرتبطة بهذا المورد
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving ? '...' : <><Save size={14} /> حفظ التقييم</>}
          </button>
        </div>
      </div>
    </div>
  )
}
