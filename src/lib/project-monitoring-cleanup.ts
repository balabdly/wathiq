import { supabase } from '@/lib/supabase'

/** حذف المشاريع القديمة (بدون pmo_phase) والإبقاء على آخر N مشروع lifecycle */
export async function cleanupLegacyMonitoringProjects(
  tenantId: string,
  branchId: number,
  keepCount = 2,
) {
  const { data: rows, error: fetchErr } = await supabase
    .from('projects')
    .select('id, pmo_phase, created_at')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })

  if (fetchErr) throw fetchErr
  const all = rows || []

  const lifecycle = all.filter(p => p.pmo_phase)
  const keepIds = new Set(lifecycle.slice(0, keepCount).map(p => p.id))
  const deleteIds = all.filter(p => !keepIds.has(p.id)).map(p => p.id)

  if (!deleteIds.length) return { deleted: 0, kept: keepIds.size }

  const { error: delErr } = await supabase.from('projects').delete().in('id', deleteIds)
  if (delErr) throw delErr

  return { deleted: deleteIds.length, kept: keepIds.size }
}

export function isLifecycleProject(p: { pmo_phase?: string | null }): boolean {
  return !!p.pmo_phase
}
