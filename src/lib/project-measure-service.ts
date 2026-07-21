import { supabase } from '@/lib/supabase'
import { fetchBoqVersions } from '@/lib/pmc-service'
import { computeMeasureProgress, type MeasureProgress } from '@/lib/measure-progress'
import { statusForPhase } from '@/lib/sec-workflow'
import type { BillingModel } from '@/lib/sec-workflow'

export type ProjectMeasure = {
  id: number
  tenant_id: string
  project_id: number
  measure_status: 'active' | 'closed'
  execution_confirmed?: boolean | null
  as_built_confirmed?: boolean | null
  material_reconciled?: boolean | null
  material_reconciliation_notes?: string | null
  variance_reviewed?: boolean | null
  interim_invoice_number?: string | null
  interim_invoice_date?: string | null
  interim_invoice_amount?: number | null
  interim_invoice_file_path?: string | null
  interim_invoice_file_name?: string | null
  measure_notes?: string | null
  updated_at?: string | null
}

export type MeasureProject = {
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
  measure?: ProjectMeasure | null
  measureProgress?: MeasureProgress
}

export type MeasureProjectDetail = MeasureProject & {
  description?: string | null
  hasAsBuiltBoq?: boolean
}

async function hasActiveAsBuiltBoq(tenantId: string, projectId: number): Promise<boolean> {
  const { data } = await fetchBoqVersions(tenantId, projectId)
  return (data || []).some(v => v.version_type === 'AS_BUILT' && v.status === 'ACTIVE')
}

async function attachMeasureProgress(
  tenantId: string,
  projects: MeasureProject[],
): Promise<MeasureProject[]> {
  return Promise.all(projects.map(async p => {
    const hasBoq = await hasActiveAsBuiltBoq(tenantId, p.id)
    return {
      ...p,
      measureProgress: computeMeasureProgress(p.measure, {
        projectProgress: p.progress,
        billingModel: p.billing_model,
        hasAsBuiltBoq: hasBoq,
      }),
    }
  }))
}

export async function fetchMeasureProjects(tenantId: string, branchId?: number) {
  let query = supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, billing_model, branch_id')
    .eq('tenant_id', tenantId)
    .eq('pmo_phase', '4_MEASURE')
    .order('updated_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: projects, error } = await query
  if (error) return { data: [] as MeasureProject[], error }

  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return { data: [] as MeasureProject[], error: null }

  const { data: measureRows } = await supabase
    .from('project_measure')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('project_id', ids)

  const measureMap = new Map((measureRows || []).map(m => [m.project_id, m as ProjectMeasure]))
  const basket: MeasureProject[] = (projects || []).map(p => ({
    ...p,
    measure: measureMap.get(p.id) || null,
  }))

  return { data: await attachMeasureProgress(tenantId, basket), error: null }
}

export async function ensureProjectMeasure(tenantId: string, projectId: number) {
  const { data: existing } = await supabase
    .from('project_measure')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) {
    if (existing.measure_status !== 'active') {
      await supabase.from('project_measure').update({
        measure_status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId).eq('project_id', projectId)
    }
    return existing as ProjectMeasure
  }

  const { data, error } = await supabase.from('project_measure').insert({
    tenant_id: tenantId,
    project_id: projectId,
    measure_status: 'active',
  }).select('*').single()

  if (error) throw error
  return data as ProjectMeasure
}

export async function fetchMeasureProject(tenantId: string, projectId: number) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, code, client_name, type, start_date, end_date, estimated_value, pmo_phase, status, progress, billing_model, description, branch_id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (error) throw error
  if (project.pmo_phase !== '4_MEASURE') {
    throw new Error('المشروع ليس في مرحلة المقايسة')
  }

  let measure = await ensureProjectMeasure(tenantId, projectId)
  const hasAsBuiltBoq = await hasActiveAsBuiltBoq(tenantId, projectId)

  return {
    project: {
      ...project,
      measure,
      hasAsBuiltBoq,
      measureProgress: computeMeasureProgress(measure, {
        projectProgress: project.progress,
        billingModel: project.billing_model,
        hasAsBuiltBoq,
      }),
    } as MeasureProjectDetail,
  }
}

export async function updateProjectMeasure(
  tenantId: string,
  projectId: number,
  patch: Partial<Omit<ProjectMeasure, 'id' | 'tenant_id' | 'project_id'>>,
) {
  const { data: row } = await supabase
    .from('project_measure')
    .select('measure_status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (row?.measure_status === 'closed') {
    throw new Error('المقايسة معتمدة — للعرض فقط')
  }

  await ensureProjectMeasure(tenantId, projectId)
  const { error } = await supabase.from('project_measure').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('project_id', projectId)

  if (error) throw error
}

/** نقل من التنفيذ إلى المقايسة */
export async function advanceProjectToMeasure(tenantId: string, projectId: number) {
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
    throw new Error('يجب أن تصل نسبة الإنجاز إلى 100% قبل الانتقال للمقايسة')
  }

  const { error: phaseErr } = await supabase.from('projects').update({
    pmo_phase: '4_MEASURE',
    status: statusForPhase('4_MEASURE'),
    progress: 100,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (phaseErr) throw phaseErr

  await ensureProjectMeasure(tenantId, projectId)
  await supabase.from('project_measure').update({
    execution_confirmed: true,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('project_id', projectId)
}

export async function closeProjectMeasure(tenantId: string, projectId: number) {
  const { project } = await fetchMeasureProject(tenantId, projectId)
  if (!project.measureProgress?.isComplete) {
    throw new Error(`يجب إكمال جميع بنود المقايسة (${project.measureProgress?.completed}/${project.measureProgress?.total})`)
  }

  await updateProjectMeasure(tenantId, projectId, { measure_status: 'closed' })

  const { error: phaseErr } = await supabase.from('projects').update({
    pmo_phase: '5_CLOSE',
    status: statusForPhase('5_CLOSE'),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (phaseErr) throw phaseErr

  const { ensureProjectClosure } = await import('@/lib/project-close-service')
  await ensureProjectClosure(tenantId, projectId)
}

/** إرجاع من المقايسة إلى التنفيذ */
export async function reopenProjectToExecution(tenantId: string, projectId: number) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, pmo_phase')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .single()

  if (pErr) throw pErr
  if (project.pmo_phase !== '4_MEASURE') {
    throw new Error('يمكن إرجاع مشاريع في مرحلة المقايسة فقط')
  }

  const { error: projErr } = await supabase.from('projects').update({
    pmo_phase: '3_EXEC',
    status: statusForPhase('3_EXEC'),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (projErr) throw projErr

  await supabase.from('project_measure').update({
    measure_status: 'active',
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('project_id', projectId)
}

export async function uploadMeasureFile(tenantId: string, projectId: number, file: File, prefix: string) {
  const path = `${tenantId}/measure/${projectId}/${prefix}_${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('project-attachments').upload(path, file)
  if (error) throw error
  return { path, name: file.name }
}
