import nacl from 'tweetnacl'
import crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const PRODUCT_ID = 'wayangide'

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

function xorEncodeKey(publicKey: Uint8Array): { encoded: string; xorKey: string } {
  const xorKeyStr = 'WAYANGIDE-v1-2026-PublicKey'
  const xorKey = new TextEncoder().encode(xorKeyStr)

  const encoded = new Uint8Array(publicKey.length)
  for (let i = 0; i < publicKey.length; i++) {
    encoded[i] = publicKey[i] ^ xorKey[i % xorKey.length]
  }

  return {
    encoded: toBase64Url(encoded),
    xorKey: xorKeyStr,
  }
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
WayangIDE License Key Generator
================================

Usage: npx tsx scripts/generate-license.ts [options]

Options:
  --email <email>       Customer email (optional, hashed for privacy)
  --order <orderId>     Order ID (optional)
  --private-key <key>   Base64url Ed25519 private key (auto-saved to .env on first run)

Example:
  # First time: auto-generates key pair, saves to .env
  npx tsx scripts/generate-license.ts

  # Subsequent: uses key from .env automatically
  npx tsx scripts/generate-license.ts --email customer@example.com --order ORD-001
`)
    process.exit(0)
  }

  const secretKeyB64 = args['private-key'] || ''
  let secretKey: Uint8Array

  if (!secretKeyB64) {
    const envPath = path.join(__dirname, '..', '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const match = envContent.match(/LICENSE_PRIVATE_KEY=(.+)/)
      if (match) {
        console.log('Found private key in .env, using it...\n')
        secretKey = decodeBase64Url(match[1].trim())
        const publicKey = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey
        console.log('Using existing key pair.')
        console.log('PUBLIC KEY: ' + toBase64Url(publicKey))
        console.log('')
      } else {
        console.log('No private key found. Generating new key pair...\n')
        const pair = nacl.sign.keyPair()
        secretKey = pair.secretKey
        saveKeyToEnv(pair.secretKey)
        printNewKeyPair(pair)
      }
    } else {
      console.log('No .env found. Generating new key pair...\n')
      const pair = nacl.sign.keyPair()
      secretKey = pair.secretKey
      saveKeyToEnv(pair.secretKey)
      printNewKeyPair(pair)
    }
  } else {
    secretKey = decodeBase64Url(secretKeyB64)
    const publicKey = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey
    console.log('Using provided key pair.')
    console.log('PUBLIC KEY: ' + toBase64Url(publicKey))
    console.log('')
  }

  function decodeBase64Url(str: string): Uint8Array {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4 !== 0) b64 += '='
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  function saveKeyToEnv(secretKey: Uint8Array) {
    const envPath = path.join(__dirname, '..', '.env')
    const keyB64 = toBase64Url(secretKey)
    const envLine = `LICENSE_PRIVATE_KEY=${keyB64}\n`
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      if (!content.includes('LICENSE_PRIVATE_KEY=')) {
        fs.appendFileSync(envPath, '\n' + envLine)
      } else {
        fs.writeFileSync(envPath, content.replace(/LICENSE_PRIVATE_KEY=.*/, `LICENSE_PRIVATE_KEY=${keyB64}`))
      }
    } else {
      fs.writeFileSync(envPath, envLine)
    }
    console.log(`✓ Private key saved to .env`)
  }

  function printNewKeyPair(pair: nacl.SignKeyPair) {
    const { encoded, xorKey } = xorEncodeKey(pair.publicKey)
    const secretKeyB64 = toBase64Url(pair.secretKey)

    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║              NEW KEY PAIR GENERATED                         ║')
    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('1. PUBLIC KEY (raw base64url):')
    console.log('   ' + toBase64Url(pair.publicKey))
    console.log('')
    console.log('2. XOR-ENCODED PUBLIC KEY (paste into license-crypto.ts _ENC_PK):')
    console.log('   ' + encoded)
    console.log('')
    console.log('3. XOR KEY (paste into license-crypto.ts _XOR_KEY as char codes):')
    console.log('   ' + xorKey)
    console.log('')
    console.log('4. SECRET KEY (saved to .env):')
    console.log('   ' + secretKeyB64)
    console.log('')
    console.log('5. C++ NATIVE ADDON (update ENC_PUBLIC_KEY in license_key.cc):')
    console.log('   const uint8_t ENC_PUBLIC_KEY[] = {')
    const rawBytes = pair.publicKey
    const lines: string[] = []
    for (let i = 0; i < rawBytes.length; i += 8) {
      const chunk = Array.from(rawBytes.slice(i, i + 8))
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(', ')
      lines.push('       ' + chunk)
    }
    console.log(lines.join(',\n'))
    console.log('   };')
    console.log('')
    console.log('╚══════════════════════════════════════════════════════════════╝')
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

  const payloadLenHex = payloadB64.length.toString(16).padStart(2, '0')
  const raw = payloadLenHex + payloadB64 + sigB64
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += 5) {
    groups.push(raw.slice(i, i + 5))
  }
  const licenseKey = groups.join('.')

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║              LICENSE KEY GENERATED                          ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
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
  console.log('╚══════════════════════════════════════════════════════════════╝')
}

main().catch(console.error)
