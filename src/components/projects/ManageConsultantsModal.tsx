'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'

export type ProjectConsultantRow = { id: number; name: string }

export default function ManageConsultantsModal({ tenantId, onClose, onChanged }: {
  tenantId: string
  onClose: () => void
  onChanged?: () => void
}) {
  const [consultants, setConsultants] = useState<ProjectConsultantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { loadConsultants() }, [tenantId])

  async function loadConsultants() {
    setLoading(true)
    const { data } = await supabase.from('project_consultants')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
    setConsultants(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error('اسم الاستشاري مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.from('project_consultants')
      .insert({ tenant_id: tenantId, name: newName.trim() })
    if (error) {
      toast.error(error.code === '23505' ? 'هذا الاستشاري موجود مسبقاً' : error.message)
      setSaving(false)
      return
    }
    setNewName('')
    await loadConsultants()
    onChanged?.()
    toast.success('تمت الإضافة ✅')
    setSaving(false)
  }

  async function handleEdit(id: number) {
    if (!editName.trim()) return
    const { error } = await supabase.from('project_consultants')
      .update({ name: editName.trim() })
      .eq('id', id)
    if (error) {
      toast.error(error.code === '23505' ? 'هذا الاسم مستخدم مسبقاً' : error.message)
      return
    }
    setEditId(null)
    setEditName('')
    await loadConsultants()
    onChanged?.()
    toast.success('تم التعديل ✅')
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف الاستشاري "${name}"؟`)) return
    await supabase.from('project_consultants').update({ is_active: false }).eq('id', id)
    await loadConsultants()
    onChanged?.()
    toast.success('تم الحذف')
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <UserRound style={{ width: '18px', height: '18px', color: '#0d9488' }} />
            إضافة استشاري
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f0fdfa', borderRadius: '10px', padding: '12px 14px', border: '1px solid #99f6e4', fontSize: '0.82rem', color: '#0f766e', lineHeight: 1.6 }}>
            أضف أسماء الاستشاريين أو الشركات الاستشارية — تظهر في قائمة منسدلة عند إنشاء مشروع جديد.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="input"
              placeholder="مثال: شركة الخبراء للاستشارات..."
              style={{ flex: 1 }}
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn btn-primary" style={{ background: '#0d9488', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : consultants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px' }}>
              لا يوجد استشاريون — أضف أول استشاري
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
              {consultants.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid var(--border)' }}>
                  {editId === c.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="input" style={{ flex: 1 }} autoFocus />
                      <button onClick={() => handleEdit(c.id)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>حفظ</button>
                      <button onClick={() => { setEditId(null); setEditName('') }} className="btn btn-ghost"><X style={{ width: '13px', height: '13px' }} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</span>
                      <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="btn btn-ghost" style={{ padding: '5px' }}>
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(c.id, c.name)} className="btn btn-ghost" style={{ padding: '5px', color: '#c81e1e' }}>
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
          <button onClick={onClose} className="btn btn-primary" style={{ background: '#0d9488' }}>تم</button>
        </div>
      </div>
    </div>
  )
}
