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
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const since = Date.now() - days * 24 * 60 * 60 * 1000

    const totalEvents = Number((await db.execute({
      sql: 'SELECT COUNT(*) as count FROM telemetry_events WHERE created_at > ?',
      args: [since],
    })).rows[0].count)

    const totalSessions = Number((await db.execute({
      sql: 'SELECT COUNT(*) as count FROM telemetry_sessions WHERE started_at > ?',
      args: [since],
    })).rows[0].count)

    const uniqueDevices = Number((await db.execute({
      sql: 'SELECT COUNT(DISTINCT device_id) as count FROM telemetry_events WHERE created_at > ?',
      args: [since],
    })).rows[0].count)

    const eventsByType = await db.execute({
      sql: `SELECT event_type, COUNT(*) as count FROM telemetry_events WHERE created_at > ? GROUP BY event_type ORDER BY count DESC`,
      args: [since],
    })

    const topFeatures = await db.execute({
      sql: `SELECT json_extract(payload, '$.feature') as feature, COUNT(*) as count
            FROM telemetry_events
            WHERE event_type = 'feature_use' AND created_at > ?
            GROUP BY feature
            ORDER BY count DESC
            LIMIT 10`,
      args: [since],
    })

    const osDistribution = await db.execute({
      sql: `SELECT os, COUNT(DISTINCT device_id) as count FROM telemetry_events WHERE created_at > ? GROUP BY os ORDER BY count DESC`,
      args: [since],
    })

    const versionDistribution = await db.execute({
      sql: `SELECT app_version, COUNT(DISTINCT device_id) as count FROM telemetry_events WHERE created_at > ? GROUP BY app_version ORDER BY count DESC`,
      args: [since],
    })

    const crashes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM telemetry_events WHERE event_type = 'crash' AND created_at > ?`,
      args: [since],
    })

    const recentCrashes = await db.execute({
      sql: `SELECT * FROM telemetry_events WHERE event_type = 'crash' AND created_at > ? ORDER BY created_at DESC LIMIT 5`,
      args: [since],
    })

    const dailyEvents = await db.execute({
      sql: `SELECT date(created_at / 1000, 'unixepoch') as day, COUNT(*) as count
            FROM telemetry_events WHERE created_at > ?
            GROUP BY day ORDER BY day`,
      args: [since],
    })

    return NextResponse.json({
      totalEvents,
      totalSessions,
      uniqueDevices,
      crashCount: Number(crashes.rows[0].count),
      eventsByType: eventsByType.rows,
      topFeatures: topFeatures.rows,
      osDistribution: osDistribution.rows,
      versionDistribution: versionDistribution.rows,
      recentCrashes: recentCrashes.rows,
      dailyEvents: dailyEvents.rows,
    }, { headers })
  } catch (err: any) {
    console.error('[Telemetry Stats Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
