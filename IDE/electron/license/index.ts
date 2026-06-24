import path from 'path'
import fs from 'fs'
import { LicensePayload, verifyLicense, parseLicenseKey, buildLicenseKey, signLicense, getEmbeddedPublicKey } from './license-crypto'
import { saveLicense, loadLicense, deleteLicense, StoredLicense } from './license-store'
import { generateDeviceFingerprint, getShortDeviceId } from './device-fingerprint'
import { phoneHomeActivate, phoneHomeDeactivate, phoneHomeVerify, startPeriodicPhoneHome, stopPeriodicPhoneHome } from './phone-home'
import { trackFeatureUse } from '../telemetry'

const app = require('electron').app
const APP_VERSION = app?.getVersion?.() || 'unknown'

let nativeAddon: any = null
let nativeAddonLoaded = false

function loadNativeAddon(): any {
  if (nativeAddonLoaded) return nativeAddon
  nativeAddonLoaded = true
  try {
    const addonPath = path.join(
      process.resourcesPath || path.join(__dirname, '..', '..'),
      'native',
      'prebuilt',
      'license_key.node'
    )
    nativeAddon = require(addonPath)
    return nativeAddon
  } catch {
    try {
      const devPath = path.join(__dirname, '..', '..', 'native', 'prebuilt', 'license_key.node')
      nativeAddon = require(devPath)
      return nativeAddon
    } catch {
      return null
    }
  }
}

