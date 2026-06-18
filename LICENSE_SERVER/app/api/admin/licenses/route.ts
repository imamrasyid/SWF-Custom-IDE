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
    const limit = searchParams.get('limit') || '20'
    const search = searchParams.get('search') || ''
    const product = searchParams.get('product') || ''
    const status = searchParams.get('status') || ''

    const offset = (Number(page) - 1) * Number(limit)

    let where = 'WHERE 1=1'
    const args: any[] = []

    if (search) {
      where += ' AND (id LIKE ? OR customer_email LIKE ? OR order_id LIKE ?)'
      args.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    if (product) {
      where += ' AND product = ?'
      args.push(product)
    }

    if (status === 'revoked') {
      where += ' AND is_revoked = 1'
    } else if (status === 'active') {
      where += ' AND is_revoked = 0'
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM licenses ${where}`,
      args,
    })
    const total = Number(countResult.rows[0].total)

    const result = await db.execute({
      sql: `SELECT * FROM licenses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), offset],
    })

    return NextResponse.json({
      licenses: result.rows.map(row => ({
        ...row,
        features: JSON.parse(row.features as string),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }, { headers })
  } catch (err: any) {
    console.error('[Admin Licenses Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

export async function POST(request: NextRequest) {
  const authError = authCheck(request)
  if (authError) {
    authError.headers.set('Access-Control-Allow-Origin', corsHeaders()['Access-Control-Allow-Origin'])
    return authError
  }

  const db = await getDb()
  const headers = corsHeaders()

  try {
    const { id, license_key_hash, product, type, max_activations, features, issued_at, customer_email, order_id } = await request.json()

    if (!id || !license_key_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: id, license_key_hash' },
        { status: 400, headers }
      )
    }

    await db.execute({
      sql: `INSERT INTO licenses (id, license_key_hash, product, type, max_activations, features, issued_at, customer_email, order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        license_key_hash,
        product || 'ninjasage-modding-toolkit',
        type || 'lifetime',
        max_activations || 3,
        JSON.stringify(features || ['all']),
        issued_at || Date.now(),
        customer_email || null,
        order_id || null,
      ],
    })

    return NextResponse.json({ success: true, id }, { headers })
  } catch (err: any) {
    console.error('[Admin Licenses Error]', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
