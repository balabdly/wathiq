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
import ActiveTeamsTab from './components/ActiveTeamsTab'
import FormationTab from './components/FormationTab'
import AssignedProjectsTab from './components/AssignedProjectsTab'
import WorkloadTab from './components/WorkloadTab'
import TeamTasksTab from './components/TeamTasksTab'

type TabId = 'active' | 'formation' | 'projects' | 'tasks' | 'workload'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'active',     label: 'الفرق النشطة',     icon: '⚡' },
  { id: 'formation',  label: 'تكوين الفرق',     icon: '🏗️' },
  { id: 'projects',   label: 'المشاريع المسندة', icon: '📋' },
  { id: 'tasks',      label: 'مهام الفريق',      icon: '✅' },
  { id: 'workload',   label: 'حمولة الفرق',     icon: '📊' },
]

const VALID_TABS = new Set<TabId>(['active', 'formation', 'projects', 'tasks', 'workload'])

export default function ProjectTeamsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { tenant, activeBranch, currentUser } = useStore()
  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const [tab, setTab] = useState<TabId>('active')
  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [members, setMembers] = useState<Record<number, TeamMember[]>>({})
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [employees, setEmployees] = useState<NormalizedHrEmployee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null
    if (t && VALID_TABS.has(t)) setTab(t)
  }, [searchParams])

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
    unassigned: projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي').length,
  }), [teams, projects])

  const pageData: TeamsPageData = {
    teams, members, projects, employees, loading, reload: loadAll,
    canEdit, tenantId: tenant!.id, branchId: activeBranch!.id,
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
          إدارة الفرق
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '4px' }}>
          {activeBranch.name} · {stats.activeTeams} فريق نشط · {stats.assigned} مشروع مسند
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '540px' }}>
        {[
          { label: 'فرق نشطة', value: stats.activeTeams, color: '#0ea77b' },
          { label: 'مشاريع مسندة', value: stats.assigned, color: '#1a56db' },
          { label: 'بانتظار الإسناد', value: stats.unassigned, color: stats.unassigned > 0 ? '#e6820a' : '#6b7280' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...TAB_STYLE.bar, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => selectTab(t.id)} style={TAB_STYLE.btn(tab === t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && tab !== 'workload' && tab !== 'tasks' ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : (
        <>
          {tab === 'active' && <ActiveTeamsTab data={pageData} />}
          {tab === 'formation' && <FormationTab data={pageData} />}
          {tab === 'projects' && <AssignedProjectsTab data={pageData} />}
          {tab === 'tasks' && <TeamTasksTab data={pageData} />}
          {tab === 'workload' && <WorkloadTab />}
        </>
      )}
    </div>
  )
}
