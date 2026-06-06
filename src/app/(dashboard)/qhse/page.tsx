'use client'
import Link from 'next/link'
import { Shield, CheckCircle, Leaf, AlertTriangle, TrendingUp, FileText } from 'lucide-react'

export default function QHSEDashboard() {
  const sections = [
    {
      href: '/qhse/safety', label: 'السلامة والصحة المهنية', abbr: 'HSE',
      icon: Shield, color: '#c81e1e', bg: '#fef2f2',
      desc: 'تقارير الحوادث، التفتيش، معدات الوقاية، تصاريح العمل',
      stats: [{ label: 'حوادث هذا الشهر', value: '0' }, { label: 'تفتيشات مجدولة', value: '—' }],
    },
    {
      href: '/qhse/quality', label: 'ضبط الجودة', abbr: 'QC',
      icon: CheckCircle, color: '#1a56db', bg: '#eff6ff',
      desc: 'عدم المطابقة، الإجراءات التصحيحية، شهادات الجودة، المراجعات',
      stats: [{ label: 'حالات عدم مطابقة', value: '0' }, { label: 'إجراءات مفتوحة', value: '—' }],
    },
    {
      href: '/qhse/environment', label: 'الإدارة البيئية', abbr: 'ENV',
      icon: Leaf, color: '#0ea77b', bg: '#ecfdf5',
      desc: 'النفايات، الانبعاثات، المواد الخطرة، الامتثال البيئي',
      stats: [{ label: 'بلاغات بيئية', value: '0' }, { label: 'متطلبات معلقة', value: '—' }],
    },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '22px', height: '22px', color: '#c81e1e' }} />
          لوحة تحكم السلامة والجودة
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>نظرة شاملة على السلامة والجودة والبيئة</p>
      </div>

      {/* KPIs عامة */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'حوادث هذا الشهر', value: '0', color: '#0ea77b', bg: '#ecfdf5', icon: AlertTriangle },
          { label: 'تقارير الجودة',    value: '0', color: '#1a56db', bg: '#eff6ff', icon: FileText },
          { label: 'امتثال البيئة',    value: '100%', color: '#0ea77b', bg: '#ecfdf5', icon: TrendingUp },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* بطاقات الأقسام الثلاثة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '20px', height: '100%', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon style={{ width: '22px', height: '22px', color: s.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{s.label}</div>
                  <span style={{ background: s.bg, color: s.color, borderRadius: '6px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{s.abbr}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '14px', lineHeight: 1.6 }}>{s.desc}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {s.stats.map(st => (
                  <div key={st.label} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: s.color, fontSize: '1.1rem' }}>{st.value}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{st.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '14px', color: s.color, fontSize: '0.8rem', fontWeight: 600, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                فتح القسم ←
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
