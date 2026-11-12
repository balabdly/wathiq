/**
 * Server-side ZATCA issuance lifecycle rules. No cryptographic operation here.
 * The database trigger in zatca_phase2_egs_schema.sql mirrors this map.
 * An invoice is NOT legally issued merely by entering one of these states.
 */
export type ZatcaDocumentStatus =
  | 'reserved' | 'signed' | 'clearance_pending' | 'cleared'
  | 'reporting_pending' | 'reported' | 'rejected' | 'retryable_error'

export type ZatcaDocumentKind =
  | 'standard_invoice' | 'simplified_invoice'
  | 'standard_credit_note' | 'simplified_credit_note'
  | 'standard_debit_note' | 'simplified_debit_note'

const transitions: Record<ZatcaDocumentStatus, readonly ZatcaDocumentStatus[]> = {
  reserved: ['signed'],
  signed: ['clearance_pending', 'reporting_pending'],
  clearance_pending: ['cleared', 'rejected', 'retryable_error'],
  reporting_pending: ['reported', 'rejected', 'retryable_error'],
  retryable_error: ['clearance_pending', 'reporting_pending'],
  cleared: [],
  reported: [],
  rejected: [],
}

/** Fail closed on cross-type routing and on rewinding an issued document. */
export function canTransitionZatcaDocument(
  from: ZatcaDocumentStatus,
  to: ZatcaDocumentStatus,
  kind: ZatcaDocumentKind,
): boolean {
  if (!transitions[from]?.includes(to)) return false
  if (to === 'clearance_pending' && !kind.startsWith('standard_')) return false
  if (to === 'reporting_pending' && !kind.startsWith('simplified_')) return false
  return true
}

export function assertZatcaTransition(
  from: ZatcaDocumentStatus,
  to: ZatcaDocumentStatus,
  kind: ZatcaDocumentKind,
): void {
  if (!canTransitionZatcaDocument(from, to, kind)) {
    throw new Error('Invalid ZATCA lifecycle transition: ' + from + ' -> ' + to)
  }
}

export const ZATCA_ISSUANCE_ENABLED = false as const
