'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/utils'
import { ArrowLeft, Copy, Check, Key } from 'lucide-react'
import Link from 'next/link'

interface GeneratedLicense {
  licenseId: string
  licenseKey: string
  customerEmail: string | null
  orderId: string | null
  issuedAt: number
}

export default function NewLicensePage() {
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<GeneratedLicense | null>(null)
  const [copied, setCopied] = useState('')

  const [form, setForm] = useState({
    customerEmail: '',
    orderId: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await apiRequest<GeneratedLicense>('POST', '/api/admin/licenses/generate', {
      customerEmail: form.customerEmail || undefined,
      orderId: form.orderId || undefined,
    })

    if (result?.licenseKey) {
      setGenerated(result)
    }
    setLoading(false)
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/licenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create License</h1>
          <p className="text-muted-foreground">Lifetime license — full features, 3 devices</p>
        </div>
      </div>

      {generated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <Key className="h-5 w-5" />
              License Generated!
            </CardTitle>
            <CardDescription>
              Send this key to the customer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">License ID</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded block">{generated.licenseId}</code>
              </div>
              {generated.customerEmail && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm">{generated.customerEmail}</p>
                </div>
              )}
              {generated.orderId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Order</p>
                  <Badge variant="outline">{generated.orderId}</Badge>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">License Key</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generated.licenseKey, 'key')}
                >
                  {copied === 'key' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied === 'key' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <code className="text-xs break-all whitespace-pre-wrap">{generated.licenseKey}</code>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/licenses">
                <Button variant="outline">Back to Licenses</Button>
              </Link>
              <Button onClick={() => { setGenerated(null); setForm({ customerEmail: '', orderId: '' }) }}>
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Customer Info</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Email</label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Order ID</label>
                  <Input
                    placeholder="ORD-001"
                    value={form.orderId}
                    onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Link href="/licenses">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate License Key'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
