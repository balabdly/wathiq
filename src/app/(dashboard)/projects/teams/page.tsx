'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import type { ProjectTeam, TeamMember } from '@/lib/project-teams'
import type { HrEmployee, ProjectRow, TeamsPageData, NormalizedHrEmployee } from './components/types'
import { normalizeHrEmployee, toMemberEmployee } from './components/types'
import { TAB_STYLE } from './components/types'
import TeamsTab from './components/TeamsTab'
import WorkloadTab from './components/WorkloadTab'
import TeamTasksTab from './components/TeamTasksTab'

type TabId = 'teams' | 'tasks' | 'workload'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'teams',    label: 'الفرق',           icon: '⚡' },
  { id: 'tasks',    label: 'المهام',          icon: '✅' },
  { id: 'workload', label: 'حمولة الفرق',    icon: '📊' },
]

const VALID_TABS = new Set<TabId>(['teams', 'tasks', 'workload'])

/** تبويبات قديمة → الجديدة */
const LEGACY_TAB: Record<string, TabId> = {
  active: 'teams',
  formation: 'teams',
  projects: 'tasks',
}

export default function ProjectTeamsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { tenant, activeBranch, currentUser } = useStore()
  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))
  const canDelete = currentUser?.role === 'مدير عام'

  const [tab, setTab] = useState<TabId>('teams')
  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [members, setMembers] = useState<Record<number, TeamMember[]>>({})
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [employees, setEmployees] = useState<NormalizedHrEmployee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = searchParams.get('tab')
    if (!raw) return
    const mapped = LEGACY_TAB[raw] || (raw as TabId)
    if (VALID_TABS.has(mapped)) {
      setTab(mapped)
      if (raw !== mapped) {
        router.replace(`/projects/teams?tab=${mapped}`, { scroll: false })
      }
    }
  }, [searchParams, router])

  function selectTab(id: TabId) {
    setTab(id)
    router.replace(`/projects/teams?tab=${id}`, { scroll: false })
  }

  const loadAll = useCallback(async () => {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [teamsRes, projRes, empRes, membersRes] = await Promise.all([
      supabase.from('teams').select('*').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('name'),
      supabase.from('projects')
        .select('id, name, code, status, progress, engineer, team_id, end_date')
        .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('name'),
      supabase.from('hr_employees')
        .select('id, name, first_name, father_name, grandfather_name, family_name, job_title, department')
        .eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('team_members').select('*').eq('tenant_id', tenant.id).eq('is_active', true),
    ])

    const projList = projRes.data || []
    const empList = (empRes.data || []).map((e: HrEmployee) => normalizeHrEmployee(e))
    const empMap = Object.fromEntries(empList.map(e => [e.id, e])) as Record<number, NormalizedHrEmployee>
    const memberRows: TeamMember[] = (membersRes.data || []).map((m: TeamMember) => {
      const emp = empMap[m.employee_id]
      return emp ? { ...m, employee: toMemberEmployee(emp) } : m
    })
    const membersByTeam: Record<number, TeamMember[]> = {}
    memberRows.forEach((m: TeamMember) => {
      if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
      membersByTeam[m.team_id].push(m)
    })

    const teamsWithCounts = (teamsRes.data || []).map((t: ProjectTeam) => {
      const leadEmp = t.lead_id ? empMap[t.lead_id] : null
      return {
        ...t,
        lead: leadEmp ? { id: leadEmp.id, name: leadEmp.name, job_title: leadEmp.job_title } : null,
        member_count: (membersByTeam[t.id] || []).length,
        project_count: projList.filter((p: ProjectRow) => p.team_id === t.id).length,
      }
    })

    setTeams(teamsWithCounts)
    setMembers(membersByTeam)
    setProjects(projList)
    setEmployees(empList)
    setLoading(false)
  }, [tenant?.id, activeBranch?.id])

  useEffect(() => { loadAll() }, [loadAll])

  const stats = useMemo(() => ({
    activeTeams: teams.filter(t => t.is_active).length,
    assigned: projects.filter(p => p.team_id).length,
  }), [teams, projects])

  const pageData: TeamsPageData = {
    teams, members, projects, employees, loading, reload: loadAll,
    canEdit, canDelete, tenantId: tenant!.id, branchId: activeBranch!.id,
    branchName: activeBranch?.name,
    currentUserName: currentUser?.name || 'مستخدم',
    currentUserEmployeeId: currentUser?.hr_employee_id,
  }

  if (!tenant || !activeBranch) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>اختر فرعاً</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Users style={{ width: '24px', height: '24px', color: '#1a56db' }} />
          إدارة الفريق والمهام
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '4px' }}>
          {activeBranch.name} · {stats.activeTeams} فريق نشط · {stats.assigned} مشروع مسند
        </p>
      </div>

      <div style={{ ...TAB_STYLE.bar, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => selectTab(t.id)} style={TAB_STYLE.btn(tab === t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && tab === 'teams' ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : (
        <>
          {tab === 'teams' && <TeamsTab data={pageData} />}
          {tab === 'tasks' && <TeamTasksTab data={pageData} />}
          {tab === 'workload' && <WorkloadTab />}
        </>
      )}
    </div>
  )
}
