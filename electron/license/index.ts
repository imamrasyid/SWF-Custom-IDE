import { LicensePayload, verifyLicense, parseLicenseKey, buildLicenseKey, signLicense, fromBase64Url } from './license-crypto'
import { saveLicense, loadLicense, deleteLicense, StoredLicense } from './license-store'
import { generateDeviceFingerprint, getShortDeviceId } from './device-fingerprint'

// FULL 32-byte Ed25519 public key in base64url format
// Generate with: npx tsx scripts/generate-license.ts
// Then paste the PUBLIC KEY value here (must match your secret key!)
const PUBLIC_KEY_B64URL = 'qs8gGpTMtdOFPdNAk9pgqMW8TAN3P8DdEYdJEGDqa0M'

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

function getEmbeddedPublicKey(): Uint8Array {
  return fromBase64Url(PUBLIC_KEY_B64URL)
}

export function getLicenseStatus(): LicenseStatus {
  if (cachedStatus) return cachedStatus

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

  return cachedStatus
}

export function activateLicense(licenseKey: string): { success: boolean; error: string | null; licenseId?: string } {
  const parsed = parseLicenseKey(licenseKey)
  if (!parsed) {
    return { success: false, error: 'Invalid license key format' }
  }

  const { payload, signature } = parsed

  if (payload.product !== 'ninjasage-modding-toolkit') {
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

    return { success: true, error: null, licenseId: payload.id }
  }

  if (stored && stored.licenseId !== payload.id) {
    return { success: false, error: 'Another license is already activated on this device' }
  }

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

  return { success: true, error: null, licenseId: payload.id }
}

export function deactivateLicense(): boolean {
  const result = deleteLicense()
  cachedLicense = null
  cachedStatus = null
  return result
}

export function getActivatedLicense(): StoredLicense | null {
  return cachedLicense || loadLicense()
}

export function isLicenseActivated(): boolean {
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
