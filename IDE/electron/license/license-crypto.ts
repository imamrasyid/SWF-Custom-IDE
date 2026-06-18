import nacl from 'tweetnacl'

const PRODUCT_ID = 'ninjasage-modding-toolkit'
const SALT = 'ninja-sage-lifetime-license-v1'

// Encoded public key - XOR obfuscated then base64url encoded
// Decode at runtime to prevent trivial extraction from source
const _ENC_PK = 'hZmRpZK1z5Sdye0VJQWuFhSf3i6jNt7cOa1bBkMr4dY='
const _XOR_KEY = [0x4e, 0x53, 0x41, 0x47, 0x45] // "NSAGE"

export interface LicensePayload {
  id: string
  product: string
  type: 'lifetime'
  maxDevices: number
  features: string[]
  issuedAt: number
  metadata?: {
    customerEmail?: string
    orderId?: string
  }
}

export interface LicenseData {
  payload: LicensePayload
  signature: string
}

function encodePayload(payload: LicensePayload): Uint8Array {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  return new TextEncoder().encode(canonical)
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) {
    b64 += '='
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function signLicense(payload: LicensePayload, secretKey: Uint8Array): string {
  const message = encodePayload(payload)
  const signature = nacl.sign.detached(message, secretKey)
  return toBase64Url(signature)
}

export function verifyLicense(payload: LicensePayload, signature: string, publicKey: Uint8Array): boolean {
  try {
    const message = encodePayload(payload)
    const sig = fromBase64Url(signature)
    return nacl.sign.detached.verify(message, sig, publicKey)
  } catch {
    return false
  }
}

export function parseLicenseKey(key: string): LicenseData | null {
  try {
    // Remove spaces and dots (group separators)
    const cleaned = key.replace(/[\s.]/g, '')
    if (cleaned.length < 10) return null

    // First 2 chars = hex length of payload B64
    const payloadLenHex = cleaned.slice(0, 2)
    const payloadLen = parseInt(payloadLenHex, 16)
    if (isNaN(payloadLen) || payloadLen < 2) return null

    const payloadB64 = cleaned.slice(2, 2 + payloadLen)
    const sigB64 = cleaned.slice(2 + payloadLen)

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64))
    const payload: LicensePayload = JSON.parse(payloadJson)

    return {
      payload,
      signature: sigB64,
    }
  } catch (err) {
    console.error('[License] Parse error:', err)
    return null
  }
}

export function buildLicenseKey(payload: LicensePayload, signature: string): string {
  const payloadB64 = toBase64Url(encodePayload(payload))
  const payloadLenHex = payloadB64.length.toString(16).padStart(2, '0')
  const raw = payloadLenHex + payloadB64 + signature

  // Format as XXXXX.XXXXX.XXXXX using dot as separator
  // (cannot use dash because base64url contains dash characters)
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += 5) {
    groups.push(raw.slice(i, i + 5))
  }
  return groups.join('.')
}

export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.sign.keyPair()
}

export function deriveDeviceSecret(deviceId: string): Uint8Array {
  const data = new TextEncoder().encode(SALT + deviceId)
  const hash = nacl.hash(data)
  const seed = hash.slice(0, 32)
  const keyPair = nacl.sign.keyPair.fromSeed(seed)
  return keyPair.secretKey
}

export function getEmbeddedPublicKey(): Uint8Array {
  const decoded = fromBase64Url(_ENC_PK)
  for (let i = 0; i < decoded.length; i++) {
    decoded[i] = decoded[i] ^ _XOR_KEY[i % _XOR_KEY.length]
  }
  return decoded
}

export { toBase64Url, fromBase64Url, PRODUCT_ID, SALT }
