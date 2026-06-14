'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import React, { useState } from 'react'

const IC = {
  dashboard:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  projects:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  visits:      'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  tasks:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  lessons:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  risks:       'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  inventory:   'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  safety:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  quality:     'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  environment: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  org:         'M3 3h6v6H3zM15 3h6v6h-6zM9 6h6M12 6v6M3 15h6v6H3zM15 15h6v6h-6zM6 15v-3M18 15v-3',
  hr:          'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 110 8 4 4 0 010-8z',
  attendance:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  leaves:      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  payroll:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  documents:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  jobs:        'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  disciplinary: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  purchases:   'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  finance:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  invoice:     'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  expense:     'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z',
  treasury:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  accounting:  'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M14 3h4m0 0v4m0-4L10 11',
  reports:     'M18 20V10M12 20V4M6 20v-6',
  inv_overview:  'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  inv_materials: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  inv_movements: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  inv_projects:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  inv_warehouses:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  employees:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  logout:      'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevron:     'M6 9l6 6 6-6',
  branch:      'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
}

const C = {
  sidebarBg:     '#ffffff',
  headerBg:      '#ffffff',
  activeBg:      '#f0f0f0',
  activeLight:   '#f0f0f0',
  hoverBg:       '#f5f5f5',
  groupOpenBg:   '#f5f5f5',
  subBg:         '#f5f5f5',
  textPrimary:   '#1a1a1a',
  textSecondary: '#444444',
  textMuted:     '#888888',
  accent:        '#1a56db',
  accentLight:   '#3b82f6',
  border:        '#e8e8e8',
  borderLight:   '#f0f0f0',
}

function Icon({ d, size = 16, color = "currentColor" }: {
  d: string
  size?: number
  color?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  )
}


function SubLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '9px 14px', marginBottom: '1px',
        background: active ? C.activeLight : 'transparent',
        color: active ? C.textPrimary : C.textSecondary,
        fontSize: '0.875rem', fontWeight: active ? 500 : 400,
        cursor: 'pointer', transition: 'background 0.1s',
        borderRadius: '0',
      }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = C.hoverBg } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent' } }}
      >
        <span style={{ flex: 1 }}>{label}</span>
      </div>
    </Link>
  )
}

// رابط مباشر بنفس تنسيق NavSection لكن بدون toggle
function NavDirectLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', cursor: 'pointer',
        background: active ? C.groupOpenBg : 'transparent',
        borderBottom: '1px solid ' + C.border,
        transition: 'background 0.2s',
      }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.hoverBg }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ flex: 1, textAlign: 'right', fontSize: '0.95rem', fontWeight: 700, color: C.textPrimary }}>
          {label}
        </span>
        <Icon d={icon} size={18} color={C.textMuted} />
      </div>
    </Link>
  )
}

