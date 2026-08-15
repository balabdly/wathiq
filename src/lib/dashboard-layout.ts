/** تخطيط شبكة لوحة التحكم — يتوسّع عند قلة العناصر */
import type { CSSProperties } from 'react'

export type DashboardGridKind = 'section' | 'kpi' | 'panel' | 'quick'

export function dashboardGridColumns(count: number, kind: DashboardGridKind): string {
  if (count <= 0) return '1fr'

  switch (kind) {
    case 'section':
      if (count === 1) return 'minmax(0, 1fr)'
      if (count === 2) return 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))'
      if (count === 3) return 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))'
      if (count <= 5) return 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'
      return 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'

    case 'kpi':
      if (count === 1) return 'minmax(0, 360px)'
      if (count === 2) return 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'
      if (count <= 4) return 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))'
      return 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))'

    case 'panel':
      if (count === 1) return 'minmax(0, 1fr)'
      if (count === 2) return 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))'
      return 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'

    case 'quick':
      if (count <= 3) return 'repeat(auto-fit, minmax(140px, 1fr))'
      if (count <= 6) return 'repeat(auto-fit, minmax(120px, 1fr))'
      return 'repeat(auto-fit, minmax(110px, 1fr))'

    default:
      return 'repeat(auto-fit, minmax(280px, 1fr))'
  }
}

export function dashboardGridStyle(count: number, kind: DashboardGridKind): CSSProperties {
  const singleCentered = count === 1 && (kind === 'section' || kind === 'kpi' || kind === 'panel')
  return {
    display: 'grid',
    gridTemplateColumns: dashboardGridColumns(count, kind),
    gap: count <= 3 ? '16px' : '12px',
    justifyContent: singleCentered ? 'center' : undefined,
    justifyItems: 'stretch',
  }
}

export function isExpandedDashboardLayout(count: number): boolean {
  return count > 0 && count <= 3
}
