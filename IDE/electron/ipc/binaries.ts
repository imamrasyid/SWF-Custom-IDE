import { ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { getBinaryStatus, loadConfig, saveConfig } from '../services/config-service'
import { downloadFile, extractZip, getFreeDiskSpace, cancelDownload } from '../services/downloader-service'
import { app } from 'electron'

// Hardcoded binaries links pointing to the GitHub Release of the repository
const BINARIES_RELEASE_URL = 'https://github.com/imamrasyid/SWF-Custom-IDE/releases/download/binaries'

const BINARIES_CONFIG = {
  jre: {
    url: `${BINARIES_RELEASE_URL}/jre-win.zip`,
    fileName: 'jre-win.zip',
    destDirName: 'jre',
    hash: '' // Fill with expected SHA-256 if needed
  },
  ffdec: {
    url: `${BINARIES_RELEASE_URL}/ffdec.zip`,
    fileName: 'ffdec.zip',
    destDirName: 'ffdec',
    hash: ''
  },
  flexSdk: {
    url: `${BINARIES_RELEASE_URL}/flex-sdk.zip`,
    fileName: 'flex-sdk.zip',
    destDirName: 'flex-sdk',
    hash: ''
  }
}

export function registerBinariesIpc() {
  ipcMain.handle('binaries:status', () => {
    return getBinaryStatus()
  })

  ipcMain.handle('binaries:download-cancel', () => {
    cancelDownload()
    return true
  })

  ipcMain.handle('binaries:check-disk-space', async () => {
    const userDataPath = app.getPath('userData')
    const freeSpace = await getFreeDiskSpace(userDataPath)
    // Return true if we have at least 500 MB free space
    return {
      freeBytes: freeSpace,
      hasEnoughSpace: freeSpace >= 500 * 1024 * 1024
    }
  })

  ipcMain.handle('binaries:download', async (event) => {
    const webContents = event.sender
    const userDataPath = app.getPath('userData')
    const binDir = path.join(userDataPath, 'bin')
    
    // Ensure bin folder exists
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true })
    }

    const items = getBinaryStatus()
    
    try {
      // 1. Download & Extract JRE if not installed
      if (!items.jre.installed) {
        const jreZip = path.join(binDir, BINARIES_CONFIG.jre.fileName)
        
        webContents.send('downloader:progress', { file: 'JRE', percent: 0, status: 'downloading', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        await downloadFile(BINARIES_CONFIG.jre.url, jreZip, 'JRE', webContents, BINARIES_CONFIG.jre.hash)
        
        webContents.send('downloader:progress', { file: 'JRE', percent: 100, status: 'extracting', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        const targetDir = path.join(binDir) // Tar extracts jre/ into bin/
        await extractZip(jreZip, targetDir)
        
        // Remove ZIP after success
        try { fs.unlinkSync(jreZip) } catch {}
      }

      // 2. Download & Extract FFDec if not installed
      if (!items.ffdec.installed) {
        const ffdecZip = path.join(binDir, BINARIES_CONFIG.ffdec.fileName)
        
        webContents.send('downloader:progress', { file: 'FFDec', percent: 0, status: 'downloading', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        await downloadFile(BINARIES_CONFIG.ffdec.url, ffdecZip, 'FFDec', webContents, BINARIES_CONFIG.ffdec.hash)
        
        webContents.send('downloader:progress', { file: 'FFDec', percent: 100, status: 'extracting', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        const targetDir = path.join(binDir, BINARIES_CONFIG.ffdec.destDirName)
        await extractZip(ffdecZip, targetDir)
        
        try { fs.unlinkSync(ffdecZip) } catch {}
      }

      // 3. Download & Extract Flex SDK if not installed
      if (!items.flexSdk.installed) {
        const flexZip = path.join(binDir, BINARIES_CONFIG.flexSdk.fileName)
        
        webContents.send('downloader:progress', { file: 'Flex SDK', percent: 0, status: 'downloading', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        await downloadFile(BINARIES_CONFIG.flexSdk.url, flexZip, 'Flex SDK', webContents, BINARIES_CONFIG.flexSdk.hash)
        
        webContents.send('downloader:progress', { file: 'Flex SDK', percent: 100, status: 'extracting', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
        const targetDir = path.join(binDir, BINARIES_CONFIG.flexSdk.destDirName)
        await extractZip(flexZip, targetDir)
        
        try { fs.unlinkSync(flexZip) } catch {}
      }

      // Update config file paths
      const config = loadConfig()
      const jrePath = path.join(binDir, 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
      const ffdecPath = path.join(binDir, 'ffdec', 'ffdec.jar')
      const flexSdkPath = path.join(binDir, 'flex-sdk')

      config.jrePath = fs.existsSync(jrePath) ? jrePath : config.jrePath
      config.ffdecPath = fs.existsSync(ffdecPath) ? ffdecPath : config.ffdecPath
      config.flexSdkPath = fs.existsSync(flexSdkPath) ? flexSdkPath : config.flexSdkPath

      saveConfig(config)

      webContents.send('downloader:progress', { file: 'All', percent: 100, status: 'completed', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s' })
      return true
    } catch (err: any) {
      console.error('[Binaries Downloader] Error:', err)
      webContents.send('downloader:progress', { file: 'Error', percent: 0, status: 'error', downloadedBytes: 0, totalBytes: 0, speed: '0 B/s', error: err.message || String(err) })
      return false
    }
  })

  // Manual folder browser select
  ipcMain.handle('binaries:select-local', async (event, type: 'jre' | 'ffdec' | 'flexSdk') => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    
    let properties: ('openFile' | 'openDirectory')[] = ['openDirectory']
    let filters: { name: string; extensions: string[] }[] = []
    let title = ''

    if (type === 'jre') {
      title = 'Select Java (java.exe) File'
      properties = ['openFile']
      filters = [{ name: 'Executable', extensions: [process.platform === 'win32' ? 'exe' : ''] }]
    } else if (type === 'ffdec') {
      title = 'Select FFDec JAR or EXE File'
      properties = ['openFile']
      filters = [{ name: 'FFDec Application', extensions: ['jar', 'exe'] }]
    } else {
      title = 'Select Flex SDK Folder'
      properties = ['openDirectory']
    }

    const result = await dialog.showOpenDialog(win, {
      title,
      properties,
      filters
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    const config = loadConfig()

    if (type === 'jre') {
      config.jrePath = selectedPath
    } else if (type === 'ffdec') {
      config.ffdecPath = selectedPath
    } else {
      config.flexSdkPath = selectedPath
    }

    saveConfig(config)
    return getBinaryStatus()
  })
}
