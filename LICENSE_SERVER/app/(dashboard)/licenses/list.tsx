'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/utils'
import { Search, Plus, Ban, Eye } from 'lucide-react'
import Link from 'next/link'

interface License {
  id: string
  license_key_hash: string
  product: string
  type: string
  max_activations: number
  features: string[]
  issued_at: number
  customer_email: string | null
  order_id: string | null
  is_revoked: number
  created_at: string
}

interface LicensesResponse {
  licenses: License[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function LicensesListPage() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLicenses()
  }, [page, search])

  async function fetchLicenses() {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(search && { search }),
    })
    const data = await apiRequest<LicensesResponse>('GET', `/api/admin/licenses?${params}`)
    if (data) {
      setLicenses(data.licenses)
      setTotal(data.pagination.total)
    }
    setLoading(false)
  }

  async function revokeLicense(id: string) {
    if (!confirm('Are you sure you want to revoke this license? This will deactivate all devices.')) return
    await apiRequest('POST', '/api/admin/licenses/revoke', { licenseId: id })
    fetchLicenses()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Licenses</h1>
          <p className="text-muted-foreground">{total} total licenses</p>
        </div>
        <Link href="/licenses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create License
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, email, or order..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left text-sm font-medium">License ID</th>
                <th className="p-4 text-left text-sm font-medium">Customer</th>
                <th className="p-4 text-left text-sm font-medium">Type</th>
                <th className="p-4 text-left text-sm font-medium">Devices</th>
                <th className="p-4 text-left text-sm font-medium">Status</th>
                <th className="p-4 text-left text-sm font-medium">Issued</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No licenses found
                  </td>
                </tr>
              ) : (
                licenses.map((license) => (
                  <tr key={license.id} className="border-b last:border-0">
                    <td className="p-4">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {license.id.slice(0, 8)}...
                      </code>
                    </td>
                    <td className="p-4 text-sm">{license.customer_email || '-'}</td>
                    <td className="p-4">
                      <Badge variant="outline">{license.type}</Badge>
                    </td>
                    <td className="p-4 text-sm">{license.max_activations}</td>
                    <td className="p-4">
                      <Badge variant={license.is_revoked ? 'destructive' : 'default'}>
                        {license.is_revoked ? 'Revoked' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(license.issued_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!license.is_revoked && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => revokeLicense(license.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 20)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
