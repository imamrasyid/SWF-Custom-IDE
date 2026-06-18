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

  const { licenseId } = await request.json()

  if (!licenseId) {
    return NextResponse.json(
      { error: 'Missing required field: licenseId' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const result = await db.execute({
      sql: `UPDATE licenses SET is_revoked = 1, revoked_at = ?, updated_at = datetime('now') WHERE id = ? AND is_revoked = 0`,
      args: [Date.now(), licenseId],
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'License not found or already revoked' }, { status: 404, headers })
    }

    await db.execute({
      sql: `UPDATE activations SET is_active = 0, deactivated_at = ? WHERE license_id = ? AND is_active = 1`,
      args: [Date.now(), licenseId],
    })

    return NextResponse.json({ success: true, message: 'License revoked' }, { headers })
  } catch (err: any) {
    console.error('[Revoke Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
