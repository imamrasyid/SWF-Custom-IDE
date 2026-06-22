import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import CryptoJS from 'crypto-js'
import { getShortDeviceId } from './device-fingerprint'

const LICENSE_FILE = 'wayangide-license.enc'
const ENCRYPTION_SALT = 'wayangide-license-encryption-v1'

function deriveEncryptionKey(): string {
  const deviceId = getShortDeviceId()
  return crypto.createHmac('sha256', ENCRYPTION_SALT).update(deviceId).digest('hex')
}

export interface StoredLicense {
  licenseKey: string
  licenseId: string
  payload: any
  signature: string
  machineId: string
  activatedAt: number
  lastVerified: number
}

function getLicensePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, LICENSE_FILE)
}

export function saveLicense(data: StoredLicense): boolean {
  try {
    const licensePath = getLicensePath()
    const json = JSON.stringify(data)
    const key = deriveEncryptionKey()
    const encrypted = CryptoJS.AES.encrypt(json, key).toString()
    fs.writeFileSync(licensePath, encrypted, 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to save license:', err)
    return false
  }
}

export function loadLicense(): StoredLicense | null {
  try {
    const licensePath = getLicensePath()
    if (!fs.existsSync(licensePath)) return null

    const encrypted = fs.readFileSync(licensePath, 'utf-8')
    const key = deriveEncryptionKey()
    const bytes = CryptoJS.AES.decrypt(encrypted, key)
    const json = bytes.toString(CryptoJS.enc.Utf8)

    if (!json) return null

    const data: StoredLicense = JSON.parse(json)
    return data
  } catch (err) {
    console.error('Failed to load license:', err)
    return null
  }
}

export function deleteLicense(): boolean {
  try {
    const licensePath = getLicensePath()
    if (fs.existsSync(licensePath)) {
      fs.unlinkSync(licensePath)
    }
    return true
  } catch (err) {
    console.error('Failed to delete license:', err)
    return false
  }
}

export function hasStoredLicense(): boolean {
  return fs.existsSync(getLicensePath())
}
