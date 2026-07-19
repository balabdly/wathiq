'use client'
import type { PlanningProgress } from '@/lib/planning-progress'

export default function PlanningProgressBadge({ progress, size = 'md' }: {
  progress: PlanningProgress | null | undefined
  size?: 'sm' | 'md'
}) {
  if (!progress) return null
  const { percent, label, isComplete, completed, total } = progress
  const color = isComplete ? '#0ea77b' : percent >= 50 ? '#e6820a' : '#9ca3af'
  const bg = isComplete ? '#ecfdf5' : percent >= 50 ? '#fffbeb' : '#f3f4f6'
  const h = size === 'sm' ? 6 : 8

  return (
    <div style={{ minWidth: size === 'sm' ? '100px' : '130px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
        <span style={{ fontSize: size === 'sm' ? '0.72rem' : '0.78rem', fontWeight: 700, color }}>{label}</span>
        {!isComplete && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{completed}/{total}</span>
        )}
      </div>
      <div style={{ height: `${h}px`, background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          width: `${percent}%`, height: '100%', background: color,
          borderRadius: '99px', transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}
