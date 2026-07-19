'use client'
import { useEffect, useState } from 'react'
import { Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useProjectPlanning } from '../ProjectPlanningContext'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

type Risk = {
  id: number; title: string; category: string; probability: string; impact: string
  risk_score?: number; status: string; response_plan?: string
}

const PROB: Record<string, number> = { 'منخفض': 1, 'متوسط': 2, 'عالي': 3 }

export default function RisksTabPage() {
  const { tenantId, projectId } = useProjectPlanning()
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'تشغيلي', probability: 'متوسط', impact: 'متوسط', response_plan: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('project_risks')
      .select('id, title, category, probability, impact, risk_score, status, response_plan')
      .eq('tenant_id', tenantId).eq('project_id', projectId).order('created_at', { ascending: false })
    setRisks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tenantId, projectId])

  async function handleAdd() {
    if (!form.title.trim()) { toast.error('عنوان المخاطرة مطلوب'); return }
    setSaving(true)
    const score = (PROB[form.probability] || 2) * (PROB[form.impact] || 2)
    const { count } = await supabase.from('project_risks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const { error } = await supabase.from('project_risks').insert({
      tenant_id: tenantId, project_id: projectId,
      risk_code: `R-${String((count || 0) + 1).padStart(3, '0')}`,
      title: form.title.trim(), category: form.category,
      probability: form.probability, impact: form.impact, risk_score: score,
      status: 'مفتوح', response_plan: form.response_plan || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('تمت الإضافة ✅')
      setForm({ title: '', category: 'تشغيلي', probability: 'متوسط', impact: 'متوسط', response_plan: '' })
      setShowForm(false)
      await load()
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف المخاطرة؟')) return
    await supabase.from('project_risks').delete().eq('id', id)
    await load()
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert style={{ width: '17px', height: '17px', color: '#c81e1e' }} /> تقييم المخاطر
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-ghost" style={{ fontSize: '0.82rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
          <Plus style={{ width: '14px', height: '14px' }} /> إضافة مخاطرة
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid #fecaca' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={lbl}>المخاطرة *</label><input value={form.title} onChange={e => set('title', e.target.value)} className="input" /></div>
            <div><label style={lbl}>التصنيف</label><select value={form.category} onChange={e => set('category', e.target.value)} className="select">{['تشغيلي','مالي','فني','قانوني','سلامة'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label style={lbl}>الاحتمال</label><select value={form.probability} onChange={e => set('probability', e.target.value)} className="select">{['منخفض','متوسط','عالي'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label style={lbl}>الأثر</label><select value={form.impact} onChange={e => set('impact', e.target.value)} className="select">{['منخفض','متوسط','عالي'].map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: '10px' }}><label style={lbl}>خطة الاستجابة</label><input value={form.response_plan} onChange={e => set('response_plan', e.target.value)} className="input" /></div>
          <button onClick={handleAdd} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}><Save style={{ width: '14px', height: '14px' }} /> حفظ</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : risks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>لا مخاطر مسجّلة — أضف أول مخاطرة</div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['المخاطرة', 'التصنيف', 'الاحتمال', 'الأثر', 'الدرجة', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.title}</td>
                  <td style={{ padding: '8px 10px' }}>{r.category}</td>
                  <td style={{ padding: '8px 10px' }}>{r.probability}</td>
                  <td style={{ padding: '8px 10px' }}>{r.impact}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: (r.risk_score || 0) >= 6 ? '#c81e1e' : '#e6820a' }}>{r.risk_score}</td>
                  <td style={{ padding: '8px 10px' }}>{r.status}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
