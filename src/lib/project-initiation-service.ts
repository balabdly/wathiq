import { supabase } from '@/lib/supabase'
import { ensureProjectPlanning } from '@/lib/project-planning-service'

export type InitiationBasketProject = {
  id: number
  name: string
  code?: string
  client_id?: number | null
  client_name?: string
  type?: string
  status?: string
  pmo_phase?: string
  estimated_value?: number
  start_date?: string
  end_date?: string
  description?: string
  created_at?: string
  hasBoq?: boolean
}

export async function fetchInitiationBasketProjects(tenantId: string) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, code, client_id, client_name, type, status, pmo_phase, estimated_value, start_date, end_date, description, created_at')
    .eq('tenant_id', tenantId)
    .eq('pmo_phase', '1_RECEIPT')
    .order('created_at', { ascending: false })

  const list = projects || []
  const ids = list.map(p => p.id)
  const withBoq = new Set<number>()

  if (ids.length > 0) {
    const { data: boqRows } = await supabase
      .from('project_boq_versions')
      .select('project_id')
      .eq('tenant_id', tenantId)
      .eq('version_type', 'INITIAL')
      .in('project_id', ids)
    for (const row of boqRows || []) withBoq.add(row.project_id)
  }

  return {
    data: list.map(p => ({ ...p, hasBoq: withBoq.has(p.id) })) as InitiationBasketProject[],
    error,
  }
}

export async function completeProjectInitiation(
  tenantId: string,
  projectId: number,
  project?: { start_date?: string; end_date?: string; client_id?: number | null },
) {
  let p = project
  if (!p) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, pmo_phase, client_id, start_date, end_date')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .single()
    if (error) throw error
    p = data
  }

  if (p.pmo_phase !== '1_RECEIPT') {
    throw new Error('المشروع ليس في سلة مرحلة البدء')
  }
  if (!p.client_id) {
    throw new Error('يجب تحديد العميل قبل إرسال المشروع للتخطيط')
  }

  const { data: boq } = await supabase
    .from('project_boq_versions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('version_type', 'INITIAL')
    .maybeSingle()

  if (!boq) {
    throw new Error('يجب حفظ الكميات الابتدائية قبل إرسال المشروع للتخطيط')
  }

  await ensureProjectPlanning(tenantId, projectId, p)
}
