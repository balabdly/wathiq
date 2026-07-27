import { supabase } from '@/lib/supabase'
import { statusForPhase } from '@/lib/sec-workflow'
import { updateProjectPmoPhase } from '@/lib/project-phase-history-service'
import { fetchBoqVersions, fetchProjectBoqCategoryCounts, projectHasActiveBoqLines, ensureReservationByNumber, formatSupabaseError } from '@/lib/pmc-service'
import { resolveMaterialReservationId } from '@/lib/planning-materials-warehouse'
import { computePlanningProgress, type PlanningProgress, type BoqCategoryCounts } from '@/lib/planning-progress'
import { buildTenantStoragePath } from '@/lib/storage-path'
import {
  applyBoqRevisionFallbackPatch,
  enrichPlanningBoqRevision,
  isMissingPlanningColumnError,
  type BoqRevisionSnapshotLine,
} from '@/lib/planning-boq-revision-fallback'

export type { BoqRevisionSnapshotLine } from '@/lib/planning-boq-revision-fallback'

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
  boq_revision_snapshot?: BoqRevisionSnapshotLine[] | null
  boq_revision_approval_file_path?: string | null
  boq_revision_approval_file_name?: string | null
  estimate_total_override?: number | null
  estimate_total_note?: string | null
  updated_at?: string | null
}


function resolveLineCategoryFromRow(line: { line_category?: string | null; notes?: string | null; material_id?: number | null }): 'MATERIAL' | 'WORK' {
  if (line.line_category === 'MATERIAL' || line.line_category === 'WORK') return line.line_category
  if (line.notes?.includes('line_category:MATERIAL')) return 'MATERIAL'
  if (line.material_id) return 'MATERIAL'
  return 'WORK'
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
  status?: string
  created_at?: string
  planning?: ProjectPlanning | null
  planningProgress?: PlanningProgress
}

const POST_PLANNING_PMO_PHASES = new Set(['3_EXEC', '4_MEASURE', '5_CLOSE'])
const LEGACY_PLANNING_STATUSES = new Set(['تحت التخطيط', 'قيد التخطيط', 'قيد التنفيذ'])

export type PlanningPageAccess = {
  allowed: boolean
  readOnly: boolean
  shouldEnsurePlanning: boolean
}

/** هل يمكن فتح صفحات تخطيط المشروع (مقاisesة، حجز، …) */
export function resolvePlanningPageAccess(
  project: { pmo_phase?: string | null; status?: string | null },
  planning: ProjectPlanning | null,
  hasBoqLines: boolean,
): PlanningPageAccess {
  const phase = project.pmo_phase ?? null
  if (phase === '1_RECEIPT') return { allowed: false, readOnly: false, shouldEnsurePlanning: false }
  if (phase === '2_PREP') {
    return { allowed: true, readOnly: false, shouldEnsurePlanning: !planning }
  }
  if (phase && POST_PLANNING_PMO_PHASES.has(phase)) {
    return { allowed: true, readOnly: true, shouldEnsurePlanning: false }
  }
  if (!planning && !hasBoqLines) {
    return { allowed: true, readOnly: false, shouldEnsurePlanning: true }
  }
  if (!phase && LEGACY_PLANNING_STATUSES.has(project.status || '')) {
    return { allowed: true, readOnly: false, shouldEnsurePlanning: !planning }
  }
  return { allowed: false, readOnly: false, shouldEnsurePlanning: false }
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

  const boqCountsMap = new Map<number, BoqCategoryCounts>()
  await Promise.all(ids.map(async id => {
    boqCountsMap.set(id, await fetchProjectBoqCategoryCounts(tenantId, id))
  }))

  return projects.map(p => ({
    ...p,
    planningProgress: computePlanningProgress(
      p.planning,
      costComplete.has(p.id) ? 1 : 0,
      0,
      boqCountsMap.get(p.id) || { materials: 0, works: 0 },
    ),
  }))
}

