import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { authCheck, corsHeaders } from '@/lib/auth'

interface TelemetryEvent {
  id: string
  license_id?: string
  device_id: string
  event_type: string
  app_version: string
  os: string
  payload?: Record<string, any>
  created_at: number
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

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const { events } = body

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty events array' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const sessionEvents = events.filter((e: TelemetryEvent) =>
      e.event_type === 'session_start' || e.event_type === 'session_end'
    )

    for (const event of sessionEvents) {
      if (event.event_type === 'session_start') {
        await db.execute({
          sql: `INSERT INTO telemetry_sessions (id, license_id, device_id, started_at, app_version, os)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            event.id,
            event.license_id || null,
            event.device_id,
            event.created_at,
            event.app_version,
            event.os,
          ],
        })
      } else if (event.event_type === 'session_end') {
        await db.execute({
          sql: `UPDATE telemetry_sessions SET ended_at = ? WHERE device_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
          args: [event.created_at, event.device_id],
        })
      }
    }

    const nonSessionEvents = events.filter((e: TelemetryEvent) =>
      e.event_type !== 'session_start' && e.event_type !== 'session_end'
    )

    for (const event of nonSessionEvents) {
      await db.execute({
        sql: `INSERT INTO telemetry_events (id, license_id, device_id, event_type, app_version, os, payload, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          event.id,
          event.license_id || null,
          event.device_id,
          event.event_type,
          event.app_version,
          event.os,
          event.payload ? JSON.stringify(event.payload) : null,
          event.created_at,
        ],
      })
    }

    return NextResponse.json({ success: true, processed: events.length }, { headers })
  } catch (err: any) {
    console.error('[Telemetry Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
