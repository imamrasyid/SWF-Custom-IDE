import { app, protocol, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { createWindow, registerWindowIpc, getMainWindow } from './main/window'
import { createMenu } from './main/menu'
import { setUpdaterWindow, initUpdater, checkForUpdates, downloadUpdate, quitAndInstall, getCurrentVersion } from './services/updater-service'
import { registerFfdecIpc, getOrExtractAssetPath } from './services/ffdec-service'
import { registerTerminalIpc } from './ipc/terminal'
import { registerDebugIpc } from './ipc/debug'
import { registerProjectIpc } from './ipc/project'
import { registerConfigIpc } from './ipc/config'
import { registerSimulatorIpc } from './ipc/simulator'
import { registerFilesystemIpc } from './ipc/filesystem'
import { registerGitIpc } from './ipc/git'
import { initDatabase, registerDatabaseIpc } from './ipc/database'
import { registerWatcherIpc } from './ipc/watcher'
import { registerLicenseIpc } from './ipc/license'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

protocol.registerSchemesAsPrivileged([
  { scheme: 'ns-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

app.whenReady().then(() => {
  initDatabase()
  // Register custom protocol for asset loading
  protocol.handle('ns-asset', async (request) => {
    try {
      const url = new URL(request.url)
      
      if (url.host === 'load') {
        const filePath = url.searchParams.get('path')
        if (!filePath) return new Response('Missing path parameter', { status: 400 })
        try {
          const stat = fs.statSync(filePath)
          if (!stat.isFile()) return new Response('Not a file', { status: 400 })
        } catch { return new Response('File Not Found', { status: 404 }) }
        const fileBuffer = fs.readFileSync(filePath)
        return new Response(fileBuffer, { headers: { 'Content-Type': 'application/x-shockwave-flash' } })
      }

      const swfPath = url.searchParams.get('swfPath')
      const category = url.searchParams.get('category') || 'image'
      
      let tagIdStr = url.host
      if (tagIdStr === 'extract') tagIdStr = url.pathname.replace(/^\//, '')
      const tagId = parseInt(tagIdStr, 10)

      if (!swfPath || isNaN(tagId)) return new Response('Invalid Request', { status: 400 })

      const filePath = await getOrExtractAssetPath(swfPath, tagId, category)
      if (!filePath || !fs.existsSync(filePath)) return new Response('Asset Not Found', { status: 404 })

      const fileBuffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      let mime = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
      else if (ext === '.gif') mime = 'image/gif'
      else if (ext === '.bmp') mime = 'image/bmp'
      else if (ext === '.webp') mime = 'image/webp'
      else if (ext === '.svg') mime = 'image/svg+xml'

      return new Response(fileBuffer, { headers: { 'Content-Type': mime } })
    } catch (err: any) {
      console.error('ns-asset protocol error:', err)
      return new Response(err.message || 'Error', { status: 500 })
    }
  })

  // Register all IPC handlers
  registerWindowIpc()
  registerTerminalIpc()
  registerDebugIpc()
  registerProjectIpc()
  registerConfigIpc()
  registerSimulatorIpc()
  registerFilesystemIpc()
  registerGitIpc()
  registerFfdecIpc()
  registerDatabaseIpc()
  registerWatcherIpc()
  registerLicenseIpc()

  ipcMain.handle('updater:check', checkForUpdates)
  ipcMain.handle('updater:download', downloadUpdate)
  ipcMain.handle('updater:install', quitAndInstall)
  ipcMain.handle('updater:version', getCurrentVersion)
  
  // Initialize services
  initUpdater()
  createMenu()
  
  // Create main window
  const mainWindow = createWindow()
  setUpdaterWindow(mainWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (getMainWindow() === null) createWindow()
})
