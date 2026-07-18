/** استيراد كميات المشروع — Excel / CSV / UDS */

export type BoqLineSource = 'manual' | 'excel' | 'csv'
export type BoqMatchStatus = 'matched' | 'review' | 'manual'

export type BoqImportLine = {
  item_code: string
  description: string
  unit: string
  qty: number
  unit_price: number
  source: BoqLineSource
  matchStatus: BoqMatchStatus
  importErrors?: string[]
}

export type FrameworkItemRef = {
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
}

export const BOQ_IMPORT_COLUMNS = [
  'كود البند',
  'الوصف',
  'الكمية',
  'الوحدة',
  'سعر الوحدة',
] as const

const CODE_KEYS = ['كود البند', 'رقم البند', 'item_code', 'catalog_no', 'code', 'رقم', 'item code', 'catalog']
const DESC_KEYS = ['الوصف', 'description', 'desc', 'بيان', 'البند']
const UNIT_KEYS = ['الوحدة', 'unit', 'uom', 'وحدة']
const QTY_KEYS = ['الكمية', 'qty', 'quantity', 'qty_planned', 'كمية', 'planned qty']
const PRICE_KEYS = ['سعر الوحدة', 'unit_price', 'price', 'سعر', 'unit price']

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return str(row[k])
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  )
  for (const k of keys) {
    const v = lower[k.toLowerCase()]
    if (v !== undefined && v !== '') return str(v)
  }
  return ''
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}

export function buildFrameworkMap(items: FrameworkItemRef[]): Map<string, FrameworkItemRef> {
  const map = new Map<string, FrameworkItemRef>()
  for (const item of items) {
    map.set(normalizeCode(item.item_code), item)
  }
  return map
}

export function matchBoqLine(
  raw: { item_code: string; description: string; unit: string; qty: number; unit_price: number },
  frameworkMap: Map<string, FrameworkItemRef>,
  source: BoqLineSource,
): BoqImportLine {
  const errors: string[] = []
  const code = raw.item_code.trim()
  const fw = code ? frameworkMap.get(normalizeCode(code)) : undefined

  if (!raw.description && !code) errors.push('الوصف أو كود البند مطلوب')
  if (!raw.qty || raw.qty <= 0) errors.push('الكمية يجب أن تكون أكبر من صفر')

  let matchStatus: BoqMatchStatus = 'review'
  if (!code && raw.description) matchStatus = 'manual'
  else if (fw) matchStatus = 'matched'
  else if (code) matchStatus = 'review'

  return {
    item_code: code,
    description: fw?.description_ar || raw.description || code,
    unit: fw?.unit || raw.unit || 'EA',
    qty: raw.qty,
    unit_price: fw?.unit_price ?? raw.unit_price ?? 0,
    source,
    matchStatus,
    importErrors: errors.length ? errors : undefined,
  }
}

export function parseBoqImportRows(
  rows: Record<string, unknown>[],
  frameworkMap: Map<string, FrameworkItemRef>,
  source: BoqLineSource,
): BoqImportLine[] {
  const out: BoqImportLine[] = []
  rows.forEach((row) => {
    const code = pickField(row, CODE_KEYS)
    const desc = pickField(row, DESC_KEYS)
    const unit = pickField(row, UNIT_KEYS) || 'EA'
    const qtyRaw = pickField(row, QTY_KEYS) || row[Object.keys(row)[2]]
    const priceRaw = pickField(row, PRICE_KEYS)
    const qty = num(qtyRaw)

    if (!code && !desc) return
    if (code.startsWith('#') || desc.startsWith('#')) return

    const line = matchBoqLine(
      {
        item_code: code,
        description: desc,
        unit,
        qty: Number.isFinite(qty) ? qty : 0,
        unit_price: num(priceRaw) || 0,
      },
      frameworkMap,
      source,
    )
    if (line.importErrors?.length && !code && !desc) return
    out.push({ ...line, importErrors: line.importErrors?.length ? line.importErrors : undefined })
  })
  return out
}

