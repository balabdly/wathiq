/**
 * VAT reconciliation for Wathiq.
 * This is an accounting preview only, not a ZATCA VAT return:
 * input VAT requires a valid tax invoice, eligibility checks and supporting
 * documentation; cash-basis adjustments, reverse charge, imports, zero-rated
 * and exempt supplies still require separate statutory workflows.
 */
export type VatRow = { vat_amount?: number | null; status?: string }
export type VatSnapshotInput = {
  sales: VatRow[]
  purchases: VatRow[]
  creditNotes: VatRow[]
  purchaseReturns: VatRow[]
  purchaseDebitNotes: VatRow[]
}
const roundHalalas = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100
const sumVat = (documents: VatRow[]): number =>
  roundHalalas(documents.reduce((sum, doc) => sum + Math.max(0, Number(doc.vat_amount) || 0), 0))

export function calculateVatSnapshot(input: VatSnapshotInput) {
  const outputVat = sumVat(input.sales)
  const creditNoteVat = sumVat(input.creditNotes)
  const purchaseVat = sumVat(input.purchases)
  const purchaseAdjustmentsVat =
    roundHalalas(sumVat(input.purchaseReturns) + sumVat(input.purchaseDebitNotes))
  const netOutputVat = roundHalalas(outputVat - creditNoteVat)
  const netInputVat = roundHalalas(purchaseVat - purchaseAdjustmentsVat)
  const netVat = roundHalalas(netOutputVat - netInputVat)
  return {
    outputVat, creditNoteVat, purchaseVat, purchaseAdjustmentsVat,
    netOutputVat, netInputVat, netVat,
  }
}
