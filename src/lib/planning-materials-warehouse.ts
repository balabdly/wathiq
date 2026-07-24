import { supabase } from '@/lib/supabase'
import type { MaterialReceiptType } from '@/lib/project-planning-service'
import type { ReservationReconciliation } from '@/lib/pmc-types'
import { fetchReservationReconciliation } from '@/lib/pmc-service'

export type PlanningMaterialWarehouseRow = {
  key: string
  material_id: number | null
  description: string
  unit: string
  /** الكمية المحجوزة (من BOQ / المقايسة) */
  qty_planned: number
  qty_received: number
  /** متبقي الاستلام = محجوز − مستلم */
  qty_remaining: number
  qty_on_hand: number
  /** الكمية المصروفة للموقع */
  qty_issued: number
  /** متبقي الصرف = محجوز − مصروف */
  qty_remaining_issue: number
  line_status: 'complete' | 'partial' | 'pending'
}

export type PlanningMaterialsWarehouseSummary = {
  reservation_id: number | null
  reservation_no: string | null
  reservation_status: string | null
  reservation_date: string | null
  rows: PlanningMaterialWarehouseRow[]
  totals: { planned: number; received: number; remaining: number; on_hand: number; issued: number; remaining_issue: number }
  receipt_type: MaterialReceiptType | 'none'
  pending_lines: PlanningMaterialWarehouseRow[]
  pending_summary: string
  has_boq_lines: boolean
  has_manual_lines: boolean
  line_source: 'boq' | 'manual' | 'none'
}

function num(v: unknown): number {
  return Number(v) || 0
}

function lineStatus(planned: number, received: number): PlanningMaterialWarehouseRow['line_status'] {
  if (received <= 0) return 'pending'
  if (planned <= 0) return received > 0 ? 'partial' : 'pending'
  if (received >= planned) return 'complete'
  return 'partial'
}

