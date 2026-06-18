'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/utils'
import { Key, Monitor, Ban, ShieldCheck, TrendingUp, Clock } from 'lucide-react'

interface Stats {
  totalLicenses: number
  activeLicenses: number
  revokedLicenses: number
  totalActivations: number
  recentActivations: any[]
}

interface License {
  id: string
  customer_email: string | null
  order_id: string | null
  type: string
  features: string[]
  max_activations: number
  is_revoked: number
  created_at: string
  activations?: number
}

interface LicensesResponse {
  licenses: License[]
  pagination: { total: number }
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLicenses, setRecentLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [statsData, licensesData] = await Promise.all([
      apiRequest<Stats>('GET', '/api/admin/stats'),
      apiRequest<LicensesResponse>('GET', '/api/admin/licenses?limit=5'),
    ])
    if (statsData) setStats(statsData)
    if (licensesData) setRecentLicenses(licensesData.licenses)
    setLoading(false)
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>
  }

  if (!stats) {
    return <div className="text-muted-foreground">Failed to load stats</div>
  }

  const statCards = [
    { label: 'Total Licenses', value: stats.totalLicenses, icon: Key, color: 'text-blue-500' },
    { label: 'Active', value: stats.activeLicenses, icon: ShieldCheck, color: 'text-green-500' },
    { label: 'Revoked', value: stats.revokedLicenses, icon: Ban, color: 'text-red-500' },
    { label: 'Active Devices', value: stats.totalActivations, icon: Monitor, color: 'text-purple-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">License system overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLicenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No licenses yet</p>
            ) : (
              <div className="space-y-3">
                {recentLicenses.map((license) => (
                  <div key={license.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{license.id.slice(0, 8)}...</code>
                      <p className="text-xs text-muted-foreground">{license.customer_email || license.order_id || 'No info'}</p>
                    </div>
                    <Badge variant={license.is_revoked ? 'destructive' : 'default'}>
                      {license.is_revoked ? 'Revoked' : 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activations</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activations yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivations.map((activation: any) => (
                  <div key={activation.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{activation.device_id?.slice(0, 12)}...</code>
                      <p className="text-xs text-muted-foreground">{activation.customer_email || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(activation.activated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
