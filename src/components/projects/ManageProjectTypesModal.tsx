'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px',
}

export type ProjectTypeRow = { id: number; code: string; name: string }

export default function ManageProjectTypesModal({ tenantId, onClose, onChanged }: {
  tenantId: string
  onClose: () => void
  onChanged?: () => void
}) {
  const [types, setTypes] = useState<ProjectTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { loadTypes() }, [tenantId])

  async function loadTypes() {
    setLoading(true)
    const { data } = await supabase.from('project_types')
      .select('id, code, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
    setTypes(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error('اسم النوع مطلوب'); return }
    setSaving(true)
    const code = newName.trim().substring(0, 20)
    const { error } = await supabase.from('project_types')
      .insert({ tenant_id: tenantId, code, name: newName.trim() })
    if (error) {
      toast.error(error.code === '23505' ? 'هذا النوع موجود مسبقاً' : error.message)
      setSaving(false)
      return
    }
    setNewName('')
    await loadTypes()
    onChanged?.()
    toast.success('تمت الإضافة ✅')
    setSaving(false)
  }

  async function handleEdit(id: number) {
    if (!editName.trim()) return
    await supabase.from('project_types')
      .update({ name: editName.trim(), code: editName.trim().substring(0, 20) })
      .eq('id', id)
    setEditId(null)
    setEditName('')
    await loadTypes()
    onChanged?.()
    toast.success('تم التعديل ✅')
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف النوع "${name}"؟`)) return
    await supabase.from('project_types').update({ is_active: false }).eq('id', id)
    await loadTypes()
    onChanged?.()
    toast.success('تم الحذف')
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Tag style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            تحديد أنواع المشاريع
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #ddd6fe', fontSize: '0.82rem', color: '#5b21b6', lineHeight: 1.6 }}>
            كل مستأجر يحدّد أنواع مشاريعه كما يريد — مشاريع SEC، صيانة، أو مشروع لعميل خارجي مثل
            <strong> «أرامكو» </strong> أو <strong> «بلدية الرياض» </strong>.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="input"
              placeholder="مثال: مشروع 802 — عميل خارج SEC — صيانة..."
              style={{ flex: 1 }}
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn btn-primary" style={{ background: '#7c3aed', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : types.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px' }}>
              لا توجد أنواع — أضف أول نوع
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
              {types.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid var(--border)' }}>
                  {editId === t.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="input" style={{ flex: 1 }} autoFocus />
                      <button onClick={() => handleEdit(t.id)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>حفظ</button>
                      <button onClick={() => { setEditId(null); setEditName('') }} className="btn btn-ghost"><X style={{ width: '13px', height: '13px' }} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</span>
                      <button onClick={() => { setEditId(t.id); setEditName(t.name) }} className="btn btn-ghost" style={{ padding: '5px' }}>
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="btn btn-ghost" style={{ padding: '5px', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary" style={{ background: '#7c3aed' }}>تم</button>
        </div>
      </div>
    </div>
  )
}
