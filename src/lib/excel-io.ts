import ExcelJS from 'exceljs'

export type ExcelSheetSpec = {
  name: string
  rows: unknown[][]
  colWidths?: number[]
}

function cellToDisplayValue(value: ExcelJS.CellValue): unknown {
  if (value == null || value === '') return ''
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'object' && value !== null && 'text' in value && value.text != null) {
    return String(value.text)
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return cellToDisplayValue((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map(t => t.text).join('')
  }
  if (typeof value === 'object' && value !== null && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text ?? ''
  }
  return value
}

/** تحويل رقم تسلسلي Excel إلى تاريخ YYYY-MM-DD */
export function parseExcelSerialDate(v: unknown): string {
  if (v == null || v === '') return new Date().toISOString().split('T')[0]
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'number') {
    const utc = (v - 25569) * 86400 * 1000
    const d = new Date(utc)
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return new Date().toISOString().split('T')[0]
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if ((ch === ',' || ch === ';') && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

export function parseCsvToJson(text: string): Record<string, unknown>[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line)
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { if (h) obj[h] = vals[i] ?? '' })
    return obj
  })
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

function pickSheet(wb: ExcelJS.Workbook, sheetName?: string): ExcelJS.Worksheet | undefined {
  if (sheetName) {
    const exact = wb.getWorksheet(sheetName)
    if (exact) return exact
    return wb.worksheets.find(w => w.name.includes(sheetName))
  }
  return wb.worksheets[0]
}

export function worksheetToRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, row => {
    let maxCol = 0
    row.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber)
    })
    const arr: unknown[] = []
    for (let c = 1; c <= maxCol; c++) {
      arr.push(cellToDisplayValue(row.getCell(c).value))
    }
    rows.push(arr)
  })
  return rows
}

export function worksheetToJson<T extends Record<string, unknown>>(sheet: ExcelJS.Worksheet): T[] {
  const matrix = worksheetToRows(sheet)
  if (!matrix.length) return []
  const headers = matrix[0].map(h => String(h ?? '').trim())
  const result: T[] = []
  for (let i = 1; i < matrix.length; i++) {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, ci) => {
      if (h) obj[h] = matrix[i][ci] ?? ''
    })
    if (Object.keys(obj).length) result.push(obj as T)
  }
  return result
}

export async function readSpreadsheetAsJson<T extends Record<string, unknown>>(
  buffer: ArrayBuffer,
  sheetName?: string,
): Promise<T[]> {
  const wb = await loadWorkbook(buffer)
  const sheet = pickSheet(wb, sheetName)
  if (!sheet) return []
  return worksheetToJson<T>(sheet)
}

export async function readSpreadsheetAsRows(
  buffer: ArrayBuffer,
  sheetName?: string,
): Promise<unknown[][]> {
  const wb = await loadWorkbook(buffer)
  const sheet = pickSheet(wb, sheetName)
  if (!sheet) return []
  return worksheetToRows(sheet)
}

export async function readFileAsJson<T extends Record<string, unknown>>(
  file: File,
  sheetName?: string,
): Promise<T[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') {
    const text = await file.text()
    return parseCsvToJson(text) as T[]
  }
  if (ext !== 'xlsx') {
    throw new Error('نوع الملف غير مدعوم — استخدم .xlsx أو .csv')
  }
  return readSpreadsheetAsJson<T>(await file.arrayBuffer(), sheetName)
}

export async function downloadExcelWorkbook(sheets: ExcelSheetSpec[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name)
    for (const row of spec.rows) ws.addRow(row)
    spec.colWidths?.forEach((wch, i) => { ws.getColumn(i + 1).width = wch })
  }
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