export async function fetchAllPlanningProjects(tenantId: string) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, created_at')
    .eq('tenant_id', tenantId)
    .eq('pmo_phase', '2_PREP')
    .order('created_at', { ascending: false })

  const list = projects || []
  const ids = list.map(p => p.id)

  let planningMap = new Map<number, ProjectPlanning>()
  if (ids.length > 0) {
    const { data: planningRows } = await supabase
      .from('project_planning')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('project_id', ids)
      .eq('planning_status', 'active')
    planningMap = new Map((planningRows || []).map(p => [p.project_id, p as ProjectPlanning]))
  }

  const basket = list
    .filter(p => planningMap.has(p.id))
    .map(p => ({ ...p, planning: planningMap.get(p.id) || null }))

  return {
    data: await attachPlanningProgress(tenantId, basket),
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

  if (existing) {
    await updateProjectPmoPhase(tenantId, projectId, '2_PREP')

    if (existing.planning_status !== 'active') {
      await supabase.from('project_planning').update({
        planning_status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId).eq('project_id', projectId)
    }
    return existing as ProjectPlanning
  }

  const { data, error } = await supabase.from('project_planning').insert({
    tenant_id: tenantId,
    project_id: projectId,
    planning_status: 'active',
    timeline_start: project?.start_date || null,
    timeline_end: project?.end_date || null,
  }).select('*').single()

  if (error) throw error

  await updateProjectPmoPhase(tenantId, projectId, '2_PREP')

  return data as ProjectPlanning
}

export async function fetchProjectPlanning(tenantId: string, projectId: number) {
  const [{ data: project, error: pErr }, { data: planning }] = await Promise.all([
    supabase.from('projects')
      .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, description')
      .eq('tenant_id', tenantId).eq('id', projectId).single(),
    supabase.from('project_planning').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
  ])
  if (pErr) throw pErr
  return {
    project,
    planning: enrichPlanningBoqRevision(planning as ProjectPlanning | null),
  }
}

export async function updateProjectPlanning(tenantId: string, projectId: number, payload: Partial<ProjectPlanning>) {
  const { data: existing } = await supabase.from('project_planning')
    .select('planning_status, id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing?.planning_status === 'closed' && payload.planning_status !== 'active') {
    throw new Error('التخطيط معتمد — للعرض فقط')
  }

  const patch = { ...payload, updated_at: new Date().toISOString() }

  if (!existing) {
    let { error } = await supabase.from('project_planning').insert({
      tenant_id: tenantId,
      project_id: projectId,
      planning_status: 'active',
      ...patch,
    })
    if (error && isMissingPlanningColumnError(error)) {
      const fallbackPatch = applyBoqRevisionFallbackPatch(patch)
      ;({ error } = await supabase.from('project_planning').insert({
        tenant_id: tenantId,
        project_id: projectId,
        planning_status: 'active',
        ...fallbackPatch,
      }))
    }
    if (error) throw error
    return
  }

  let { error } = await supabase.from('project_planning')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)

  if (error && isMissingPlanningColumnError(error)) {
    const fallbackPatch = applyBoqRevisionFallbackPatch(patch)
    ;({ error } = await supabase.from('project_planning')
      .update(fallbackPatch)
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId))
  }

  if (error) throw error
}

export async function closeProjectPlanning(tenantId: string, projectId: number) {
  const [{ data: planning }, { data: costRows }] = await Promise.all([
    supabase.from('project_planning').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
    supabase.from('project_planning_cost_items').select('planned_amount').eq('tenant_id', tenantId).eq('project_id', projectId),
  ])

  const costComplete = (costRows || []).some(r => Number(r.planned_amount) > 0)
  const hasBoq = await projectHasActiveBoqLines(tenantId, projectId)
  if (!hasBoq) {
    throw new Error('يجب حفظ المقايسة (مواد + أعمال) قبل اعتماد التخطيط')
  }

  const boqCounts = await fetchProjectBoqCategoryCounts(tenantId, projectId)

  const isRevision = !!(planning as ProjectPlanning | null)?.cost_plan_notes?.includes('[تعديل مقايسة]')

  if (isRevision && !(planning as ProjectPlanning)?.boq_revision_approval_file_path) {
    throw new Error('يجب إرفاق نموذج موافقة الكهرباء على تعديل المقايسة قبل الاعتماد')
  }

  const progress = computePlanningProgress(planning as ProjectPlanning | null, costComplete ? 1 : 0, 0, boqCounts)
  if (!progress.isComplete) {
    throw new Error(`يجب إكمال جميع أقسام التخطيط (${progress.completed}/${progress.total}) قبل الاعتماد`)
  }

  const closePatch: Partial<ProjectPlanning> = { planning_status: 'closed' }
  if (isRevision) {
    closePatch.boq_revision_snapshot = null
    closePatch.boq_revision_approval_file_path = null
    closePatch.boq_revision_approval_file_name = null
    const notes = (planning as ProjectPlanning)?.cost_plan_notes?.replace(/\[تعديل مقايسة\]\s*/g, '').trim()
    closePatch.cost_plan_notes = notes || null
  }

  await updateProjectPlanning(tenantId, projectId, closePatch)

  const { startProjectExecution } = await import('@/lib/project-execution-service')
  await startProjectExecution(tenantId, projectId)
}

