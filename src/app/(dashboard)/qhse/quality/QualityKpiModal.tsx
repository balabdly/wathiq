'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Project  = { id: number; name: string }
type Props = { projects: Project[]; editItem?: any; onClose: () => void; onSave: () => void }

const KPI_TEMPLATES = [
  { name: 'نسبة المطابقة في الزيارات التفتيشية',  category: 'جودة التنفيذ',   unit: '%',      source: 'visits',                     target: 95 },
  { name: 'عدد حالات عدم المطابقة (NCR) المفتوحة', category: 'جودة التنفيذ',   unit: 'حالة',   source: 'visits',                     target: 0 },
  { name: 'نسبة إغلاق الشكاوى في الوقت المحدد',    category: 'رضا العملاء',    unit: '%',      source: 'quality_customer_feedback',  target: 90 },
  { name: 'متوسط تقييم رضا العملاء',               category: 'رضا العملاء',    unit: '/5',     source: 'quality_customer_feedback',  target: 4 },
  { name: 'نسبة الموردين المؤهلين',                 category: 'الموردين',       unit: '%',      source: 'quality_suppliers',          target: 100 },
  { name: 'متوسط تقييم الموردين',                  category: 'الموردين',       unit: '/5',     source: 'quality_supplier_evaluations', target: 3.5 },
  { name: 'نسبة إتمام تدريبات الجودة',              category: 'تدريب',          unit: '%',      source: 'qhse_trainings',             target: 100 },
  { name: 'نسبة إغلاق CAPA في الوقت المحدد',        category: 'جودة التنفيذ',   unit: '%',      source: 'qhse_capa',                  target: 90 },
]

export default function QualityKpiModal({ projects, editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const [form, setForm] = useState({
    year:         editItem?.year         || now.getFullYear(),
    month:        editItem?.month        || '',
    project_id:   editItem?.project_id   || '',
    kpi_name:     editItem?.kpi_name     || '',
    kpi_category: editItem?.kpi_category || 'جودة التنفيذ',
    unit:         editItem?.unit         || '%',
    target:       editItem?.target       || '',
    actual:       editItem?.actual       || '',
    notes:        editItem?.notes        || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function applyTemplate(tpl: typeof KPI_TEMPLATES[0]) {
    setForm(f => ({ ...f, kpi_name: tpl.name, kpi_category: tpl.category, unit: tpl.unit, target: tpl.target, source_table: tpl.source }))
  }

  // حساب الحالة التلقائي
  const getStatus = () => {
    if (!form.actual || !form.target) return null
    const a = Number(form.actual), t = Number(form.target)
    if (form.unit === 'حالة') return a <= t ? 'محقق' : 'متأخر'
    return a >= t ? 'محقق' : a >= t * 0.9 ? 'قيد التحقيق' : 'متأخر'
  }
  const status = getStatus()

  async function handleSave() {
    if (!form.kpi_name || !form.target) { toast.error('اسم المؤشر والهدف مطلوبان'); return }
    setSaving(true)
    const payload: Record<string, any> = {
      ...form,
      tenant_id: tenant?.id,
      year:   Number(form.year),
      target: Number(form.target),
      actual: form.actual ? Number(form.actual) : null,
      month:  form.month || null,
      status: status || null,
    }
    if (form.project_id) payload.project_id = Number(form.project_id)
    else delete payload.project_id

    const { error } = editItem
      ? await supabase.from('quality_kpis').update(payload).eq('id', editItem.id)
      : await supabase.from('quality_kpis').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>
            {editItem ? 'تعديل' : 'إضافة'} مؤشر جودة (KPI)
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400, marginRight: 8 }}>ISO 9001 §6.2</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* قوالب جاهزة */}
          {!editItem && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>قوالب مؤشرات جاهزة</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {KPI_TEMPLATES.map(tpl => (
                  <button key={tpl.name} type="button" onClick={() => applyTemplate(tpl)}
                    style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit',
                      borderColor: form.kpi_name === tpl.name ? '#1a56db' : 'var(--border)',
                      background: form.kpi_name === tpl.name ? '#eff6ff' : 'white',
                      color: form.kpi_name === tpl.name ? '#1a56db' : 'var(--text3)', fontWeight: form.kpi_name === tpl.name ? 700 : 400 }}>
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم المؤشر *</label>
            <input value={form.kpi_name} onChange={e => set('kpi_name', e.target.value)} className="input" placeholder="مثال: نسبة المطابقة في الزيارات" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التصنيف</label>
              <select value={form.kpi_category} onChange={e => set('kpi_category', e.target.value)} className="select">
                {['جودة التنفيذ','رضا العملاء','الموردين','تدريب','تدقيق','CAPA'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— على مستوى الشركة —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>السنة</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الشهر (اختياري)</label>
              <select value={form.month} onChange={e => set('month', e.target.value)} className="select">
                <option value="">— سنوي —</option>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الوحدة</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                {['%','/5','حالة','ساعة','يوم','ريال'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الهدف *</label>
              <input type="number" step="0.1" value={form.target} onChange={e => set('target', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الفعلي</label>
              <input type="number" step="0.1" value={form.actual} onChange={e => set('actual', e.target.value)} className="input" />
            </div>
          </div>

          {status && (
            <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
              background: status === 'محقق' ? '#ecfdf5' : status === 'قيد التحقيق' ? '#fffbeb' : '#fef2f2',
              color:      status === 'محقق' ? '#0ea77b' : status === 'قيد التحقيق' ? '#e6820a' : '#c81e1e' }}>
              {status === 'محقق' ? '✅ الهدف محقق' : status === 'قيد التحقيق' ? '⚠️ قريب من الهدف — يحتاج متابعة' : '❌ لم يتحقق الهدف — يوصى بـ CAPA'}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات / تفسير الانحراف</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 50, resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
