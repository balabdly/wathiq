'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck } from 'lucide-react'

const TABS = [
  { href: '/fleet', label: 'لوحة القيادة' },
  { href: '/fleet/units', label: 'سجل الأسطول' },
  { href: '/fleet/assignments', label: 'التخصيص' },
  { href: '/fleet/operator', label: 'تشغيل يومي' },
  { href: '/fleet/maintenance', label: 'الصيانة' },
  { href: '/fleet/fuel', label: 'الوقود' },
  { href: '/fleet/compliance', label: 'الامتثال' },
]

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck style={{ width: '20px', height: '20px', color: '#0d9488' }} />
          إدارة الأسطول
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
          متابعة المعدات والشاحنات والسيارات — تشغيل، صيانة، وقود، امتثال
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#e5e7eb', padding: '6px', borderRadius: '14px' }}>
        {TABS.map(tab => {
          const active = tab.href === '/fleet' ? pathname === '/fleet' : pathname.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href}
              style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s',
                background: active ? '#0d9488' : 'transparent',
                color: active ? 'white' : '#6b7280',
                boxShadow: active ? '0 2px 8px rgba(13,148,136,0.3)' : 'none',
              }}>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
