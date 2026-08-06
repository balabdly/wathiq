import { fetchBoqVersions } from '@/lib/pmc-service'
import { buildFrameworkMap, type FrameworkItemRef } from '@/lib/project-boq-import'
import { lookupSecCodeMap } from '@/lib/sec-item-code'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'

export const CLOSURE_AMOUNT_TOLERANCE = 0.01

export type ClosureExtractFields = {
  partial_invoice_skipped?: boolean | null
  partial_invoice_amount?: number | null
  final_invoice_amount?: number | null
}

function resolveLineCategory(line: { line_category?: string | null; notes?: string | null; material_id?: number | null }): 'MATERIAL' | 'WORK' {
  if (line.line_category === 'MATERIAL' || line.line_category === 'WORK') return line.line_category
  if (line.notes?.includes('line_category:MATERIAL')) return 'MATERIAL'
  if (line.material_id) return 'MATERIAL'
  return 'WORK'
}

export async function fetchFrameworkBoqMap(tenantId: string): Promise<Map<string, FrameworkItemRef>> {
  const contractId = await ensureDefaultSecContract(tenantId)
  const { data: items } = await fetchFrameworkBoqItems(tenantId, contractId)
  return buildFrameworkMap((items || []).map(i => ({
    item_code: i.item_code,
    unit: i.unit,
    unit_price: Number(i.unit_price),
    description_ar: i.description_ar,
  })))
}

/** إجمالي مقايسة الأعمال من بنود BOQ النشطة × أسعار العقد */
export async function computeWorksBoqTotal(tenantId: string, projectId: number): Promise<number> {
  const frameworkMap = await fetchFrameworkBoqMap(tenantId)
  return computeWorksBoqTotalWithFramework(tenantId, projectId, frameworkMap)
}

export async function computeWorksBoqTotalWithFramework(
  tenantId: string,
  projectId: number,
  frameworkMap: Map<string, FrameworkItemRef>,
): Promise<number> {
  const { data } = await fetchBoqVersions(tenantId, projectId)
  const active = (data || []).find(v => v.status === 'ACTIVE') || (data || []).find(v => v.version_type === 'INITIAL')
  if (!active?.lines?.length) return 0

  let total = 0
  for (const line of active.lines) {
    const qty = Number(line.qty_planned) || 0
    if (qty <= 0) continue
    if (resolveLineCategory(line) !== 'WORK') continue
    const code = line.catalog_no || ''
    const fw = code ? lookupSecCodeMap(frameworkMap, code) : undefined
    total += qty * (fw ? Number(fw.unit_price) : 0)
  }
  return total
}

/** @deprecated استخدم computeWorksBoqTotal */
export async function computeBoqGrandTotal(
  tenantId: string,
  projectId: number,
  frameworkPriceByCode?: Map<string, number>,
): Promise<number> {
  if (frameworkPriceByCode) {
    const frameworkMap = buildFrameworkMap(
      Array.from(frameworkPriceByCode.entries()).map(([item_code, unit_price]) => ({
        item_code,
        unit: 'EA',
        unit_price,
      })),
    )
    return computeWorksBoqTotalWithFramework(tenantId, projectId, frameworkMap)
  }
  return computeWorksBoqTotal(tenantId, projectId)
}

export function sumClosureExtractAmounts(closure: ClosureExtractFields): number {
  const partial = closure.partial_invoice_skipped ? 0 : (Number(closure.partial_invoice_amount) || 0)
  const final = Number(closure.final_invoice_amount) || 0
  return partial + final
}

/** هل أُدخلت مبالغ المستخلصات المطلوبة للمقارنة؟ */
export function closureExtractAmountsReady(closure: ClosureExtractFields): boolean {
  const finalAmt = Number(closure.final_invoice_amount)
  if (!Number.isFinite(finalAmt) || finalAmt <= 0) return false
  if (closure.partial_invoice_skipped) return true
  const partialAmt = Number(closure.partial_invoice_amount)
  return Number.isFinite(partialAmt) && partialAmt > 0
}

export function closureExtractsMatchWorksBoq(extractSum: number, worksTotal: number): boolean {
  if (worksTotal <= 0) return false
  return Math.abs(extractSum - worksTotal) <= CLOSURE_AMOUNT_TOLERANCE
}

export async function validateClosureExtractTotals(
  tenantId: string,
  projectId: number,
  closure: ClosureExtractFields,
): Promise<{ ok: boolean; worksTotal: number; extractSum: number; message?: string }> {
  const extractSum = sumClosureExtractAmounts(closure)
  if (!closureExtractAmountsReady(closure)) {
    return { ok: true, worksTotal: 0, extractSum }
  }

  const worksTotal = await computeWorksBoqTotal(tenantId, projectId)
  if (worksTotal <= 0) {
    return {
      ok: false,
      worksTotal,
      extractSum,
      message: 'لا توجد مقايسة أعمال معتمدة للمشروع — أكمل مقايسة الأعمال في التخطيط',
    }
  }

  if (!closureExtractsMatchWorksBoq(extractSum, worksTotal)) {
    return {
      ok: false,
      worksTotal,
      extractSum,
      message: `مجموع المستخلصات (${extractSum.toLocaleString('ar-SA')} ر.س) يجب أن يطابق مقايسة الأعمال (${worksTotal.toLocaleString('ar-SA')} ر.س)`,
    }
  }

  return { ok: true, worksTotal, extractSum }
}
