import os from 'os'
import { app } from 'electron'
import { getTelemetryConsent } from './consent'
import { queueEvents } from './sender'

export type TelemetryEventType = 'session_start' | 'session_end' | 'feature_use' | 'crash' | 'error'

export interface TelemetryEvent {
  id: string
  license_id?: string
  device_id: string
  event_type: TelemetryEventType
  app_version: string
  os: string
  payload?: Record<string, any>
  created_at: number
}

let deviceId: string | null = null
let sessionId: string | null = null
let sessionStart: number | null = null

function getDeviceId(): string {
  if (!deviceId) {
    const machineId = app.getPath('userData')
    let hash = 0
    for (let i = 0; i < machineId.length; i++) {
      const char = machineId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    deviceId = 'dev-' + Math.abs(hash).toString(36)
  }
  return deviceId
}

function getOsInfo(): string {
  return `${os.platform()} ${os.release()}`
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function trackEvent(type: TelemetryEventType, payload?: Record<string, any>, licenseId?: string): void {
  if (!getTelemetryConsent()) return

  const event: TelemetryEvent = {
    id: generateId(),
    license_id: licenseId,
    device_id: getDeviceId(),
    event_type: type,
    app_version: app.getVersion(),
    os: getOsInfo(),
    payload,
    created_at: Date.now(),
  }

  queueEvents([event])
}

export function startSession(licenseId?: string): void {
  if (!getTelemetryConsent()) return

  sessionId = generateId()
  sessionStart = Date.now()

  trackEvent('session_start', {
    screenResolution: `${require('electron').screen.getPrimaryDisplay().size.width}x${require('electron').screen.getPrimaryDisplay().size.height}`,
  }, licenseId)
}

export function endSession(): void {
  if (!getTelemetryConsent() || !sessionStart) return

  trackEvent('session_end', {
    durationMs: Date.now() - sessionStart,
  })

  sessionId = null
  sessionStart = null
}

export function trackFeatureUse(feature: string, licenseId?: string): void {
  trackEvent('feature_use', { feature }, licenseId)
}

export function trackCrash(error: Error, fatal = false, licenseId?: string): void {
  trackEvent('crash', {
    message: error.message,
    stack: error.stack?.slice(0, 1000),
    fatal,
  }, licenseId)
}

export function trackError(message: string, code?: string, licenseId?: string): void {
  trackEvent('error', { message, code }, licenseId)
}
