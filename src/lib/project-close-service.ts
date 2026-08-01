import { supabase } from '@/lib/supabase'
import { buildTenantStoragePath } from '@/lib/storage-path'
import { computeClosureProgress, type ClosureProgress } from '@/lib/closure-progress'
import { getMissingClosureDocs } from '@/lib/project-tasks'
import { isTaskOpen } from '@/lib/project-tasks'
import { statusForPhase } from '@/lib/sec-workflow'
import { updateProjectPmoPhase } from '@/lib/project-phase-history-service'
import type { BillingModel } from '@/lib/sec-workflow'

export type ProjectClosure = {
  id: number
  tenant_id: string
  project_id: number
  closure_status: 'active' | 'closed'
  final_boq_confirmed?: boolean | null
  client_handover_date?: string | null
  client_handover_notes?: string | null
  as_built_drawings_confirmed?: boolean | null
  assets_handover_date?: string | null
  gis_mapping_date?: string | null
  completion_certificate_date?: string | null
  completion_certificate_file_path?: string | null
  completion_certificate_file_name?: string | null
  partial_invoice_number?: string | null
  partial_invoice_date?: string | null
  partial_invoice_amount?: number | null
  partial_invoice_file_path?: string | null
  partial_invoice_file_name?: string | null
  partial_invoice_skipped?: boolean | null
  final_invoice_number?: string | null
  final_invoice_date?: string | null
  final_invoice_amount?: number | null
  final_invoice_file_path?: string | null
  final_invoice_file_name?: string | null
  lessons_learned?: string | null
  closure_notes?: string | null
  work_completion_number?: string | null
  work_completion_date?: string | null
  work_completion_file_path?: string | null
  work_completion_file_name?: string | null
  clearance_number?: string | null
  clearance_date?: string | null
  clearance_file_path?: string | null
  clearance_file_name?: string | null
  closed_at?: string | null
  updated_at?: string | null
}

export type ClosureBlockers = {
  /** تحذيرات وثائق — لا تمنع الإغلاق */
  missingDocs: string[]
  openTasks: number
  openNcr: number
}

export function hasClosureHardBlockers(blockers?: ClosureBlockers | null): boolean {
  if (!blockers) return false
  return blockers.openTasks > 0 || blockers.openNcr > 0
}

export type CloseProject = {
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
  billing_model?: BillingModel | null
  closure?: ProjectClosure | null
  closureProgress?: ClosureProgress
  blockers?: ClosureBlockers
}

export type CloseProjectDetail = CloseProject & {
  description?: string | null
}

export async function fetchClosureBlockers(tenantId: string, projectId: number): Promise<ClosureBlockers> {
  const [{ data: attachments }, { data: allTasks }, { data: openNCR }] = await Promise.all([
    supabase.from('project_attachments').select('category').eq('project_id', projectId).eq('tenant_id', tenantId),
    supabase.from('project_tasks').select('status').eq('project_id', projectId).eq('tenant_id', tenantId),
    supabase.from('visits').select('id').eq('project_id', projectId).eq('tenant_id', tenantId)
      .eq('specs', 'غير مطابق').is('resolved_report', null),
  ])

  const uploadedCategories = (attachments || []).map((a: { category: string }) => a.category)
  return {
    missingDocs: getMissingClosureDocs(uploadedCategories),
    openTasks: (allTasks || []).filter(t => isTaskOpen(t.status)).length,
    openNcr: openNCR?.length || 0,
  }
}

async function attachClosureProgress(
  tenantId: string,
  projects: CloseProject[],
): Promise<CloseProject[]> {
  return Promise.all(projects.map(async p => {
    const blockers = await fetchClosureBlockers(tenantId, p.id)
    return {
      ...p,
      blockers,
      closureProgress: computeClosureProgress(p.closure, {
        tasksComplete: blockers.openTasks === 0,
        ncrClear: blockers.openNcr === 0,
      }),
    }
  }))
}

