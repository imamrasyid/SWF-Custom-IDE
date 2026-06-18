import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
import { corsHeaders } from '@/lib/auth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() })
}

export async function GET(request: NextRequest) {
  const db = await getDb()
  const headers = corsHeaders()

  try {
    const totalLicenses = Number((await db.execute('SELECT COUNT(*) as count FROM licenses')).rows[0].count)
    const activeLicenses = Number((await db.execute('SELECT COUNT(*) as count FROM licenses WHERE is_revoked = 0')).rows[0].count)
    const revokedLicenses = Number((await db.execute('SELECT COUNT(*) as count FROM licenses WHERE is_revoked = 1')).rows[0].count)
    const totalActivations = Number((await db.execute('SELECT COUNT(*) as count FROM activations WHERE is_active = 1')).rows[0].count)

    const recentActivations = await db.execute({
      sql: `SELECT a.*, l.customer_email, l.product
            FROM activations a
            JOIN licenses l ON a.license_id = l.id
            ORDER BY a.activated_at DESC
            LIMIT 5`,
      args: [],
    })

    return NextResponse.json({
      totalLicenses,
      activeLicenses,
      revokedLicenses,
      totalActivations,
      recentActivations: recentActivations.rows,
    }, { headers })
  } catch (err: any) {
    console.error('[Admin Stats Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
