'use client'
import Link from 'next/link'
import { Shield, ClipboardCheck, ArrowLeft } from 'lucide-react'
import { QHSE_PLANNED_REPORTS, REPORT_COUNTS } from '@/lib/reports-config'

export default function ReportsQHSEPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '22px', height: '22px', color: '#dc2626' }} />
          تقارير السلامة والجودة (QHSE)
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.6 }}>
          تقارير الحوادق والتدقيق والشهادات قيد التطوير.
          تقارير الزيارات وNCR متاحة الآن في قسم الزيارات الميدانية.
        </p>
      </div>

      {/* رابط الزيارات */}
      <Link href="/reports/visits" style={{ textDecoration: 'none' }}>
        <div style={{
          padding: '18px 20px', borderRadius: '14px', border: '2px solid #99f6e4',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          transition: 'box-shadow 0.15s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardCheck style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f766e' }}>تقارير الزيارات و NCR</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                {REPORT_COUNTS.visits} تقارير جاهزة — ملخص، NCR، المهندسين، المشاريع
              </div>
            </div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0f766e', fontWeight: 600, fontSize: '0.82rem' }}>
            عرض <ArrowLeft style={{ width: '14px', height: '14px' }} />
          </span>
        </div>
      </Link>

      {/* قريباً */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', marginBottom: '10px' }}>
          قريباً — {REPORT_COUNTS.qhse} تقارير
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {QHSE_PLANNED_REPORTS.map(r => (
            <div key={r.title} style={{
              padding: '16px', borderRadius: '12px', border: '1px dashed #fecaca',
              background: '#fef2f2', opacity: 0.85,
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#991b1b', marginBottom: '4px' }}>{r.title}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5 }}>{r.desc}</div>
              <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#c81e1e', padding: '2px 8px', borderRadius: '8px' }}>
                قريباً
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