/** Parse CSV text (UDS export or simple template) */
export function parseBoqCsvText(
  text: string,
  frameworkMap: Map<string, FrameworkItemRef>,
): BoqImportLine[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []

  const headerParts = splitCsvLine(lines[0]).map(h => h.trim())
  const hasHeader = CODE_KEYS.some(k => headerParts.some(h => h.toLowerCase() === k.toLowerCase()))
    || DESC_KEYS.some(k => headerParts.some(h => h.includes('وصف') || h.toLowerCase() === 'description'))

  if (hasHeader) {
    const rows = lines.slice(1).map(line => {
      const parts = splitCsvLine(line)
      const row: Record<string, unknown> = {}
      headerParts.forEach((h, i) => { row[h] = parts[i] ?? '' })
      return row
    })
    return parseBoqImportRows(rows, frameworkMap, 'csv')
  }

  // بدون رأس: كود، كمية، وحدة (اختياري)
  const rows = lines.map(line => {
    const [item_code, qty, unit, ...rest] = splitCsvLine(line)
    return {
      item_code: item_code?.trim() ?? '',
      qty: qty?.trim() ?? '',
      unit: unit?.trim() ?? 'EA',
      description: rest.join(',').trim(),
    } as Record<string, unknown>
  })
  return parseBoqImportRows(rows, frameworkMap, 'csv')
}

function splitCsvLine(line: string): string[] {
  const parts: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ; continue }
    if (c === ',' && !inQ) { parts.push(cur); cur = ''; continue }
    cur += c
  }
  parts.push(cur)
  return parts
}

export type BoqMergeMode = 'merge' | 'append' | 'replace_all'

export function mergeBoqLines(
  existing: BoqImportLine[],
  imported: BoqImportLine[],
  mode: BoqMergeMode,
): BoqImportLine[] {
  if (mode === 'replace_all') return imported.length ? imported : existing

  const result = mode === 'append'
    ? [...existing]
    : existing.filter(l => l.matchStatus === 'manual')

  const byCode = new Map<string, number>()
  result.forEach((l, i) => {
    if (l.item_code) byCode.set(normalizeCode(l.item_code), i)
  })

  for (const imp of imported) {
    if (!imp.item_code) {
      result.push(imp)
      continue
    }
    const key = normalizeCode(imp.item_code)
    const idx = byCode.get(key)
    if (idx !== undefined) {
      result[idx] = { ...imp, matchStatus: imp.matchStatus }
    } else {
      byCode.set(key, result.length)
      result.push(imp)
    }
  }
  return result
}

export function boqImportSummary(lines: BoqImportLine[]) {
  return {
    total: lines.length,
    matched: lines.filter(l => l.matchStatus === 'matched').length,
    review: lines.filter(l => l.matchStatus === 'review').length,
    manual: lines.filter(l => l.matchStatus === 'manual').length,
    invalid: lines.filter(l => l.importErrors?.length).length,
  }
}

export async function downloadBoqImportTemplate() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    [...BOQ_IMPORT_COLUMNS],
    ['201020101', 'استبدال عمود حديدي', 5, 'EA', ''],
    ['101000001', 'المسح الأرضي', 2.5, 'KM', ''],
    ['', 'بند بدون كود — يدوي', 1, 'EA', ''],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'كميات UDS')
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ['تعليمات استيراد كميات المشروع'],
    [''],
    ['① حمّل هذا النموذج أو صدّر من UDS'],
    ['② املأ: كود البند، الوصف، الكمية، الوحدة'],
    ['③ سعر الوحدة اختياري — يُملأ من العقد الإطاري إن وُجد الكود'],
    ['④ ارفع الملف في تبويب الكميات الابتدائية'],
    [''],
    ['ملاحظة: البنود غير المطابقة للعقد تظهر للمراجعة — أضفها يدوياً'],
  ])
  XLSX.utils.book_append_sheet(wb, wsInfo, 'تعليمات')
  XLSX.writeFile(wb, 'نموذج_كميات_المشروع.xlsx')
}

export async function readBoqImportFile(
  file: File,
  frameworkItems: FrameworkItemRef[],
): Promise<{ lines: BoqImportLine[]; source: BoqLineSource }> {
  const frameworkMap = buildFrameworkMap(frameworkItems)
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    return { lines: parseBoqCsvText(text, frameworkMap), source: 'csv' }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
    return { lines: parseBoqImportRows(json, frameworkMap, 'excel'), source: 'excel' }
  }

  throw new Error('نوع الملف غير مدعوم — استخدم .xlsx أو .csv')
}
