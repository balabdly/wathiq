import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

export type PlanningMaterialLine = {
  id?: number
  tenant_id?: string
  project_id: number
  line_no?: number
  description: string
  unit: string
  catalog_no?: string | null
  qty_planned: number
  notes?: string | null
  sort_order?: number
}

export async function fetchPlanningMaterialLines(tenantId: string, projectId: number) {
  const { data, error } = await supabase
    .from('project_planning_material_lines')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('sort_order')
    .order('line_no')
  return { data: (data || []) as PlanningMaterialLine[], error }
}

export async function savePlanningMaterialLines(
  tenantId: string,
  projectId: number,
  lines: PlanningMaterialLine[],
) {
  const { data: planning } = await supabase
    .from('project_planning')
    .select('planning_status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (planning?.planning_status === 'closed') {
    throw new Error('التخطيط معتمد — للعرض فقط')
  }

  await supabase
    .from('project_planning_material_lines')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)

  const valid = lines.filter(l => l.description.trim() && Number(l.qty_planned) > 0)
  if (!valid.length) return

  const rows = valid.map((line, i) => ({
    tenant_id: tenantId,
    project_id: projectId,
    line_no: i + 1,
    description: line.description.trim(),
    unit: line.unit?.trim() || 'قطعة',
    catalog_no: line.catalog_no?.trim() || null,
    qty_planned: Number(line.qty_planned),
    notes: line.notes?.trim() || null,
    sort_order: i,
  }))

  const { error } = await supabase.from('project_planning_material_lines').insert(rows)
  if (error) throw error
}

const HEADER_ALIASES: Record<string, keyof PlanningMaterialLine> = {
  'المادة': 'description',
  'الوصف': 'description',
  'description': 'description',
  'name': 'description',
  'الكمية': 'qty_planned',
  'qty': 'qty_planned',
  'quantity': 'qty_planned',
  'الوحدة': 'unit',
  'unit': 'unit',
  'رقم': 'catalog_no',
  'catalog': 'catalog_no',
  'catalog_no': 'catalog_no',
  'ملاحظات': 'notes',
  'notes': 'notes',
}

function normalizeHeader(h: string): string {
  return String(h || '').trim().toLowerCase()
}

function parseQty(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** استيراد بنود من Excel / CSV */
export function parseMaterialsSpreadsheet(file: File): Promise<PlanningMaterialLine[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        if (!sheet) { resolve([]); return }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        if (!rows.length) { resolve([]); return }

        const firstKeys = Object.keys(rows[0])
        const colMap = new Map<string, keyof PlanningMaterialLine>()
        for (const key of firstKeys) {
          const norm = normalizeHeader(key)
          for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
            if (normalizeHeader(alias) === norm || norm.includes(normalizeHeader(alias))) {
              colMap.set(key, field)
              break
            }
          }
        }

        const hasDescription = Array.from(colMap.values()).includes('description')
        const lines: PlanningMaterialLine[] = []

        for (const row of rows) {
          const line: PlanningMaterialLine = {
            project_id: 0,
            description: '',
            unit: 'قطعة',
            qty_planned: 0,
          }

          for (const [col, field] of colMap.entries()) {
            const val = row[col]
            if (field === 'qty_planned') line.qty_planned = parseQty(val)
            else if (field === 'description') line.description = String(val ?? '').trim()
            else if (field === 'unit') line.unit = String(val ?? 'قطعة').trim() || 'قطعة'
            else if (field === 'catalog_no') line.catalog_no = String(val ?? '').trim() || null
            else if (field === 'notes') line.notes = String(val ?? '').trim() || null
          }

          if (!hasDescription) {
            const vals = Object.values(row).map(v => String(v ?? '').trim())
            line.description = vals[0] || ''
            line.qty_planned = parseQty(vals[1]) || line.qty_planned
            if (vals[2]) line.unit = vals[2]
          }

          if (line.description && line.qty_planned > 0) {
            lines.push(line)
          }
        }

        resolve(lines)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('فشل قراءة الملف'))
    reader.readAsArrayBuffer(file)
  })
}