function NavSection({ label, icon, isActive, isOpen, onToggle, children }: {
  label: string; icon: string
  isActive: boolean; isOpen: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState(isOpen ? 'auto' : '0px')

  React.useEffect(() => {
    if (!contentRef.current) return
    if (isOpen) {
      const h = contentRef.current.scrollHeight
      setHeight(h + 'px')
      const timer = setTimeout(() => setHeight('auto'), 280)
      return () => clearTimeout(timer)
    } else {
      const h = contentRef.current.scrollHeight
      setHeight(h + 'px')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight('0px'))
      })
    }
  }, [isOpen])

  return (
    <div>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', border: 'none', cursor: 'pointer',
        background: isOpen ? C.groupOpenBg : 'transparent',
        borderBottom: '1px solid ' + C.border,
        transition: 'background 0.2s',
      }}>
        <span style={{
          flex: 1, textAlign: 'right',
          fontSize: '0.95rem',
          // ── التعديل: العنوان دائماً Bold ──
          fontWeight: 700,
          color: C.textPrimary,
        }}>
          {label}
        </span>
        <div style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s ease', flexShrink: 0 }}>
            <path d={IC.chevron} />
          </svg>
          <Icon d={icon} size={18} />
        </div>
      </button>

      <div ref={contentRef} style={{
        overflow: 'hidden',
        height: height,
        transition: 'height 0.25s ease',
      }}>
        <div style={{
          background: C.groupOpenBg,
          borderBottom: '1px solid ' + C.border,
          paddingBottom: '4px',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function StandaloneLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', borderBottom: '1px solid ' + C.border }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px',
        background: active ? C.activeLight : 'transparent',
        color: active ? C.textPrimary : C.textSecondary,
        // ── التعديل: العنوان دائماً Bold ──
        fontSize: '0.95rem', fontWeight: 700,
        cursor: 'pointer', transition: 'background 0.1s',
      }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = C.hoverBg } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent' } }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <Icon d={icon} size={18} />
      </div>
    </Link>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: C.border }} />
}

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset } = useStore()
  const perms: string[]   = currentUser?.permissions || []
  const tenantModules     = (tenant as any)?.modules || {}
  const isAdmin           = currentUser?.role === 'مدير عام'

  const hasProjects  = perms.includes('projects_view')                   && tenantModules.projects  !== false
  const hasTasks     = (isAdmin || perms.includes('projects_view'))        && tenantModules.projects  !== false
  const hasLessons   = (isAdmin || perms.includes('projects_view'))        && tenantModules.projects  !== false
  const hasRisks     = (isAdmin || perms.includes('projects_view'))        && tenantModules.projects  !== false
  const hasVisits    = perms.some((p: string) => p.startsWith('visits')) && tenantModules.visits    !== false
  const hasInventory = perms.includes('inventory')                       && tenantModules.inventory !== false
  const hasQHSE      = perms.includes('qhse')                           && tenantModules.qhse      !== false
  const hasPurchases = perms.includes('purchases')                       && tenantModules.purchases !== false
  const hasFinance   = perms.includes('finance')                         && tenantModules.finance   !== false
  const hasReports   = perms.includes('reports')
  const hasHR        = perms.includes('employees')
  const hasDashboard = perms.includes('dashboard')

  const inProjects = pathname === '/dashboard' || ['/projects','/visits','/projects/tasks','/projects/lessons','/projects/risks'].some(p => pathname === p || pathname.startsWith(p+'/'))
  const inQHSE     = pathname.startsWith('/qhse')
  const inHR       = pathname.startsWith('/hr')
  const inSettings = pathname.startsWith('/settings')
  const inReports  = pathname.startsWith('/reports')
  const inFinance  = pathname.startsWith('/finance')

  // كل الأقسام مغلقة افتراضياً — تفتح فقط إذا المستخدم فيها (عدا dashboard)
  const [projectsOpen,  setProjectsOpen]  = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(pathname.startsWith('/inventory'))
  const [qhseOpen,      setQhseOpen]      = useState(inQHSE)
  const [hrOpen,        setHrOpen]        = useState(inHR)
  const [settingsOpen,  setSettingsOpen]  = useState(inSettings)
  const [reportsOpen,   setReportsOpen]   = useState(pathname.startsWith('/reports'))
  const [financeOpen,   setFinanceOpen]   = useState(inFinance)

  return (
    <div className="sidebar" style={{
      background: C.sidebarBg,
      borderLeft: '1px solid ' + C.border,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 14px',
        background: C.headerBg,
        borderBottom: '1px solid ' + C.border,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
            background: C.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon d={IC.shield} size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.textPrimary, fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tenant?.name || 'وثيق ERP'}
            </div>
            <div style={{ color: C.textMuted, fontSize: '0.72rem', marginTop: '2px' }}>نظام إدارة مقاولي الكهرباء</div>
          </div>
        </div>

        {branches.length > 1 ? (
          <select
            value={activeBranch?.id || ''}
            onChange={e => { const b = branches.find(b => b.id === Number(e.target.value)); if (b) setActiveBranch(b) }}
            style={{
              width: '100%', background: 'white', border: '1px solid ' + C.border,
              color: C.textPrimary, borderRadius: '8px', padding: '7px 10px', fontSize: '0.8rem', cursor: 'pointer',
            }}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{
            background: C.borderLight, border: '1px solid ' + C.border,
            borderRadius: '8px', padding: '7px 10px',
            color: C.textSecondary, fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            <Icon d={IC.branch} size={13} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeBranch?.name || 'الفرع الرئيسي'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {(hasDashboard || hasProjects || hasVisits || hasTasks) && (
          <NavSection label="إدارة المشاريع" icon={IC.projects}
            isActive={inProjects} isOpen={projectsOpen} onToggle={() => setProjectsOpen(o => !o)}>
            {hasDashboard  && <SubLink href="/dashboard"  label="لوحة التحكم"    icon={IC.dashboard}  active={pathname === '/dashboard'} />}
            {hasProjects   && <SubLink href="/projects"   label="المشاريع"        icon={IC.projects}   active={pathname.startsWith('/projects')} />}
            {hasVisits     && <SubLink href="/visits"              label="الزيارات الفنية" icon={IC.visits}   active={pathname.startsWith('/visits')} />}
            {hasTasks      && <SubLink href="/projects/tasks"    label="المهام"          icon={IC.tasks}   active={pathname.startsWith('/projects/tasks')} />}
            {hasLessons    && <SubLink href="/projects/lessons"  label="الدروس المستفادة" icon={IC.lessons} active={pathname.startsWith('/projects/lessons')} />}
            {hasRisks      && <SubLink href="/projects/risks"    label="سجل المخاطر"    icon={IC.risks}   active={pathname.startsWith('/projects/risks')} />}
          </NavSection>
        )}

        {hasInventory && (
          <NavSection label="المخزون" icon={IC.inventory}
            isActive={pathname.startsWith('/inventory')} isOpen={inventoryOpen} onToggle={() => setInventoryOpen(o => !o)}>
            <SubLink href="/inventory"             label="نظرة عامة"       icon={IC.inv_overview}   active={pathname === '/inventory'} />
            <SubLink href="/inventory/materials"   label="المواد"           icon={IC.inv_materials}  active={pathname.startsWith('/inventory/materials')} />
            <SubLink href="/inventory/movements"   label="الحركات"          icon={IC.inv_movements}  active={pathname.startsWith('/inventory/movements')} />
            <SubLink href="/inventory/projects"    label="عهدة المشاريع"    icon={IC.inv_projects}   active={pathname.startsWith('/inventory/projects')} />
            <SubLink href="/inventory/warehouses"  label="المستودعات"       icon={IC.inv_warehouses} active={pathname.startsWith('/inventory/warehouses')} />
          </NavSection>
        )}

        {hasQHSE && (
          <NavSection label="السلامة والجودة" icon={IC.shield}
            isActive={inQHSE} isOpen={qhseOpen} onToggle={() => setQhseOpen(o => !o)}>
            <SubLink href="/qhse"             label="لوحة التحكم"   icon={IC.dashboard}   active={pathname === '/qhse'} />
            <SubLink href="/qhse/safety"      label="السلامة (HSE)" icon={IC.safety}      active={pathname.startsWith('/qhse/safety')} />
            <SubLink href="/qhse/quality"     label="الجودة (QC)"   icon={IC.quality}     active={pathname.startsWith('/qhse/quality')} />
            <SubLink href="/qhse/environment" label="البيئة (ENV)"  icon={IC.environment} active={pathname.startsWith('/qhse/environment')} />
          </NavSection>
        )}

        {hasHR && (
          <NavSection label="الموارد البشرية" icon={IC.hr}
            isActive={inHR} isOpen={hrOpen} onToggle={() => setHrOpen(o => !o)}>
            <SubLink href="/hr/dashboard"  label="لوحة التحكم"       icon={IC.dashboard}  active={pathname === '/hr/dashboard'} />
            <SubLink href="/hr/org"        label="الهيكل التنظيمي"   icon={IC.org}        active={pathname.startsWith('/hr/org')} />
            <SubLink href="/hr"            label="ملفات الموظفين"     icon={IC.employees}  active={pathname === '/hr'} />
            <SubLink href="/hr/attendance" label="الحضور والغياب"     icon={IC.attendance} active={pathname.startsWith('/hr/attendance')} />
            <SubLink href="/hr/leaves"     label="الإجازات"           icon={IC.leaves}     active={pathname.startsWith('/hr/leaves')} />
            <SubLink href="/hr/payroll"    label="الرواتب والتعويضات"  icon={IC.payroll}    active={pathname.startsWith('/hr/payroll')} />
            <SubLink href="/hr/documents"  label="الوثائق"            icon={IC.documents}  active={pathname.startsWith('/hr/documents')} />
            <SubLink href="/hr/jobs"       label="عروض الوظائف"       icon={IC.jobs}       active={pathname.startsWith('/hr/jobs')} />
            <SubLink href="/hr/disciplinary" label="التأديب والجزاءات"   icon={IC.disciplinary} active={pathname.startsWith('/hr/disciplinary')} />
          </NavSection>
        )}

        <Divider />

        {hasFinance && (
          <NavSection label="المالية والمحاسبة" icon={IC.finance}
            isActive={inFinance} isOpen={financeOpen} onToggle={() => setFinanceOpen(o => !o)}>
            <SubLink href="/finance"             label="لوحة التحكم المالية" icon={IC.dashboard}  active={pathname === '/finance'} />
            <SubLink href="/finance/invoices"    label="فواتير المبيعات"     icon={IC.invoice}    active={pathname.startsWith('/finance/invoices')} />
            <SubLink href="/finance/purchases"   label="المشتريات"           icon={IC.purchases}  active={pathname.startsWith('/finance/purchases')} />
            <SubLink href="/finance/expenses"    label="المصروفات"           icon={IC.expense}    active={pathname.startsWith('/finance/expenses')} />
            <SubLink href="/finance/treasury"    label="الخزينة"             icon={IC.treasury}   active={pathname.startsWith('/finance/treasury')} />
            <SubLink href="/finance/accounting"  label="الحسابات العامة"     icon={IC.accounting} active={pathname.startsWith('/finance/accounting')} />
          </NavSection>
        )}

        <Divider />

        {hasReports && (
          <NavSection label="التقارير" icon={IC.reports}
            isActive={inReports} isOpen={reportsOpen} onToggle={() => setReportsOpen(o => !o)}>
            <SubLink href="/reports/projects"  label="تقارير المشاريع"  icon={IC.projects}   active={pathname.startsWith('/reports/projects')} />
            <SubLink href="/reports/inventory" label="تقارير المخزون"   icon={IC.inventory}  active={pathname.startsWith('/reports/inventory')} />
            <SubLink href="/reports/qhse"      label="تقارير QHSE"      icon={IC.shield}     active={pathname.startsWith('/reports/qhse')} />
            <SubLink href="/reports/hr"        label="تقارير الموارد البشرية" icon={IC.hr}   active={pathname.startsWith('/reports/hr')} />
            <SubLink href="/reports/finance"   label="تقارير المالية"   icon={IC.finance}    active={pathname.startsWith('/reports/finance')} />
          </NavSection>
        )}

        {isAdmin && (
          <>
            <Divider />
            <NavSection label="الإعدادات" icon={IC.settings}
              isActive={inSettings} isOpen={settingsOpen} onToggle={() => setSettingsOpen(o => !o)}>
              <SubLink href="/settings/employees" label="المستخدمون والصلاحيات" icon={IC.employees} active={pathname.startsWith('/settings/employees')} />
              <SubLink href="/settings"           label="إعدادات النظام"         icon={IC.settings}  active={pathname === '/settings'} />
              <SubLink href="/settings/print"     label="إعدادات الطباعة"        icon={IC.invoice}   active={pathname.startsWith('/settings/print')} />
            </NavSection>
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid ' + C.border, background: C.headerBg, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '10px',
          background: C.borderLight, border: '1px solid ' + C.border, marginBottom: '8px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
            background: C.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: '0.9rem',
          }}>
            {currentUser?.name?.charAt(0) || '؟'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.textPrimary, fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name}
            </div>
            <div style={{ color: C.textMuted, fontSize: '0.7rem', marginTop: '1px' }}>
              {currentUser?.role}
            </div>
          </div>
        </div>

        <button onClick={() => { reset(); router.push('/login') }} style={{
          width: '100%', background: 'transparent', color: C.textSecondary,
          border: '1px solid ' + C.border, borderRadius: '8px', padding: '8px 12px',
          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fef2f2'; el.style.color = '#ef4444'; el.style.borderColor = '#fecaca' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = C.textSecondary; el.style.borderColor = C.border }}
        >
          <Icon d={IC.logout} size={15} />
          تسجيل الخروج
        </button>

        <div style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.65rem', marginTop: '8px' }}>
          وثيق v1.0
        </div>
      </div>
    </div>
  )
}
