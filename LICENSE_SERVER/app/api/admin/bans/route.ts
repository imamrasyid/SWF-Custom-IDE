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

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const result = await db.execute({
      sql: `SELECT d.*, l.customer_email, l.order_id
            FROM devices d
            LEFT JOIN licenses l ON d.license_id = l.id
            WHERE d.is_banned = 1
            ORDER BY d.created_at DESC`,
      args: [],
    })

    return NextResponse.json({ bans: result.rows }, { headers })
  } catch (err: any) {
    console.error('[Admin Bans Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

export async function POST(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const { deviceId, reason, expiresAt } = await request.json()

  if (!deviceId) {
    return NextResponse.json(
      { error: 'Missing required field: deviceId' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    await db.execute({
      sql: `INSERT INTO devices (id, license_id, first_seen, last_seen, activation_count, ip_addresses, is_banned, ban_reason, ban_expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_banned = 1,
              ban_reason = excluded.ban_reason,
              ban_expires_at = excluded.ban_expires_at`,
      args: [
        deviceId,
        null,
        Date.now(),
        Date.now(),
        0,
        '[]',
        1,
        reason || 'No reason provided',
        expiresAt || null,
        Date.now(),
      ],
    })

    await db.execute({
      sql: `INSERT INTO activations (id, license_id, device_id, machine_fingerprint, activated_at, last_verified, is_active, deactivated_at)
            SELECT id, license_id, device_id, machine_fingerprint, activated_at, last_verified, 0, ?
            FROM activations WHERE device_id = ? AND is_active = 1`,
      args: [Date.now(), deviceId],
    })

    await db.execute({
      sql: `INSERT INTO activity_log (id, device_id, license_id, event_type, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        deviceId,
        null,
        'ban',
        JSON.stringify({ reason: reason || 'No reason provided', expiresAt }),
        Date.now(),
      ],
    })

    return NextResponse.json({ success: true, message: 'Device banned' }, { headers })
  } catch (err: any) {
    console.error('[Admin Ban Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

export async function DELETE(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const { deviceId } = await request.json()

  if (!deviceId) {
    return NextResponse.json(
      { error: 'Missing required field: deviceId' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    await db.execute({
      sql: `UPDATE devices SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?`,
      args: [deviceId],
    })

    await db.execute({
      sql: `INSERT INTO activity_log (id, device_id, license_id, event_type, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        deviceId,
        null,
        'unban',
        JSON.stringify({}),
        Date.now(),
      ],
    })

    return NextResponse.json({ success: true, message: 'Device unbanned' }, { headers })
  } catch (err: any) {
    console.error('[Admin Unban Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
