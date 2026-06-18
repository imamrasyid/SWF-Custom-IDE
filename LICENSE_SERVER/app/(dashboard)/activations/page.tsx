'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/utils'
import { Search, Monitor, Smartphone, Globe } from 'lucide-react'

interface Activation {
  id: string
  license_id: string
  device_id: string
  machine_fingerprint: string
  activated_at: number
  last_verified: number
  is_active: number
  ip_address: string
  app_version: string
  customer_email: string | null
  order_id: string | null
}

interface ActivationsResponse {
  activations: Activation[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function ActivationsPage() {
  const [activations, setActivations] = useState<Activation[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivations()
  }, [page])

  async function fetchActivations() {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '20' })
    const data = await apiRequest<ActivationsResponse>('GET', `/api/admin/activations?${params}`)
    if (data) {
      setActivations(data.activations)
      setTotal(data.pagination.total)
    }
    setLoading(false)
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString()
  }

  function timeAgo(ts: number) {
    const seconds = Math.floor((Date.now() - ts) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activations</h1>
        <p className="text-muted-foreground">{total} total active devices</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left text-sm font-medium">Device</th>
                <th className="p-4 text-left text-sm font-medium">Customer</th>
                <th className="p-4 text-left text-sm font-medium">License</th>
                <th className="p-4 text-left text-sm font-medium">IP</th>
                <th className="p-4 text-left text-sm font-medium">Version</th>
                <th className="p-4 text-left text-sm font-medium">Status</th>
                <th className="p-4 text-left text-sm font-medium">Activated</th>
                <th className="p-4 text-left text-sm font-medium">Last Verified</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : activations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No activations found
                  </td>
                </tr>
              ) : (
                activations.map((activation) => (
                  <tr key={activation.id} className="border-b last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {activation.device_id.slice(0, 12)}...
                        </code>
                      </div>
                    </td>
                    <td className="p-4 text-sm">{activation.customer_email || '-'}</td>
                    <td className="p-4">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {activation.license_id.slice(0, 8)}...
                      </code>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {activation.ip_address || '-'}
                      </div>
                    </td>
                    <td className="p-4 text-sm">{activation.app_version || '-'}</td>
                    <td className="p-4">
                      <Badge variant={activation.is_active ? 'default' : 'secondary'}>
                        {activation.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(activation.activated_at)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {timeAgo(activation.last_verified)}
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
