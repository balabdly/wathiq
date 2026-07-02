export type AuthCookiePayload = {
  id: number
  role: string
  permissions: string[]
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function safeJsonParse(value: string): AuthCookiePayload | null {
  try {
    const parsed = JSON.parse(value) as AuthCookiePayload
    if (!parsed || typeof parsed.id !== 'number' || typeof parsed.role !== 'string' || !Array.isArray(parsed.permissions)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function signBytes(payload: Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const payloadBuffer = new Uint8Array(payload.byteLength)
  payloadBuffer.set(payload)
  const signature = await crypto.subtle.sign('HMAC', key, payloadBuffer.buffer)
  return new Uint8Array(signature)
}

export async function createAuthCookieToken(payload: AuthCookiePayload, secret: string): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
  const signatureBytes = await signBytes(payloadBytes, secret)
  return `${toBase64Url(payloadBytes)}.${toBase64Url(signatureBytes)}`
}

export async function verifyAuthCookieToken(token: string, secret: string): Promise<AuthCookiePayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  const payloadBytes = fromBase64Url(parts[0])
  const expectedSignature = await signBytes(payloadBytes, secret)
  const signatureBytes = fromBase64Url(parts[1])

  if (expectedSignature.length !== signatureBytes.length) return null
  for (let i = 0; i < expectedSignature.length; i += 1) {
    if (expectedSignature[i] !== signatureBytes[i]) return null
  }

  const payloadText = new TextDecoder().decode(payloadBytes)
  return safeJsonParse(payloadText)
}
