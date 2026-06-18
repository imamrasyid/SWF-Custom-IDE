import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { authCheck, corsHeaders } from '@/lib/auth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function GET(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const { searchParams } = new URL(request.url)
  const licenseId = searchParams.get('licenseId')
  const deviceId = searchParams.get('deviceId')

  if (!licenseId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: licenseId' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM licenses WHERE id = ?',
      args: [licenseId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404, headers })
    }

    const license = result.rows[0]

    if (license.is_revoked === 1) {
      return NextResponse.json({
        valid: false,
        reason: 'revoked',
        revokedAt: license.revoked_at,
      }, { headers })
    }

    if (deviceId) {
      const activationResult = await db.execute({
        sql: 'SELECT * FROM activations WHERE license_id = ? AND device_id = ? AND is_active = 1',
        args: [licenseId, deviceId],
      })

      if (activationResult.rows.length === 0) {
        return NextResponse.json({
          valid: false,
          reason: 'not_activated_on_device',
        }, { headers })
      }

      const activation = activationResult.rows[0]
      await db.execute({
        sql: 'UPDATE activations SET last_verified = ? WHERE id = ?',
        args: [Date.now(), activation.id as string],
      })

      return NextResponse.json({
        valid: true,
        licenseId: license.id,
        type: license.type,
        features: JSON.parse(license.features as string),
        activatedAt: activation.activated_at,
        lastVerified: Date.now(),
      }, { headers })
    }

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM activations WHERE license_id = ? AND is_active = 1',
      args: [licenseId],
    })

    return NextResponse.json({
      valid: true,
      licenseId: license.id,
      type: license.type,
      features: JSON.parse(license.features as string),
      activations: Number(countResult.rows[0].count),
      maxActivations: license.max_activations,
    }, { headers })
  } catch (err: any) {
    console.error('[Verify Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
