import { supabase } from '@/lib/supabase'

function num(v: unknown): number {
  return Number(v) || 0
}

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[]))
}

export type CustodyMovementKind = 'receive' | 'issue' | 'return_client' | 'return_site' | 'other'

export type CustodyMovementEvent = {
  id: number
  date: string
  kind: CustodyMovementKind
  kind_label: string
  qty: number
  unit: string
  txn_number?: string | null
  booking_no?: string | null
  exit_permit_no?: string | null
  doc_code?: string | null
  client_name?: string | null
  vendor_name?: string | null
  wh_name?: string | null
  note?: string | null
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
  /** إرجاع فعلي للعميل (SEC) فقط */
  qty_returned_client: number
  /** مرتجع موقع → المستودع (ليس إرجاع عميل) */
  qty_returned_site: number
  qty_balance: number
  events: CustodyMovementEvent[]
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

export type ProjectCustodyMeta = {
  booking_numbers: string[]
  exit_permits: string[]
  doc_codes: string[]
  client_names: string[]
  reservation_number?: string | null
}

export type CustodyVoucherKind = 'receive' | 'issue' | 'return_client' | 'return_site' | 'loan'

export type CustodyVoucherLine = {
  mat_name: string
  unit: string
  qty: number
  note?: string
}

export type CustodyVoucherDoc = {
  no: string
  legacy: boolean
  date: string
  wh_name: string
  kind: CustodyVoucherKind
  kind_label: string
  booking_no?: string | null
  exit_permit_no?: string | null
  loan_from_project?: string | null
  loan_to_project?: string | null
  lines: CustodyVoucherLine[]
}

export type CustodyVoucherSummary = {
  receive: CustodyVoucherDoc[]
  issue: CustodyVoucherDoc[]
  return_client: CustodyVoucherDoc[]
  return_site: CustodyVoucherDoc[]
  loan: CustodyVoucherDoc[]
  counts: {
    receive: number
    issue: number
    return_client: number
    return_site: number
    loan: number
  }
}

export type ProjectCustodyDetail = {
  received: CustodyMaterialRow[]
  notYetReceived: CustodyPendingReceiveRow[]
  pendingInWarehouse: CustodyMaterialRow[]
  has_boq: boolean
  meta: ProjectCustodyMeta
}

export type ProjectCustodyPageData = ProjectCustodyDetail & {
  project: {
    id: number
    name: string
    code?: string | null
    status?: string | null
    location?: string | null
    client_name?: string | null
  }
  vouchers: CustodyVoucherSummary
  totals: {
    received: number
    issued: number
    returned_client: number
    in_warehouse: number
    pending_receive: number
  }
}

type PlannedLine = {
  key: string
  material_id: number | null
  description: string
  unit: string
  qty_planned: number
}

type LedgerRow = {
  id: number
  project_id?: number | null
  project_name?: string | null
  type: string
  movement_category?: string | null
  mat_name: string
  mat_code?: string | null
  unit?: string | null
  qty: number
  wh_name?: string | null
  is_loan?: boolean | null
  created_at: string
  txn_number?: string | null
  booking_no?: string | null
  exit_permit_no?: string | null
  doc_code?: string | null
  client_name?: string | null
  vendor_name?: string | null
  dispatch_note?: string | null
  loan_from_project?: string | null
  loan_to_project?: string | null
}

const KIND_LABELS: Record<CustodyMovementKind, string> = {
  receive: 'استلام من العميل',
  issue: 'صرف للموقع',
  return_client: 'إرجاع للعميل',
  return_site: 'مرتجع موقع → المستودع',
  other: 'حركة أخرى',
}

export function classifyCustodyMovement(type: string, cat?: string | null, isLoan?: boolean | null): CustodyMovementKind {
  if (isLoan) return 'other'
  const c = (cat || '').trim()
  if (c === 'ارجاع_عميل' || type === 'إرجاع للعميل') return 'return_client'
  if (c === 'مرتجع_موقع' || c === 'ارجاع_مستودع') return 'return_site'
  if (type === 'استلام' || type === 'توريد' || c.includes('استلام')) return 'receive'
  if (type === 'صرف' || c.includes('صرف')) return 'issue'
  return 'other'
}

function ledgerToEvent(row: LedgerRow): CustodyMovementEvent {
  const kind = classifyCustodyMovement(row.type, row.movement_category, row.is_loan)
  return {
    id: row.id,
    date: row.created_at,
    kind,
    kind_label: KIND_LABELS[kind],
    qty: num(row.qty),
    unit: row.unit || 'قطعة',
    txn_number: row.txn_number,
    booking_no: row.booking_no,
    exit_permit_no: row.exit_permit_no,
    doc_code: row.doc_code,
    client_name: row.client_name,
    vendor_name: row.vendor_name,
    wh_name: row.wh_name,
    note: row.dispatch_note,
  }
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
    .select('description, unit, qty_planned')
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

async function fetchProjectLedgerRows(
  tenantId: string,
  projectId: number,
  projectName?: string | null,
): Promise<LedgerRow[]> {
  const [{ data: byId }, { data: byName }] = await Promise.all([
    supabase.from('stock_ledger')
      .select('id, type, movement_category, mat_name, mat_code, unit, qty, wh_name, is_loan, created_at, txn_number, booking_no, exit_permit_no, doc_code, client_name, vendor_name, dispatch_note, loan_from_project, loan_to_project')
      .eq('tenant_id', tenantId).eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    projectName
      ? supabase.from('stock_ledger')
          .select('id, type, movement_category, mat_name, mat_code, unit, qty, wh_name, is_loan, created_at, txn_number, booking_no, exit_permit_no, doc_code, client_name, vendor_name, dispatch_note, loan_from_project, loan_to_project')
          .eq('tenant_id', tenantId).eq('project_name', projectName)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as LedgerRow[] }),
  ])

  const seen = new Set<number>()
  const rows: LedgerRow[] = []
  for (const row of [...(byId || []), ...(byName || [])] as LedgerRow[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return rows
}

function buildMaterialsFromLedger(
  ledgerRows: LedgerRow[],
  materialMeta: Map<number, { name: string; unit: string; catalog_no?: string | null; warehouse_name?: string | null }>,
): Map<string, CustodyMaterialRow> {
  const byKey = new Map<string, CustodyMaterialRow>()

  for (const row of ledgerRows) {
    if (row.is_loan) continue
    const event = ledgerToEvent(row)
    const key = row.mat_name?.trim() || 'unknown'
    const meta = Array.from(materialMeta.values()).find(m => m.name === key)
    const prev = byKey.get(key)
    const base: CustodyMaterialRow = prev || {
      key: `mat-${key}`,
      material_id: null,
      name: key,
      unit: row.unit || meta?.unit || 'قطعة',
      catalog_no: meta?.catalog_no,
      warehouse_name: row.wh_name || meta?.warehouse_name || null,
      qty_received: 0,
      qty_issued: 0,
      qty_returned_client: 0,
      qty_returned_site: 0,
      qty_balance: 0,
      events: [],
    }

    base.events.push(event)
    const qty = num(row.qty)
    if (event.kind === 'receive') base.qty_received += qty
    else if (event.kind === 'issue') base.qty_issued += qty
    else if (event.kind === 'return_client') base.qty_returned_client += qty
    else if (event.kind === 'return_site') base.qty_received += qty

    if (row.wh_name && base.warehouse_name && !base.warehouse_name.includes(row.wh_name)) {
      base.warehouse_name = `${base.warehouse_name}، ${row.wh_name}`
    } else if (row.wh_name && !base.warehouse_name) {
      base.warehouse_name = row.wh_name
    }

    byKey.set(key, base)
  }

  Array.from(byKey.values()).forEach(row => {
    row.qty_balance = Math.max(0, row.qty_received - row.qty_issued - row.qty_returned_client)
  })
  return byKey
}

function mergePmBalances(
  materials: Map<string, CustodyMaterialRow>,
  pmRows: {
    material_id: number
    qty_balance: number | null
    material: { name: string; unit: string; catalog_no?: string | null } | { name: string; unit: string; catalog_no?: string | null }[] | null
    warehouse: { name: string } | { name: string }[] | null
  }[],
) {
  for (const row of pmRows) {
    const mat = unwrapJoin(row.material)
    const wh = unwrapJoin(row.warehouse)
    const name = mat?.name || `مادة #${row.material_id}`
    const existing = materials.get(name)
    if (existing) {
      existing.material_id = row.material_id
      if (mat?.catalog_no) existing.catalog_no = mat.catalog_no
      if (wh?.name) existing.warehouse_name = wh.name
      // لا نستبدل qty_balance — يُحسب من الحركات (مستلم − مصروف − إرجاع)
    } else if (num(row.qty_balance) > 0 || mat) {
      materials.set(name, {
        key: `m-${row.material_id}`,
        material_id: row.material_id,
        name,
        unit: mat?.unit || 'قطعة',
        catalog_no: mat?.catalog_no,
        warehouse_name: wh?.name || null,
        qty_received: 0,
        qty_issued: 0,
        qty_returned_client: 0,
        qty_returned_site: 0,
        qty_balance: 0,
        events: [],
      })
    }
  }
}

/** متبقي العهدة = مستلم − مصروف − إرجاع للعميل */
function recalculateCustodyBalances(materials: Map<string, CustodyMaterialRow>) {
  Array.from(materials.values()).forEach(row => {
    row.qty_balance = Math.max(0, row.qty_received - row.qty_issued - row.qty_returned_client)
  })
}

function buildMetaFromLedger(ledgerRows: LedgerRow[], reservationNumber?: string | null): ProjectCustodyMeta {
  return {
    booking_numbers: uniqueStrings(ledgerRows.map(r => r.booking_no)),
    exit_permits: uniqueStrings(ledgerRows.map(r => r.exit_permit_no)),
    doc_codes: uniqueStrings(ledgerRows.map(r => r.doc_code)),
    client_names: uniqueStrings(ledgerRows.map(r => r.client_name)),
    reservation_number: reservationNumber || ledgerRows.find(r => r.booking_no)?.booking_no || null,
  }
}

function voucherKindFromRow(row: LedgerRow): Exclude<CustodyMovementKind, 'other'> | null {
  const kind = classifyCustodyMovement(row.type, row.movement_category, row.is_loan)
  return kind === 'other' ? null : kind
}

function loanVoucherLabel(first: LedgerRow): string {
  const note = (first.dispatch_note || '').trim()
  if (note.startsWith('تسوية')) return 'تسوية استعارة'
  return 'استعارة بين مشاريع'
}

export function buildCustodyVouchersFromLedger(ledgerRows: LedgerRow[]): CustodyVoucherSummary {
  const regularGrouped = new Map<string, LedgerRow[]>()
  const loanGrouped = new Map<string, LedgerRow[]>()

  for (const row of ledgerRows) {
    const key = row.txn_number || `legacy-${row.id}`
    if (row.is_loan) {
      const list = loanGrouped.get(key) || []
      list.push(row)
      loanGrouped.set(key, list)
    } else if (voucherKindFromRow(row)) {
      const list = regularGrouped.get(key) || []
      list.push(row)
      regularGrouped.set(key, list)
    }
  }

  const buckets: Record<CustodyVoucherKind, CustodyVoucherDoc[]> = {
    receive: [],
    issue: [],
    return_client: [],
    return_site: [],
    loan: [],
  }

  for (const [key, rows] of Array.from(regularGrouped.entries())) {
    const first = rows[0]
    const kind = voucherKindFromRow(first)
    if (!kind) continue
    buckets[kind].push({
      no: first.txn_number || key,
      legacy: !first.txn_number,
      date: first.created_at,
      wh_name: first.wh_name || '—',
      kind,
      kind_label: KIND_LABELS[kind],
      booking_no: first.booking_no,
      exit_permit_no: first.exit_permit_no,
      lines: rows.map((r: LedgerRow) => ({
        mat_name: r.mat_name,
        unit: r.unit || 'قطعة',
        qty: num(r.qty),
      })),
    })
  }

  for (const [key, rows] of Array.from(loanGrouped.entries())) {
    const first = rows[0]
    buckets.loan.push({
      no: first.txn_number || key,
      legacy: !first.txn_number,
      date: first.created_at,
      wh_name: first.wh_name || '—',
      kind: 'loan',
      kind_label: loanVoucherLabel(first),
      booking_no: first.booking_no,
      exit_permit_no: first.exit_permit_no,
      loan_from_project: first.loan_from_project,
      loan_to_project: first.loan_to_project,
      lines: rows.map((r: LedgerRow) => ({
        mat_name: r.mat_name,
        unit: r.unit || 'قطعة',
        qty: num(r.qty),
        note: r.dispatch_note || undefined,
      })),
    })
  }

  for (const kind of Object.keys(buckets) as CustodyVoucherKind[]) {
    buckets[kind].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  return {
    receive: buckets.receive,
    issue: buckets.issue,
    return_client: buckets.return_client,
    return_site: buckets.return_site,
    loan: buckets.loan,
    counts: {
      receive: buckets.receive.length,
      issue: buckets.issue.length,
      return_client: buckets.return_client.length,
      return_site: buckets.return_site.length,
      loan: buckets.loan.length,
    },
  }
}

function buildNotYetReceived(
  planned: { lines: PlannedLine[]; has_boq: boolean },
  materials: CustodyMaterialRow[],
): CustodyPendingReceiveRow[] {
  const receivedByMaterial = new Map<number, number>()
  const receivedByName = new Map<string, number>()
  for (const m of materials) {
    if (m.material_id) receivedByMaterial.set(m.material_id, m.qty_received)
    receivedByName.set(m.name, m.qty_received)
  }

  const rows: CustodyPendingReceiveRow[] = []
  for (const line of planned.lines) {
    const receivedQty = line.material_id
      ? (receivedByMaterial.get(line.material_id) ?? 0)
      : (receivedByName.get(line.description) ?? 0)
    const pending = Math.max(0, line.qty_planned - receivedQty)
    if (pending > 0) {
      rows.push({
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
  return rows.sort((a, b) => a.description.localeCompare(b.description, 'ar'))
}

/** مشاريع لها حركات عهدة */
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

export type CustodyProjectListRow = {
  id: number
  name: string
  code?: string | null
  voucher_counts: CustodyVoucherSummary['counts']
}

const LEDGER_VOUCHER_SELECT = 'id, project_id, project_name, type, movement_category, is_loan, txn_number, created_at, wh_name, mat_name, unit, qty, booking_no, exit_permit_no, dispatch_note, loan_from_project, loan_to_project'

function resolveLedgerProjectId(
  row: { project_id?: number | null; project_name?: string | null },
  nameToId: Map<string, number>,
): number | null {
  if (row.project_id) return row.project_id as number
  if (row.project_name) return nameToId.get(row.project_name) ?? null
  return null
}

/** قائمة المشاريع مع عدّادات الأذون — للصفحة الرئيسية */
export async function fetchCustodyProjectsList(
  tenantId: string,
  branchId?: number | null,
): Promise<CustodyProjectListRow[]> {
  const custodyIds = await fetchCustodyProjectIds(tenantId)
  const custodyIdSet = new Set(custodyIds)

  const { data: allProjects } = await supabase.from('projects')
    .select('id, name, code, status, branch_id')
    .eq('tenant_id', tenantId)
    .order('name')

  let filtered = allProjects || []
  if (branchId) {
    filtered = filtered.filter(p => p.branch_id === branchId || custodyIdSet.has(p.id))
  }

  const projects = filtered.filter(p => custodyIdSet.has(p.id) || p.status !== 'مكتمل')
  if (projects.length === 0) return []

  const projectIds = projects.map(p => p.id)
  const projectNames = projects.map(p => p.name)
  const nameToId = new Map(projects.map(p => [p.name, p.id]))

  const [{ data: byId }, { data: byName }] = await Promise.all([
    supabase.from('stock_ledger').select(LEDGER_VOUCHER_SELECT)
      .eq('tenant_id', tenantId).in('project_id', projectIds),
    supabase.from('stock_ledger').select(LEDGER_VOUCHER_SELECT)
      .eq('tenant_id', tenantId).in('project_name', projectNames).is('project_id', null),
  ])

  const ledgerByProject = new Map<number, LedgerRow[]>()
  const seen = new Set<number>()
  for (const row of [...(byId || []), ...(byName || [])] as LedgerRow[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const pid = resolveLedgerProjectId(row, nameToId)
    if (!pid) continue
    const list = ledgerByProject.get(pid) || []
    list.push(row)
    ledgerByProject.set(pid, list)
  }

  return projects
    .map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      voucher_counts: buildCustodyVouchersFromLedger(ledgerByProject.get(p.id) || []).counts,
    }))
    .sort((a, b) => {
      const aHas = custodyIdSet.has(a.id) ? 1 : 0
      const bHas = custodyIdSet.has(b.id) ? 1 : 0
      if (bHas !== aHas) return bHas - aHas
      return (a.code || a.name).localeCompare(b.code || b.name, 'ar')
    })
}

export async function fetchProjectCustodyPageData(
  tenantId: string,
  projectId: number,
): Promise<ProjectCustodyPageData | null> {
  const [{ data: project }, { data: planning }, { data: pmRows }, planned] = await Promise.all([
    supabase.from('projects').select('id, name, code, status, location, client_name').eq('tenant_id', tenantId).eq('id', projectId).maybeSingle(),
    supabase.from('project_planning').select('material_reservation_number').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
    supabase.from('project_materials')
      .select('material_id, qty_balance, material:materials(name, unit, catalog_no), warehouse:warehouses(name)')
      .eq('tenant_id', tenantId).eq('project_id', projectId),
    fetchPlannedMaterialLines(tenantId, projectId),
  ])

  if (!project) return null

  const ledgerRows = await fetchProjectLedgerRows(tenantId, projectId, project.name)
  const materialMeta = new Map<number, { name: string; unit: string; catalog_no?: string | null; warehouse_name?: string | null }>()
  for (const row of pmRows || []) {
    const mat = unwrapJoin(row.material as { name: string; unit: string; catalog_no?: string | null } | { name: string; unit: string; catalog_no?: string | null }[] | null)
    const wh = unwrapJoin(row.warehouse as { name: string } | { name: string }[] | null)
    if (mat) materialMeta.set(row.material_id as number, { ...mat, warehouse_name: wh?.name || null })
  }

  const materialMap = buildMaterialsFromLedger(ledgerRows, materialMeta)
  mergePmBalances(materialMap, (pmRows || []) as Parameters<typeof mergePmBalances>[1])
  recalculateCustodyBalances(materialMap)

  const received = Array.from(materialMap.values())
    .filter(m => m.qty_received > 0 || m.qty_balance > 0 || m.events.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  const pendingInWarehouse = received
    .filter(m => m.qty_balance > 0)
    .sort((a, b) => b.qty_balance - a.qty_balance)

  const notYetReceived = buildNotYetReceived(planned, received)
  const meta = buildMetaFromLedger(ledgerRows, planning?.material_reservation_number)
  const vouchers = buildCustodyVouchersFromLedger(ledgerRows)

  const totals = received.reduce(
    (acc, m) => ({
      received: acc.received + m.qty_received,
      issued: acc.issued + m.qty_issued,
      returned_client: acc.returned_client + m.qty_returned_client,
      in_warehouse: acc.in_warehouse + m.qty_balance,
      pending_receive: acc.pending_receive,
    }),
    { received: 0, issued: 0, returned_client: 0, in_warehouse: 0, pending_receive: notYetReceived.reduce((s, r) => s + r.qty_pending, 0) },
  )

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      location: project.location,
      client_name: project.client_name,
    },
    received,
    notYetReceived,
    pendingInWarehouse,
    has_boq: planned.has_boq || planned.lines.length > 0,
    meta,
    vouchers,
    totals,
  }
}

/** @deprecated استخدم fetchProjectCustodyPageData */
export async function fetchProjectCustodyDetail(
  tenantId: string,
  projectId: number,
  _projectName?: string | null,
): Promise<ProjectCustodyDetail> {
  const page = await fetchProjectCustodyPageData(tenantId, projectId)
  if (!page) {
    return { received: [], notYetReceived: [], pendingInWarehouse: [], has_boq: false, meta: { booking_numbers: [], exit_permits: [], doc_codes: [], client_names: [] } }
  }
  return {
    received: page.received,
    notYetReceived: page.notYetReceived,
    pendingInWarehouse: page.pendingInWarehouse,
    has_boq: page.has_boq,
    meta: page.meta,
  }
}
