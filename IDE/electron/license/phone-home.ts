import { getShortDeviceId } from './device-fingerprint'

const SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://ninjasage-license.vercel.app'
const API_KEY = process.env.LICENSE_SERVER_API_KEY || ''
const PHONE_HOME_INTERVAL = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT = 15000

let phoneHomeTimer: ReturnType<typeof setInterval> | null = null
let lastPhoneHome = 0

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

export async function phoneHomeActivate(
  licenseKey: string,
  appVersion?: string
): Promise<{ success: boolean; error?: string; licenseId?: string }> {
  const deviceId = getShortDeviceId()

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

export function startPeriodicPhoneHome(licenseId: string, callback?: (valid: boolean) => void): void {
  stopPeriodicPhoneHome()

  phoneHomeTimer = setInterval(async () => {
    const result = await phoneHomeVerify(licenseId)
    if (result && !result.valid) {
      console.warn('[PhoneHome] License no longer valid:', result.reason)
      callback?.(false)
    }
  }, PHONE_HOME_INTERVAL)
}

export function stopPeriodicPhoneHome(): void {
  if (phoneHomeTimer) {
    clearInterval(phoneHomeTimer)
    phoneHomeTimer = null
  }
}

export function getLastPhoneHome(): number {
  return lastPhoneHome
}
