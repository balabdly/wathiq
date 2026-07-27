import { supabase } from '@/lib/supabase'
import { statusForPhase, type PmoPhase } from '@/lib/sec-workflow'
import { lifecycleLabel, pmoPhaseToLifecycle, type LifecyclePhase } from '@/lib/project-lifecycle'

export type ProjectPhaseHistoryRow = {
  id?: number
  tenant_id?: string
  project_id?: number
  lifecycle_phase: LifecyclePhase
  pmo_phase?: string | null
  entered_at: string
  exited_at?: string | null
  synthetic?: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || (err.message || '').includes('project_phase_history')
}

/** تسجيل أول دخول للمشروع (مرحلة البدء) */
export async function recordInitialProjectPhase(
  tenantId: string,
  projectId: number,
  pmoPhase: string = '1_RECEIPT',
  enteredAt?: string,
) {
  const life = pmoPhaseToLifecycle(pmoPhase)
  if (!life) return
  const { error } = await supabase.from('project_phase_history').insert({
    tenant_id: tenantId,
    project_id: projectId,
    lifecycle_phase: life,
    pmo_phase: pmoPhase,
    entered_at: enteredAt || nowIso(),
  })
  if (error && !isMissingTableError(error)) throw error
}

/** مزامنة السجل عند تغيير pmo_phase */
export async function syncProjectPhaseHistory(
  tenantId: string,
  projectId: number,
  previousPmo: string | null | undefined,
  newPmo: string | null | undefined,
) {
  const prevLife = pmoPhaseToLifecycle(previousPmo)
  const nextLife = pmoPhaseToLifecycle(newPmo)
  if (prevLife === nextLife) return

  const ts = nowIso()

  if (prevLife) {
    const { error: closeErr } = await supabase
      .from('project_phase_history')
      .update({ exited_at: ts })
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('lifecycle_phase', prevLife)
      .is('exited_at', null)
    if (closeErr && !isMissingTableError(closeErr)) throw closeErr
  }

  if (nextLife) {
    const { error: openErr } = await supabase.from('project_phase_history').insert({
      tenant_id: tenantId,
      project_id: projectId,
      lifecycle_phase: nextLife,
      pmo_phase: newPmo || null,
      entered_at: ts,
    })
    if (openErr && !isMissingTableError(openErr)) throw openErr
  }
}

/** تحديث pmo_phase مع تسجيل السجل */
export async function updateProjectPmoPhase(
  tenantId: string,
  projectId: number,
  newPmo: PmoPhase | string,
  extra?: Record<string, unknown>,
) {
  const { data: current, error: fetchErr } = await supabase
    .from('projects')
    .select('pmo_phase')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  const prev = current?.pmo_phase ?? null
  const status = statusForPhase(newPmo as PmoPhase)

  const { error } = await supabase.from('projects').update({
    pmo_phase: newPmo,
    status,
    updated_at: nowIso(),
    ...extra,
  }).eq('id', projectId).eq('tenant_id', tenantId)
  if (error) throw error

  await syncProjectPhaseHistory(tenantId, projectId, prev, newPmo)
}

export async function fetchProjectPhaseHistory(
  tenantId: string,
  projectId: number,
  fallback?: { pmo_phase?: string | null; created_at?: string | null },
): Promise<ProjectPhaseHistoryRow[]> {
  const { data, error } = await supabase
    .from('project_phase_history')
    .select('id, lifecycle_phase, pmo_phase, entered_at, exited_at')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('entered_at', { ascending: true })

  if (error) {
    if (isMissingTableError(error)) {
      return buildSyntheticHistory(fallback)
    }
    throw error
  }

  const rows = (data || []) as ProjectPhaseHistoryRow[]
  if (!rows.length) return buildSyntheticHistory(fallback)
  return rows
}

function buildSyntheticHistory(
  fallback?: { pmo_phase?: string | null; created_at?: string | null },
): ProjectPhaseHistoryRow[] {
  if (!fallback?.pmo_phase) return []
  const life = pmoPhaseToLifecycle(fallback.pmo_phase)
  if (!life) return []
  return [{
    lifecycle_phase: life,
    pmo_phase: fallback.pmo_phase,
    entered_at: fallback.created_at || nowIso(),
    exited_at: null,
    synthetic: true,
  }]
}

export function formatPhaseDuration(enteredAt: string, exitedAt?: string | null): string {
  const start = new Date(enteredAt).getTime()
  const end = exitedAt ? new Date(exitedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const days = Math.max(0, Math.floor((end - start) / 86400000))
  if (days === 0) return 'أقل من يوم'
  if (days === 1) return 'يوم واحد'
  return `${days} يوم`
}

export function phaseHistoryLabel(row: ProjectPhaseHistoryRow): string {
  return lifecycleLabel(row.lifecycle_phase)
}
