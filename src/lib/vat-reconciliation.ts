/** VAT management reconciliation preview, NOT a ZATCA return.
 * Does not determine deductibility, cash-basis elections, imports, customs,
 * deferred adjustments or ZATCA invoice clearance/reporting.
 */
export type VatDoc = {
  status?: string | null
  vat_amount?: number | string | null
  subtotal?: number | string | null
}
const safe = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const sum = (docs: VatDoc[]) => round(docs.reduce((n, d) => n + Math.max(0, safe(d.vat_amount)), 0))
const eligible = (docs: VatDoc[], statuses: string[]) =>
  docs.filter(d => statuses.includes(d.status || ''))
export function calculateVatReconciliation(inputs: {
  sales: VatDoc[]
  vendorInvoices: VatDoc[]
  creditNotes: VatDoc[]
  purchaseReturns: VatDoc[]
  supplierDebitNotes: VatDoc[]
  expenses: VatDoc[]
}) {
  const sales = eligible(inputs.sales, ['مرسلة', 'مدفوعة', 'متأخرة'])
  const invoices = eligible(inputs.vendorInvoices, ['معتمدة', 'مدفوعة', 'مرتجعة'])
  const credits = eligible(inputs.creditNotes, ['معتمد'])
  const returns = eligible(inputs.purchaseReturns, ['معتمد'])
  const debitNotes = eligible(inputs.supplierDebitNotes, ['معتمد'])
  const salesVat = sum(sales)
  const creditVat = sum(credits)
  const purchaseVat = sum(invoices)
  const reverseVat = round(sum(returns) + sum(debitNotes))
  const outputVat = round(salesVat - creditVat)
  const inputVatCandidate = round(purchaseVat - reverseVat)
  const expenseVatForReview = sum(inputs.expenses.filter(d => d.status !== 'ملغي'))
  return {
    salesVat, creditVat, outputVat, purchaseVat, reverseVat,
    inputVatCandidate, expenseVatForReview,
    estimatedNetVat: round(outputVat - inputVatCandidate),
  }
}
