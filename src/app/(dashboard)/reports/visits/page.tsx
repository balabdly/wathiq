'use client'
import { ClipboardCheck } from 'lucide-react'
import { VisitReportsPanel } from '@/components/reports/VisitReportsPanel'

export default function ReportsVisitsPage() {
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <ClipboardCheck style={{ width: '22px', height: '22px', color: '#0f766e' }} />
      </div>
      <VisitReportsPanel />
    </div>
  )
}
