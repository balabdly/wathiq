'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderOpen } from 'lucide-react'

const TABS = [
  { href: '/projects/monitoring', label: 'لوحة المتابعة', emoji: '📊', color: '#7c3aed', match: (p: string) => p.startsWith('/projects/monitoring') || p === '/projects' },
  { href: '/projects/initiation/projects', label: 'مرحلة البدء', emoji: '🚀', color: '#1a56db', match: (p: string) => p.startsWith('/projects/initiation') },
  { href: '/projects/planning', label: 'مرحلة التخطيط', emoji: '📋', color: '#0ea77b', match: (p: string) => p.startsWith('/projects/planning') && !/\/planning\/\d+/.test(p) },
  { href: '/projects/execution', label: 'مرحلة التنفيذ', emoji: '🏗️', color: '#e6820a', match: (p: string) => p.startsWith('/projects/execution') && !/\/execution\/\d+/.test(p) },
  { href: '/projects/close', label: 'مرحلة الإغلاق', emoji: '🏁', color: '#059669', match: (p: string) => p.startsWith('/projects/close') && !/\/close\/\d+/.test(p) },
]

export function showProjectsLifecycleShell(pathname: string): boolean {
  if (pathname === '/projects' || pathname.startsWith('/projects/monitoring')) return true
  const excluded = ['/projects/tasks', '/projects/teams', '/projects/lessons', '/projects/risks', '/projects/field-memos', '/projects/framework']
  if (excluded.some(p => pathname.startsWith(p))) return false
  if (pathname.startsWith('/projects/initiation')) {
    return !/\/projects\/initiation\/\d+/.test(pathname)
  }
  if (pathname.startsWith('/projects/planning')) {
    return !/\/projects\/planning\/\d+/.test(pathname)
  }
  if (pathname.startsWith('/projects/execution')) {
    return !/\/projects\/execution\/\d+/.test(pathname)
  }
  if (pathname.startsWith('/projects/measure')) {
    return false
  }
  if (pathname.startsWith('/projects/close')) {
    return !/\/projects\/close\/\d+/.test(pathname)
  }
  return false
}

export default function ProjectsLifecycleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen style={{ width: '20px', height: '20px', color: '#1a56db' }} />
          المشاريع
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
          متابعة — بدء — تخطيط — تنفيذ — إغلاق
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = t.match(pathname)
          return (
            <Link key={t.href} href={t.href} style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
              background: active ? t.color : 'transparent',
              color: active ? 'white' : 'var(--text3)',
              boxShadow: active ? `0 2px 8px ${t.color}44` : 'none',
            }}>
              {t.emoji} {t.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
