'use client'
import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'

export default function CancelProjectModal({
  projectName,
  onClose,
  onConfirm,
}: {
  projectName: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSaving(true)
    try {
      await onConfirm(reason.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0, color: '#c81e1e' }}>إلغاء المشروع</h3>
          <button onClick={onClose} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text2)' }}>
              سيتم إلغاء «<strong>{projectName}</strong>» وإخفاؤه من القوائم — يظهر فقط عند تفعيل فلتر <strong>المشاريع الملغية</strong>.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                سبب الإلغاء <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="input"
                rows={4}
                placeholder="اكتب سبب الإلغاء..."
                autoFocus
                required
              />
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving}>تراجع</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !reason.trim()} style={{ background: '#c81e1e', borderColor: '#c81e1e' }}>
              <Trash2 style={{ width: '14px', height: '14px' }} />
              {saving ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
