import { supabase } from '@/lib/supabase'

function num(v: unknown): number {
  return Number(v) || 0
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

export async function fetchProjectCustodyDetail(
  tenantId: string,
  projectId: number,
): Promise<ProjectCustodyDetail> {
  const [{ data: pmRows }, planned] = await Promise.all([
    supabase
      .from('project_materials')
      .select('material_id, qty_received, qty_issued, qty_returned, qty_balance, material:materials(name, unit, catalog_no), warehouse:warehouses(name)')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId),
    fetchPlannedMaterialLines(tenantId, projectId),
  ])

  const receivedByMaterial = new Map<number, CustodyMaterialRow>()
  for (const row of pmRows || []) {
    const mid = row.material_id as number
    const mat = row.material as { name: string; unit: string; catalog_no?: string } | null
    const wh = row.warehouse as { name: string } | null
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

  const received = Array.from(receivedByMaterial.values())
    .filter(r => r.qty_received > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  const pendingClientReturn = received
    .filter(r => r.qty_balance > 0)
    .sort((a, b) => b.qty_balance - a.qty_balance)

  const notYetReceived: CustodyPendingReceiveRow[] = []
  const usedMaterialIds = new Set<number>()

  for (const line of planned.lines) {
    if (line.material_id) usedMaterialIds.add(line.material_id)
    const receivedQty = line.material_id ? (receivedByMaterial.get(line.material_id)?.qty_received ?? 0) : 0
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

  // مواد مستلمة بدون مقايسة — لا تظهر في «غير المستلمة» (تظهر في المستلمة فقط)
  for (const row of received) {
    if (row.material_id && !usedMaterialIds.has(row.material_id)) {
      // received but not in plan — already in received list
    }
  }

  return {
    received,
    notYetReceived: notYetReceived.sort((a, b) => a.description.localeCompare(b.description, 'ar')),
    pendingClientReturn,
    has_boq: planned.has_boq || planned.lines.length > 0,
  }
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
