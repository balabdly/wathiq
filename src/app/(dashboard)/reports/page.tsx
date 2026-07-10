'use client'

import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { REPORT_SECTIONS, REPORT_COUNTS, FEATURED_REPORTS } from '@/lib/reports-config'

const AVAILABLE_TOTAL =
  REPORT_COUNTS.finance +
  REPORT_COUNTS.hr +
  REPORT_COUNTS.projects +
  REPORT_COUNTS.inventory +
  REPORT_COUNTS.visits

export default function ReportsPage() {
  const router = useRouter()

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 style={{ width: '20px', height: '20px', color: '#1a56db' }} />
          التقارير
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '2px' }}>
          {AVAILABLE_TOTAL} تقرير جاهز · {REPORT_COUNTS.qhse} قيد التطوير (QHSE)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {FEATURED_REPORTS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              style={{ textAlign: 'right', width: '100%', outline: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div
                style={{ borderRadius: '16px', padding: '20px', border: '1px solid', transition: 'all 0.2s', background: item.bg, borderColor: item.border }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.color + '18' }}>
                    <Icon style={{ width: '20px', height: '20px', color: item.color }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: item.color + '15', color: item.color }}>
                    مميز
                  </span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px', color: item.color }}>{item.label}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', lineHeight: 1.6 }}>{item.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {REPORT_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => router.push(section.href)}
              style={{ textAlign: 'right', width: '100%', outline: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div
                style={{
                  borderRadius: '16px', padding: '20px', border: '1px solid', transition: 'all 0.2s',
                  background: section.bg,
                  borderColor: section.border,
                  opacity: section.comingSoon ? 0.92 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: section.color + '18' }}
                  >
                    <Icon style={{ width: '20px', height: '20px', color: section.color }} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: '999px',
                      background: section.comingSoon ? '#f3f4f6' : section.color + '15',
                      color: section.comingSoon ? '#6b7280' : section.color,
                    }}
                  >
                    {section.comingSoon ? `${section.count} قريباً` : `${section.count} تقرير`}
                  </span>
                </div>

                <h3
                  style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px', color: section.color }}
                >
                  {section.label}
                </h3>

                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', lineHeight: 1.6 }}>
                  {section.description}
                </p>

                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: section.color }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                    {section.comingSoon ? 'عرض الخطة' : 'عرض التقارير'}
                  </span>
                  <span style={{ fontSize: '0.875rem' }}>←</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
