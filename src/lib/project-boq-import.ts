/** استيراد كميات المشروع — Excel / CSV / PDF / صورة UDS */

export type BoqLineSource = 'manual' | 'excel' | 'csv' | 'pdf' | 'image'
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

const UNIT_PATTERN = /^(EA|KM|M|LS|NO|SET|HR|MT|FT|LOT)$/i

/** استخراج بنود من نص خام (PDF / OCR) */
export function parseBoqFromRawText(
  text: string,
  frameworkMap: Map<string, FrameworkItemRef>,
  source: 'pdf' | 'image',
): BoqImportLine[] {
  const rows: Record<string, unknown>[] = []
  const lines = text.replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    if (line.length < 3) continue

    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean)
      const codePart = parts.find(p => /^[\d.]{6,12}$/.test(p.replace(/\./g, '')))
      const code = codePart ? codePart.replace(/\./g, '') : ''
      const unitPart = parts.find(p => UNIT_PATTERN.test(p))
      const numericParts = parts.filter(p => /^\d+(\.\d+)?$/.test(p) && p !== code)
      const qtyPart = numericParts.length ? numericParts[numericParts.length - 1] : '1'
      const descParts = parts.filter(p =>
        p !== code && p !== unitPart && p !== qtyPart && !/^[\d.]{6,12}$/.test(p.replace(/\./g, '')),
      )
      if (code || descParts.length) {
        rows.push({ item_code: code, description: descParts.join(' '), qty: qtyPart, unit: unitPart || 'EA' })
      }
      continue
    }

    const codeMatch = line.match(/\b(\d{6,9})\b/)
    if (!codeMatch) continue
    const code = codeMatch[1]
    let rest = line.replace(code, ' ').replace(/\s+/g, ' ').trim()
    const unitMatch = rest.match(/\b(EA|KM|M|LS|NO|SET|HR|MT|FT|LOT)\b/i)
    const unit = unitMatch ? unitMatch[1].toUpperCase() : 'EA'
    const qtyMatches = [...rest.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => m[1])
    const qty = qtyMatches.length ? qtyMatches[qtyMatches.length - 1] : '1'
    const desc = rest
      .replace(/\b(EA|KM|M|LS|NO|SET|HR|MT|FT|LOT)\b/gi, '')
      .replace(/\d+(?:\.\d+)?/g, '')
      .trim()
    rows.push({ item_code: code, description: desc, qty, unit })
  }

  const deduped = new Map<string, Record<string, unknown>>()
  for (const r of rows) {
    const c = str(r.item_code)
    if (c) deduped.set(normalizeCode(c), r)
    else deduped.set(`__${deduped.size}`, r)
  }
  return parseBoqImportRows([...deduped.values()], frameworkMap, source)
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const allRows: string[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = (tc.items as { str?: string; transform?: number[] }[]).filter(i => i.str?.trim())

    const byRow = new Map<number, { x: number; str: string }[]>()
    for (const item of items) {
      const y = Math.round(item.transform?.[5] ?? 0)
      const x = item.transform?.[4] ?? 0
      if (!byRow.has(y)) byRow.set(y, [])
      byRow.get(y)!.push({ x, str: item.str!.trim() })
    }

    const sortedYs = [...byRow.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const cols = byRow.get(y)!.sort((a, b) => a.x - b.x).map(c => c.str).filter(Boolean)
      if (cols.length) allRows.push(cols.join('\t'))
    }
  }
  return allRows.join('\n')
}

export async function extractImageText(
  file: File,
  onProgress?: (pct: number, status: string) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ara+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100), 'جاري قراءة الصورة...')
      }
    },
  })
  onProgress?.(0, 'تحضير محرك OCR...')
  const { data: { text } } = await worker.recognize(file)
  await worker.terminate()
  onProgress?.(100, 'اكتمل')
  return text
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
  onProgress?: (pct: number, status: string) => void,
): Promise<{ lines: BoqImportLine[]; source: BoqLineSource }> {
  const frameworkMap = buildFrameworkMap(frameworkItems)
  const ext = file.name.split('.').pop()?.toLowerCase()
  const mime = file.type.toLowerCase()

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

  if (ext === 'pdf' || mime === 'application/pdf') {
    onProgress?.(10, 'قراءة PDF...')
    const buffer = await file.arrayBuffer()
    const text = await extractPdfText(buffer)
    onProgress?.(100, 'اكتمل')
    const lines = parseBoqFromRawText(text, frameworkMap, 'pdf')
    if (!lines.length) throw new Error('لم يُعثر على بنود في PDF — تأكد أن الملف يحتوي جدول كميات')
    return { lines, source: 'pdf' }
  }

  if (
    mime.startsWith('image/')
    || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext || '')
  ) {
    const text = await extractImageText(file, onProgress)
    const lines = parseBoqFromRawText(text, frameworkMap, 'image')
    if (!lines.length) throw new Error('لم يُعثر على بنود في الصورة — جرّب لقطة أوضح للجدول')
    return { lines, source: 'image' }
  }

  throw new Error('نوع الملف غير مدعوم — Excel أو CSV أو PDF أو صورة')
}
