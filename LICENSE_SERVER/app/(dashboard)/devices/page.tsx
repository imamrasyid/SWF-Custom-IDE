'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/utils'
import { Search, Ban, CheckCircle, AlertTriangle, Monitor } from 'lucide-react'

interface Device {
  id: string
  license_id: string | null
  first_seen: number
  last_seen: number
  activation_count: number
  ip_addresses: string[]
  is_banned: number
  ban_reason: string | null
  ban_expires_at: number | null
  customer_email: string | null
  active_activations: number
  anomaly: string | null
}

interface DevicesResponse {
  devices: Device[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [banModal, setBanModal] = useState<string | null>(null)
  const [banReason, setBanReason] = useState('')

  useEffect(() => { fetchDevices() }, [page, search])

  async function fetchDevices() {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '20', ...(search && { search }) })
    const data = await apiRequest<DevicesResponse>('GET', `/api/admin/devices?${params}`)
    if (data) { setDevices(data.devices); setTotal(data.pagination.total) }
    setLoading(false)
  }

  async function banDevice(deviceId: string) {
    await apiRequest('POST', '/api/admin/bans', { deviceId, reason: banReason || 'No reason' })
    setBanModal(null); setBanReason(''); fetchDevices()
  }

  async function unbanDevice(deviceId: string) {
    await apiRequest('DELETE', '/api/admin/bans', { deviceId })
    fetchDevices()
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
        <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">{total} tracked devices</p>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search device ID or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left text-sm font-medium">Device</th>
                <th className="p-4 text-left text-sm font-medium">Customer</th>
                <th className="p-4 text-left text-sm font-medium">Activations</th>
                <th className="p-4 text-left text-sm font-medium">IPs</th>
                <th className="p-4 text-left text-sm font-medium">Status</th>
                <th className="p-4 text-left text-sm font-medium">Last Seen</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No devices found</td></tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="border-b last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{device.id.slice(0, 16)}...</code>
                        {device.anomaly && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                      </div>
                    </td>
                    <td className="p-4 text-sm">{device.customer_email || '-'}</td>
                    <td className="p-4 text-sm">{device.activation_count}</td>
                    <td className="p-4 text-sm">{device.ip_addresses.length}</td>
                    <td className="p-4">
                      <Badge variant={device.is_banned ? 'destructive' : 'default'}>
                        {device.is_banned ? 'Banned' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{timeAgo(device.last_seen)}</td>
                    <td className="p-4 text-right">
                      {device.is_banned ? (
                        <Button variant="outline" size="sm" onClick={() => unbanDevice(device.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Unban
                        </Button>
                      ) : (
                        <Button variant="destructive" size="sm" onClick={() => setBanModal(device.id)}>
                          <Ban className="h-4 w-4 mr-1" /> Ban
                        </Button>
                      )}
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
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 20)}>Next</Button>
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ban Device</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Input placeholder="Why is this device banned?" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBanModal(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => banDevice(banModal)}>Ban Device</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
