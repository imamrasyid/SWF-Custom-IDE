import { ipcMain } from 'electron'
import { getLicenseStatus, activateLicense, deactivateLicense, getLicenseInfo, isLicenseActivated } from '../license'
import { generateDeviceFingerprint, getShortDeviceId } from '../license/device-fingerprint'

export function registerLicenseIpc() {
  ipcMain.handle('license:status', () => {
    return getLicenseStatus()
  })

  ipcMain.handle('license:activate', (_event, licenseKey: string) => {
    console.log('[License IPC] Activate request received, key length:', licenseKey.length)
    console.log('[License IPC] Key preview:', licenseKey.slice(0, 30) + '...')
    const result = activateLicense(licenseKey)
    console.log('[License IPC] Result:', result.success ? 'SUCCESS' : 'FAILED -', result.error)
    return result
  })

  ipcMain.handle('license:deactivate', () => {
    return deactivateLicense()
  })

  ipcMain.handle('license:info', () => {
    return getLicenseInfo()
  })

  ipcMain.handle('license:isActivated', () => {
    return isLicenseActivated()
  })

  ipcMain.handle('license:deviceFingerprint', () => {
    return generateDeviceFingerprint()
  })

  ipcMain.handle('license:deviceId', () => {
    return getShortDeviceId()
  })
}
