import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { corsHeaders } from '@/lib/auth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
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
    const banCheck = await db.execute({
      sql: `SELECT id, ban_reason, ban_expires_at FROM devices WHERE id = ? AND is_banned = 1`,
      args: [deviceId],
    })

    if (banCheck.rows.length > 0) {
      const ban = banCheck.rows[0]
      const isExpired = ban.ban_expires_at && Number(ban.ban_expires_at) < Date.now()

      if (!isExpired) {
        return NextResponse.json({
          banned: true,
          reason: ban.ban_reason,
          expiresAt: ban.ban_expires_at,
        }, { headers })
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
          return NextResponse.json({
            rateLimited: true,
            retryAfter: Number(rl.window_start) + 3600000 - Date.now(),
          }, { headers })
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

    return NextResponse.json({ banned: false, rateLimited: false }, { headers })
  } catch (err: any) {
    console.error('[Check Ban Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
