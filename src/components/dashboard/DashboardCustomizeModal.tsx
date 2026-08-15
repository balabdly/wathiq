'use client'
import { useEffect, useState } from 'react'
import { X, LayoutGrid, RotateCcw } from 'lucide-react'
import {
  DASHBOARD_BLOCK_SECTIONS,
  DASHBOARD_DEPARTMENT_SECTIONS,
  DEFAULT_DASHBOARD_SECTIONS,
  type DashboardAccess,
  type DashboardSectionKey,
  type DashboardSections,
  canShowDashboardSection,
} from '@/lib/dashboard-sections'

type Props = {
  open: boolean
  onClose: () => void
  sections: DashboardSections
  access: DashboardAccess
  onChange: (sections: DashboardSections) => void
}

function ToggleRow({ label, checked, disabled, onChange }: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '10px 12px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      background: checked ? '#eff6ff' : 'transparent',
      border: `1px solid ${checked ? '#bfdbfe' : 'var(--border)'}`,
      transition: 'background 0.15s',
    }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </label>
  )
}

export default function DashboardCustomizeModal({ open, onClose, sections, access, onChange }: Props) {
  const [draft, setDraft] = useState(sections)

  useEffect(() => { if (open) setDraft(sections) }, [open, sections])

  if (!open) return null

  function setKey(key: DashboardSectionKey, visible: boolean) {
    setDraft(prev => ({ ...prev, [key]: visible }))
  }

  function showAll() {
    const next = { ...DEFAULT_DASHBOARD_SECTIONS }
    for (const { key } of [...DASHBOARD_DEPARTMENT_SECTIONS, ...DASHBOARD_BLOCK_SECTIONS]) {
      if (!canShowDashboardSection(access, next, key)) next[key] = false
    }
    setDraft(next)
  }

  function save() {
    onChange(draft)
    onClose()
  }

  const visibleDeptCount = DASHBOARD_DEPARTMENT_SECTIONS.filter(
    s => canShowDashboardSection(access, draft, s.key) && draft[s.key],
  ).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={onClose}>
      <div className="card" style={{
        width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>تخصيص لوحة التحكم</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                {visibleDeptCount} أقسام ظاهرة — تُحفظ تلقائياً على هذا الجهاز
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X style={{ width: '20px', height: '20px', color: 'var(--text3)' }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>
              الأقسام
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {DASHBOARD_DEPARTMENT_SECTIONS.map(s => {
                const allowed = canShowDashboardSection(access, draft, s.key)
                return (
                  <ToggleRow
                    key={s.key}
                    label={s.label}
                    checked={!!draft[s.key]}
                    disabled={!allowed}
                    onChange={v => setKey(s.key, v)}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>
              عناصر اللوحة
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {DASHBOARD_BLOCK_SECTIONS.map(s => {
                const allowed = canShowDashboardSection(access, draft, s.key)
                return (
                  <ToggleRow
                    key={s.key}
                    label={s.label}
                    checked={!!draft[s.key]}
                    disabled={!allowed}
                    onChange={v => setKey(s.key, v)}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap',
        }}>
          <button onClick={showAll} className="btn btn-ghost" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw style={{ width: '14px', height: '14px' }} />
            إظهار الكل
          </button>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>إلغاء</button>
          <button onClick={save} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>حفظ</button>
        </div>
      </div>
    </div>
  )
}
