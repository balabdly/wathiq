import { fetchBoqVersions } from '@/lib/pmc-service'

function resolveLineCategory(line: { line_category?: string | null; notes?: string | null; material_id?: number | null }): 'MATERIAL' | 'WORK' {
  if (line.line_category === 'MATERIAL' || line.line_category === 'WORK') return line.line_category
  if (line.notes?.includes('line_category:MATERIAL')) return 'MATERIAL'
  if (line.material_id) return 'MATERIAL'
  return 'WORK'
}

/** يحسب إجمالي المقايسة من البنود — سعر الأعمال من العقد إن وُجد catalog_no */
export async function computeBoqGrandTotal(
  tenantId: string,
  projectId: number,
  frameworkPriceByCode?: Map<string, number>,
): Promise<number> {
  const { data } = await fetchBoqVersions(tenantId, projectId)
  const active = (data || []).find(v => v.status === 'ACTIVE') || (data || []).find(v => v.version_type === 'INITIAL')
  if (!active?.lines?.length) return 0

  let total = 0
  for (const line of active.lines) {
    const qty = Number(line.qty_planned) || 0
    if (qty <= 0) continue
    const cat = resolveLineCategory(line)
    const code = (line.catalog_no || '').replace(/\s+/g, '').toUpperCase()
    const fwPrice = code && frameworkPriceByCode?.get(code)
    if (cat === 'WORK') {
      total += qty * (typeof fwPrice === 'number' ? fwPrice : 0)
    }
  }
  return total
}
