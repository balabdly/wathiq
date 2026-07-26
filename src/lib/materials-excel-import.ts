// src/lib/materials-excel-import.ts
// تحويل ملفات Excel (النموذج العربي أو قائمة SEC الرسمية) لصفوف استيراد موحّدة

export type NormalizedMaterialImportRow = {
  name: string
  unit: string
  catalog_no: string | null
  sec_number: string | null
  mat_code: string | null
  item_code: string | null
  source: 'SEC' | 'خاص'
  qty: number
  reorder: number
  location: string | null
}

const SEC_UNIT_MAP: Record<string, string> = {
  MTR: 'متر',
  M: 'متر',
  EA: 'قطعة',
  PCS: 'قطعة',
  PC: 'قطعة',
  KIT: 'علبة',
  ROLL: 'رول',
}

export function mapSecUnit(raw: unknown): string {
  const key = String(raw || '').trim().toUpperCase()
  return SEC_UNIT_MAP[key] || 'قطعة'
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]).trim()
    const lower = k.toLowerCase()
    for (const [rk, rv] of Object.entries(row)) {
      if (rk.toLowerCase() === lower && String(rv).trim()) return String(rv).trim()
    }
  }
  return ''
}

export function isSecMatExcelRow(row: Record<string, unknown>): boolean {
  return Boolean(cell(row, 'Item No', 'ITEM NO', 'item no'))
}

function parseSecMatFormat(rawRows: Record<string, unknown>[]): NormalizedMaterialImportRow[] {
  const seenSec = new Set<string>()
  const nameCount = new Map<string, number>()
  const out: NormalizedMaterialImportRow[] = []

  for (const row of rawRows) {
    const itemNo = cell(row, 'Item No', 'ITEM NO', 'item no')
    let name = cell(row, 'Description', 'DESCRIPTION', 'description')
    if (!itemNo || !name) continue
    if (seenSec.has(itemNo)) continue
    seenSec.add(itemNo)

    const base = name
    const n = (nameCount.get(base) || 0) + 1
    nameCount.set(base, n)
    if (n > 1) name = `${base} [${itemNo}]`

    out.push({
      name,
      unit: mapSecUnit(row.Unit ?? row.UNIT ?? row.unit),
      catalog_no: itemNo,
      sec_number: itemNo,
      mat_code: itemNo,
      item_code: itemNo,
      source: 'SEC',
      qty: 0,
      reorder: 0,
      location: null,
    })
  }
  return out
}

function parseArabicTemplateFormat(rawRows: Record<string, unknown>[]): NormalizedMaterialImportRow[] {
  return rawRows
    .filter(r => {
      const name = cell(r, 'اسم المادة', 'name')
      return name && !name.startsWith('#')
    })
    .map(row => {
      const srcRaw = cell(row, 'المصدر', 'source').toUpperCase()
      const isSec = srcRaw === 'SEC' || srcRaw.includes('كهرب')
      const sec = cell(row, 'رقم SEC', 'sec_number') || null
      const catalog = cell(row, 'رقم الكتالوج', 'catalog_no') || sec || null
      return {
        name: cell(row, 'اسم المادة', 'name'),
        unit: cell(row, 'الوحدة', 'unit') || 'قطعة',
        catalog_no: catalog,
        sec_number: sec,
        mat_code: sec,
        item_code: sec,
        source: isSec ? 'SEC' as const : 'خاص' as const,
        qty: Number(row['الكمية'] ?? row.qty ?? 0) || 0,
        reorder: Number(row['حد الأمان'] ?? row.reorder ?? 0) || 0,
        location: cell(row, 'الموقع في المستودع', 'الموقع', 'location') || null,
      }
    })
}

/** يكتشف تلقائياً: قائمة SEC (Item No + Description) أو النموذج العربي */
export function parseExcelMaterialRows(rawRows: Record<string, unknown>[]): NormalizedMaterialImportRow[] {
  if (!rawRows.length) return []
  if (rawRows.some(isSecMatExcelRow)) return parseSecMatFormat(rawRows)
  return parseArabicTemplateFormat(rawRows)
}

export function detectExcelImportFormat(rawRows: Record<string, unknown>[]): 'sec' | 'arabic' {
  return rawRows.some(isSecMatExcelRow) ? 'sec' : 'arabic'
}
