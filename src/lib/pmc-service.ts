import { supabase } from '@/lib/supabase'
import type {
  MaterialReservation,
  PostInventoryVoucherPayload,
  ProjectBoqLine,
  ProjectBoqVersion,
  ReservationReconciliation,
  BoqVariationOrder,
  MaterialReconciliation,
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

/** إنشاء أو إيجاد حجز برقم الحجز فقط — لا يتطلب اكتمال التخطيط */
export async function ensureReservationByNumber(
  tenantId: string,
  projectId: number,
  reservationNo: string,
  clientName?: string | null,
) {
  const no = reservationNo.trim()
  if (!no) return { data: null, error: { message: 'رقم الحجز مطلوب' } as { message: string } }

  const { data: existing, error: findErr } = await supabase
    .from('material_reservations')
    .select('id, reservation_no, status, project_id, client_name, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('reservation_no', no)
    .maybeSingle()

  if (findErr) return { data: null, error: findErr }
  if (existing) {
    if (existing.project_id !== projectId) {
      return { data: null, error: { message: 'رقم الحجز مربوط بمشروع آخر' } }
    }
    return { data: existing as MaterialReservation, error: null }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('client_name')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return createReservation({
    tenant_id: tenantId,
    project_id: projectId,
    reservation_no: no,
    client_name: clientName || project?.client_name || undefined,
  })
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

// ── أوامر التغيير (Variation Orders) ──

export async function fetchVariationOrders(tenantId: string, projectId?: number) {
  let q = supabase
    .from('boq_variation_orders')
    .select('*, parent_version:project_boq_versions!parent_boq_version_id(*), new_version:project_boq_versions!new_boq_version_id(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  return { data: (data || []) as BoqVariationOrder[], error }
}

export async function createVariationOrder(payload: {
  tenant_id: string
  project_id: number
  variation_no: string
  parent_boq_version_id: number
  reason?: string
  sec_reference?: string
  adjustment_request_id?: string
  notes?: string
  created_by?: string
}) {
  const { data, error } = await supabase
    .from('boq_variation_orders')
    .insert({ ...payload, status: 'DRAFT' })
    .select()
    .single()
  return { data: data as BoqVariationOrder | null, error }
}

export async function applyVariationOrder(variationId: number) {
  const { data, error } = await supabase.rpc('apply_boq_variation_order', { p_variation_id: variationId })
  return { data: data as { variation_id: number; new_boq_version_id: number } | null, error }
}

export async function approveVariationOrder(id: number) {
  return supabase
    .from('boq_variation_orders')
    .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
    .eq('id', id)
}

// ── مطابقة نهائية ──

export async function finalizeReservationReconciliation(
  tenantId: string,
  reservationId: number,
  boqVersionId?: number,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('finalize_reservation_reconciliation', {
    p_tenant_id: tenantId,
    p_reservation_id: reservationId,
    p_boq_version_id: boqVersionId ?? null,
    p_notes: notes ?? null,
  })
  return { data: data as { reconciliation_id: number; reservation_id: number; status: string } | null, error }
}

export async function fetchReconciliationHistory(tenantId: string, reservationId?: number) {
  let q = supabase
    .from('material_reconciliations')
    .select('*, lines:material_reconciliation_lines(*)')
    .eq('tenant_id', tenantId)
    .order('reconciled_at', { ascending: false })
  if (reservationId) q = q.eq('reservation_id', reservationId)
  const { data, error } = await q
  return { data: (data || []) as MaterialReconciliation[], error }
}

export async function fetchOpenReservations(tenantId: string, projectId: number) {
  const { data, error } = await supabase
    .from('material_reservations')
    .select('id, reservation_no, status, project_id, client_name')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .in('status', ['OPEN', 'PARTIAL', 'RECONCILED'])
    .order('opened_at', { ascending: false })
  return { data: (data || []) as Pick<MaterialReservation, 'id' | 'reservation_no' | 'status' | 'project_id' | 'client_name'>[], error }
}
