/**
 * OFFLINE ZATCA SDK validation adapter — SERVER ONLY.
 *
 * The operator must install ZATCA's official "fatoora" CLI separately
 * (license/terms from ZATCA's Download SDK portal) and configure
 * ZATCA_SDK_FATOORA_BIN and optional ZATCA_SDK_WORKDIR as server secrets.
 *
 * No network call, no private key, no XAdES signature generation here.
 * Successful SDK validation is a prerequisite, not proof of ZATCA approval.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const execFileAsync = promisify(execFile)
const MAX_XML_BYTES = 2 * 1024 * 1024
const MAX_SDK_OUTPUT = 256 * 1024

export type OfflineValidationEvidence = Readonly<{
  validatedBy: 'ZATCA_OFFICIAL_SDK'
  signedXmlSha256Hex: string
  passed: true
}>

export function assertOfficialSdkPassed(exitCode: number, output: string): void {
  // The SDK sometimes returns status 0 despite a business-rule rejection.
  // Require an explicit GLOBAL result and reject all ambiguous output.
  if (exitCode !== 0 ||
    !/\bGLOBAL VALIDATION RESULT\s*[-:]\s*PASSED\b/i.test(output) ||
    /\bGLOBAL VALIDATION RESULT\s*[-:]\s*FAILED\b/i.test(output)) {
    throw new Error('ZATCA SDK validation did not report a global PASS')
  }
}

export async function validateSignedXmlUsingOfficialSdk(
  signedXml: string,
): Promise<OfflineValidationEvidence> {
  if (typeof signedXml !== 'string' || !signedXml.trim()) {
    throw new Error('Signed XML is required')
  }
  const bytes = Buffer.from(signedXml, 'utf8')
  if (bytes.length > MAX_XML_BYTES) throw new Error('Signed XML size exceeds safe validation limit')
  if (!/<(?:[A-Za-z_][\w.-]*:)?Signature\b/.test(signedXml) ||
      !/<(?:[A-Za-z_][\w.-]*:)?UBLExtensions\b/.test(signedXml)) {
    throw new Error('Unsigned XML cannot be validated as a signed e-invoice')
  }
  const executable = process.env.ZATCA_SDK_FATOORA_BIN
  if (!executable || !executable.trim()) {
    throw new Error('Official ZATCA SDK is not installed or configured on the server')
  }
  const workdir = process.env.ZATCA_SDK_WORKDIR || undefined
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'wathiq-zatca-sdk-'))
  const xmlPath = join(temporaryDirectory, 'signed-invoice.xml')
  try {
    await writeFile(xmlPath, bytes, {mode: 0o600, flag: 'wx'})
    let stdout = ''
    let stderr = ''
    let exitCode = 0
    try {
      const result = await execFileAsync(executable, ['-validate', '-invoice', xmlPath], {
        cwd: workdir,
        shell: false,
        timeout: 45000,
        maxBuffer: MAX_SDK_OUTPUT,
        encoding: 'utf8',
      })
      stdout = result.stdout
      stderr = result.stderr
    } catch (error: unknown) {
      const failure = error as Error & { code?: string | number; stdout?: string; stderr?: string }
      stdout = failure.stdout || ''
      stderr = failure.stderr || ''
      exitCode = typeof failure.code === 'number' ? failure.code : 1
    }
    // SDK output could include details from invoices; never log/return it.
    assertOfficialSdkPassed(exitCode, stdout + '\n' + stderr)
    return Object.freeze({
      validatedBy: 'ZATCA_OFFICIAL_SDK',
      signedXmlSha256Hex: createHash('sha256').update(bytes).digest('hex'),
      passed: true,
    })
  } finally {
    await rm(temporaryDirectory, {recursive: true, force: true})
  }
}

/**
 * OFFLINE signing experiment using official ZATCA CLI. Only works after the
 * operator installs the official SDK with a TEST/SIMULATION certificate/key
 * in its own isolated working directory. No CSIDs or keys are read by Wathiq.
 *
 * CLI performs canonicalization, XAdES construction, hash and QR; Wathiq does
 * NOT hand-roll its own XAdES. Any output must pass SDK validation again.
 *
 * Default is DISABLED. Do not call with production identities/credentials,
 * and do not expose this function through a public API route.
 */
export async function signAndValidateTestXmlUsingOfficialSdk(
  unsignedXml: string,
): Promise<{signedXml: string; evidence: OfflineValidationEvidence}> {
  if (process.env.ZATCA_SDK_SIGNING_ENABLED !== 'true') {
    throw new Error('Offline test signing is disabled')
  }
  const executable = process.env.ZATCA_SDK_FATOORA_BIN
  if (!executable) throw new Error('Official ZATCA SDK is not configured')
  const workdir = process.env.ZATCA_SDK_WORKDIR
  if (!workdir) throw new Error('SDK isolated test workdir must be specified')
  if (typeof unsignedXml !== 'string' || !unsignedXml.includes('<Invoice')) {
    throw new Error('An unsigned UBL invoice XML document is required')
  }
  const data = Buffer.from(unsignedXml, 'utf8')
  if (data.length > MAX_XML_BYTES) throw new Error('XML size limit exceeded')
  if (/<(?:[A-Za-z_][\w.-]*:)?Signature\b/.test(unsignedXml)) {
    throw new Error('Refusing to re-sign an already signed invoice')
  }
  const tmp = await mkdtemp(join(tmpdir(), 'wathiq-zatca-sign-'))
  const input = join(tmp, 'unsigned.xml')
  const output = join(tmp, 'signed.xml')
  try {
    await writeFile(input, data, {flag:'wx',mode:0o600})
    try {
      await execFileAsync(executable,
        ['-sign','-invoice',input,'-signedInvoice',output],{
          cwd:workdir,shell:false,timeout:45000,maxBuffer:MAX_SDK_OUTPUT,
          encoding:'utf8',
        })
    } catch {
      throw new Error('Official ZATCA SDK signing did not complete')
    }
    const xmlBytes = await readFile(output)
    if (xmlBytes.byteLength > MAX_XML_BYTES) {
      throw new Error('Signed XML exceeded safe size')
    }
    const signedXml = xmlBytes.toString('utf8')
    if (!/<(?:[A-Za-z_][\w.-]*:)?Signature\b/.test(signedXml)) {
      throw new Error('SDK output does not contain an XML signature')
    }
    // A signing CLI success alone is not validation of the signed document.
    const evidence = await validateSignedXmlUsingOfficialSdk(signedXml)
    return {signedXml,evidence}
  } finally {
    await rm(tmp,{force:true,recursive:true})
  }
}
