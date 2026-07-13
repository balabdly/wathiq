import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

export type FuelMode = 'manual' | 'drees'

export type FleetFuelSettings = {
  fuel_mode: FuelMode
}

export const DEFAULT_FLEET_FUEL_SETTINGS: FleetFuelSettings = { fuel_mode: 'manual' }

export function parseFleetFuelSettings(raw: unknown): FleetFuelSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FLEET_FUEL_SETTINGS }
  const mode = (raw as { fuel_mode?: string }).fuel_mode
  return { fuel_mode: mode === 'drees' ? 'drees' : 'manual' }
}

export function isDreesFuelEnabled(settings: FleetFuelSettings): boolean {
  return settings.fuel_mode === 'drees'
}

export async function loadFleetFuelSettings(tenantId: string): Promise<FleetFuelSettings> {
  const { data } = await supabase.from('tenants').select('fleet_settings').eq('id', tenantId).maybeSingle()
  return parseFleetFuelSettings(data?.fleet_settings)
}

export async function saveFleetFuelSettings(tenantId: string, settings: FleetFuelSettings): Promise<boolean> {
  const { error } = await supabase.from('tenants').update({ fleet_settings: settings }).eq('id', tenantId)
  return !error
}

export type ParsedDreesRow = {
  rowIndex: number
  externalRef: string
  fillDate: string
  dreesCardNo: string
  plateNo?: string
  liters: number
  cost: number
  stationName?: string
  fuelProduct?: string
  kmReading?: number
}

export type MatchedDreesRow = ParsedDreesRow & {
  unitId?: number
  unitLabel?: string
  status: 'matched' | 'unmatched' | 'duplicate'
}

