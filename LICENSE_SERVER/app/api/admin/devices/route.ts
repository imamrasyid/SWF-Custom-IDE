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
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '50'
    const search = searchParams.get('search') || ''
    const banned = searchParams.get('banned')
    const offset = (Number(page) - 1) * Number(limit)

    let where = 'WHERE 1=1'
    const args: any[] = []

    if (search) {
      where += ' AND (d.id LIKE ? OR l.customer_email LIKE ?)'
      args.push(`%${search}%`, `%${search}%`)
    }

    if (banned === 'true') {
      where += ' AND d.is_banned = 1'
    } else if (banned === 'false') {
      where += ' AND d.is_banned = 0'
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM devices d LEFT JOIN licenses l ON d.license_id = l.id ${where}`,
      args,
    })
    const total = Number(countResult.rows[0].total)

    const result = await db.execute({
      sql: `SELECT d.*, l.customer_email, l.order_id,
              (SELECT COUNT(*) FROM activations WHERE device_id = d.id AND is_active = 1) as active_activations
            FROM devices d
            LEFT JOIN licenses l ON d.license_id = l.id
            ${where}
            ORDER BY d.last_seen DESC
            LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), offset],
    })

    const devices = result.rows.map((device) => {
      const ipAddresses: string[] = JSON.parse(device.ip_addresses as string || '[]')
      const recentActivations = Number(device.activation_count || 0)

      let anomaly = null
      if (recentActivations > 5) {
        anomaly = 'high_activation_count'
      } else if (ipAddresses.length > 3) {
        anomaly = 'multiple_ip_addresses'
      }

      const isBanExpired = device.ban_expires_at && Number(device.ban_expires_at) < Date.now()

      return {
        ...device,
        ip_addresses: ipAddresses,
        anomaly,
        is_banned: isBanExpired ? 0 : device.is_banned,
      }
    })

    return NextResponse.json({
      devices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }, { headers })
  } catch (err: any) {
    console.error('[Admin Devices Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
