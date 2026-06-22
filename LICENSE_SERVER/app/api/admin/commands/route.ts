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
      sql: `SELECT * FROM remote_commands ORDER BY created_at DESC LIMIT 50`,
      args: [],
    })

    return NextResponse.json({ commands: result.rows }, { headers })
  } catch (err: any) {
    console.error('[Admin Commands Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

export async function POST(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const { commandType, targetLicenseId, targetDeviceId, payload } = await request.json()

  if (!commandType) {
    return NextResponse.json(
      { error: 'Missing required field: commandType' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const validCommands = ['force_revoke', 'force_update', 'kill_switch', 'force_deactivate']
  if (!validCommands.includes(commandType)) {
    return NextResponse.json(
      { error: `Invalid commandType. Valid: ${validCommands.join(', ')}` },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const commandId = crypto.randomUUID()

    await db.execute({
      sql: `INSERT INTO remote_commands (id, command_type, target_license_id, target_device_id, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        commandId,
        commandType,
        targetLicenseId || null,
        targetDeviceId || null,
        payload ? JSON.stringify(payload) : null,
        Date.now(),
      ],
    })

    if (commandType === 'force_revoke' && targetLicenseId) {
      await db.execute({
        sql: `UPDATE licenses SET is_revoked = 1, revoked_at = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [Date.now(), targetLicenseId],
      })
      await db.execute({
        sql: `UPDATE activations SET is_active = 0, deactivated_at = ? WHERE license_id = ? AND is_active = 1`,
        args: [Date.now(), targetLicenseId],
      })
    }

    if (commandType === 'force_deactivate' && targetDeviceId) {
      await db.execute({
        sql: `UPDATE activations SET is_active = 0, deactivated_at = ? WHERE device_id = ? AND is_active = 1`,
        args: [Date.now(), targetDeviceId],
      })
    }

    if (commandType === 'kill_switch') {
      if (targetLicenseId) {
        await db.execute({
          sql: `UPDATE licenses SET is_revoked = 1, revoked_at = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [Date.now(), targetLicenseId],
        })
      }
    }

    await db.execute({
      sql: `INSERT INTO activity_log (id, device_id, license_id, event_type, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        targetDeviceId || null,
        targetLicenseId || null,
        `command_${commandType}`,
        JSON.stringify({ commandId, payload }),
        Date.now(),
      ],
    })

    return NextResponse.json({ success: true, commandId }, { headers })
  } catch (err: any) {
    console.error('[Admin Command Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
