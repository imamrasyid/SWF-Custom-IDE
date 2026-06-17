import nacl from 'tweetnacl'
import crypto from 'crypto'

const PRODUCT_ID = 'ninjasage-modding-toolkit'

interface LicensePayload {
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

function generateLicenseId(): string {
  return crypto.randomBytes(16).toString('hex').replace(/(.{8})/g, '$1-').slice(0, -1)
}

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16)
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (let i = 2; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '')
    const value = args[i + 1]
    if (value && !value.startsWith('--')) {
      parsed[key] = value
    }
  }
  return parsed
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    console.log(`
NinjaSage License Key Generator
================================

Usage: npx tsx scripts/generate-license.ts [options]

Options:
  --email <email>       Customer email (optional, hashed for privacy)
  --order <orderId>     Order ID (optional)
  --devices <n>         Max devices (default: 1)
  --features <list>     Comma-separated features (default: all)
  --private-key <key>   Base64url Ed25519 private key (required for subsequent runs)

Example:
  npx tsx scripts/generate-license.ts --email customer@example.com --order ORD-001
`)
    process.exit(0)
  }

  const secretKeyB64 = args['private-key'] || ''
  let secretKey: Uint8Array

  if (!secretKeyB64) {
    console.log('No private key provided. Generating new key pair...\n')
    const pair = nacl.sign.keyPair()
    secretKey = pair.secretKey

    console.log('=== NEW KEY PAIR GENERATED ===')
    console.log('PUBLIC KEY (paste into electron/license/index.ts):')
    console.log('const PUBLIC_KEY_B64URL = \'' + toBase64Url(pair.publicKey) + '\'')
    console.log('\nSECRET KEY (keep safe, use for future generations):')
    console.log(toBase64Url(pair.secretKey))
    console.log('=============================\n')
  } else {
    // Decode from base64url
    let b64 = secretKeyB64.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4 !== 0) b64 += '='
    const binary = atob(b64)
    secretKey = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      secretKey[i] = binary.charCodeAt(i)
    }
    const publicKey = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey
    console.log('Using existing key pair.')
    console.log('PUBLIC KEY (paste into electron/license/index.ts):')
    console.log("const PUBLIC_KEY_B64URL = '" + toBase64Url(publicKey) + "'")
    console.log('')
  }

  const email = args.email || ''
  const maxDevices = parseInt(args.devices || '1', 10)
  const features = args.features ? args.features.split(',').map(f => f.trim()) : ['all']

  const payload: LicensePayload = {
    id: generateLicenseId(),
    product: PRODUCT_ID,
    type: 'lifetime',
    maxDevices,
    features,
    issuedAt: Date.now(),
  }

  if (email) {
    payload.metadata = {
      customerEmail: hashEmail(email),
      orderId: args.order || undefined,
    }
  }

  const message = encodePayload(payload)
  const signature = nacl.sign.detached(message, secretKey)
  const payloadB64 = toBase64Url(message)
  const sigB64 = toBase64Url(signature)

  // Format: 2-char hex length prefix + payload B64 + signature B64 → groups of 5 with dot separator
  const payloadLenHex = payloadB64.length.toString(16).padStart(2, '0')
  const raw = payloadLenHex + payloadB64 + sigB64
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += 5) {
    groups.push(raw.slice(i, i + 5))
  }
  const licenseKey = groups.join('.')

  console.log('=== LICENSE KEY GENERATED ===')
  console.log(`License ID:  ${payload.id}`)
  console.log(`Product:     ${payload.product}`)
  console.log(`Type:        ${payload.type}`)
  console.log(`Max Devices: ${payload.maxDevices}`)
  console.log(`Features:    ${payload.features.join(', ')}`)
  console.log(`Issued At:   ${new Date(payload.issuedAt).toISOString()}`)
  if (email) console.log(`Customer:    ${email}`)
  console.log('')
  console.log('LICENSE KEY:')
  console.log(licenseKey)
  console.log('')
  console.log('=== END ===')
}

main().catch(console.error)
