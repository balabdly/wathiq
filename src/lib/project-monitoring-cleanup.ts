import { supabase } from '@/lib/supabase'

/** حذف المشاريع القديمة بدون pmo_phase فقط — لا يمس مشاريع دورة الحياة */
export async function cleanupLegacyMonitoringProjects(
  tenantId: string,
  branchId: number,
) {
  const { data: rows, error: fetchErr } = await supabase
    .from('projects')
    .select('id, pmo_phase')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .is('pmo_phase', null)

  if (fetchErr) throw fetchErr
  const deleteIds = (rows || []).map(p => p.id)
  if (!deleteIds.length) return { deleted: 0 }

  const { error: delErr } = await supabase.from('projects').delete().in('id', deleteIds)
  if (delErr) throw delErr

  return { deleted: deleteIds.length }
}

export function isLifecycleProject(p: { pmo_phase?: string | null }): boolean {
  return !!p.pmo_phase
}
