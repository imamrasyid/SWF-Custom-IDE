'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/utils'
import { Terminal, Send, Shield, RefreshCw, Trash2 } from 'lucide-react'

interface Command {
  id: string
  command_type: string
  target_license_id: string | null
  target_device_id: string | null
  payload: string | null
  executed: number
  created_at: number
}

const COMMAND_TYPES = [
  { value: 'force_revoke', label: 'Force Revoke', description: 'Revoke a license immediately', icon: Shield },
  { value: 'force_deactivate', label: 'Force Deactivate', description: 'Deactivate a specific device', icon: Trash2 },
  { value: 'force_update', label: 'Force Update', description: 'Require minimum version', icon: RefreshCw },
  { value: 'kill_switch', label: 'Kill Switch', description: 'Shut down the app (use carefully!)', icon: Terminal },
]

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(true)
  const [showSend, setShowSend] = useState(false)
  const [commandType, setCommandType] = useState('force_revoke')
  const [targetLicense, setTargetLicense] = useState('')
  const [targetDevice, setTargetDevice] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { fetchCommands() }, [])

  async function fetchCommands() {
    setLoading(true)
    const data = await apiRequest<{ commands: Command[] }>('GET', '/api/admin/commands')
    if (data) setCommands(data.commands)
    setLoading(false)
  }

  async function sendCommand() {
    setSending(true)
    await apiRequest('POST', '/api/admin/commands', {
      commandType,
      targetLicenseId: targetLicense || undefined,
      targetDeviceId: targetDevice || undefined,
    })
    setSending(false); setShowSend(false); fetchCommands()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Remote Commands</h1>
          <p className="text-muted-foreground">Send commands to client apps</p>
        </div>
        <Button onClick={() => setShowSend(true)}>
          <Send className="mr-2 h-4 w-4" /> Send Command
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Command History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : commands.length === 0 ? (
            <p className="text-muted-foreground">No commands sent yet</p>
          ) : (
            <div className="space-y-3">
              {commands.map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={cmd.command_type === 'kill_switch' ? 'destructive' : 'outline'}>{cmd.command_type}</Badge>
                      {cmd.executed ? <Badge variant="default">Executed</Badge> : <Badge variant="secondary">Pending</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cmd.target_license_id && `License: ${cmd.target_license_id.slice(0, 8)}...`}
                      {cmd.target_license_id && cmd.target_device_id && ' | '}
                      {cmd.target_device_id && `Device: ${cmd.target_device_id.slice(0, 12)}...`}
                      {!cmd.target_license_id && !cmd.target_device_id && 'All devices'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(cmd.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showSend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Send Command</CardTitle>
              <CardDescription>Commands are executed on the next client poll</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Command Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMMAND_TYPES.map((ct) => (
                    <Button
                      key={ct.value}
                      variant={commandType === ct.value ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setCommandType(ct.value)}
                    >
                      <ct.icon className="h-4 w-4 mr-2" />
                      {ct.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {COMMAND_TYPES.find(ct => ct.value === commandType)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target License ID (optional)</label>
                <Input placeholder="Leave empty for all licenses" value={targetLicense} onChange={(e) => setTargetLicense(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Device ID (optional)</label>
                <Input placeholder="Leave empty for all devices" value={targetDevice} onChange={(e) => setTargetDevice(e.target.value)} />
              </div>

              {commandType === 'kill_switch' && (
                <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                  Warning: Kill switch will shut down the app for all targeted users!
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSend(false)}>Cancel</Button>
                <Button variant={commandType === 'kill_switch' ? 'destructive' : 'default'} onClick={sendCommand} disabled={sending}>
                  {sending ? 'Sending...' : 'Send Command'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
