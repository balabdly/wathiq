/** أنواع مشتركة لصفحة إدارة الفرق */

import type { ProjectTeam, TeamMember } from '@/lib/project-teams'

export type HrEmployee = {
  id: number
  name?: string | null
  first_name?: string | null
  father_name?: string | null
  grandfather_name?: string | null
  family_name?: string | null
  job_title?: string
  department?: string
}

/** الاسم الكامل — يستخدم name أو يُركّب من أجزاء الاسم في HR */
export function getHrEmployeeName(e: Pick<HrEmployee, 'name' | 'first_name' | 'father_name' | 'grandfather_name' | 'family_name'>): string {
  if (e.name?.trim()) return e.name.trim()
  const built = [e.first_name, e.father_name, e.grandfather_name, e.family_name].filter(Boolean).join(' ').trim()
  return built || '—'
}

export function normalizeHrEmployee(e: HrEmployee): HrEmployee {
  return { ...e, name: getHrEmployeeName(e) }
}

export type ProjectRow = {
  id: number
  name: string
  code?: string
  status?: string
  progress?: number
  engineer?: string
  team_id?: number | null
  end_date?: string
}

export type TeamsPageData = {
  teams: ProjectTeam[]
  members: Record<number, TeamMember[]>
  projects: ProjectRow[]
  employees: HrEmployee[]
  loading: boolean
  reload: () => Promise<void>
  canEdit: boolean
  tenantId: string
  branchId: number
  branchName?: string
  currentUserName: string
  currentUserEmployeeId?: number
}

export const TAB_STYLE = {
  bar: {
    display: 'flex' as const,
    gap: '4px',
    padding: '4px',
    background: '#f3f4f6',
    borderRadius: '12px',
    width: 'fit-content' as const,
    flexWrap: 'wrap' as const,
  },
  btn: (active: boolean) => ({
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none' as const,
    cursor: 'pointer' as const,
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    background: active ? 'white' : 'transparent',
    color: active ? '#1a56db' : '#6b7280',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
  }),
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
