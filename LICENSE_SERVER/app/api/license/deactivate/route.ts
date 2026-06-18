import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/turso'
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

  const { licenseId, deviceId } = await request.json()

  if (!licenseId || !deviceId) {
    return NextResponse.json(
      { error: 'Missing required fields: licenseId, deviceId' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const result = await db.execute({
      sql: `UPDATE activations SET is_active = 0, deactivated_at = ?
            WHERE license_id = ? AND device_id = ? AND is_active = 1`,
      args: [Date.now(), licenseId, deviceId],
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'No active activation found for this device' }, { status: 404, headers })
    }

    return NextResponse.json({ success: true, message: 'License deactivated successfully' }, { headers })
  } catch (err: any) {
    console.error('[Deactivate Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
