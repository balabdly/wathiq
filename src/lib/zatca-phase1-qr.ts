/**
 * ZATCA Phase 1 five-tag TLV payload (Base64).
 * This is NOT a Phase 2 signed, cleared/reported electronic invoice.
 * Caller supplies a recorded ISO timestamp; production e-invoicing requires a\n * separately persisted immutable issuance timestamp (still pending).
 */
export function createZatcaPhase1Qr(input: {
  sellerName: string
  vatNumber: string
  issuedAt: string
  totalAmount: number
  vatAmount: number
}): string {
  if (!input.sellerName.trim() || !input.vatNumber.trim() || !input.issuedAt.includes('T')) return ''
  const date = new Date(input.issuedAt)
  if (Number.isNaN(date.getTime()) ||
      !Number.isFinite(input.totalAmount) || !Number.isFinite(input.vatAmount)) return ''

  const encoder = new TextEncoder()
  const fields = [
    input.sellerName,
    input.vatNumber,
    date.toISOString(),
    input.totalAmount.toFixed(2),
    input.vatAmount.toFixed(2),
  ]
  const bytes: number[] = []
  for (let index = 0; index < fields.length; index++) {
    const fieldBytes = encoder.encode(fields[index])
    if (fieldBytes.length > 255) throw new Error('الحقل طويل جدًا لتنسيق ZATCA TLV')
    bytes.push(index + 1, fieldBytes.length, ...fieldBytes)
  }
  // Each value was already UTF-8 encoded: do NOT encode this binary again.
  // The previous QR implementation double-encoded Arabic company names.
  return btoa(String.fromCharCode(...bytes))
}
