import { machineIdSync } from 'node-machine-id'
import os from 'os'
import crypto from 'crypto'

const FINGERPRINT_SALT = 'wayangide-device-v1'

function getCpuInfo(): string {
  const cpus = os.cpus()
  if (cpus.length === 0) return 'unknown'
  return `${cpus[0].model}-${cpus.length}`
}

function getMotherboardInfo(): string {
  try {
    const platform = os.platform()
    if (platform === 'win32') {
      return os.hostname()
    }
    return os.hostname()
  } catch {
    return 'unknown'
  }
}

export function generateDeviceFingerprint(): string {
  const components = [
    machineIdSync(true),
    os.platform(),
    os.arch(),
    getCpuInfo(),
    os.totalmem().toString(),
    getMotherboardInfo(),
  ]

  const raw = components.join('|')
  const hash = crypto.createHmac('sha256', FINGERPRINT_SALT).update(raw).digest('hex')

  return hash.slice(0, 32)
}

export function generateDeviceId(): string {
  return machineIdSync(true)
}

export function getShortDeviceId(): string {
  const full = machineIdSync(true)
  const hash = crypto.createHmac('sha256', FINGERPRINT_SALT).update(full).digest('hex')
  return hash.slice(0, 24)
}
