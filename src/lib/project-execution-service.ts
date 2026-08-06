import { supabase } from '@/lib/supabase'
import { statusForPhase } from '@/lib/sec-workflow'
import { updateProjectPmoPhase } from '@/lib/project-phase-history-service'
import { fetchProjectBoqCategoryCounts } from '@/lib/pmc-service'
import { computePlanningProgress, type PlanningProgress } from '@/lib/planning-progress'
import type { ProjectPlanning } from '@/lib/project-planning-service'
import type { ProjectTeam, TeamProjectLog, ProjectTeamAssignment, TeamAssignmentStatus } from '@/lib/project-teams'

export type ExecutionProject = {
  id: number
  name: string
  code?: string
  client_name?: string
  type?: string
  start_date?: string
  end_date?: string
  estimated_value?: number
  pmo_phase?: string
  status?: string
  progress?: number
  team_id?: number | null
  engineer?: string | null
  team?: { id: number; name: string; team_type: string } | null
  planning?: ProjectPlanning | null
  planningProgress?: PlanningProgress
  logCount?: number
  lastLogDate?: string | null
  teamSequenceTotal?: number
  teamSequenceActive?: number | null
  teamSequenceCompleted?: number
}

export type ExecutionProjectDetail = ExecutionProject & {
  description?: string | null
  teamAssignments?: ProjectTeamAssignment[]
}

function isMissingAssignmentTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false
  return error.code === 'PGRST204'
    || error.code === '42P01'
    || error.message.includes('project_team_assignments')
    || error.message.includes('schema cache')
}

async function resolveTeamLead(teamId: number): Promise<{ leadName: string | null; leadId: number | null }> {
  const { data: team } = await supabase.from('teams').select('lead_id').eq('id', teamId).maybeSingle()
  if (!team?.lead_id) return { leadName: null, leadId: null }
  const { data: leadEmp } = await supabase.from('hr_employees').select('name').eq('id', team.lead_id).maybeSingle()
  return { leadName: leadEmp?.name || null, leadId: team.lead_id }
}

async function assignTeamDirectToProject(tenantId: string, projectId: number, teamId: number) {
  const { leadName, leadId } = await resolveTeamLead(teamId)
  const { error } = await supabase.from('projects').update({
    team_id: teamId,
    lead_id: leadId,
    engineer: leadName,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (error) throw error
}

function formatAssignmentError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: string }).message)
  return fallback
}

