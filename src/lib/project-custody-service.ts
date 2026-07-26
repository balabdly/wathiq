import { supabase } from '@/lib/supabase'

function num(v: unknown): number {
  return Number(v) || 0
}

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

type MaterialJoin = { name: string; unit: string; catalog_no?: string | null }
type WarehouseJoin = { name: string }

type ProjectMaterialRow = {
  material_id: number
  qty_received: number | null
  qty_issued: number | null
  qty_returned: number | null
  qty_balance: number | null
  material: MaterialJoin | MaterialJoin[] | null
  warehouse: WarehouseJoin | WarehouseJoin[] | null
}

export type CustodyMaterialRow = {
  key: string
  material_id: number | null
  name: string
  unit: string
  catalog_no?: string | null
  warehouse_name?: string | null
  qty_received: number
  qty_issued: number
  qty_returned: number
  qty_balance: number
}

export type CustodyPendingReceiveRow = {
  key: string
  material_id: number | null
  description: string
  unit: string
  qty_planned: number
  qty_received: number
  qty_pending: number
}

export type ProjectCustodyDetail = {
  received: CustodyMaterialRow[]
  notYetReceived: CustodyPendingReceiveRow[]
  pendingClientReturn: CustodyMaterialRow[]
  has_boq: boolean
}

type PlannedLine = {
  key: string
  material_id: number | null
  description: string
  unit: string
  qty_planned: number
}

async function fetchPlannedMaterialLines(tenantId: string, projectId: number): Promise<{ lines: PlannedLine[]; has_boq: boolean }> {
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
      .select('material_id, description, unit, qty_planned, line_category, notes')
      .eq('tenant_id', tenantId)
      .eq('boq_version_id', active.id)
      .order('line_no')
    const materialLines = (lines || []).filter(l => {
      const cat = l.line_category === 'MATERIAL' || l.notes?.includes('line_category:MATERIAL') || l.material_id ? 'MATERIAL' : 'WORK'
      return cat === 'MATERIAL' && num(l.qty_planned) > 0
    })
    return {
      has_boq: materialLines.length > 0,
      lines: materialLines.map(l => ({
        key: l.material_id ? `m-${l.material_id}` : `boq-${l.description}`,
        material_id: l.material_id ?? null,
        description: l.description,
        unit: l.unit || 'قطعة',
        qty_planned: num(l.qty_planned),
      })),
    }
  }

  const { data: manual } = await supabase
    .from('project_planning_material_lines')
    .select('description, unit, qty_planned, catalog_no')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('sort_order')

  const manualLines = (manual || []).filter(l => num(l.qty_planned) > 0)
  return {
    has_boq: false,
    lines: manualLines.map(l => ({
      key: `manual-${l.description}`,
      material_id: null,
      description: l.description,
      unit: l.unit || 'قطعة',
      qty_planned: num(l.qty_planned),
    })),
  }
}

type LedgerRow = {
  id: number
  type: string
  movement_category?: string | null
  mat_name: string
  unit?: string | null
  qty: number
  wh_name?: string | null
  is_loan?: boolean | null
}

function isReceiveType(type: string, cat?: string | null): boolean {
  if (type === 'استلام' || type === 'توريد') return true
  return !!(cat && (cat.includes('استلام') || cat === 'مرتجع_موقع'))
}

function isIssueType(type: string, isLoan?: boolean | null): boolean {
  return type === 'صرف' && !isLoan
}

function isClientReturnType(type: string, cat?: string | null): boolean {
  return type === 'إرجاع للعميل' || type === 'إرجاع' || cat === 'ارجاع_عميل'
}

