'use client'
import { SkipForward } from 'lucide-react'

export default function PlanningSectionSkip({
  sectionLabel,
  skipped,
  readOnly,
  onSkip,
}: {
  sectionLabel: string
  skipped?: boolean | null
  readOnly?: boolean
  onSkip: () => void | Promise<void>
}) {
  if (skipped) {
    return (
      <div style={{
        padding: '10px 14px', borderRadius: '10px', marginBottom: '14px',
        background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.8rem', color: '#92400e',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <SkipForward style={{ width: '16px', height: '16px', flexShrink: 0 }} />
        <span>تم تجاوز «{sectionLabel}» — على مسؤولية المستخدم</span>
      </div>
    )
  }

  if (readOnly) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
      <button
        type="button"
        onClick={() => {
          const msg = [
            `تجاوز «${sectionLabel}»؟`,
            '',
            '• لن يُطلب إكمال هذا القسم لاعتماد التخطيط',
            '• المقايسة (بنود الأعمال) تبقى إلزامية',
            '• التجاوز على مسؤوليتك',
          ].join('\n')
          if (!confirm(msg)) return
          void onSkip()
        }}
        className="btn btn-ghost"
        style={{ fontSize: '0.78rem', color: '#92400e', border: '1px solid #fcd34d' }}
      >
        <SkipForward style={{ width: '14px', height: '14px' }} /> تجاوز هذا القسم
      </button>
    </div>
  )
}
