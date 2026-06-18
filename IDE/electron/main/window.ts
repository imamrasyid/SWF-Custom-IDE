import { BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { getOrExtractAssetPath } from '../services/ffdec-service'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    title: 'NinjaSage Modding Toolkit'
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; worker-src 'self' blob: https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: ns-asset:; connect-src 'self' * ws: wss: ns-asset: data: blob:; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net"]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.webContents.setZoomLevel(0)
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

export function openToolWindow(toolName: string) {
  const toolWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    title: `${toolName.replace('-', ' ').toUpperCase()} - Standalone`
  })

  toolWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; worker-src 'self' blob: https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: ns-asset:; connect-src 'self' * ws: wss: ns-asset: data: blob:; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net"]
      }
    })
  })

  const url = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?standalone=${toolName}`
    : `file://${path.join(__dirname, '../dist/index.html')}?standalone=${toolName}`

  toolWindow.loadURL(url)
  toolWindow.on('ready-to-show', () => {
    toolWindow.webContents.setZoomLevel(0)
    toolWindow.show()
  })
}

export function registerWindowIpc() {
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window:openTool', (_event, toolName: string) => {
    openToolWindow(toolName)
  })

  ipcMain.handle('dialog:openSwf', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open SWF File',
      filters: [
        { name: 'SWF Files', extensions: ['swf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveSwf', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save SWF As',
      filters: [
        { name: 'SWF Files', extensions: ['swf'] }
      ]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:openAsFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open ActionScript File',
      filters: [
        { name: 'ActionScript Files', extensions: ['as'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Destination Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:readDataUrl', async (_event, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase()
      let mime = 'application/octet-stream'
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
        mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`
        if (ext === '.jpg') mime = 'image/jpeg'
      } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
        mime = ext === '.mp3' ? 'audio/mpeg' : `audio/${ext.slice(1)}`
      }
      const data = fs.readFileSync(filePath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.error('file:readDataUrl error:', err)
      return null
    }
  })
}