async function fetchCustodyFromLedger(
  tenantId: string,
  projectId: number,
  projectName?: string | null,
): Promise<Map<number | string, CustodyMaterialRow>> {
  const [{ data: ledgerById }, { data: ledgerByName }] = await Promise.all([
    supabase.from('stock_ledger').select('id, type, movement_category, mat_name, unit, qty, wh_name, is_loan')
      .eq('tenant_id', tenantId).eq('project_id', projectId),
    projectName
      ? supabase.from('stock_ledger').select('id, type, movement_category, mat_name, unit, qty, wh_name, is_loan')
          .eq('tenant_id', tenantId).eq('project_name', projectName)
      : Promise.resolve({ data: [] as LedgerRow[] }),
  ])

  const seen = new Set<number>()
  const rows: LedgerRow[] = []
  for (const row of [...(ledgerById || []), ...(ledgerByName || [])] as LedgerRow[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }

  const byKey = new Map<number | string, CustodyMaterialRow>()
  for (const row of rows) {
    const key = row.mat_name || 'unknown'
    const prev = byKey.get(key)
    const base: CustodyMaterialRow = prev || {
      key: `ledger-${key}`,
      material_id: null,
      name: row.mat_name,
      unit: row.unit || 'قطعة',
      warehouse_name: row.wh_name || null,
      qty_received: 0,
      qty_issued: 0,
      qty_returned: 0,
      qty_balance: 0,
    }
    const qty = num(row.qty)
    if (isReceiveType(row.type, row.movement_category)) base.qty_received += qty
    else if (isIssueType(row.type, row.is_loan)) base.qty_issued += qty
    else if (isClientReturnType(row.type, row.movement_category)) base.qty_returned += qty
    base.qty_balance = Math.max(0, base.qty_received - base.qty_issued - base.qty_returned)
    if (row.wh_name && base.warehouse_name && !base.warehouse_name.includes(row.wh_name)) {
      base.warehouse_name = `${base.warehouse_name}، ${row.wh_name}`
    } else if (row.wh_name && !base.warehouse_name) {
      base.warehouse_name = row.wh_name
    }
    byKey.set(key, base)
  }
  return byKey
}

function buildCustodySections(
  receivedByMaterial: Map<number, CustodyMaterialRow>,
  receivedByName: Map<string, CustodyMaterialRow>,
  planned: { lines: PlannedLine[]; has_boq: boolean },
): ProjectCustodyDetail {
  const received = [
    ...Array.from(receivedByMaterial.values()),
    ...Array.from(receivedByName.values()),
  ]
    .filter(r => r.qty_received > 0 || r.qty_balance > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  const pendingClientReturn = received
    .filter(r => r.qty_balance > 0)
    .sort((a, b) => b.qty_balance - a.qty_balance)

  const receivedQtyByMaterial = new Map<number, number>()
  for (const r of received) {
    if (r.material_id) receivedQtyByMaterial.set(r.material_id, r.qty_received)
  }

  const notYetReceived: CustodyPendingReceiveRow[] = []
  for (const line of planned.lines) {
    const receivedQty = line.material_id ? (receivedQtyByMaterial.get(line.material_id) ?? 0) : 0
    const pending = Math.max(0, line.qty_planned - receivedQty)
    if (pending > 0) {
      notYetReceived.push({
        key: line.key,
        material_id: line.material_id,
        description: line.description,
        unit: line.unit,
        qty_planned: line.qty_planned,
        qty_received: receivedQty,
        qty_pending: pending,
      })
    }
  }

  return {
    received,
    notYetReceived: notYetReceived.sort((a, b) => a.description.localeCompare(b.description, 'ar')),
    pendingClientReturn,
    has_boq: planned.has_boq || planned.lines.length > 0,
  }
}

/** مشاريع لها حركات عهدة (project_materials أو stock_ledger) */
export async function fetchCustodyProjectIds(tenantId: string): Promise<number[]> {
  const [{ data: pmRows }, { data: ledgerRows }] = await Promise.all([
    supabase.from('project_materials').select('project_id').eq('tenant_id', tenantId),
    supabase.from('stock_ledger').select('project_id').eq('tenant_id', tenantId).not('project_id', 'is', null),
  ])
  const ids = new Set<number>()
  for (const row of pmRows || []) ids.add(row.project_id as number)
  for (const row of ledgerRows || []) if (row.project_id) ids.add(row.project_id as number)
  return Array.from(ids)
}

export async function fetchProjectCustodyDetail(
  tenantId: string,
  projectId: number,
  projectName?: string | null,
): Promise<ProjectCustodyDetail> {
  const [{ data: pmRows }, planned, projectRes] = await Promise.all([
    supabase
      .from('project_materials')
      .select('material_id, qty_received, qty_issued, qty_returned, qty_balance, material:materials(name, unit, catalog_no), warehouse:warehouses(name)')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId),
    fetchPlannedMaterialLines(tenantId, projectId),
    projectName ? Promise.resolve({ data: { name: projectName } }) :
      supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
  ])

  const resolvedName = projectName || (projectRes.data as { name?: string } | null)?.name || null

  const receivedByMaterial = new Map<number, CustodyMaterialRow>()
  for (const row of (pmRows || []) as ProjectMaterialRow[]) {
    const mid = row.material_id
    const mat = unwrapJoin(row.material)
    const wh = unwrapJoin(row.warehouse)
    const prev = receivedByMaterial.get(mid)
    if (prev) {
      prev.qty_received += num(row.qty_received)
      prev.qty_issued += num(row.qty_issued)
      prev.qty_returned += num(row.qty_returned)
      prev.qty_balance += num(row.qty_balance)
      if (wh?.name && prev.warehouse_name && !prev.warehouse_name.includes(wh.name)) {
        prev.warehouse_name = `${prev.warehouse_name}، ${wh.name}`
      }
    } else {
      receivedByMaterial.set(mid, {
        key: `m-${mid}`,
        material_id: mid,
        name: mat?.name || `مادة #${mid}`,
        unit: mat?.unit || 'قطعة',
        catalog_no: mat?.catalog_no,
        warehouse_name: wh?.name || null,
        qty_received: num(row.qty_received),
        qty_issued: num(row.qty_issued),
        qty_returned: num(row.qty_returned),
        qty_balance: num(row.qty_balance),
      })
    }
  }

  if (receivedByMaterial.size === 0) {
    const ledgerMap = await fetchCustodyFromLedger(tenantId, projectId, resolvedName)
    const receivedByName = new Map<string, CustodyMaterialRow>()
    ledgerMap.forEach((row, key) => receivedByName.set(String(key), row))
    return buildCustodySections(receivedByMaterial, receivedByName, planned)
  }

  return buildCustodySections(receivedByMaterial, new Map(), planned)
}

export type ProjectCustodyListItem = {
  id: number
  name: string
  status?: string
  location?: string
  team_id?: number | null
  engineer?: string
  material_count: number
  active_balance_count: number
  pending_receive_count: number
  pending_return_count: number
}

export async function fetchProjectCustodyListSummary(
  tenantId: string,
  branchId: number,
  projectIds: number[],
): Promise<Record<number, Pick<ProjectCustodyListItem, 'material_count' | 'active_balance_count' | 'pending_receive_count' | 'pending_return_count'>>> {
  const summary: Record<number, Pick<ProjectCustodyListItem, 'material_count' | 'active_balance_count' | 'pending_receive_count' | 'pending_return_count'>> = {}
  if (!projectIds.length) return summary

  await Promise.all(projectIds.map(async (pid) => {
    const detail = await fetchProjectCustodyDetail(tenantId, pid)
    summary[pid] = {
      material_count: detail.received.length,
      active_balance_count: detail.pendingClientReturn.length,
      pending_receive_count: detail.notYetReceived.length,
      pending_return_count: detail.pendingClientReturn.length,
    }
  }))
  return summary
}
