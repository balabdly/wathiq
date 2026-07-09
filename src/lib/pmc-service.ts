import { supabase } from '@/lib/supabase'
import type {
  MaterialReservation,
  PostInventoryVoucherPayload,
  ProjectBoqLine,
  ProjectBoqVersion,
  ReservationReconciliation,
} from '@/lib/pmc-types'

// ── حجوزات ──

export async function fetchReservations(tenantId: string, projectId?: number) {
  let q = supabase
    .from('material_reservations')
    .select('*, project:projects(id, name)')
    .eq('tenant_id', tenantId)
    .order('opened_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  return { data: (data || []) as MaterialReservation[], error }
}

export async function createReservation(payload: {
  tenant_id: string
  project_id: number
  reservation_no: string
  ownership_type?: 'CUSTODY' | 'COMPANY'
  client_name?: string
  boq_version_id?: number
  notes?: string
  created_by?: string
}) {
  const { data, error } = await supabase
    .from('material_reservations')
    .insert({
      ...payload,
      ownership_type: payload.ownership_type || 'CUSTODY',
      status: 'OPEN',
    })
    .select('*, project:projects(id, name)')
    .single()
  return { data: data as MaterialReservation | null, error }
}

export async function closeReservation(id: number) {
  return supabase
    .from('material_reservations')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .eq('id', id)
}

// ── BOQ ──

export async function fetchBoqVersions(tenantId: string, projectId: number) {
  const { data, error } = await supabase
    .from('project_boq_versions')
    .select('*, lines:project_boq_lines(*)')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('version_no', { ascending: true })
  return { data: (data || []) as ProjectBoqVersion[], error }
}

export async function createBoqVersion(payload: {
  tenant_id: string
  project_id: number
  version_type: 'INITIAL' | 'VARIATION' | 'AS_BUILT'
  version_no: number
  parent_version_id?: number
  variation_ref?: string
  effective_date?: string
  notes?: string
  created_by?: string
  lines: Omit<ProjectBoqLine, 'id' | 'tenant_id' | 'boq_version_id'>[]
}) {
  const { lines, ...header } = payload
  const { data: version, error: vErr } = await supabase
    .from('project_boq_versions')
    .insert({ ...header, status: 'DRAFT' })
    .select()
    .single()
  if (vErr || !version) return { data: null, error: vErr }

  if (lines.length > 0) {
    const lineRows = lines.map((l, i) => ({
      tenant_id: payload.tenant_id,
      boq_version_id: version.id,
      line_no: l.line_no || i + 1,
      material_id: l.material_id || null,
      catalog_no: l.catalog_no || null,
      description: l.description,
      unit: l.unit || 'قطعة',
      qty_planned: l.qty_planned,
      notes: l.notes || null,
    }))
    const { error: lErr } = await supabase.from('project_boq_lines').insert(lineRows)
    if (lErr) return { data: null, error: lErr }
  }

  return fetchBoqVersions(payload.tenant_id, payload.project_id)
}

export async function activateBoqVersion(tenantId: string, versionId: number, projectId: number) {
  await supabase
    .from('project_boq_versions')
    .update({ status: 'SUPERSEDED' })
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('status', 'ACTIVE')

  const { error } = await supabase
    .from('project_boq_versions')
    .update({ status: 'ACTIVE' })
    .eq('id', versionId)
  return { error }
}

// ── أذون مخزنية (RPC ذرّي) ──

export async function postInventoryVoucher(payload: PostInventoryVoucherPayload) {
  const { data, error } = await supabase.rpc('post_inventory_voucher', { p_payload: payload })
  return { data: data as { voucher_id: number; voucher_no: string; status: string } | null, error }
}

// ── تقرير المطابقة ──

export async function fetchReservationReconciliation(
  tenantId: string,
  filters?: { projectId?: number; reservationId?: number }
) {
  let q = supabase
    .from('v_pmc_reservation_reconciliation')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('reservation_no')
  if (filters?.projectId) q = q.eq('project_id', filters.projectId)
  if (filters?.reservationId) q = q.eq('reservation_id', filters.reservationId)
  const { data, error } = await q
  return { data: (data || []) as ReservationReconciliation[], error }
}
