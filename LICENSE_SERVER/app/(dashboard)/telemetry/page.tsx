'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/utils'
import { Monitor, Users, Activity, Bug, TrendingUp, AlertTriangle } from 'lucide-react'

interface TelemetryStats {
  totalEvents: number
  totalSessions: number
  uniqueDevices: number
  crashCount: number
  eventsByType: { event_type: string; count: number }[]
  topFeatures: { feature: string; count: number }[]
  osDistribution: { os: string; count: number }[]
  versionDistribution: { app_version: string; count: number }[]
  recentCrashes: any[]
  dailyEvents: { day: string; count: number }[]
}

export default function TelemetryPage() {
  const [stats, setStats] = useState<TelemetryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    fetchStats()
  }, [days])

  async function fetchStats() {
    setLoading(true)
    const data = await apiRequest<TelemetryStats>('GET', `/api/telemetry/stats?days=${days}`)
    if (data) setStats(data)
    setLoading(false)
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>
  if (!stats) return <div className="text-muted-foreground">Failed to load telemetry data</div>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemetry</h1>
          <p className="text-muted-foreground">Usage data from the last {days} days</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-3xl font-bold">{stats.totalEvents.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="text-3xl font-bold">{stats.totalSessions.toLocaleString()}</p>
              </div>
              <Monitor className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Devices</p>
                <p className="text-3xl font-bold">{stats.uniqueDevices.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crashes</p>
                <p className="text-3xl font-bold">{stats.crashCount}</p>
              </div>
              <Bug className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.eventsByType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.eventsByType.map((item) => (
                  <div key={item.event_type} className="flex items-center justify-between">
                    <Badge variant="outline">{item.event_type}</Badge>
                    <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Features</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feature usage data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.topFeatures.map((item) => (
                  <div key={item.feature} className="flex items-center justify-between">
                    <span className="text-sm">{item.feature || 'unknown'}</span>
                    <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OS Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.osDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.osDistribution.map((item) => (
                  <div key={item.os} className="flex items-center justify-between">
                    <span className="text-sm">{item.os}</span>
                    <span className="text-sm font-medium">{item.count} devices</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Version Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.versionDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.versionDistribution.map((item) => (
                  <div key={item.app_version} className="flex items-center justify-between">
                    <Badge variant="outline">v{item.app_version}</Badge>
                    <span className="text-sm font-medium">{item.count} devices</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.recentCrashes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Recent Crashes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentCrashes.map((crash) => (
                <div key={crash.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{crash.device_id}</code>
                    <span className="text-xs text-muted-foreground">
                      {new Date(crash.created_at).toLocaleString()}
                    </span>
                  </div>
                  <pre className="text-xs text-muted-foreground overflow-x-auto max-h-24">
                    {JSON.stringify(JSON.parse(crash.payload || '{}'), null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
