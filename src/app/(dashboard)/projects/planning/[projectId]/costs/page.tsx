'use client'
import { useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Save, Trash2, X, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { fetchCostItems, saveCostItems, updateProjectPlanning, type PlanningCostItem } from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

function emptyItem(projectId: number): PlanningCostItem {
  return { project_id: projectId, item_name: '', category: '', planned_amount: 0, notes: '' }
}

export default function CostsTabPage() {
  const { tenantId, projectId, project, planning, reload } = useProjectPlanning()
  const [items, setItems] = useState<PlanningCostItem[]>([])
  const [notes, setNotes] = useState(planning?.cost_plan_notes || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editItems, setEditItems] = useState<PlanningCostItem[]>([])

  async function load() {
    setLoading(true)
    const { data } = await fetchCostItems(tenantId, projectId)
    setItems(data.length ? data : [{ ...emptyItem(projectId), item_name: 'القيمة التقديرية للمشروع', planned_amount: Number(project.estimated_value || 0), category: 'رئيسي' }])
    setNotes(planning?.cost_plan_notes || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [tenantId, projectId, planning?.cost_plan_notes])

  const total = items.reduce((s, i) => s + Number(i.planned_amount || 0), 0)

  async function handleSaveEdit() {
    setSaving(true)
    try {
      await saveCostItems(tenantId, projectId, editItems.filter(i => i.item_name.trim()))
      await updateProjectPlanning(tenantId, projectId, { cost_plan_notes: notes || null })
      await reload()
      await load()
      setEditOpen(false)
      toast.success('تم حفظ خطة التكاليف ✅')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  function openEdit() {
    setEditItems(items.length ? items.map(i => ({ ...i })) : [emptyItem(projectId)])
    setEditOpen(true)
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign style={{ width: '17px', height: '17px', color: '#0891b2' }} /> خطة التكاليف
        </h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setViewOpen(true)} className="btn btn-ghost" style={{ padding: '6px 10px' }} title="عرض التفاصيل">
            <Eye style={{ width: '15px', height: '15px' }} />
          </button>
          <button onClick={openEdit} className="btn btn-ghost" style={{ padding: '6px 10px', color: '#1a56db', border: '1px solid #bfdbfe' }} title="تعديل">
            <Pencil style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : (
        <>
          <div style={{ background: '#ecfeff', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>إجمالي الخطة</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0891b2' }}>{total.toLocaleString('ar-SA')} ر.س</div>
            {project.estimated_value && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>
                القيمة التقديرية من البدء: {Number(project.estimated_value).toLocaleString('ar-SA')} ر.س
              </div>
            )}
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['البند', 'التصنيف', 'المبلغ المخطط', 'ملاحظات'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.item_name}</td>
                    <td style={{ padding: '8px 10px' }}>{item.category || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#0891b2', fontWeight: 700 }}>{Number(item.planned_amount).toLocaleString('ar-SA')} ر.س</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text3)', fontSize: '0.75rem' }}>{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewOpen && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '560px' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, margin: 0 }}>تفاصيل خطة التكاليف</h3>
              <button onClick={() => setViewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.85rem' }}>
              <p><strong>المشروع:</strong> {project.name}</p>
              <p><strong>الإجمالي:</strong> {total.toLocaleString('ar-SA')} ر.س</p>
              {notes && <p><strong>ملاحظات:</strong> {notes}</p>}
              <div style={{ marginTop: '12px' }}>
                {items.map((item, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    {item.item_name} — {Number(item.planned_amount).toLocaleString('ar-SA')} ر.س
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'auto' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil style={{ width: '16px', height: '16px' }} /> تعديل خطة التكاليف
              </h3>
              <button onClick={() => setEditOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {editItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                  <div><label style={lbl}>البند</label><input value={item.item_name} onChange={e => { const n = [...editItems]; n[idx] = { ...n[idx], item_name: e.target.value }; setEditItems(n) }} className="input" /></div>
                  <div><label style={lbl}>التصنيف</label><input value={item.category || ''} onChange={e => { const n = [...editItems]; n[idx] = { ...n[idx], category: e.target.value }; setEditItems(n) }} className="input" /></div>
                  <div><label style={lbl}>المبلغ</label><input type="number" value={item.planned_amount} onChange={e => { const n = [...editItems]; n[idx] = { ...n[idx], planned_amount: Number(e.target.value) }; setEditItems(n) }} className="input" dir="ltr" /></div>
                  <button onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '8px' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button>
                </div>
              ))}
              <button onClick={() => setEditItems([...editItems, emptyItem(projectId)])} className="btn btn-ghost" style={{ fontSize: '0.82rem', alignSelf: 'flex-start' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> بند
              </button>
              <div><label style={lbl}>ملاحظات الخطة</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows={2} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditOpen(false)} className="btn btn-ghost">إلغاء</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn btn-primary" style={{ background: '#0891b2' }}>
                <Save style={{ width: '14px', height: '14px' }} /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