const HEADER_ALIASES: Record<keyof Omit<ParsedDreesRow, 'rowIndex' | 'externalRef'>, string[]> = {
  fillDate: ['تاريخ', 'التاريخ', 'date', 'transaction date', 'txn date', 'fill date'],
  dreesCardNo: ['شريحة', 'الشريحة', 'رقم الشريحة', 'بطاقة', 'رقم البطاقة', 'card', 'card no', 'card number', 'chip'],
  plateNo: ['لوحة', 'رقم اللوحة', 'plate', 'plate no', 'vehicle plate'],
  liters: ['لتر', 'لترات', 'الكمية', 'qty', 'quantity', 'liters', 'volume'],
  cost: ['مبلغ', 'المبلغ', 'amount', 'total', 'cost', 'قيمة', 'الإجمالي'],
  stationName: ['محطة', 'المحطة', 'station', 'station name', 'site'],
  fuelProduct: ['نوع', 'المنتج', 'product', 'fuel', 'fuel type', 'نوع الوقود'],
  kmReading: ['عداد', 'العداد', 'km', 'odometer', 'mileage', 'قراءة'],
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader)
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h === alias || h.includes(alias))
    if (idx >= 0) return idx
  }
  return -1
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function cellNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseExcelDate(v: unknown): string {
  if (v == null || v === '') return new Date().toISOString().split('T')[0]
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${mm}-${dd}`
    }
  }
  const s = cellStr(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return new Date().toISOString().split('T')[0]
}

function normalizeCardNo(v: string): string {
  return v.replace(/\s+/g, '').replace(/^0+/, '') || v.trim()
}

export function parseDreesSpreadsheet(buffer: ArrayBuffer): ParsedDreesRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  let headerRowIdx = 0
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = (rows[i] || []).map(c => cellStr(c).toLowerCase()).join(' ')
    if (line.includes('شريحة') || line.includes('بطاق') || line.includes('card') || line.includes('لتر')) {
      headerRowIdx = i
      break
    }
  }

  const headers = (rows[headerRowIdx] || []).map(c => cellStr(c))
  const colDate = findColumn(headers, HEADER_ALIASES.fillDate)
  const colCard = findColumn(headers, HEADER_ALIASES.dreesCardNo)
  const colPlate = findColumn(headers, HEADER_ALIASES.plateNo)
  const colLiters = findColumn(headers, HEADER_ALIASES.liters)
  const colCost = findColumn(headers, HEADER_ALIASES.cost)
  const colStation = findColumn(headers, HEADER_ALIASES.stationName)
  const colProduct = findColumn(headers, HEADER_ALIASES.fuelProduct)
  const colKm = findColumn(headers, HEADER_ALIASES.kmReading)

  if (colCard < 0 && colPlate < 0) {
    throw new Error('لم يُعثر على عمود الشريحة أو اللوحة — تأكد من صيغة تقرير الدريس')
  }
  if (colLiters < 0 && colCost < 0) {
    throw new Error('لم يُعثر على عمود اللترات أو المبلغ')
  }

  const parsed: ParsedDreesRow[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const card = colCard >= 0 ? cellStr(row[colCard]) : ''
    const plate = colPlate >= 0 ? cellStr(row[colPlate]) : ''
    const liters = colLiters >= 0 ? cellNum(row[colLiters]) : 0
    const cost = colCost >= 0 ? cellNum(row[colCost]) : 0
    if (!card && !plate) continue
    if (liters <= 0 && cost <= 0) continue

    const fillDate = colDate >= 0 ? parseExcelDate(row[colDate]) : new Date().toISOString().split('T')[0]
    const externalRef = [fillDate, normalizeCardNo(card || plate), liters, cost, i].join('|')

    parsed.push({
      rowIndex: i + 1,
      externalRef,
      fillDate,
      dreesCardNo: card || plate,
      plateNo: plate || undefined,
      liters,
      cost,
      stationName: colStation >= 0 ? cellStr(row[colStation]) || undefined : undefined,
      fuelProduct: colProduct >= 0 ? cellStr(row[colProduct]) || undefined : undefined,
      kmReading: colKm >= 0 ? cellNum(row[colKm]) || undefined : undefined,
    })
  }
  return parsed
}

export async function readDreesFile(file: File): Promise<ParsedDreesRow[]> {
  const buffer = await file.arrayBuffer()
  return parseDreesSpreadsheet(buffer)
}

export type UnitFuelLink = {
  id: number
  fleet_no: string
  name: string
  plate_no?: string | null
  drees_card_no?: string | null
}

export function matchDreesRows(
  rows: ParsedDreesRow[],
  units: UnitFuelLink[],
  existingRefs: Set<string>,
): MatchedDreesRow[] {
  const byCard = new Map<string, UnitFuelLink>()
  const byPlate = new Map<string, UnitFuelLink>()
  for (const u of units) {
    if (u.drees_card_no) byCard.set(normalizeCardNo(u.drees_card_no), u)
    if (u.plate_no) byPlate.set(u.plate_no.replace(/\s+/g, ''), u)
  }

  return rows.map(row => {
    if (existingRefs.has(row.externalRef)) {
      return { ...row, status: 'duplicate' as const }
    }
    const cardKey = normalizeCardNo(row.dreesCardNo)
    let unit = byCard.get(cardKey)
    if (!unit && row.plateNo) {
      unit = byPlate.get(row.plateNo.replace(/\s+/g, ''))
    }
    if (!unit) {
      return { ...row, status: 'unmatched' as const }
    }
    return {
      ...row,
      unitId: unit.id,
      unitLabel: `${unit.fleet_no} ${unit.name}`,
      status: 'matched' as const,
    }
  })
}

export async function loadExistingFuelRefs(tenantId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('fleet_fuel_logs')
    .select('external_ref')
    .eq('tenant_id', tenantId)
    .not('external_ref', 'is', null)
  return new Set((data || []).map(r => r.external_ref as string))
}

export async function importDreesFuelBatch(params: {
  tenantId: string
  fileName: string
  periodLabel?: string
  importedBy?: string
  rows: MatchedDreesRow[]
}): Promise<{ ok: boolean; batchId?: number; imported?: number; error?: string }> {
  const toImport = params.rows.filter(r => r.status === 'matched')
  if (toImport.length === 0) {
    return { ok: false, error: 'لا توجد صفوف مطابقة للاستيراد' }
  }

  const matched = toImport.length
  const unmatched = params.rows.filter(r => r.status === 'unmatched').length
  const duplicate = params.rows.filter(r => r.status === 'duplicate').length
  const totalLiters = toImport.reduce((s, r) => s + r.liters, 0)
  const totalCost = toImport.reduce((s, r) => s + r.cost, 0)

  const { data: batch, error: batchErr } = await supabase
    .from('fleet_fuel_import_batches')
    .insert({
      tenant_id: params.tenantId,
      file_name: params.fileName,
      period_label: params.periodLabel || null,
      row_count: params.rows.length,
      matched_count: matched,
      unmatched_count: unmatched,
      duplicate_count: duplicate,
      total_liters: totalLiters,
      total_cost: totalCost,
      imported_by: params.importedBy || null,
    })
    .select('id')
    .single()

  if (batchErr || !batch) return { ok: false, error: batchErr?.message || 'فشل إنشاء الدفعة' }

  const inserts = toImport.map(r => ({
    tenant_id: params.tenantId,
    unit_id: r.unitId!,
    fill_date: r.fillDate,
    liters: r.liters,
    cost: r.cost,
    km_reading: r.kmReading ?? null,
    payment_method: 'بطاقة وقود — الدريس',
    source: 'drees_import',
    external_ref: r.externalRef,
    drees_card_no: r.dreesCardNo,
    station_name: r.stationName || null,
    fuel_product: r.fuelProduct || null,
    import_batch_id: batch.id,
    notes: r.stationName ? `محطة: ${r.stationName}` : null,
  }))

  const { error: insErr } = await supabase.from('fleet_fuel_logs').insert(inserts)
  if (insErr) {
    await supabase.from('fleet_fuel_import_batches').delete().eq('id', batch.id)
    return { ok: false, error: insErr.message }
  }

  return { ok: true, batchId: batch.id, imported: toImport.length }
}
