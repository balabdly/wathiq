'use client'

import { Truck, type LucideIcon } from 'lucide-react'

export function FleetPageHeader({
  title,
  description,
  icon: Icon = Truck,
  color = '#0d9488',
}: {
  title: string
  description?: string
  icon?: LucideIcon
  color?: string
}) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon style={{ width: '20px', height: '20px', color }} />
        {title}
      </h1>
      {description && (
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>{description}</p>
      )}
    </div>
  )
}
