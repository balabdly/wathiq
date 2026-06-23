'use client'
import { DisplayView } from '@/hooks/useStore'

type Option = { value: DisplayView; label: string; icon: string }

const OPTIONS: Option[] = [
  { value: 'list',   label: 'قائمة',  icon: '☰' },
  { value: 'cards',  label: 'بطاقات', icon: '⊞' },
  { value: 'kanban', label: 'كانبان', icon: '⊟' },
]

export function ViewToggle({
  view, onChange, options = ['list', 'cards']
}: {
  view: DisplayView
  onChange: (v: DisplayView) => void
  options?: DisplayView[]
}) {
  const available = OPTIONS.filter(o => options.includes(o.value))
  return (
    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
      {available.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          title={opt.label}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
            background: view === opt.value ? 'white' : 'transparent',
            color: view === opt.value ? 'var(--primary)' : 'var(--text3)',
            boxShadow: view === opt.value ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>
          <span style={{ fontSize: '14px' }}>{opt.icon}</span>
          <span style={{ display: 'none' }}>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
