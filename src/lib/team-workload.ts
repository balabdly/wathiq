/** حمولة الفرق — مشاريع نشطة، مهام، NCR */

import { isTaskOpen } from '@/lib/project-tasks'
import { formatTeamTypeLabel } from '@/lib/project-teams'

export type TeamWorkloadRow = {
  team_id: number
  team_name: string
  team_type: string
  specialization?: string | null
  lead_name?: string
  member_count: number
  active_projects: number
  open_tasks: number
  open_ncr: number
}

const CLOSED_STATUSES = new Set(['مكتمل', 'ملغي'])

function isActiveProject(status: string | undefined): boolean {
  if (!status) return true
  return !CLOSED_STATUSES.has(status)
}

export async function fetchTeamWorkload(
  supabase: { from: (t: string) => any },
  tenantId: string,
  branchId: number,
): Promise<TeamWorkloadRow[]> {
  const [teamsRes, projectsRes, tasksRes, ncrRes, membersRes] = await Promise.all([
    supabase.from('teams')
      .select('id, name, team_type, specialization, lead_id, lead:hr_employees(name)')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name'),
    supabase.from('projects')
      .select('id, team_id, status')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId),
    supabase.from('project_tasks')
      .select('project_id, status')
      .eq('tenant_id', tenantId),
    supabase.from('visits')
      .select('project_id')
      .eq('tenant_id', tenantId)
      .eq('specs', 'غير مطابق')
      .is('resolved_report', null),
    supabase.from('team_members')
      .select('team_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
  ])

  const teams = teamsRes.data || []
  const projects = (projectsRes.data || []) as { id: number; team_id?: number | null; status: string }[]
  const branchProjectIds = new Set(projects.map(p => p.id))
  const projectTeamMap = Object.fromEntries(projects.map(p => [p.id, p.team_id]))

  const memberCount: Record<number, number> = {}
  ;(membersRes.data || []).forEach((m: { team_id: number }) => {
    memberCount[m.team_id] = (memberCount[m.team_id] || 0) + 1
  })

  const tasksByTeam: Record<number, number> = {}
  ;(tasksRes.data || []).forEach((t: { project_id: number; status: string }) => {
    if (!branchProjectIds.has(t.project_id) || !isTaskOpen(t.status)) return
    const tid = projectTeamMap[t.project_id]
    if (!tid) return
    tasksByTeam[tid] = (tasksByTeam[tid] || 0) + 1
  })

  const ncrByTeam: Record<number, number> = {}
  ;(ncrRes.data || []).forEach((v: { project_id: number }) => {
    if (!branchProjectIds.has(v.project_id)) return
    const tid = projectTeamMap[v.project_id]
    if (!tid) return
    ncrByTeam[tid] = (ncrByTeam[tid] || 0) + 1
  })

  const activeByTeam: Record<number, number> = {}
  projects.filter(p => isActiveProject(p.status)).forEach(p => {
    if (!p.team_id) return
    activeByTeam[p.team_id] = (activeByTeam[p.team_id] || 0) + 1
  })

  return teams.map((t: { id: number; name: string; team_type: string; specialization?: string | null; lead?: { name: string } | null }) => ({
    team_id: t.id,
    team_name: t.name,
    team_type: formatTeamTypeLabel(t),
    specialization: t.specialization,
    lead_name: t.lead?.name,
    member_count: memberCount[t.id] || 0,
    active_projects: activeByTeam[t.id] || 0,
    open_tasks: tasksByTeam[t.id] || 0,
    open_ncr: ncrByTeam[t.id] || 0,
  }))
}

export function countUnassignedActiveProjects(
  projects: { team_id?: number | null; status: string }[],
): number {
  return projects.filter(p => !p.team_id && isActiveProject(p.status)).length
}
