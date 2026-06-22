import nacl from 'tweetnacl'

const PUBLIC_KEY_B64URL = process.env.PUBLIC_KEY_B64URL || 'DktWZyaUiuBNy-d9tkjCqo7FuFiLad0h2h56IeccoXo'

function fromBase64Url(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getPublicKey(): Uint8Array {
  return fromBase64Url(PUBLIC_KEY_B64URL)
}

function encodePayload(payload: Record<string, any>): Uint8Array {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  return new TextEncoder().encode(canonical)
}

export interface ParsedLicense {
  payload: {
    id: string
    product: string
    type: string
    maxDevices: number
    features: string[]
    issuedAt: number
    metadata?: Record<string, any>
  }
  signature: string
}

export function parseLicenseKey(key: string): ParsedLicense | null {
  try {
    const cleaned = key.replace(/[\s.]/g, '')
    if (cleaned.length < 10) return null

    const payloadLenHex = cleaned.slice(0, 2)
    const payloadLen = parseInt(payloadLenHex, 16)
    if (isNaN(payloadLen) || payloadLen < 2) return null

    const payloadB64 = cleaned.slice(2, 2 + payloadLen)
    const sigB64 = cleaned.slice(2 + payloadLen)

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64))
    const payload = JSON.parse(payloadJson)

    return { payload, signature: sigB64 }
  } catch {
    return null
  }
}

export function verifyLicenseSignature(payload: Record<string, any>, signature: string): boolean {
  try {
    const message = encodePayload(payload)
    const sig = fromBase64Url(signature)
    const publicKey = getPublicKey()
    return nacl.sign.detached.verify(message, sig, publicKey)
  } catch {
    return false
  }
}