function getPublicKeyFromNative(): Uint8Array | null {
  const addon = loadNativeAddon()
  if (!addon) return null
  try {
    const buf = addon.getPublicKey()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

export interface LicenseStatus {
  isValid: boolean
  isActivated: boolean
  licenseId: string | null
  licenseType: string | null
  features: string[]
  activatedAt: number | null
  error: string | null
}

let cachedLicense: StoredLicense | null = null
let cachedStatus: LicenseStatus | null = null

export function isLicenseDisabled(): boolean {
  if (process.env.DISABLE_LICENSE === 'true') {
    return true
  }
  try {
    const possibleEnvPaths = [
      path.join(process.cwd(), '.env'),
      path.join(app?.getAppPath() || '', '.env'),
      path.join(path.dirname(app?.getPath('exe') || ''), '.env')
    ]
    for (const envPath of possibleEnvPaths) {
      if (envPath && fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        if (/^\s*DISABLE_LICENSE\s*=\s*true/m.test(content)) {
          return true
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return false
}

function verifyPublicKeyIntegrity(): boolean {
  const nativeKey = getPublicKeyFromNative()
  if (!nativeKey) return true
  const jsKey = getEmbeddedPublicKey()
  if (nativeKey.length !== jsKey.length) return false
  for (let i = 0; i < nativeKey.length; i++) {
    if (nativeKey[i] !== jsKey[i]) return false
  }
  return true
}

export function getLicenseStatus(): LicenseStatus {
  if (isLicenseDisabled()) {
    cachedStatus = {
      isValid: true,
      isActivated: true,
      licenseId: 'disabled_license_env',
      licenseType: 'lifetime',
      features: ['all'],
      activatedAt: Date.now(),
      error: null,
    }
    return cachedStatus
  }

  if (cachedStatus) return cachedStatus

  if (!verifyPublicKeyIntegrity()) {
    cachedStatus = {
      isValid: false,
      isActivated: false,
      licenseId: null,
      licenseType: null,
      features: [],
      activatedAt: null,
      error: 'Public key integrity check failed',
    }
    return cachedStatus
  }

  const stored = loadLicense()
  if (!stored) {
    cachedStatus = {
      isValid: false,
      isActivated: false,
      licenseId: null,
      licenseType: null,
      features: [],
      activatedAt: null,
      error: null,
    }
    return cachedStatus
  }

  const publicKey = getEmbeddedPublicKey()
  const payload = stored.payload as LicensePayload
  const isValidSig = verifyLicense(payload, stored.signature, publicKey)

  if (!isValidSig) {
    cachedStatus = {
      isValid: false,
      isActivated: false,
      licenseId: stored.licenseId,
      licenseType: null,
      features: [],
      activatedAt: stored.activatedAt,
      error: 'Invalid license signature',
    }
    return cachedStatus
  }

  cachedLicense = stored
  cachedStatus = {
    isValid: true,
    isActivated: true,
    licenseId: stored.licenseId,
    licenseType: payload.type,
    features: payload.features,
    activatedAt: stored.activatedAt,
    error: null,
  }

  startPeriodicPhoneHome(stored.licenseId, (valid) => {
    if (!valid) {
      console.warn('[License] Server reported license revoked, deactivating locally')
      deleteLicense()
      cachedLicense = null
      cachedStatus = null
    }
  })

  return cachedStatus
}

export function activateLicense(licenseKey: string): { success: boolean; error: string | null; licenseId?: string } {
  if (!verifyPublicKeyIntegrity()) {
    return { success: false, error: 'Security check failed' }
  }

  const parsed = parseLicenseKey(licenseKey)
  if (!parsed) {
    return { success: false, error: 'Invalid license key format' }
  }

  const { payload, signature } = parsed

  if (payload.product !== 'wayangide') {
    return { success: false, error: 'Invalid license key for this product' }
  }

  if (payload.type !== 'lifetime') {
    return { success: false, error: 'Invalid license type' }
  }

  const publicKey = getEmbeddedPublicKey()
  const isValidSig = verifyLicense(payload, signature, publicKey)

  if (!isValidSig) {
    return { success: false, error: 'Invalid license signature - key may be tampered' }
  }

  const currentFingerprint = getShortDeviceId()

  const stored = loadLicense()
  if (stored && stored.licenseId === payload.id) {
    if (stored.machineId !== currentFingerprint) {
      return { success: false, error: 'License is bound to a different device' }
    }

    const updatedStored: StoredLicense = {
      ...stored,
      signature,
      lastVerified: Date.now(),
    }
    saveLicense(updatedStored)
    cachedLicense = updatedStored
    cachedStatus = null

    startPeriodicPhoneHome(payload.id, (valid) => {
      if (!valid) {
        console.warn('[License] Server reported license revoked, deactivating locally')
        deleteLicense()
        cachedLicense = null
        cachedStatus = null
      }
    })

    return { success: true, error: null, licenseId: payload.id }
  }

  if (stored && stored.licenseId !== payload.id) {
    return { success: false, error: 'Another license is already activated on this device' }
  }

  phoneHomeActivate(licenseKey, APP_VERSION).then((result) => {
    if (!result.success && result.error) {
      console.warn('[License] Phone-home activation warning:', result.error)
    }
  }).catch(() => {})

  const licenseData: StoredLicense = {
    licenseKey,
    licenseId: payload.id,
    payload,
    signature,
    machineId: currentFingerprint,
    activatedAt: Date.now(),
    lastVerified: Date.now(),
  }

  const saved = saveLicense(licenseData)
  if (!saved) {
    return { success: false, error: 'Failed to save license data' }
  }

  cachedLicense = licenseData
  cachedStatus = null

  trackFeatureUse('license_activated', payload.id)

  startPeriodicPhoneHome(payload.id, (valid) => {
    if (!valid) {
      console.warn('[License] Server reported license revoked, deactivating locally')
      deleteLicense()
      cachedLicense = null
      cachedStatus = null
    }
  })

  return { success: true, error: null, licenseId: payload.id }
}

export function deactivateLicense(): boolean {
  const stored = loadLicense()
  if (stored?.licenseId) {
    phoneHomeDeactivate(stored.licenseId).catch(() => {})
  }

  stopPeriodicPhoneHome()
  const result = deleteLicense()
  cachedLicense = null
  cachedStatus = null
  return result
}

export function getActivatedLicense(): StoredLicense | null {
  return cachedLicense || loadLicense()
}

export function isLicenseActivated(): boolean {
  if (isLicenseDisabled()) {
    return true
  }
  const status = getLicenseStatus()
  return status.isValid && status.isActivated
}

export function getLicenseInfo(): {
  licenseId: string | null
  type: string | null
  features: string[]
  activatedAt: number | null
  deviceBound: boolean
} {
  if (isLicenseDisabled()) {
    return {
      licenseId: 'disabled_license_env',
      type: 'lifetime',
      features: ['all'],
      activatedAt: Date.now(),
      deviceBound: false,
    }
  }

  const stored = loadLicense()
  if (!stored) {
    return {
      licenseId: null,
      type: null,
      features: [],
      activatedAt: null,
      deviceBound: false,
    }
  }

  return {
    licenseId: stored.licenseId,
    type: stored.payload?.type || null,
    features: stored.payload?.features || [],
    activatedAt: stored.activatedAt,
    deviceBound: true,
  }
}
