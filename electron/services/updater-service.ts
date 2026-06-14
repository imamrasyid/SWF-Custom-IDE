import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

export function setUpdaterWindow(win: BrowserWindow) {
  mainWindow = win
}

export function initUpdater() {
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow?.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes || '',
      releaseName: info.releaseName || '',
      releaseDate: info.releaseDate,
      files: info.files?.map(f => ({
        name: f.url?.split('/').pop() || '',
        size: f.size || 0,
        url: f.url || ''
      }))
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:status', { status: 'up-to-date' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:status', { status: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err)
    mainWindow?.webContents.send('update:error', { message: err.message })
  })
}

export async function checkForUpdates() {
  try {
    return await autoUpdater.checkForUpdates()
  } catch (err: any) {
    console.error('Check for updates failed:', err)
    throw err
  }
}

export function downloadUpdate() {
  return autoUpdater.downloadUpdate()
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true)
}

export function getCurrentVersion() {
  return app.getVersion()
}
