/**
 * ZATCA Phase 2 cryptographic BUILDING BLOCKS (server-side only).
 *
 * IMPORTANT:
 * These helpers do NOT perform official ZATCA XML canonicalization, invoice
 * hashing, XAdES enveloped-signature assembly, compliant QR signing, onboarding,
 * or clearance/reporting. A SHA256 digest of arbitrary XML is NOT necessarily
 * the invoice hash required by ZATCA. Production issuing stays disabled.
 *
 * Never place a private key, OTP or CSID secret in a browser bundle or database.
 */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { Buffer } from 'node:buffer'

function asNonEmptyBytes(bytes: Uint8Array, label: string): Buffer {
  if (!ArrayBuffer.isView(bytes) || bytes.BYTES_PER_ELEMENT !== 1 || bytes.byteLength === 0) {
    throw new Error(label + ' must be non-empty bytes')
  }
  return Buffer.from(bytes)
}

/** SHA-256 over caller-supplied exact bytes (no XML canonicalization performed). */
export function sha256Base64(bytes: Uint8Array): string {
  return createHash('sha256').update(asNonEmptyBytes(bytes, 'digest input')).digest('base64')
}

/**
 * Verify a detached ECDSA P-256/SHA-256 signature in IEEE-P1363 (r||s) form.
 * Caller is responsible for supplying the exact canonical bytes signed.
 * Public key only; this function deliberately cannot issue signatures.
 */
export function verifyP256Signature(
  canonicalBytes: Uint8Array,
  signature: Uint8Array,
  publicKeyPem: string,
): boolean {
  const document = asNonEmptyBytes(canonicalBytes, 'signed content')
  const sig = asNonEmptyBytes(signature, 'signature')
  const key = createPublicKey(publicKeyPem)
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('Only the P-256 elliptic curve is allowed by this verification helper')
  }
  if (sig.byteLength !== 64) {
    throw new Error('P-256 IEEE-P1363 signatures must be 64 bytes')
  }
  return verify('sha256', document, {key, dsaEncoding: 'ieee-p1363'}, sig)
}

export type QrTlvField = { tag: number; value: string | Uint8Array }

/**
 * Encode prevalidated ZATCA QR TLV fields.
 * Does NOT populate or approve phase-2 tags 6-9: those require official
 * canonical invoice hash, signature, public key and (where relevant) CA data.
 * A TLV encoding by itself is not a compliant QR.
 */
export function encodeQrTlvBase64(fields: readonly QrTlvField[]): string {
  if (!fields.length) throw new Error('QR TLV requires at least one field')
  const seen = new Set<number>()
  const encoded = fields.map(field => {
    if (!Number.isInteger(field.tag) || field.tag < 1 || field.tag > 255 || seen.has(field.tag)) {
      throw new Error('QR TLV tags must be distinct integers between 1 and 255')
    }
    seen.add(field.tag)
    const value = typeof field.value === 'string'
      ? Buffer.from(field.value, 'utf8')
      : asNonEmptyBytes(field.value, 'TLV field')
    if (value.byteLength === 0 || value.byteLength > 255) {
      throw new Error('QR TLV field length must be between 1 and 255 bytes')
    }
    return Buffer.concat([Buffer.from([field.tag, value.length]), value])
  })
  return Buffer.concat(encoded).toString('base64')
}
