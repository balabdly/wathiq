/**
 * Preliminary VAT reconciliation for Saudi ZATCA reporting.
 * This is NOT a filed VAT return: input VAT is still subject to
 * documentary eligibility, tax categories, adjustment timing and
 * taxpayer-specific exceptions. Purchase orders are deliberately excluded.
 */
export type VatDocument = {
  id?: number
  status?: string | null
  subtotal?: number | string | null
  vat_amount?: number | string | null
  total_amount?: number | string | null
  vat_rate?: number | string | null
  invoice_number?: string
  note_number?: string
  return_number?: string
  invoice_date?: string
  note_date?: string
  return_date?: string
  expense_date?: string
  client_name?: string
  vendor_name?: string
}
export type VatDocuments = {
  invoices: VatDocument[]
  creditNotes: VatDocument[]
  vendorInvoices: VatDocument[]
  debitNotes: VatDocument[]
  purchaseReturns: VatDocument[]
  expenses: VatDocument[]
}
export type VatReportRow = VatDocument & {
  invoice_number: string
  invoice_date: string
  subtotal: number
  vat_amount: number
  total_amount: number
  vat_rate: number
  category: string
}

const issuedInvoice = new Set(['مرسلة', 'مدفوعة', 'متأخرة'])
const recognizedVendorInvoice = new Set(['معتمدة', 'مدفوعة', 'مرتجعة'])
const recognizedNote = new Set(['معتمد'])
function money(n: unknown): number {
  const value = Number(n || 0)
  if (!Number.isFinite(value)) throw new Error('قيمة ضريبية غير صالحة')
  return Math.round((value + Number.EPSILON) * 100) / 100
}
function vatRows(rows: VatDocument[], statuses: Set<string>, kind: string, negative = false): VatReportRow[] {
  return rows.filter(row => statuses.has(row.status || '')).map(row => {
    const sign = negative ? -1 : 1
    return {
      ...row,
      invoice_number: row.invoice_number || row.note_number || row.return_number || '',
      invoice_date: row.invoice_date || row.note_date || row.return_date || row.expense_date || '',
      subtotal: money(row.subtotal) * sign,
      vat_amount: money(row.vat_amount) * sign,
      total_amount: money(row.total_amount) * sign,
      vat_rate: Number(row.vat_rate ?? 0),
      category: kind,
    }
  })
}
export function summarizeVatDocuments(documents: VatDocuments) {
  const sales = vatRows(documents.invoices, issuedInvoice, 'فاتورة مبيعات')
  const salesCredits = vatRows(documents.creditNotes, recognizedNote, 'إشعار دائن', true)
  const purchases = vatRows(documents.vendorInvoices, recognizedVendorInvoice, 'فاتورة مورد')
  const purchaseDebits = vatRows(documents.debitNotes, recognizedNote, 'إشعار مدين', true)
  const purchaseReturns = vatRows(documents.purchaseReturns, recognizedNote, 'مرتجع مشتريات', true)
  const salesRows = [...sales, ...salesCredits]
  const purchaseRows = [...purchases, ...purchaseDebits, ...purchaseReturns]
  const sumVat = (rows: VatReportRow[]) => money(rows.reduce((total, row) => total + row.vat_amount, 0))
  const salesVat = sumVat(sales)
  const salesCreditVat = sumVat(salesCredits)
  const vendorVat = sumVat(purchases)
  const purchaseAdjustmentVat = sumVat([...purchaseDebits, ...purchaseReturns])
  const outputVat = money(salesVat + salesCreditVat)
  const inputVatCandidate = money(vendorVat + purchaseAdjustmentVat)

  // There is no documented eligibility flag on expenses. Show these as
  // NOT YET VERIFIED, never automatically include them as deductible.
  const expenseVatPendingReview = money(documents.expenses
    .filter(row => row.status !== 'ملغي' && row.status !== 'ملغاة')
    .reduce((total, row) => total + money(row.vat_amount), 0))

  return {
    salesRows, purchaseRows,
    salesVat, salesCreditVat, outputVat,
    vendorVat, purchaseAdjustmentVat, inputVatCandidate,
    expenseVatPendingReview,
    netVatEstimate: money(outputVat - inputVatCandidate),
  }
}
