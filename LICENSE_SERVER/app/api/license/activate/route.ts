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
  const ipAddress = request.headers.get('x-forwarded-for') || ''

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

  if (payload.product !== 'wayangide') {
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
    const banCheck = await db.execute({
      sql: `SELECT id, ban_reason, ban_expires_at FROM devices WHERE id = ? AND is_banned = 1`,
      args: [deviceId],
    })

    if (banCheck.rows.length > 0) {
      const ban = banCheck.rows[0]
      const isExpired = ban.ban_expires_at && Number(ban.ban_expires_at) < Date.now()

      if (!isExpired) {
        await logActivity(db, deviceId, payload.id, 'activate_blocked', ipAddress, { reason: 'banned' })
        return NextResponse.json({
          error: 'This device has been banned',
          reason: ban.ban_reason,
        }, { status: 403, headers })
      }
    }

    const rateLimitKey = `activate:${deviceId}`
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    const rateLimit = await db.execute({
      sql: `SELECT count, window_start FROM rate_limits WHERE id = ?`,
      args: [rateLimitKey],
    })

    if (rateLimit.rows.length > 0) {
      const rl = rateLimit.rows[0]
      if (Number(rl.window_start) > oneHourAgo) {
        if (Number(rl.count) >= 5) {
          await logActivity(db, deviceId, payload.id, 'rate_limited', ipAddress, {})
          return NextResponse.json({
            error: 'Too many activation attempts. Please try again later.',
            retryAfter: Number(rl.window_start) + 3600000 - Date.now(),
          }, { status: 429, headers })
        }
        await db.execute({
          sql: `UPDATE rate_limits SET count = count + 1 WHERE id = ?`,
          args: [rateLimitKey],
        })
      } else {
        await db.execute({
          sql: `UPDATE rate_limits SET count = 1, window_start = ? WHERE id = ?`,
          args: [Date.now(), rateLimitKey],
        })
      }
    } else {
      await db.execute({
        sql: `INSERT INTO rate_limits (id, count, window_start) VALUES (?, 1, ?)`,
        args: [rateLimitKey, Date.now()],
      })
    }

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
        args: [Date.now(), ipAddress, appVersion || '', activation.id as string],
      })

      await upsertDevice(db, deviceId, license.id as string, ipAddress)
      await logActivity(db, deviceId, license.id as string, 'reactivate', ipAddress, { appVersion })

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
      args: [activationId, license.id as string, deviceId, machineFingerprint, now, now, ipAddress, appVersion || ''],
    })

    await upsertDevice(db, deviceId, license.id as string, ipAddress)
    await logActivity(db, deviceId, license.id as string, 'activate', ipAddress, { appVersion, activationId })

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

async function upsertDevice(db: any, deviceId: string, licenseId: string, ipAddress: string) {
  const existing = await db.execute({
    sql: `SELECT id, ip_addresses FROM devices WHERE id = ?`,
    args: [deviceId],
  })

  if (existing.rows.length > 0) {
    const device = existing.rows[0]
    const ips: string[] = JSON.parse(device.ip_addresses as string || '[]')
    if (ipAddress && !ips.includes(ipAddress)) {
      ips.push(ipAddress)
      if (ips.length > 10) ips.shift()
    }
    await db.execute({
      sql: `UPDATE devices SET last_seen = ?, activation_count = activation_count + 1, ip_addresses = ?, license_id = ? WHERE id = ?`,
      args: [Date.now(), JSON.stringify(ips), licenseId, deviceId],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO devices (id, license_id, first_seen, last_seen, activation_count, ip_addresses, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [deviceId, licenseId, Date.now(), Date.now(), 1, JSON.stringify(ipAddress ? [ipAddress] : []), Date.now()],
    })
  }
}

async function logActivity(db: any, deviceId: string, licenseId: string | null, eventType: string, ipAddress: string, details: Record<string, any>) {
  await db.execute({
    sql: `INSERT INTO activity_log (id, device_id, license_id, event_type, ip_address, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      deviceId,
      licenseId,
      eventType,
      ipAddress,
      JSON.stringify(details),
      Date.now(),
    ],
  })
}