export async function fetchPlanningMaterialsWarehouseStatus(
  tenantId: string,
  projectId: number,
  reservationId?: number | null,
  reservationNo?: string | null,
): Promise<PlanningMaterialsWarehouseSummary> {
  const empty: PlanningMaterialsWarehouseSummary = {
    reservation_id: null,
    reservation_no: reservationNo || null,
    reservation_status: null,
    reservation_date: null,
    rows: [],
    totals: { planned: 0, received: 0, remaining: 0, on_hand: 0, issued: 0, remaining_issue: 0 },
    receipt_type: 'none',
    pending_lines: [],
    pending_summary: '',
    has_boq_lines: false,
    has_manual_lines: false,
    line_source: 'none',
  }

  let reservation: { id: number; reservation_no: string; status: string; boq_version_id?: number | null } | null = null

  if (reservationId) {
    const { data } = await supabase
      .from('material_reservations')
      .select('id, reservation_no, status, boq_version_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('id', reservationId)
      .maybeSingle()
    reservation = data
  } else if (reservationNo?.trim()) {
    const { data } = await supabase
      .from('material_reservations')
      .select('id, reservation_no, status, boq_version_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('reservation_no', reservationNo.trim())
      .maybeSingle()
    reservation = data
  }

  if (!reservation) return empty

  const [{ data: recon }, boqVersionId] = await Promise.all([
    fetchReservationReconciliation(tenantId, { projectId, reservationId: reservation.id }),
    (async () => {
      if (reservation!.boq_version_id) return reservation!.boq_version_id
      const { data: active } = await supabase
        .from('project_boq_versions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('status', 'ACTIVE')
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle()
      return active?.id ?? null
    })(),
  ])

  const balances = (recon || []) as ReservationReconciliation[]
  const balanceByMaterial = new Map<number, ReservationReconciliation>()
  for (const b of balances) balanceByMaterial.set(b.material_id, b)

  let boqLines: { material_id?: number | null; description: string; unit: string; qty_planned: number; catalog_no?: string | null }[] = []
  if (boqVersionId) {
    const { data: lines } = await supabase
      .from('project_boq_lines')
      .select('material_id, description, unit, qty_planned, catalog_no, line_category, notes')
      .eq('tenant_id', tenantId)
      .eq('boq_version_id', boqVersionId)
      .order('line_no')
    boqLines = (lines || []).filter(l => {
      const cat = l.line_category === 'MATERIAL' || l.notes?.includes('line_category:MATERIAL') || l.material_id ? 'MATERIAL' : 'WORK'
      return cat === 'MATERIAL'
    })
  }

  let manualLines: { material_id?: null; description: string; unit: string; qty_planned: number; catalog_no?: string | null }[] = []
  if (!boqLines.length) {
    const { data: planLines } = await supabase
      .from('project_planning_material_lines')
      .select('description, unit, qty_planned, catalog_no')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('sort_order')
    manualLines = (planLines || []).map(l => ({
      material_id: null,
      description: l.description,
      unit: l.unit || 'قطعة',
      qty_planned: Number(l.qty_planned) || 0,
      catalog_no: l.catalog_no,
    }))
  }

  const plannedSource = boqLines.length > 0 ? boqLines : manualLines
  const lineSource: 'boq' | 'manual' | 'none' = boqLines.length > 0 ? 'boq' : manualLines.length > 0 ? 'manual' : 'none'

  const rows: PlanningMaterialWarehouseRow[] = []
  const usedMaterialIds = new Set<number>()

  for (const line of plannedSource) {
    const mid = line.material_id ?? null
    const bal = mid ? balanceByMaterial.get(mid) : undefined
    if (mid) usedMaterialIds.add(mid)
    const planned = num(line.qty_planned)
    const received = num(bal?.qty_received)
    const issued = num(bal?.qty_issued)
    const remaining = Math.max(0, planned - received)
    const remainingIssue = planned > 0 ? Math.max(0, planned - issued) : 0
    rows.push({
      key: mid ? `m-${mid}` : `boq-${line.description}`,
      material_id: mid,
      description: line.description,
      unit: line.unit || bal?.unit || 'قطعة',
      qty_planned: planned,
      qty_received: received,
      qty_remaining: remaining,
      qty_on_hand: num(bal?.qty_on_hand),
      qty_issued: issued,
      qty_remaining_issue: remainingIssue,
      line_status: lineStatus(planned, received),
    })
  }

  for (const bal of balances) {
    if (usedMaterialIds.has(bal.material_id)) continue
    const received = num(bal.qty_received)
    const issued = num(bal.qty_issued)
    rows.push({
      key: `m-${bal.material_id}`,
      material_id: bal.material_id,
      description: bal.material_name,
      unit: bal.unit || 'قطعة',
      qty_planned: 0,
      qty_received: received,
      qty_remaining: 0,
      qty_on_hand: num(bal.qty_on_hand),
      qty_issued: issued,
      qty_remaining_issue: 0,
      line_status: received > 0 ? 'partial' : 'pending',
    })
  }

  const totals = rows.reduce(
    (acc, r) => ({
      planned: acc.planned + r.qty_planned,
      received: acc.received + r.qty_received,
      remaining: acc.remaining + r.qty_remaining,
      on_hand: acc.on_hand + r.qty_on_hand,
      issued: acc.issued + r.qty_issued,
      remaining_issue: acc.remaining_issue + r.qty_remaining_issue,
    }),
    { planned: 0, received: 0, remaining: 0, on_hand: 0, issued: 0, remaining_issue: 0 },
  )

  const pending_lines = rows.filter(r => r.line_status !== 'complete' && (r.qty_planned > 0 || r.qty_received <= 0))
  const hasReceived = rows.some(r => r.qty_received > 0)
  const allComplete = rows.length > 0 && rows.every(r => r.line_status === 'complete' || (r.qty_planned <= 0 && r.qty_received > 0))

  let receipt_type: MaterialReceiptType | 'none' = 'none'
  if (hasReceived) {
    receipt_type = allComplete && totals.remaining <= 0 ? 'full' : 'partial'
  }

  const pending_summary = pending_lines
    .filter(r => r.qty_remaining > 0 || (r.qty_planned > 0 && r.qty_received <= 0))
    .map(r => `${r.description}: متبقي ${r.qty_remaining} ${r.unit}`)
    .join(' — ')

  return {
    reservation_id: reservation.id,
    reservation_no: reservation.reservation_no,
    reservation_status: reservation.status,
    reservation_date: null,
    rows,
    totals,
    receipt_type,
    pending_lines,
    pending_summary,
    has_boq_lines: boqLines.length > 0,
    has_manual_lines: manualLines.length > 0,
    line_source: lineSource,
  }
}

export async function getPlanningMaterialsFileUrl(filePath: string | null | undefined): Promise<string | null> {
  if (!filePath) return null
  const { data } = await supabase.storage.from('project-attachments').createSignedUrl(filePath, 3600)
  return data?.signedUrl ?? null
}

export async function resolveMaterialReservationId(
  tenantId: string,
  projectId: number,
  reservationNo: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('material_reservations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('reservation_no', reservationNo.trim())
    .maybeSingle()
  return data?.id ?? null
}
