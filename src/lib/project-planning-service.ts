import { supabase } from '@/lib/supabase'
import { statusForPhase } from '@/lib/sec-workflow'
import { SEC_PMO_PHASES } from '@/lib/project-phase-display'
import { computePlanningProgress, type PlanningProgress } from '@/lib/planning-progress'

export type MaterialAvailability = 'pending' | 'available' | 'not_available'
export type MaterialReceiptType = 'full' | 'partial'

export type ProjectPlanning = {
  id: number
  tenant_id: string
  project_id: number
  planning_status: 'active' | 'closed'
  material_reservation_date?: string | null
  material_reservation_number?: string | null
  material_reservation_id?: number | null
  material_availability?: MaterialAvailability | null
  material_pickup_notified_at?: string | null
  materials_list_file_path?: string | null
  materials_list_file_name?: string | null
  material_receipt_type?: MaterialReceiptType | null
  material_receipt_notes?: string | null
  material_delay_client_caused?: boolean | null
  material_delay_revised_end?: string | null
  permit_number?: string | null
  permit_start?: string | null
  permit_end?: string | null
  permit_file_path?: string | null
  permit_file_name?: string | null
  work_completion_number?: string | null
  work_completion_file_path?: string | null
  work_completion_file_name?: string | null
  clearance_number?: string | null
  clearance_file_path?: string | null
  clearance_file_name?: string | null
  timeline_start?: string | null
  timeline_end?: string | null
  timeline_revised_end?: string | null
  timeline_revision_reason?: string | null
  safe_work_content?: string | null
  safe_work_file_path?: string | null
  safe_work_file_name?: string | null
  safe_work_template_id?: number | null
  safe_work_steps?: { step: number; text: string }[] | null
  risks_assessment_content?: string | null
  quality_plan_content?: string | null
  quality_plan_file_path?: string | null
  quality_plan_file_name?: string | null
  cost_plan_notes?: string | null
  updated_at?: string | null
}

export type PlanningCostItem = {
  id?: number
  tenant_id?: string
  project_id: number
  item_name: string
  category?: string | null
  planned_amount: number
  actual_amount?: number
  notes?: string | null
  sort_order?: number
}

export type PlanningProject = {
  id: number
  name: string
  code?: string
  client_name?: string
  type?: string
  start_date?: string
  end_date?: string
  estimated_value?: number
  pmo_phase?: string
  created_at?: string
  planning?: ProjectPlanning | null
  planningProgress?: PlanningProgress
}

async function attachPlanningProgress(tenantId: string, projects: PlanningProject[]): Promise<PlanningProject[]> {
  const ids = projects.map(p => p.id)
  if (!ids.length) return projects

  const { data: costRows } = await supabase
    .from('project_planning_cost_items')
    .select('project_id, planned_amount')
    .eq('tenant_id', tenantId)
    .in('project_id', ids)

  const costComplete = new Set<number>()
  for (const row of costRows || []) {
    if (Number(row.planned_amount) > 0) costComplete.add(row.project_id)
  }

  return projects.map(p => ({
    ...p,
    planningProgress: computePlanningProgress(p.planning, costComplete.has(p.id) ? 1 : 0),
  }))
}

export async function fetchAllPlanningProjects(tenantId: string) {
  const { data: planningRows } = await supabase
    .from('project_planning')
    .select('*')
    .eq('tenant_id', tenantId)

  const planningMap = new Map((planningRows || []).map(p => [p.project_id, p as ProjectPlanning]))
  const idsFromPlanning = Array.from(planningMap.keys())

  const phases = [...SEC_PMO_PHASES]

  const [byPhaseRes, byPlanningRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, created_at')
      .eq('tenant_id', tenantId)
      .in('pmo_phase', phases)
      .order('created_at', { ascending: false }),
    idsFromPlanning.length
      ? supabase
          .from('projects')
          .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, created_at')
          .eq('tenant_id', tenantId)
          .in('id', idsFromPlanning)
      : Promise.resolve({ data: [], error: null }),
  ])

  const merged = new Map<number, PlanningProject>()
  for (const p of [...(byPhaseRes.data || []), ...(byPlanningRes.data || [])]) {
    merged.set(p.id, { ...p, planning: planningMap.get(p.id) || null })
  }

  const sorted = Array.from(merged.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })

  return {
    data: await attachPlanningProgress(tenantId, sorted),
    error: byPhaseRes.error || byPlanningRes.error,
  }
}

