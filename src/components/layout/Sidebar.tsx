'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useState } from 'react'

// ── أيقونات SVG paths ──
const ICONS = {
  dashboard:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  projects:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  visits:      'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  inventory:   'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  safety:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  quality:     'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  environment: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  hr:          'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 110 8 4 4 0 010-8z',
  attendance:  'M12 22V12M12 12V2M12 12H2M12 12h10',
  leaves:      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  payroll:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  documents:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  jobs:        'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  purchases:   'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  reports:     'M18 20V10M12 20V4M6 20v-6',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  employees:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  chevron:     'M6 9l6 6 6-6',
}

function SvgIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={path} />
    </svg>
  )
}

// ── مكوّن القسم القابل للطي ──
function NavGroup({ label, icon, isActive, isOpen, onToggle, children, accentColor = 'rgba(255,255,255,0.2)' }: {
  label: string; icon: string; isActive: boolean; isOpen: boolean
  onToggle: () => void; children: React.ReactNode; accentColor?: string
}) {
  return (
    <div style={{ marginBottom: '2px' }}>
      <button
        onClick={onToggle}
        className={`sidebar-item ${isActive ? 'active' : ''}`}
        style={{
          width: '100%', justifyContent: 'space-between',
          background: isActive ? 'rgba(255,255,255,0.2)' : isOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SvgIcon path={icon} />
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d={ICONS.chevron} />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          marginTop: '2px', marginRight: '10px',
          borderRight: `2px solid ${accentColor}`,
          paddingRight: '8px',
          display: 'flex', flexDirection: 'column', gap: '1px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── عنصر فرعي ──
function SubItem({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href}
      className={`sidebar-item ${active ? 'active' : ''}`}
      style={{
        fontSize: '0.825rem', padding: '7px 10px',
        background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
        borderRadius: '7px',
      }}>
      <SvgIcon path={icon} size={15} />
      <span>{label}</span>
    </Link>
  )
}

// ── عنصر قسم (label فاصل) ──
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
      color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
      padding: '10px 10px 4px', marginTop: '4px',
    }}>
      {label}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset } = useStore()
  const perms = currentUser?.permissions || []

  const [projectsOpen, setProjectsOpen] = useState(
    pathname === '/dashboard' || pathname.startsWith('/projects') || pathname.startsWith('/visits') || pathname.startsWith('/inventory')
  )
  const [qhseOpen, setQhseOpen] = useState(pathname.startsWith('/qhse'))
  const [hrOpen, setHrOpen] = useState(pathname.startsWith('/hr'))
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings') || pathname.startsWith('/employees'))

  const tenantModules = (tenant as any)?.modules || {}
  const isAdmin = currentUser?.role === 'مدير عام'

  const hasProjects  = perms.includes('projects_view') && tenantModules.projects !== false
  const hasVisits    = perms.some((p: string) => p.startsWith('visits')) && tenantModules.visits !== false
  const hasInventory = perms.includes('inventory') && tenantModules.inventory !== false
  const hasQHSE      = perms.includes('qhse') && tenantModules.qhse !== false
  const hasPurchases = perms.includes('purchases') && tenantModules.purchases !== false
  const hasReports   = perms.includes('reports')
  const hasHR        = perms.includes('employees')
  const hasDashboard = perms.includes('dashboard')

  const isProjectsActive = ['/dashboard', '/projects', '/visits', '/inventory'].some(p =>
    pathname === p || pathname.startsWith(p + '/'))
  const isQHSEActive = pathname.startsWith('/qhse')
  const isHRActive   = pathname.startsWith('/hr')
  const isSettingsActive = pathname.startsWith('/settings') || pathname.startsWith('/employees')

  return (
    <div className="sidebar">
      {/* ── Header ── */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '38px', height: '38px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SvgIcon path={ICONS.shield} size={20} />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
              {tenant?.name || 'وثيق ERP'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>مقاول كهرباء معتمد</div>
          </div>
        </div>

        {branches.length > 1 ? (
          <select value={activeBranch?.id || ''} onChange={e => {
            const b = branches.find(b => b.id === Number(e.target.value))
            if (b) setActiveBranch(b)
          }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', width: '100%' }}>
            {branches.map(b => <option key={b.id} value={b.id} style={{ color: '#1a1a1a', background: 'white' }}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px',
            color: 'white', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SvgIcon path="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" size={14} />
            {activeBranch?.name || 'الفرع الرئيسي'}
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>

        {/* ════ إدارة المشاريع ════ */}
        {(hasDashboard || hasProjects || hasVisits || hasInventory) && (
          <NavGroup
            label="إدارة المشاريع"
            icon={ICONS.projects}
            isActive={isProjectsActive}
            isOpen={projectsOpen}
            onToggle={() => setProjectsOpen(o => !o)}
            accentColor="rgba(99,179,237,0.5)"
          >
            {hasDashboard && (
              <SubItem href="/dashboard" label="لوحة التحكم" icon={ICONS.dashboard} active={pathname === '/dashboard'} />
            )}
            {hasProjects && (
              <SubItem href="/projects" label="المشاريع" icon={ICONS.projects} active={pathname.startsWith('/projects')} />
            )}
            {hasVisits && (
              <SubItem href="/visits" label="الزيارات الفنية" icon={ICONS.visits} active={pathname.startsWith('/visits')} />
            )}
            {hasInventory && (
              <SubItem href="/inventory" label="المخزون" icon={ICONS.inventory} active={pathname.startsWith('/inventory')} />
            )}
          </NavGroup>
        )}

        {/* ════ إدارة السلامة والجودة ════ */}
        {hasQHSE && (
          <NavGroup
            label="السلامة والجودة"
            icon={ICONS.shield}
            isActive={isQHSEActive}
            isOpen={qhseOpen}
            onToggle={() => setQhseOpen(o => !o)}
            accentColor="rgba(252,211,77,0.5)"
          >
            <SubItem href="/qhse" label="لوحة التحكم" icon={ICONS.dashboard} active={pathname === '/qhse'} />
            <SubItem href="/qhse/safety" label="السلامة (HSE)" icon={ICONS.safety} active={pathname.startsWith('/qhse/safety')} />
            <SubItem href="/qhse/quality" label="الجودة (QC)" icon={ICONS.quality} active={pathname.startsWith('/qhse/quality')} />
            <SubItem href="/qhse/environment" label="البيئة (ENV)" icon={ICONS.environment} active={pathname.startsWith('/qhse/environment')} />
          </NavGroup>
        )}

        {/* ════ الموارد البشرية ════ */}
        {hasHR && (
          <NavGroup
            label="الموارد البشرية"
            icon={ICONS.hr}
            isActive={isHRActive}
            isOpen={hrOpen}
            onToggle={() => setHrOpen(o => !o)}
            accentColor="rgba(134,239,172,0.5)"
          >
            <SubItem href="/hr/dashboard" label="لوحة التحكم" icon={ICONS.dashboard} active={pathname === '/hr/dashboard'} />
            <SubItem href="/hr" label="ملفات الموظفين" icon={ICONS.employees} active={pathname === '/hr'} />
            <SubItem href="/hr/attendance" label="الحضور والغياب" icon={ICONS.attendance} active={pathname.startsWith('/hr/attendance')} />
            <SubItem href="/hr/leaves" label="الإجازات" icon={ICONS.leaves} active={pathname.startsWith('/hr/leaves')} />
            <SubItem href="/hr/payroll" label="الرواتب والتعويضات" icon={ICONS.payroll} active={pathname.startsWith('/hr/payroll')} />
            <SubItem href="/hr/documents" label="الوثائق" icon={ICONS.documents} active={pathname.startsWith('/hr/documents')} />
            <SubItem href="/hr/jobs" label="عروض الوظائف" icon={ICONS.jobs} active={pathname.startsWith('/hr/jobs')} />
          </NavGroup>
        )}

        {/* ════ منفردة ════ */}
        {(hasPurchases || hasReports) && (
          <>
            <SectionLabel label="أخرى" />
            {hasPurchases && (
              <Link href="/purchases" className={`sidebar-item ${pathname.startsWith('/purchases') ? 'active' : ''}`}>
                <SvgIcon path={ICONS.purchases} />
                <span>المشتريات</span>
              </Link>
            )}
            {hasReports && (
              <Link href="/reports" className={`sidebar-item ${pathname.startsWith('/reports') ? 'active' : ''}`}>
                <SvgIcon path={ICONS.reports} />
                <span>التقارير</span>
              </Link>
            )}
          </>
        )}

        {/* ════ الإعدادات ════ */}
        {isAdmin && (
          <NavGroup
            label="الإعدادات"
            icon={ICONS.settings}
            isActive={isSettingsActive}
            isOpen={settingsOpen}
            onToggle={() => setSettingsOpen(o => !o)}
            accentColor="rgba(196,181,253,0.5)"
          >
            <SubItem href="/employees" label="المستخدمون والصلاحيات" icon={ICONS.employees} active={pathname.startsWith('/employees')} />
            <SubItem href="/settings" label="إعدادات النظام" icon={ICONS.settings} active={pathname === '/settings'} />
          </NavGroup>
        )}

      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>{currentUser?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{currentUser?.role}</div>
        </div>
        <button onClick={() => { reset(); router.push('/login') }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
          <SvgIcon path="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" size={16} />
          تسجيل الخروج
        </button>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '8px' }}>وثيق v1.0</div>
      </div>
    </div>
  )
}
