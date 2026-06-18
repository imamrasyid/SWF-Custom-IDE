'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

export default function SettingsPage() {
  const [copied, setCopied] = useState('')

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your license server
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Use these endpoints to connect your Electron app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Server URL</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={process.env.NEXT_PUBLIC_API_URL || 'https://your-project.vercel.app'}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(process.env.NEXT_PUBLIC_API_URL || '', 'url')}
              >
                {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Client Environment Variables</label>
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`# .env atau .env.local di Electron app
LICENSE_SERVER_URL=${process.env.NEXT_PUBLIC_API_URL || 'https://your-project.vercel.app'}
LICENSE_SERVER_API_KEY=your-api-key`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment</CardTitle>
          <CardDescription>
            Deploy this dashboard to Vercel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Environment Variables (set in Vercel Dashboard)</label>
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
API_KEY=your-secret-key
PUBLIC_KEY_B64URL=qs8gGpTMtdOFPdNAk9pgqMW8TAN3P8DdEYdJEGDqa0M
CORS_ORIGIN=https://your-dashboard.vercel.app
NEXT_PUBLIC_API_URL=https://your-api.vercel.app
NEXT_PUBLIC_API_KEY=your-api-key`}
            </pre>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Deploy</label>
            <div className="flex gap-2">
              <Button variant="outline">
                <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Deploy to Vercel
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate License Keys</CardTitle>
          <CardDescription>
            Use the CLI tool to generate license keys for customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`# First time: generate key pair
npx tsx scripts/generate-license.ts

# Subsequent: use saved private key
npx tsx scripts/generate-license.ts \\
  --private-key "YOUR_SECRET_KEY" \\
  --email customer@example.com \\
  --order ORD-001`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy & Telemetry</CardTitle>
          <CardDescription>
            What data is collected from users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Collected Data</label>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>App version and OS info</li>
              <li>Feature usage (which tools are used)</li>
              <li>Session duration</li>
              <li>Crash reports (error messages, stack traces)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Not Collected</label>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Personal information (name, email, files)</li>
              <li>Project contents or code</li>
              <li>IP addresses (only hashed device ID)</li>
            </ul>
          </div>
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-1">Default: Enabled</p>
            <p className="text-muted-foreground">
              Users can opt out in the Electron app Settings → Privacy → Send usage data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