/** إرجاع مشروع من التنفيذ إلى سلة التخطيط (تعديل مقايسة أو تصحيح) */
export async function reopenProjectPlanning(
  tenantId: string,
  projectId: number,
  options?: { preserveTeam?: boolean; reason?: string },
) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, pmo_phase')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()
  if (pErr) throw pErr
  if (project.pmo_phase !== '3_EXEC') {
    throw new Error('يمكن إرجاع مشاريع في مرحلة التنفيذ فقط')
  }

  const { data: planning } = await supabase
    .from('project_planning')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!planning) throw new Error('لا يوجد سجل تخطيط لهذا المشروع')

  const { updateProjectPmoPhase } = await import('@/lib/project-phase-history-service')
  const extra: Record<string, unknown> = {}
  if (!options?.preserveTeam) {
    extra.team_id = null
    extra.engineer = null
  }
  await updateProjectPmoPhase(tenantId, projectId, '2_PREP', extra)

  const planPatch: Record<string, unknown> = {
    planning_status: 'active',
    updated_at: new Date().toISOString(),
  }
  if (options?.reason?.trim()) {
    planPatch.cost_plan_notes = `[تعديل مقايسة] ${options.reason.trim()}`
  }

  if (options?.preserveTeam) {
    const { data: versions } = await fetchBoqVersions(tenantId, projectId)
    const active = (versions || []).find(v => v.status === 'ACTIVE')
      || (versions || []).find(v => v.version_type === 'INITIAL')
    if (active?.lines?.length) {
      planPatch.boq_revision_snapshot = active.lines.map(l => ({
        line_no: l.line_no,
        catalog_no: l.catalog_no,
        description: l.description,
        unit: l.unit,
        qty: Number(l.qty_planned),
        line_category: resolveLineCategoryFromRow(l),
      }))
    }
  }

  await updateProjectPlanning(tenantId, projectId, planPatch as Partial<ProjectPlanning>)
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
  const { data: planning } = await supabase.from('project_planning')
    .select('planning_status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (planning?.planning_status === 'closed') {
    throw new Error('التخطيط معتمد — للعرض فقط')
  }

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
  const { path, name } = buildTenantStoragePath(tenantId, [`planning`, String(projectId)], prefix, file)
  const { error } = await supabase.storage.from('project-attachments').upload(path, file, { upsert: true })
  if (error) throw error
  return { path, name }
}

export async function saveProjectMaterialReservation(
  tenantId: string,
  projectId: number,
  reservationNumber: string,
  options?: {
    reservationDate?: string | null
    clientName?: string | null
    reservationId?: number | null
  },
): Promise<number | null> {
  const no = reservationNumber.trim()
  if (!no) return null

  await ensureProjectPlanning(tenantId, projectId)

  let resId = options?.reservationId ?? null
  if (!resId) {
    const found = await resolveMaterialReservationId(tenantId, projectId, no)
    if (found) resId = found
    else {
      const { data: ensured, error } = await ensureReservationByNumber(
        tenantId,
        projectId,
        no,
        options?.clientName ?? undefined,
      )
      if (error || !ensured) throw new Error(formatSupabaseError(error, 'تعذّر إنشاء الحجز'))
      resId = ensured.id
    }
  }

  await updateProjectPlanning(tenantId, projectId, {
    material_reservation_date: options?.reservationDate || null,
    material_reservation_number: no,
    material_reservation_id: resId,
  })

  return resId
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
    body: `المشروع «${projectName}» — رقم الحجز: ${reservationNo}. يرجى تجهيز الشاحنة للاستلام.`,
    type: 'action',
    project_id: projectId,
  })
  if (error && error.code !== '42P01' && !error.message?.includes('notifications')) throw error
}
