import { net } from 'electron'
import type { TelemetryEvent } from './collector'

const API_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:3000'
const API_KEY = process.env.LICENSE_SERVER_API_KEY || ''
const FLUSH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_BATCH_SIZE = 50

let eventBuffer: TelemetryEvent[] = []
let flushTimer: NodeJS.Timeout | null = null

export function queueEvents(events: TelemetryEvent[]): void {
  eventBuffer.push(...events)

  if (eventBuffer.length >= MAX_BATCH_SIZE) {
    flush()
  }

  if (!flushTimer) {
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
    if (flushTimer.unref) flushTimer.unref()
  }
}

async function flush(): Promise<void> {
  if (eventBuffer.length === 0) return

  const batch = eventBuffer.splice(0, MAX_BATCH_SIZE)

  try {
    const url = new URL('/api/telemetry/track', API_URL)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`
    }

    const request = net.request({
      method: 'POST',
      url: url.toString(),
      headers,
    })

    request.on('error', () => {
      eventBuffer.unshift(...batch)
    })

    request.write(JSON.stringify({ events: batch }))
    request.end()
  } catch {
    eventBuffer.unshift(...batch)
  }
}

export function flushOnExit(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  flush()
}
