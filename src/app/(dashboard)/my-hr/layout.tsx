'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useMyHrEmployee } from '@/hooks/useMyHrEmployee'
import { getSelfServiceBlockReason } from '@/lib/hrSelfService'

const TABS = [
  { href: '/my-hr', label: 'الرئيسية' },
  { href: '/my-hr/attendance', label: 'الحضور' },
  { href: '/my-hr/leaves', label: 'الإجازات' },
  { href: '/my-hr/disciplinary', label: 'الجزاءات' },
  { href: '/my-hr/payroll', label: 'الرواتب' },
]

export default function MyHrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { allowed, loading, hrEmployeeId, profile, currentUser } = useMyHrEmployee()
  const blockReason = getSelfServiceBlockReason(
    currentUser?.permissions,
    hrEmployeeId,
    currentUser?.role,
  )

  useEffect(() => {
    if (!loading && blockReason) {
      router.replace(`/unauthorized?reason=${blockReason}`)
    }
  }, [loading, blockReason, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!allowed || !hrEmployeeId) return null

  return (
    <div className="space-y-4 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800">الخدمة الذاتية</h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>
          مرحباً {profile?.name || 'بك'} — بياناتك الشخصية في الموارد البشرية
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s',
              background: pathname === tab.href ? 'var(--primary)' : 'transparent',
              color: pathname === tab.href ? 'white' : 'var(--text3)',
              boxShadow: pathname === tab.href ? '0 2px 8px rgba(26,86,219,0.3)' : 'none',
            }}>
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  )
}