async function syncProjectFromActiveAssignment(tenantId: string, projectId: number) {
  const { data: active } = await supabase
    .from('project_team_assignments')
    .select('team_id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('status', 'active')
    .maybeSingle()

  if (!active?.team_id) {
    await supabase.from('projects').update({
      team_id: null,
      lead_id: null,
      engineer: null,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId).eq('tenant_id', tenantId)
    return
  }

  const { leadName, leadId } = await resolveTeamLead(active.team_id)
  await supabase.from('projects').update({
    team_id: active.team_id,
    lead_id: leadId,
    engineer: leadName,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
}

export async function fetchProjectTeamAssignments(
  tenantId: string,
  projectId: number,
  legacyTeamId?: number | null,
): Promise<ProjectTeamAssignment[]> {
  const { data, error } = await supabase
    .from('project_team_assignments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('sequence_order', { ascending: true })

  if (error) {
    if (isMissingAssignmentTableError(error)) return []
    throw error
  }

  let rows = data || []

  if (!rows.length && legacyTeamId) {
    const { error: insErr } = await supabase.from('project_team_assignments').insert({
      tenant_id: tenantId,
      project_id: projectId,
      team_id: legacyTeamId,
      sequence_order: 1,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    if (!insErr) {
      const { data: refreshed } = await supabase
        .from('project_team_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true })
      rows = refreshed || []
    }
  }

  const teamIds = Array.from(new Set(rows.map(r => r.team_id)))
  const { data: teams } = teamIds.length
    ? await supabase.from('teams').select('id, name, team_type, specialization').in('id', teamIds)
    : { data: [] }
  const teamMap = new Map((teams || []).map(t => [t.id, t]))

  return rows.map(r => ({
    ...r,
    status: r.status as TeamAssignmentStatus,
    team: teamMap.get(r.team_id) || undefined,
  })) as ProjectTeamAssignment[]
}

export async function assignExecutionTeam(
  tenantId: string,
  projectId: number,
  teamId: number | null,
  _leadName?: string | null,
  _leadId?: number | null,
) {
  if (!teamId) {
    await clearProjectTeamSequence(tenantId, projectId)
    return
  }

  const { error: insErr } = await supabase.from('project_team_assignments').insert({
    tenant_id: tenantId,
    project_id: projectId,
    team_id: teamId,
    sequence_order: 1,
    status: 'active',
    started_at: new Date().toISOString(),
  })

  if (insErr) {
    if (isMissingAssignmentTableError(insErr)) {
      await assignTeamDirectToProject(tenantId, projectId, teamId)
      return
    }
    throw insErr
  }

  await syncProjectFromActiveAssignment(tenantId, projectId)
}

/** إنهاء دور الفريق الحالي وإسناد المشروع لفريق تالي (ميداني ← كهربائي ...) */
export async function reassignExecutionTeam(
  tenantId: string,
  projectId: number,
  newTeamId: number,
  options?: { handoffNotes?: string; progressAtHandoff?: number },
) {
  if (!newTeamId) throw new Error('اختر الفريق التالي')

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('team_id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()
  if (pErr) throw pErr

  if (project.team_id === newTeamId) {
    throw new Error('هذا الفريق مسند للمشروع بالفعل')
  }

  const { error: probeErr } = await supabase.from('project_team_assignments').select('id').limit(1)
  if (probeErr && isMissingAssignmentTableError(probeErr)) {
    await assignTeamDirectToProject(tenantId, projectId, newTeamId)
    return
  }

  const now = new Date().toISOString()
  let assignments = await fetchProjectTeamAssignments(tenantId, projectId)
  const active = assignments.find(a => a.status === 'active')

  if (!assignments.length && project.team_id) {
    const { error: legacyErr } = await supabase.from('project_team_assignments').insert({
      tenant_id: tenantId,
      project_id: projectId,
      team_id: project.team_id,
      sequence_order: 1,
      status: 'completed',
      started_at: now,
      completed_at: now,
      progress_at_handoff: options?.progressAtHandoff ?? null,
      handoff_notes: options?.handoffNotes?.trim() || null,
    })
    if (legacyErr && !isMissingAssignmentTableError(legacyErr)) throw legacyErr
    if (!legacyErr) {
      assignments = await fetchProjectTeamAssignments(tenantId, projectId)
    }
  } else if (active) {
    const { error: completeErr } = await supabase.from('project_team_assignments').update({
      status: 'completed',
      completed_at: now,
      progress_at_handoff: options?.progressAtHandoff ?? null,
      handoff_notes: options?.handoffNotes?.trim() || null,
    }).eq('id', active.id).eq('tenant_id', tenantId)
    if (completeErr) throw completeErr
  }

  const maxOrder = assignments.reduce((m, a) => Math.max(m, a.sequence_order), 0)
  const { error: insErr } = await supabase.from('project_team_assignments').insert({
    tenant_id: tenantId,
    project_id: projectId,
    team_id: newTeamId,
    sequence_order: maxOrder + 1,
    status: 'active',
    started_at: now,
  })
  if (insErr) {
    if (isMissingAssignmentTableError(insErr)) {
      await assignTeamDirectToProject(tenantId, projectId, newTeamId)
      return
    }
    throw insErr
  }

  await syncProjectFromActiveAssignment(tenantId, projectId)
}

/** @deprecated استخدم reassignExecutionTeam */
export async function handoffExecutionTeam(
  tenantId: string,
  projectId: number,
  options?: { handoffNotes?: string; progressAtHandoff?: number },
) {
  const assignments = await fetchProjectTeamAssignments(tenantId, projectId)
  const next = assignments.find(a => a.status === 'pending')
  if (!next) throw new Error('اختر الفريق التالي من القائمة')
  await reassignExecutionTeam(tenantId, projectId, next.team_id, options)
}

/** @deprecated استخدم assignExecutionTeam أو reassignExecutionTeam */
export async function addTeamToSequence(tenantId: string, projectId: number, teamId: number) {
  const { data: project } = await supabase.from('projects').select('team_id').eq('id', projectId).eq('tenant_id', tenantId).single()
  if (project?.team_id) {
    await reassignExecutionTeam(tenantId, projectId, teamId)
    return
  }
  await assignExecutionTeam(tenantId, projectId, teamId)
}

export async function removePendingTeamAssignment(tenantId: string, assignmentId: number) {
  const { data: row, error: fetchErr } = await supabase
    .from('project_team_assignments')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('id', assignmentId)
    .single()
  if (fetchErr) throw fetchErr
  if (row.status !== 'pending') throw new Error('يمكن حذف الفرق بالانتظار فقط')

  const { error } = await supabase.from('project_team_assignments').delete().eq('id', assignmentId).eq('tenant_id', tenantId)
  if (error) throw error
}

export async function clearProjectTeamSequence(tenantId: string, projectId: number) {
  const { error: delErr } = await supabase
    .from('project_team_assignments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
  if (delErr && !isMissingAssignmentTableError(delErr)) throw delErr

  await supabase.from('projects').update({
    team_id: null,
    lead_id: null,
    engineer: null,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
}

export { formatAssignmentError }

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function startProjectExecution(tenantId: string, projectId: number) {
  await updateProjectPmoPhase(tenantId, projectId, '3_EXEC')
}

/** نقل من التنفيذ إلى الإغلاق (تخطي مرحلة المقايسة المنفصلة) */
export async function advanceProjectToClose(tenantId: string, projectId: number) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, pmo_phase, progress')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (pErr) throw pErr
  if (project.pmo_phase !== '3_EXEC') {
    throw new Error('يمكن نقل مشاريع في مرحلة التنفيذ فقط')
  }
  if ((project.progress ?? 0) < 100) {
    throw new Error('يجب أن تصل نسبة الإنجاز إلى 100% قبل الانتقال للإغلاق')
  }

  await updateProjectPmoPhase(tenantId, projectId, '5_CLOSE', { progress: 100 })

  const { ensureProjectClosure } = await import('@/lib/project-close-service')
  await ensureProjectClosure(tenantId, projectId)
}

export async function fetchExecutionProjects(tenantId: string, branchId?: number) {
  let query = supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, team_id, engineer, branch_id')
    .eq('tenant_id', tenantId)
    .eq('pmo_phase', '3_EXEC')
    .order('created_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: projects, error } = await query
  if (error) return { data: [] as ExecutionProject[], error }

  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return { data: [] as ExecutionProject[], error: null }

  const teamIds = Array.from(new Set((projects || []).map(p => p.team_id).filter(Boolean))) as number[]

  const [planningRes, costRes, logsRes, teamsRes, assignmentsRes] = await Promise.all([
    supabase.from('project_planning').select('*').eq('tenant_id', tenantId).in('project_id', ids),
    supabase.from('project_planning_cost_items').select('project_id, planned_amount').eq('tenant_id', tenantId).in('project_id', ids),
    supabase.from('team_project_logs').select('project_id, log_date, created_at').eq('tenant_id', tenantId).in('project_id', ids),
    teamIds.length
      ? supabase.from('teams').select('id, name, team_type').eq('tenant_id', tenantId).in('id', teamIds)
      : Promise.resolve({ data: [] }),
    supabase.from('project_team_assignments').select('project_id, sequence_order, status, team_id').eq('tenant_id', tenantId).in('project_id', ids).order('sequence_order'),
  ])

  const planningMap = new Map((planningRes.data || []).map(p => [p.project_id, p as ProjectPlanning]))
  const costComplete = new Set<number>()
  for (const row of costRes.data || []) {
    if (Number(row.planned_amount) > 0) costComplete.add(row.project_id)
  }
  const teamMap = new Map((teamsRes.data || []).map(t => [t.id, t]))
  const assignmentStats = new Map<number, { total: number; activeOrder: number | null; completed: number }>()
  if (!assignmentsRes.error) {
    for (const row of assignmentsRes.data || []) {
      const cur = assignmentStats.get(row.project_id) || { total: 0, activeOrder: null, completed: 0 }
      cur.total++
      if (row.status === 'active') cur.activeOrder = row.sequence_order
      if (row.status === 'completed') cur.completed++
      assignmentStats.set(row.project_id, cur)
    }
  }
  const logStats = new Map<number, { count: number; lastDate: string | null }>()
  for (const log of logsRes.data || []) {
    const cur = logStats.get(log.project_id) || { count: 0, lastDate: null }
    cur.count++
    const d = log.log_date || log.created_at?.slice(0, 10)
    if (d && (!cur.lastDate || d > cur.lastDate)) cur.lastDate = d
    logStats.set(log.project_id, cur)
  }

  const data: ExecutionProject[] = (projects || []).map(p => {
    const planning = planningMap.get(p.id) || null
    const stats = logStats.get(p.id)
    const team = p.team_id ? teamMap.get(p.team_id) || null : null
    const aStats = assignmentStats.get(p.id)
    return {
      ...p,
      planning,
      planningProgress: computePlanningProgress(planning, costComplete.has(p.id) ? 1 : 0),
      team,
      logCount: stats?.count || 0,
      lastLogDate: stats?.lastDate || null,
      teamSequenceTotal: aStats?.total || (p.team_id ? 1 : 0),
      teamSequenceActive: aStats?.activeOrder || (p.team_id ? 1 : null),
      teamSequenceCompleted: aStats?.completed || 0,
    }
  })

  return { data, error: null }
}

export async function fetchExecutionProject(tenantId: string, projectId: number) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, team_id, engineer, description, branch_id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (error) throw error
  if (project.pmo_phase !== '3_EXEC') {
    throw new Error('المشروع ليس في مرحلة التنفيذ')
  }

  const [{ data: planning }, { data: costRows }, { data: team }] = await Promise.all([
    supabase.from('project_planning').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
    supabase.from('project_planning_cost_items').select('project_id, planned_amount').eq('tenant_id', tenantId).eq('project_id', projectId),
    project.team_id
      ? supabase.from('teams').select('id, name, team_type, lead_id').eq('id', project.team_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const pl = planning as ProjectPlanning | null
  const teamAssignments = await fetchProjectTeamAssignments(tenantId, projectId, project.team_id)

  return {
    project: {
      ...project,
      planning: pl,
      planningProgress: computePlanningProgress(pl, (costRows || []).some(r => Number(r.planned_amount) > 0) ? 1 : 0),
      team: team || null,
      teamAssignments,
    } as ExecutionProjectDetail,
  }
}

export async function fetchActiveTeams(tenantId: string, branchId: number): Promise<ProjectTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data || []) as ProjectTeam[]
}

export async function fetchProjectDailyLogs(tenantId: string, projectId: number): Promise<TeamProjectLog[]> {
  const { data: logRows } = await supabase
    .from('team_project_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true })

  const rows = logRows || []
  const teamIds = Array.from(new Set(rows.map((l: TeamProjectLog) => l.team_id)))
  const { data: teams } = teamIds.length
    ? await supabase.from('teams').select('id, name, team_type, specialization').in('id', teamIds)
    : { data: [] }
  const teamMap = new Map((teams || []).map(t => [t.id, t]))

  const withFiles = await Promise.all(rows.map(async (log: TeamProjectLog) => {
    const { data: f } = await supabase.from('team_project_log_files').select('*').eq('log_id', log.id)
    const filesWithUrls = await Promise.all((f || []).map(async file => {
      const { data: urlData } = await supabase.storage.from('project-attachments').createSignedUrl(file.file_path, 3600)
      return { ...file, public_url: urlData?.signedUrl }
    }))
    return {
      ...log,
      files: filesWithUrls,
      team_name: teamMap.get(log.team_id)?.name,
      team_type: teamMap.get(log.team_id)?.team_type,
    }
  }))
  return withFiles
}

export async function updateProjectProgress(tenantId: string, projectId: number, progress: number) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)))
  const { error } = await supabase.from('projects').update({
    progress: pct,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (error) throw error
  return pct
}

export async function submitDailyLog(
  tenantId: string,
  projectId: number,
  teamId: number,
  authorName: string,
  authorId: number | null | undefined,
  notes: string,
  files: File[],
  /** نسبة إنجاز اليوم (زيادة) — ليس التراكمي */
  progressIncrement?: number | null,
) {
  const logDate = todayDateStr()
  let increment: number | null = null
  let newTotal: number | null = null

  if (progressIncrement != null && !Number.isNaN(progressIncrement)) {
    increment = Math.round(progressIncrement)
    if (increment <= 0) {
      throw new Error('نسبة إنجاز اليوم يجب أن تكون أكبر من صفر')
    }
    const { data: proj, error: pErr } = await supabase
      .from('projects')
      .select('progress')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .single()
    if (pErr) throw pErr
    const current = Math.round(Number(proj?.progress ?? 0))
    if (current + increment > 100) {
      throw new Error(`لا يمكن تجاوز 100% — المتبقي ${100 - current}% فقط`)
    }
    newTotal = current + increment
  }

  const { data: logRow, error } = await supabase.from('team_project_logs').insert({
    tenant_id: tenantId,
    team_id: teamId,
    project_id: projectId,
    author_id: authorId || null,
    author_name: authorName,
    notes: notes.trim() || null,
    log_date: logDate,
    progress_percent: increment,
  }).select('id').single()

  if (error || !logRow) throw error || new Error('فشل الحفظ')

  if (newTotal != null) {
    await updateProjectProgress(tenantId, projectId, newTotal)
  }

  for (const file of files) {
    const filePath = `${tenantId}/team-logs/${teamId}/${projectId}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('project-attachments').upload(filePath, file)
    if (upErr) continue
    await supabase.from('team_project_log_files').insert({
      tenant_id: tenantId,
      log_id: logRow.id,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    })
  }

  return logRow.id as number
}

export function formatTodayLabel(): string {
  return new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