export async function fetchCloseProjects(tenantId: string, branchId?: number) {
  let query = supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, billing_model, branch_id')
    .eq('tenant_id', tenantId)
    .in('pmo_phase', ['4_MEASURE', '5_CLOSE'])
    .neq('status', 'مكتمل')
    .order('updated_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: projects, error } = await query
  if (error) return { data: [] as CloseProject[], error }

  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return { data: [] as CloseProject[], error: null }

  const { data: closureRows } = await supabase
    .from('project_closure')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('project_id', ids)

  const closureMap = new Map((closureRows || []).map(c => [c.project_id, c as ProjectClosure]))
  const basket: CloseProject[] = (projects || []).map(p => ({
    ...p,
    closure: closureMap.get(p.id) || null,
  }))

  return { data: await attachClosureProgress(tenantId, basket), error: null }
}

export async function ensureProjectClosure(tenantId: string, projectId: number) {
  const { data: existing } = await supabase
    .from('project_closure')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) {
    if (existing.closure_status !== 'active') {
      await supabase.from('project_closure').update({
        closure_status: 'active',
        closed_at: null,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId).eq('project_id', projectId)
    }
    return existing as ProjectClosure
  }

  const { data, error } = await supabase.from('project_closure').insert({
    tenant_id: tenantId,
    project_id: projectId,
    closure_status: 'active',
  }).select('*').single()

  if (error) throw error
  return data as ProjectClosure
}

/** نقل بيانات إتمام الأعمال/إخلاء الطرف من التخطيط (مرة واحدة) */
async function syncLegacyMunicipalFromPlanning(
  tenantId: string,
  projectId: number,
  closure: ProjectClosure,
): Promise<ProjectClosure> {
  const needsWork = !closure.work_completion_date && !closure.work_completion_number
  const needsClearance = !closure.clearance_date && !closure.clearance_number
  if (!needsWork && !needsClearance) return closure

  const { data: planning } = await supabase
    .from('project_planning')
    .select('work_completion_number, work_completion_file_path, work_completion_file_name, clearance_number, clearance_file_path, clearance_file_name')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!planning) return closure

  const patch: Partial<ProjectClosure> = {}
  if (needsWork && (planning.work_completion_number || planning.work_completion_file_path)) {
    patch.work_completion_number = planning.work_completion_number
    patch.work_completion_file_path = planning.work_completion_file_path
    patch.work_completion_file_name = planning.work_completion_file_name
    if (planning.work_completion_number) patch.work_completion_date = new Date().toISOString().slice(0, 10)
  }
  if (needsClearance && (planning.clearance_number || planning.clearance_file_path)) {
    patch.clearance_number = planning.clearance_number
    patch.clearance_file_path = planning.clearance_file_path
    patch.clearance_file_name = planning.clearance_file_name
    if (planning.clearance_number) patch.clearance_date = new Date().toISOString().slice(0, 10)
  }
  if (!Object.keys(patch).length) return closure

  await updateProjectClosure(tenantId, projectId, patch)
  return { ...closure, ...patch }
}

export async function fetchCloseProject(tenantId: string, projectId: number) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, billing_model, description, branch_id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (error) throw error
  if (!['4_MEASURE', '5_CLOSE'].includes(project.pmo_phase || '')) {
    throw new Error('المشروع ليس في مرحلة الإغلاق')
  }

  if (project.pmo_phase === '4_MEASURE') {
    await updateProjectPmoPhase(tenantId, projectId, '5_CLOSE')
    project.pmo_phase = '5_CLOSE'
    project.status = statusForPhase('5_CLOSE')
  }

  let closure = await ensureProjectClosure(tenantId, projectId)
  closure = await syncLegacyMunicipalFromPlanning(tenantId, projectId, closure)
  const blockers = await fetchClosureBlockers(tenantId, projectId)

  return {
    project: {
      ...project,
      closure,
      blockers,
      closureProgress: computeClosureProgress(closure, {
        tasksComplete: blockers.openTasks === 0,
        ncrClear: blockers.openNcr === 0,
      }),
    } as CloseProjectDetail,
  }
}

export async function updateProjectClosure(
  tenantId: string,
  projectId: number,
  patch: Partial<Omit<ProjectClosure, 'id' | 'tenant_id' | 'project_id'>>,
) {
  const { data: row } = await supabase
    .from('project_closure')
    .select('closure_status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (row?.closure_status === 'closed') {
    throw new Error('المشروع مُغلق — للعرض فقط')
  }

  await ensureProjectClosure(tenantId, projectId)
  const { error } = await supabase.from('project_closure').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('project_id', projectId)

  if (error) throw error
}

export async function approveProjectClosure(tenantId: string, projectId: number) {
  const { project } = await fetchCloseProject(tenantId, projectId)
  if (!project.closureProgress?.isComplete) {
    throw new Error(`يجب إكمال جميع بنود الإغلاق (${project.closureProgress?.completed}/${project.closureProgress?.total})`)
  }

  const blockers: string[] = []
  if ((project.blockers?.openTasks || 0) > 0) {
    blockers.push(`${project.blockers!.openTasks} مهمة مفتوحة`)
  }
  if ((project.blockers?.openNcr || 0) > 0) {
    blockers.push(`${project.blockers!.openNcr} NCR مفتوحة`)
  }
  if (blockers.length) {
    throw new Error(blockers.join(' — '))
  }

  const now = new Date().toISOString()
  await updateProjectClosure(tenantId, projectId, {
    closure_status: 'closed',
    closed_at: now,
  })

  await updateProjectPmoPhase(tenantId, projectId, '5_CLOSE', { status: 'مكتمل', progress: 100 })
}

/** إرجاع من الإغلاق إلى التنفيذ */
export async function reopenProjectToExecution(tenantId: string, projectId: number) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, pmo_phase, status')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (pErr) throw pErr
  if (!['4_MEASURE', '5_CLOSE'].includes(project.pmo_phase || '') || project.status === 'مكتمل') {
    throw new Error('يمكن إرجاع مشاريع في مرحلة الإغلاق (غير المكتملة) فقط')
  }

  await updateProjectPmoPhase(tenantId, projectId, '3_EXEC')

  await supabase.from('project_closure').update({
    closure_status: 'active',
    closed_at: null,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('project_id', projectId)
}

/** @deprecated استخدم reopenProjectToExecution */
export async function reopenProjectToMeasure(tenantId: string, projectId: number) {
  return reopenProjectToExecution(tenantId, projectId)
}

export async function uploadClosureFile(tenantId: string, projectId: number, file: File, prefix: string) {
  const { path, name } = buildTenantStoragePath(tenantId, [`closure`, String(projectId)], prefix, file)
  const { error } = await supabase.storage.from('project-attachments').upload(path, file, { upsert: true })
  if (error) throw error
  return { path, name }
}
