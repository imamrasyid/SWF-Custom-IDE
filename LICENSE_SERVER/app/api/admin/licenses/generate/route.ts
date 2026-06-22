import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { authCheck, corsHeaders } from '@/lib/auth'
import nacl from 'tweetnacl'

const PRIVATE_KEY_B64URL = process.env.LICENSE_PRIVATE_KEY || ''

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

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodePayload(payload: Record<string, any>): Uint8Array {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  return new TextEncoder().encode(canonical)
}

function generateLicenseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').replace(/(.{8})/g, '$1-').slice(0, -1)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  if (!PRIVATE_KEY_B64URL) {
    return NextResponse.json(
      { error: 'LICENSE_PRIVATE_KEY not configured on server' },
      { status: 500, headers: corsHeaders() }
    )
  }

  const { customerEmail, orderId } = await request.json()

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const secretKey = fromBase64Url(PRIVATE_KEY_B64URL)
    const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey)

    const licenseId = generateLicenseId()
    const now = Date.now()

    const payload = {
      id: licenseId,
      product: 'wayangide',
      type: 'lifetime',
      maxDevices: 3,
      features: ['all'],
      issuedAt: now,
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

    const licenseKeyHash = 'h' + licenseId.slice(0, 8)

    await db.execute({
      sql: `INSERT INTO licenses (id, license_key_hash, product, type, max_activations, features, issued_at, customer_email, order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        licenseId,
        licenseKeyHash,
        'wayangide',
        'lifetime',
        3,
        JSON.stringify(['all']),
        now,
        customerEmail || null,
        orderId || null,
      ],
    })

    return NextResponse.json({
      success: true,
      licenseId,
      licenseKey,
      customerEmail: customerEmail || null,
      orderId: orderId || null,
      issuedAt: now,
    }, { headers })
  } catch (err: any) {
    console.error('[Generate License Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
