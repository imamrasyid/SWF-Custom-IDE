import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { corsHeaders } from '@/lib/auth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId')
  const licenseId = searchParams.get('licenseId')
  const lastCheck = parseInt(searchParams.get('lastCheck') || '0')

  if (!deviceId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: deviceId' },
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

    let where = 'WHERE executed = 0'
    const args: any[] = []

    if (licenseId) {
      where += ' AND (target_license_id = ? OR target_license_id IS NULL)'
      args.push(licenseId)
    } else {
      where += ' AND target_license_id IS NULL'
    }

    if (deviceId) {
      where += ' AND (target_device_id = ? OR target_device_id IS NULL)'
      args.push(deviceId)
    } else {
      where += ' AND target_device_id IS NULL'
    }

    if (lastCheck > 0) {
      where += ' AND created_at > ?'
      args.push(lastCheck)
    }

    const commands = await db.execute({
      sql: `SELECT * FROM remote_commands ${where} ORDER BY created_at ASC LIMIT 10`,
      args,
    })

    for (const cmd of commands.rows) {
      await db.execute({
        sql: `UPDATE remote_commands SET executed = 1 WHERE id = ?`,
        args: [cmd.id],
      })
    }

    return NextResponse.json({
      banned: false,
      commands: commands.rows.map((cmd) => ({
        id: cmd.id,
        type: cmd.command_type,
        payload: cmd.payload ? JSON.parse(cmd.payload as string) : null,
      })),
    }, { headers })
  } catch (err: any) {
    console.error('[Client Command Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
