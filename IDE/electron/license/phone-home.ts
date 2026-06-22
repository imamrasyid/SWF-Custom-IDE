import { getShortDeviceId } from './device-fingerprint'

const isDev = !require('electron').app?.isPackaged
const SERVER_URL = process.env.LICENSE_SERVER_URL || (isDev ? 'http://localhost:3000' : 'https://wayangide-license.vercel.app')
const API_KEY = process.env.LICENSE_SERVER_API_KEY || ''
const PHONE_HOME_INTERVAL = 24 * 60 * 60 * 1000
const COMMAND_POLL_INTERVAL = 60 * 60 * 1000
const REQUEST_TIMEOUT = 15000

let phoneHomeTimer: ReturnType<typeof setInterval> | null = null
let commandTimer: ReturnType<typeof setInterval> | null = null
let lastPhoneHome = 0
let lastCommandCheck = 0

interface ServerVerifyResponse {
  valid: boolean
  reason?: string
  licenseId?: string
  type?: string
  features?: string[]
  revokedAt?: number
  activations?: number
  maxActivations?: number
}

interface CommandResponse {
  banned: boolean
  reason?: string
  expiresAt?: number
  commands: Array<{
    id: string
    type: string
    payload?: Record<string, any>
  }>
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<T | null> {
  try {
    const url = `${SERVER_URL}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`[PhoneHome] API error ${response.status}:`, error)
      return null
    }

    return await response.json()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[PhoneHome] Request timed out')
    } else {
      console.warn('[PhoneHome] Network error:', err.message)
    }
    return null
  }
}

export async function checkBan(): Promise<{ banned: boolean; reason?: string }> {
  const deviceId = getShortDeviceId()
  const result = await apiRequest<{ banned: boolean; reason?: string }>('POST', '/api/license/check-ban', { deviceId })
  return result || { banned: false }
}

export async function phoneHomeActivate(
  licenseKey: string,
  appVersion?: string
): Promise<{ success: boolean; error?: string; licenseId?: string }> {
  const deviceId = getShortDeviceId()

  const banResult = await checkBan()
  if (banResult.banned) {
    return { success: false, error: `Device banned: ${banResult.reason}` }
  }

  const result = await apiRequest<any>('POST', '/api/license/activate', {
    licenseKey,
    deviceId,
    machineFingerprint: deviceId,
    appVersion,
  })

  if (!result) {
    return { success: false, error: 'Unable to reach license server' }
  }

  if (result.error) {
    return { success: false, error: result.error }
  }

  lastPhoneHome = Date.now()
  return { success: true, licenseId: result.licenseId }
}

export async function phoneHomeDeactivate(licenseId: string): Promise<boolean> {
  const deviceId = getShortDeviceId()

  const result = await apiRequest<any>('POST', '/api/license/deactivate', {
    licenseId,
    deviceId,
  })

  return result?.success === true
}

export async function phoneHomeVerify(licenseId: string): Promise<ServerVerifyResponse | null> {
  const deviceId = getShortDeviceId()

  const result = await apiRequest<ServerVerifyResponse>('GET', `/api/license/verify?licenseId=${licenseId}&deviceId=${deviceId}`)

  if (result) {
    lastPhoneHome = Date.now()
  }

  return result
}

export async function pollCommands(licenseId: string): Promise<CommandResponse | null> {
  const deviceId = getShortDeviceId()

  const result = await apiRequest<CommandResponse>('GET', `/api/license/command?deviceId=${deviceId}&licenseId=${licenseId}&lastCheck=${lastCommandCheck}`)

  if (result) {
    lastCommandCheck = Date.now()
  }

  return result
}

export async function phoneHomeStatus(): Promise<{
  online: boolean
  lastCheck: number
  serverStatus?: any
}> {
  const result = await apiRequest<any>('GET', '/api/license/status')

  if (result) {
    return {
      online: true,
      lastCheck: Date.now(),
      serverStatus: result,
    }
  }

  return { online: false, lastCheck: lastPhoneHome }
}

function executeCommand(command: { type: string; payload?: Record<string, any> }, licenseId: string): void {
  console.log(`[PhoneHome] Executing command: ${command.type}`)

  switch (command.type) {
    case 'force_revoke':
      console.warn('[PhoneHome] Force revoke received, deactivating license')
      const { deleteLicense } = require('./license-store')
      deleteLicense()
      break

    case 'force_update':
      const minVersion = command.payload?.minVersion
      if (minVersion) {
        const appVersion = require('electron').app.getVersion()
        if (appVersion < minVersion) {
          console.warn(`[PhoneHome] Force update required: ${minVersion}`)
        }
      }
      break

    case 'kill_switch':
      console.error('[PhoneHome] Kill switch activated, shutting down')
      require('electron').app.quit()
      break

    case 'force_deactivate':
      console.warn('[PhoneHome] Force deactivate received')
      const store = require('./license-store')
      store.deleteLicense()
      break

    default:
      console.warn(`[PhoneHome] Unknown command: ${command.type}`)
  }
}

export function startPeriodicPhoneHome(licenseId: string, callback?: (valid: boolean) => void): void {
  stopPeriodicPhoneHome()

  phoneHomeTimer = setInterval(async () => {
    const result = await phoneHomeVerify(licenseId)
    if (result && !result.valid) {
      console.warn('[PhoneHome] License no longer valid:', result.reason)
      callback?.(false)
    }
  }, PHONE_HOME_INTERVAL)

  commandTimer = setInterval(async () => {
    const result = await pollCommands(licenseId)
    if (result) {
      if (result.banned) {
        console.warn('[PhoneHome] Device banned:', result.reason)
        callback?.(false)
        return
      }

      for (const command of result.commands) {
        executeCommand(command, licenseId)
      }
    }
  }, COMMAND_POLL_INTERVAL)
}

export function stopPeriodicPhoneHome(): void {
  if (phoneHomeTimer) {
    clearInterval(phoneHomeTimer)
    phoneHomeTimer = null
  }
  if (commandTimer) {
    clearInterval(commandTimer)
    commandTimer = null
  }
}

export function getLastPhoneHome(): number {
  return lastPhoneHome
}
