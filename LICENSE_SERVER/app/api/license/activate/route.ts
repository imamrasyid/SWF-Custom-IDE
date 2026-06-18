import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { parseLicenseKey, verifyLicenseSignature } from '@/lib/license-crypto'
import { authCheck, corsHeaders } from '@/lib/auth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const { licenseKey, deviceId, machineFingerprint, appVersion } = await request.json()

  if (!licenseKey || !deviceId || !machineFingerprint) {
    return NextResponse.json(
      { error: 'Missing required fields: licenseKey, deviceId, machineFingerprint' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const parsed = parseLicenseKey(licenseKey)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid license key format' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const { payload, signature } = parsed

  if (payload.product !== 'ninjasage-modding-toolkit') {
    return NextResponse.json(
      { error: 'Invalid license key for this product' },
      { status: 400, headers: corsHeaders() }
    )
  }

  if (!verifyLicenseSignature(payload as Record<string, any>, signature)) {
    return NextResponse.json(
      { error: 'Invalid license signature' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM licenses WHERE id = ?',
      args: [payload.id],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404, headers })
    }

    const license = result.rows[0]

    if (license.is_revoked === 1) {
      return NextResponse.json({ error: 'License has been revoked' }, { status: 403, headers })
    }

    const existingActivation = await db.execute({
      sql: 'SELECT * FROM activations WHERE license_id = ? AND device_id = ? AND is_active = 1',
      args: [license.id as string, deviceId],
    })

    if (existingActivation.rows.length > 0) {
      const activation = existingActivation.rows[0]
      await db.execute({
        sql: 'UPDATE activations SET last_verified = ?, ip_address = ?, app_version = ? WHERE id = ?',
        args: [Date.now(), request.headers.get('x-forwarded-for') || '', appVersion || '', activation.id as string],
      })

      return NextResponse.json({
        success: true,
        licenseId: license.id,
        type: license.type,
        features: JSON.parse(license.features as string),
        activatedAt: activation.activated_at,
        reactivated: true,
      }, { headers })
    }

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM activations WHERE license_id = ? AND is_active = 1',
      args: [license.id as string],
    })

    const activeCount = Number(countResult.rows[0].count)

    if (activeCount >= Number(license.max_activations)) {
      return NextResponse.json({
        error: 'Maximum activation limit reached',
        maxActivations: license.max_activations,
        currentActivations: activeCount,
      }, { status: 403, headers })
    }

    const activationId = crypto.randomUUID()
    const now = Date.now()

    await db.execute({
      sql: `INSERT INTO activations (id, license_id, device_id, machine_fingerprint, activated_at, last_verified, ip_address, app_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [activationId, license.id as string, deviceId, machineFingerprint, now, now, request.headers.get('x-forwarded-for') || '', appVersion || ''],
    })

    return NextResponse.json({
      success: true,
      licenseId: license.id,
      activationId,
      type: license.type,
      features: JSON.parse(license.features as string),
      activatedAt: now,
    }, { headers })
  } catch (err: any) {
    console.error('[Activate Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