/** @deprecated استخدم fetchAllPlanningProjects */
export async function fetchPlanningProjects(tenantId: string, status: 'active' | 'closed') {
  const { data: planningRows } = await supabase
    .from('project_planning')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('planning_status', status)

  const planningMap = new Map((planningRows || []).map(p => [p.project_id, p as ProjectPlanning]))
  const planningIds = Array.from(planningMap.keys())

  if (status === 'closed') {
    if (!planningIds.length) return { data: [] as PlanningProject[], error: null }
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase')
      .eq('tenant_id', tenantId)
      .in('id', planningIds)
      .order('created_at', { ascending: false })
    return {
      data: await attachPlanningProgress(tenantId, (data || []).map(p => ({ ...p, planning: planningMap.get(p.id) || null }))),
      error,
    }
  }

  // active: all initiation projects (1_RECEIPT) + those in planning (2_PREP)
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase')
    .eq('tenant_id', tenantId)
    .in('pmo_phase', ['1_RECEIPT', '2_PREP'])
    .order('created_at', { ascending: false })

  const active = (projects || []).filter(p => {
    const pl = planningMap.get(p.id)
    return !pl || pl.planning_status === 'active'
  })

  return {
    data: await attachPlanningProgress(tenantId, active.map(p => ({ ...p, planning: planningMap.get(p.id) || null }))),
    error,
  }
}

export async function ensureProjectPlanning(tenantId: string, projectId: number, project?: { start_date?: string; end_date?: string }) {
  const { data: existing } = await supabase
    .from('project_planning')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) return existing as ProjectPlanning

  const { data, error } = await supabase.from('project_planning').insert({
    tenant_id: tenantId,
    project_id: projectId,
    planning_status: 'active',
    timeline_start: project?.start_date || null,
    timeline_end: project?.end_date || null,
  }).select('*').single()

  if (error) throw error

  await supabase.from('projects').update({
    pmo_phase: '2_PREP',
    status: statusForPhase('2_PREP'),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)

  return data as ProjectPlanning
}

export async function fetchProjectPlanning(tenantId: string, projectId: number) {
  const [{ data: project, error: pErr }, { data: planning }] = await Promise.all([
    supabase.from('projects')
      .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, description')
      .eq('tenant_id', tenantId).eq('id', projectId).single(),
    supabase.from('project_planning').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
  ])
  if (pErr) throw pErr
  return { project, planning: planning as ProjectPlanning | null }
}

export async function updateProjectPlanning(tenantId: string, projectId: number, payload: Partial<ProjectPlanning>) {
  const { error } = await supabase.from('project_planning')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
  if (error) throw error
}

export async function closeProjectPlanning(tenantId: string, projectId: number) {
  await updateProjectPlanning(tenantId, projectId, { planning_status: 'closed' })
  const { startProjectExecution } = await import('@/lib/project-execution-service')
  await startProjectExecution(tenantId, projectId)
}

export async function fetchCostItems(tenantId: string, projectId: number) {
  const { data, error } = await supabase.from('project_planning_cost_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('sort_order')
  return { data: (data || []) as PlanningCostItem[], error }
}

export async function saveCostItems(tenantId: string, projectId: number, items: PlanningCostItem[]) {
  await supabase.from('project_planning_cost_items').delete().eq('tenant_id', tenantId).eq('project_id', projectId)
  if (!items.length) return
  const rows = items.map((item, i) => ({
    tenant_id: tenantId,
    project_id: projectId,
    item_name: item.item_name,
    category: item.category || null,
    planned_amount: item.planned_amount,
    actual_amount: item.actual_amount || 0,
    notes: item.notes || null,
    sort_order: i,
  }))
  const { error } = await supabase.from('project_planning_cost_items').insert(rows)
  if (error) throw error
}

export async function uploadPlanningFile(tenantId: string, projectId: number, file: File, prefix: string) {
  const path = `${tenantId}/planning/${projectId}/${prefix}_${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('project-attachments').upload(path, file)
  if (error) throw error
  return { path, name: file.name }
}

export async function notifyWarehouseMaterialPickup(
  tenantId: string,
  projectId: number,
  projectName: string,
  reservationNo: string,
) {
  const { error } = await supabase.from('notifications').insert({
    tenant_id: tenantId,
    for_role: 'inventory',
    title: 'طلب إرسال شاحنة لاستلام المواد',
    body: `المشروع «${projectName}» — رقم الحجز: ${reservationNo}. المواد متوفرة — يرجى تجهيز الشاحنة للاستلام.`,
    type: 'action',
    project_id: projectId,
  })
  if (error) throw error
}
