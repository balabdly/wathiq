/**
 * SERVER ONLY: ZATCA SIMULATION transport boundary.
 * Cannot access production: endpoints are hardcoded to simulation.
 * No route/controller invokes this file yet; production issuance remains OFF.
 *
 * This requires XML signed by an EGS and positively validated using the
 * official SDK adapter. It never generates a signature or a tax invoice.
 * A 200 response is NOT automatically classified as accepted.
 */
import {createHash} from 'node:crypto'
import type {OfflineValidationEvidence} from './sdk-cli.server'

const SIMULATION_BASE = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation'

export type ZatcaSubmissionKind = 'standard' | 'simplified'
export type ZatcaSignedSubmission = {
  kind: ZatcaSubmissionKind
  uuid: string
  invoiceHash: string
  signedXml: string
  sdkEvidence: OfflineValidationEvidence
}
export type ZatcaSimulationRequest = {
  url: string
  clearanceStatus: '0' | '1'
  body: {invoiceHash: string; uuid: string; invoice: string}
}
export type ZatcaSimulationResult = {
  outcome: 'cleared' | 'reported' | 'rejected' | 'unknown'
  httpStatus: number
  retryable: boolean
}

export function buildZatcaSimulationRequest(input: ZatcaSignedSubmission): ZatcaSimulationRequest {
  if (input.kind !== 'standard' && input.kind !== 'simplified') {
    throw new Error('Unsupported ZATCA invoice kind')
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.uuid)) {
    throw new Error('Invalid fiscal document UUID')
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input.invoiceHash)) {
    throw new Error('Signed invoice hash must be a Base64 SHA-256 digest')
  }
  if (!input.signedXml || !input.sdkEvidence ||
      input.sdkEvidence.passed !== true ||
      input.sdkEvidence.validatedBy !== 'ZATCA_OFFICIAL_SDK') {
    throw new Error('Official SDK validation is required before simulation submission')
  }
  const integrity = createHash('sha256').update(input.signedXml, 'utf8').digest('hex')
  if (integrity !== input.sdkEvidence.signedXmlSha256Hex) {
    throw new Error('Signed XML was modified after SDK validation')
  }
  const standard = input.kind === 'standard'
  return {
    url: SIMULATION_BASE + (standard
      ? '/invoices/clearance/single' : '/invoices/reporting/single'),
    clearanceStatus: standard ? '1' : '0',
    body: {
      invoiceHash: input.invoiceHash,
      uuid: input.uuid,
      invoice: Buffer.from(input.signedXml, 'utf8').toString('base64'),
    },
  }
}

export function classifySimulationResponse(
  kind: ZatcaSubmissionKind,
  httpStatus: number,
  payload: unknown,
): ZatcaSimulationResult {
  const data = payload && typeof payload === 'object'
    ? payload as Record<string, unknown> : {}
  if (httpStatus >= 200 && httpStatus < 300) {
    if (kind === 'standard' && data.clearanceStatus === 'CLEARED' &&
        typeof data.clearedInvoice === 'string' && data.clearedInvoice.length > 0) {
      return {outcome:'cleared',httpStatus,retryable:false}
    }
    if (kind === 'simplified' && data.reportingStatus === 'REPORTED') {
      return {outcome:'reported',httpStatus,retryable:false}
    }
    return {outcome:'unknown',httpStatus,retryable:false}
  }
  if ([400, 401, 403, 422].includes(httpStatus)) {
    return {outcome:'rejected',httpStatus,retryable:false}
  }
  // A timeout, 409 or 5xx cannot justify resubmission automatically:
  // query/reconcile status first to avoid duplicate submissions.
  return {outcome:'unknown',httpStatus,retryable:httpStatus === 429 || httpStatus >= 500}
}

/**
 * Makes NO request unless enabled by the server operator. Caller must persist
 * the exact request, response and state transitions in the EGS ledger.
 * Explicitly not an activation route or production integration.
 */
export async function submitToZatcaSimulation(
  invoice: ZatcaSignedSubmission,
  transport: typeof fetch = fetch,
): Promise<ZatcaSimulationResult> {
  if (process.env.ZATCA_SIMULATION_NETWORK_ENABLED !== 'true') {
    throw new Error('ZATCA simulation transport is disabled')
  }
  const token = process.env.ZATCA_SIMULATION_BINARY_SECURITY_TOKEN
  const secret = process.env.ZATCA_SIMULATION_SECRET
  if (!token || !secret) {
    throw new Error('Simulation-only CSID credentials are not configured')
  }
  const request = buildZatcaSimulationRequest(invoice)
  const auth = Buffer.from(token + ':' + secret).toString('base64')
  const response = await transport(request.url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Version': 'V2',
      'Clearance-Status': request.clearanceStatus,
      'accept-language': 'en',
    },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  })
  let responseBody: unknown = null
  try { responseBody = await response.json() } catch { /* inconclusive non-JSON response */ }
  // Do not log/return invoice XML, certificates, tokens or response payload.
  return classifySimulationResponse(invoice.kind, response.status, responseBody)
}
