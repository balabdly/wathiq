// src/app/(dashboard)/finance/accounting/layout.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Layers } from 'lucide-react'

const TABS = [
  { href: '/finance/accounting/chart',        label: 'شجرة الحسابات',    emoji: '📊', color: '#1a56db' },
  { href: '/finance/accounting/journal',      label: 'القيود اليومية',   emoji: '📒', color: '#0ea77b' },
  { href: '/finance/accounting/cost-centers', label: 'مراكز التكلفة',    emoji: '🎯', color: '#e6820a' },
  { href: '/finance/accounting/periods',      label: 'الفترات المحاسبية', emoji: '🔒', color: '#c81e1e' },
  { href: '/finance/accounting/standards',    label: 'دليل المعايير',    emoji: '📋', color: '#7c3aed' },
]

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Layers style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          الحسابات العامة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px' }}>شجرة الحسابات — القيود اليومية — مراكز التكلفة — الفترات المحاسبية</p>
      </div>

      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = pathname?.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href}
              style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s',
                background: active ? t.color : 'transparent',
                color: active ? 'white' : 'var(--text3)',
                boxShadow: active ? '0 2px 8px ' + t.color + '44' : 'none' }}>
              {t.emoji} {t.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
