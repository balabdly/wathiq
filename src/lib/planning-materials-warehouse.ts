import { supabase } from '@/lib/supabase'
import type { MaterialReceiptType } from '@/lib/project-planning-service'
import type { ReservationReconciliation } from '@/lib/pmc-types'
import { fetchReservationReconciliation } from '@/lib/pmc-service'
import { findMaterialBySecCode, secItemCodeVariants } from '@/lib/sec-item-code'

export type PlanningMaterialAlert = 'none' | 'not_in_plan' | 'over_received' | 'under_received'

export type WarehouseMaterialLookup = {
  id: number
  name: string
  catalog_no?: string | null
  sec_number?: string | null
  mat_code?: string | null
  item_code?: string | null
}

export type PlanningMaterialWarehouseRow = {
  key: string
  material_id: number | null
  catalog_no?: string | null
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
  /** تنبيه فجوة بين المقايسة والمخزون */
  planning_alert: PlanningMaterialAlert
  is_unplanned: boolean
  is_over_received: boolean
}

export type ReceivePlanningWarning = {
  material_id: number
  material_name: string
  qty_planned: number
  qty_already_received: number
  qty_receiving: number
  kind: 'not_in_plan' | 'over_receive'
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
  unplanned_count: number
  over_received_count: number
  has_planning_drift: boolean
  planning_drift_summary: string
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

function planningAlert(planned: number, received: number): PlanningMaterialAlert {
  if (planned <= 0 && received > 0) return 'not_in_plan'
  if (planned > 0 && received > planned) return 'over_received'
  if (planned > 0 && received <= 0) return 'under_received'
  return 'none'
}

function rowFlags(planned: number, received: number) {
  const alert = planningAlert(planned, received)
  return {
    planning_alert: alert,
    is_unplanned: alert === 'not_in_plan',
    is_over_received: alert === 'over_received',
  }
}

function buildRow(
  base: Omit<PlanningMaterialWarehouseRow, 'line_status' | 'planning_alert' | 'is_unplanned' | 'is_over_received'>,
): PlanningMaterialWarehouseRow {
  return {
    ...base,
    line_status: lineStatus(base.qty_planned, base.qty_received),
    ...rowFlags(base.qty_planned, base.qty_received),
  }
}

function findBalanceForPlannedLine(
  line: { material_id?: number | null; description: string; catalog_no?: string | null },
  balanceByMaterial: Map<number, ReservationReconciliation>,
  balances: ReservationReconciliation[],
): ReservationReconciliation | undefined {
  if (line.material_id) return balanceByMaterial.get(line.material_id)
  const desc = line.description.trim().toLowerCase()
  const byName = balances.find(b => b.material_name?.trim().toLowerCase() === desc)
  if (byName) return byName
  if (line.catalog_no?.trim()) {
    const cat = line.catalog_no.trim().toLowerCase()
    const variants = secItemCodeVariants(line.catalog_no).map(v => v.toLowerCase())
    return balances.find(b => {
      const name = b.material_name?.trim().toLowerCase() || ''
      return name.includes(cat) || variants.some(v => name.includes(v))
    })
  }
  return undefined
}

/** ربط سطر المقايسة بمادة في المستودع (رقم كتالوج / SEC / الاسم) */
export function resolveWarehouseMaterialId(
  materials: WarehouseMaterialLookup[],
  line: { material_id?: number | null; description: string; catalog_no?: string | null },
): number | null {
  if (line.material_id) {
    const exact = materials.find(m => m.id === line.material_id)
    if (exact) return exact.id
  }
  const cat = (line.catalog_no || '').trim()
  if (cat) {
    const byCode = findMaterialBySecCode(materials, cat)
    if (byCode) return byCode.id
  }
  const desc = line.description.trim()
  const byName = materials.find(m => m.name === desc)
  if (byName) return byName.id
  const byPrefix = materials.find(m => m.name.startsWith(desc + ' [') || m.name.startsWith(desc))
  if (byPrefix) return byPrefix.id
  return null
}

export type WarehouseMaterialMatchResult = {
  material_id: number | null
  matched: boolean
  note: string | null
}

const WAREHOUSE_MISSING_NOTE = '⚠ المادة غير مضافة مسبقاً في المستودع'

/** مقارنة سطر مواد (مقايسة / استيراد) مع كatalog المستودع */
export function matchLineToWarehouseMaterial(
  materials: WarehouseMaterialLookup[],
  line: { material_id?: number | null; description: string; catalog_no?: string | null; item_code?: string | null },
): WarehouseMaterialMatchResult {
  const catalogNo = line.catalog_no ?? line.item_code ?? null
  if (!line.description.trim() && !String(catalogNo || '').trim()) {
    return { material_id: null, matched: false, note: null }
  }
  const materialId = resolveWarehouseMaterialId(materials, {
    material_id: line.material_id ?? null,
    description: line.description,
    catalog_no: catalogNo,
  })
  if (materialId) return { material_id: materialId, matched: true, note: null }
  return { material_id: null, matched: false, note: WAREHOUSE_MISSING_NOTE }
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
    unplanned_count: 0,
    over_received_count: 0,
    has_planning_drift: false,
    planning_drift_summary: '',
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

  if (!reservation && reservationNo?.trim()) {
    empty.reservation_no = reservationNo.trim()
  }

  const [{ data: recon }, boqVersionId] = await Promise.all([
    reservation
      ? fetchReservationReconciliation(tenantId, { projectId, reservationId: reservation.id })
      : Promise.resolve({ data: [] as ReservationReconciliation[] }),
    (async () => {
      if (reservation?.boq_version_id) return reservation.boq_version_id
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
    const bal = findBalanceForPlannedLine(line, balanceByMaterial, balances)
    const resolvedMid = mid ?? bal?.material_id ?? null
    if (resolvedMid) usedMaterialIds.add(resolvedMid)
    const planned = num(line.qty_planned)
    const received = num(bal?.qty_received)
    const issued = num(bal?.qty_issued)
    const remaining = Math.max(0, planned - received)
    const remainingIssue = planned > 0 ? Math.max(0, planned - issued) : 0
    rows.push(buildRow({
      key: resolvedMid ? `m-${resolvedMid}` : `boq-${line.catalog_no || line.description}`,
      material_id: resolvedMid,
      catalog_no: line.catalog_no ?? null,
      description: line.description,
      unit: line.unit || bal?.unit || 'قطعة',
      qty_planned: planned,
      qty_received: received,
      qty_remaining: remaining,
      qty_on_hand: num(bal?.qty_on_hand),
      qty_issued: issued,
      qty_remaining_issue: remainingIssue,
    }))
  }

  for (const bal of balances) {
    if (usedMaterialIds.has(bal.material_id)) continue
    const received = num(bal.qty_received)
    const issued = num(bal.qty_issued)
    rows.push(buildRow({
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
    }))
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

  const unplanned_rows = rows.filter(r => r.is_unplanned)
  const over_received_rows = rows.filter(r => r.is_over_received)
  const unplanned_count = unplanned_rows.length
  const over_received_count = over_received_rows.length
  const has_planning_drift = unplanned_count > 0 || over_received_count > 0
  const driftParts: string[] = []
  if (unplanned_count > 0) driftParts.push(`${unplanned_count} مادة مستلمة غير موجودة بالمقايسة`)
  if (over_received_count > 0) driftParts.push(`${over_received_count} مادة باستلام زائد`)
  const planning_drift_summary = driftParts.join(' — ')

  if (!rows.length && !reservation) return empty

  return {
    reservation_id: reservation?.id ?? null,
    reservation_no: reservation?.reservation_no ?? reservationNo?.trim() ?? null,
    reservation_status: reservation?.status ?? null,
    reservation_date: null,
    rows,
    totals,
    receipt_type,
    pending_lines,
    pending_summary,
    has_boq_lines: boqLines.length > 0,
    has_manual_lines: manualLines.length > 0,
    line_source: lineSource,
    unplanned_count,
    over_received_count,
    has_planning_drift,
    planning_drift_summary,
  }
}

/** مقارنة بنود الاستلام مع المقايسة — للتنبيه دون منع الحفظ */
async function fetchProjectPlannedMaterialMap(
  tenantId: string,
  projectId: number,
): Promise<Map<number, { planned: number; name: string }>> {
  const map = new Map<number, { planned: number; name: string }>()
  const { data: active } = await supabase
    .from('project_boq_versions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('status', 'ACTIVE')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active?.id) {
    const { data: lines } = await supabase
      .from('project_boq_lines')
      .select('material_id, description, qty_planned, line_category, notes')
      .eq('tenant_id', tenantId)
      .eq('boq_version_id', active.id)
    for (const line of lines || []) {
      const cat = line.line_category === 'MATERIAL' || line.notes?.includes('line_category:MATERIAL') || line.material_id ? 'MATERIAL' : 'WORK'
      if (cat !== 'MATERIAL' || !line.material_id) continue
      const mid = line.material_id
      const prev = map.get(mid)
      map.set(mid, {
        planned: (prev?.planned ?? 0) + num(line.qty_planned),
        name: prev?.name || line.description,
      })
    }
  }
  return map
}

async function fetchProjectReceivedMaterialMap(
  tenantId: string,
  projectId: number,
  reservationId?: number | null,
): Promise<Map<number, number>> {
  const { data } = await fetchReservationReconciliation(
    tenantId,
    reservationId ? { projectId, reservationId } : { projectId },
  )
  const map = new Map<number, number>()
  for (const b of data || []) {
    map.set(b.material_id, (map.get(b.material_id) ?? 0) + num(b.qty_received))
  }
  return map
}

export async function checkReceivePlanningWarnings(
  tenantId: string,
  projectId: number,
  lines: { material_id: number; qty: number; material_name?: string }[],
  reservationId?: number | null,
  reservationNo?: string | null,
): Promise<ReceivePlanningWarning[]> {
  if (!lines.length) return []

  let resolvedResId = reservationId ?? null
  if (!resolvedResId && reservationNo?.trim()) {
    resolvedResId = await resolveMaterialReservationId(tenantId, projectId, reservationNo.trim())
  }

  const [plannedMap, receivedMap] = await Promise.all([
    fetchProjectPlannedMaterialMap(tenantId, projectId),
    fetchProjectReceivedMaterialMap(tenantId, projectId, resolvedResId),
  ])

  const merged = new Map<number, { qty: number; name: string }>()
  for (const line of lines) {
    const prev = merged.get(line.material_id)
    merged.set(line.material_id, {
      qty: (prev?.qty ?? 0) + line.qty,
      name: line.material_name || prev?.name || plannedMap.get(line.material_id)?.name || `مادة #${line.material_id}`,
    })
  }

  const warnings: ReceivePlanningWarning[] = []
  Array.from(merged.entries()).forEach(([materialId, { qty, name }]) => {
    const planned = plannedMap.get(materialId)?.planned ?? 0
    const already = receivedMap.get(materialId) ?? 0
    const totalAfter = already + qty

    if (planned <= 0) {
      warnings.push({
        material_id: materialId,
        material_name: name,
        qty_planned: 0,
        qty_already_received: already,
        qty_receiving: qty,
        kind: 'not_in_plan',
      })
    } else if (totalAfter > planned) {
      warnings.push({
        material_id: materialId,
        material_name: name,
        qty_planned: planned,
        qty_already_received: already,
        qty_receiving: qty,
        kind: 'over_receive',
      })
    }
  })
  return warnings
}

export function formatReceivePlanningConfirmMessage(warnings: ReceivePlanningWarning[]): string {
  const lines = warnings.map(w => {
    if (w.kind === 'not_in_plan') {
      return `• ${w.material_name}: غير موجودة بالمقايسة (ستُستلم ${w.qty_receiving})`
    }
    const excess = w.qty_already_received + w.qty_receiving - w.qty_planned
    return `• ${w.material_name}: المخطط ${w.qty_planned} — ستُستلم ${w.qty_receiving} (زيادة ${excess})`
  })
  return [
    '⚠️ تنبيه — مواد خارج المقايسة أو بكمية زائدة',
    '',
    ...lines,
    '',
    'يُنصح بتعديل المقايسة في التخطيط.',
    'متابعة الاستلام؟',
  ].join('\n')
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
