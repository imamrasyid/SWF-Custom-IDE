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
    const licenseId = searchParams.get('licenseId')
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '20'
    const offset = (Number(page) - 1) * Number(limit)

    if (licenseId) {
      const result = await db.execute({
        sql: `SELECT a.*, l.customer_email, l.order_id
              FROM activations a
              JOIN licenses l ON a.license_id = l.id
              WHERE a.license_id = ?
              ORDER BY a.activated_at DESC`,
        args: [licenseId],
      })

      return NextResponse.json({ activations: result.rows }, { headers })
    }

    const countResult = await db.execute('SELECT COUNT(*) as total FROM activations WHERE is_active = 1')
    const total = Number(countResult.rows[0].total)

    const result = await db.execute({
      sql: `SELECT a.*, l.customer_email, l.order_id, l.product
            FROM activations a
            JOIN licenses l ON a.license_id = l.id
            ORDER BY a.activated_at DESC
            LIMIT ? OFFSET ?`,
      args: [Number(limit), offset],
    })

    return NextResponse.json({
      activations: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }, { headers })
  } catch (err: any) {
    console.error('[Admin Activations Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
