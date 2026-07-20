import { projectPhaseDisplay } from '@/lib/project-phase-display'

export default function ProjectPhaseBadge({ phase, size = 'md' }: { phase?: string | null; size?: 'sm' | 'md' }) {
  const d = projectPhaseDisplay(phase)
  const fontSize = size === 'sm' ? '0.72rem' : '0.78rem'
  const padding = size === 'sm' ? '3px 8px' : '4px 10px'

  return (
    <span style={{
      display: 'inline-block', padding, borderRadius: '8px',
      fontSize, fontWeight: 700, color: d.color, background: d.bg,
      border: `1px solid ${d.color}33`, whiteSpace: 'nowrap',
    }}>
      {d.label}
    </span>
  )
}
