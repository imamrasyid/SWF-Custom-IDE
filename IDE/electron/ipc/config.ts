import { ipcMain, app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { loadConfig, saveConfig } from '../services/config-service'

export function registerConfigIpc() {
  ipcMain.handle('config:get', () => {
    try {
      return loadConfig()
    } catch (err) {
      console.error('Failed to load config:', err)
      return { ffdecPath: '', recentFiles: [], theme: 'system' as const }
    }
  })

  ipcMain.handle('config:set', (_event, config: Record<string, unknown>) => {
    try {
      const current = loadConfig()
      saveConfig({ ...current, ...config })
      return true
    } catch (err) {
      console.error('Failed to save config:', err)
      return false
    }
  })

  ipcMain.handle('config:getToolbarActions', async (_event, projectRoot?: string) => {
    const configPath = projectRoot
      ? path.join(projectRoot, '.wayangide', 'toolbar.json')
      : path.join(app.getPath('userData'), 'toolbar.json')
    
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'))
      }
    } catch {}
    return []
  })

  ipcMain.handle('config:saveToolbarActions', async (_event, actions: any[], projectRoot?: string) => {
    const configDir = projectRoot
      ? path.join(projectRoot, '.wayangide')
      : app.getPath('userData')
    const configPath = path.join(configDir, 'toolbar.json')
    
    try {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(configPath, JSON.stringify(actions, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('Failed to save toolbar actions:', err)
      return false
    }
  })

  ipcMain.handle('config:getBuildHooks', async (_event, projectRoot: string) => {
    const hooksPath = path.join(projectRoot, '.wayangide', 'hooks.json')
    try {
      if (fs.existsSync(hooksPath)) {
        return JSON.parse(fs.readFileSync(hooksPath, 'utf8'))
      }
    } catch {}
    return { preBuild: [], postBuild: [] }
  })

  ipcMain.handle('config:saveBuildHooks', async (_event, projectRoot: string, hooks: any) => {
    const hooksDir = path.join(projectRoot, '.wayangide')
    const hooksPath = path.join(hooksDir, 'hooks.json')
    
    try {
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('Failed to save build hooks:', err)
      return false
    }
  })

  ipcMain.handle('config:runBuildHook', async (_event, projectRoot: string, command: string): Promise<{ success: boolean; output: string }> => {
    const dangerous = /[;&|`$(){}[\]<>]/
    if (dangerous.test(command)) {
      return { success: false, output: 'Error: Build hook command contains disallowed characters.' }
    }
    
    const { exec } = require('child_process')
    return new Promise((resolve) => {
      exec(command, { cwd: projectRoot, timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve({ success: false, output: `Error: ${error.message}\n${stderr}` })
        } else {
          resolve({ success: true, output: stdout + stderr })
        }
      })
    })
  })

  ipcMain.handle('config:export', async (_event, projectRoot?: string) => {
    const result = await dialog.showSaveDialog(getMainWindow()!, {
      title: 'Export Configuration',
      defaultPath: `wayangide-config-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    
    if (result.canceled || !result.filePath) return false
    
    try {
      const config: any = {}
      const warnings: string[] = []
      
      function safeReadJson(filePath: string): any {
        try {
          if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'))
          }
        } catch (err) {
          warnings.push(`Skipped ${path.basename(filePath)}: ${err instanceof Error ? err.message : 'parse error'}`)
        }
        return undefined
      }
      
      if (projectRoot) {
        const settings = safeReadJson(path.join(projectRoot, '.wayangide', 'settings.json'))
        if (settings) config.settings = settings
        const toolbar = safeReadJson(path.join(projectRoot, '.wayangide', 'toolbar.json'))
        if (toolbar) config.toolbar = toolbar
        const hooks = safeReadJson(path.join(projectRoot, '.wayangide', 'hooks.json'))
        if (hooks) config.hooks = hooks
      } else {
        const userDataPath = app.getPath('userData')
        const userConfig = safeReadJson(path.join(userDataPath, 'config.json'))
        if (userConfig) config.userConfig = userConfig
        const toolbar = safeReadJson(path.join(userDataPath, 'toolbar.json'))
        if (toolbar) config.toolbar = toolbar
        const keybindings = safeReadJson(path.join(userDataPath, 'keybindings.json'))
        if (keybindings) config.keybindings = keybindings
      }
      
      if (warnings.length > 0) config._warnings = warnings
      
      fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('Failed to export config:', err)
      return false
    }
  })

  ipcMain.handle('config:import', async (_event, projectRoot?: string) => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      title: 'Import Configuration',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    
    if (result.canceled || result.filePaths.length === 0) return false
    
    try {
      const config = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
      
      if (projectRoot) {
        const settingsDir = path.join(projectRoot, '.wayangide')
        fs.mkdirSync(settingsDir, { recursive: true })
        if (config.settings) fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify(config.settings, null, 2), 'utf8')
        if (config.toolbar) fs.writeFileSync(path.join(settingsDir, 'toolbar.json'), JSON.stringify(config.toolbar, null, 2), 'utf8')
        if (config.hooks) fs.writeFileSync(path.join(settingsDir, 'hooks.json'), JSON.stringify(config.hooks, null, 2), 'utf8')
      } else {
        const userDataPath = app.getPath('userData')
        if (config.userConfig) fs.writeFileSync(path.join(userDataPath, 'config.json'), JSON.stringify(config.userConfig, null, 2), 'utf8')
        if (config.toolbar) fs.writeFileSync(path.join(userDataPath, 'toolbar.json'), JSON.stringify(config.toolbar, null, 2), 'utf8')
        if (config.keybindings) fs.writeFileSync(path.join(userDataPath, 'keybindings.json'), JSON.stringify(config.keybindings, null, 2), 'utf8')
      }
      
      return true
    } catch (err) {
      console.error('Failed to import config:', err)
      return false
    }
  })

  ipcMain.handle('db:readJson', async (_event, projectRoot: string, dbName: string) => {
    const filePath = path.join(projectRoot, 'databases', 'json', `${dbName}.json`)
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
      } catch (err) {
        console.error(`Failed to parse ${dbName}.json:`, err)
        return null
      }
    }
    return null
  })

  ipcMain.handle('db:writeJson', async (_event, projectRoot: string, dbName: string, data: any) => {
    const filePath = path.join(projectRoot, 'databases', 'json', `${dbName}.json`)
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error(`Failed to write ${dbName}.json:`, err)
      return false
    }
  })

  ipcMain.handle('zlib:decompress', async (_event, arrayBuffer: ArrayBuffer) => {
    try {
      const zlib = require('zlib')
      const buffer = Buffer.from(arrayBuffer)
      const decompressed = zlib.inflateSync(buffer)
      return decompressed.toString('utf8')
    } catch (err) {
      console.error('Zlib decompression failed:', err)
      return null
    }
  })

  ipcMain.handle('zlib:compress', async (_event, text: string) => {
    try {
      const zlib = require('zlib')
      const compressed = zlib.deflateSync(Buffer.from(text, 'utf8'))
      return compressed
    } catch (err) {
      console.error('Zlib compression failed:', err)
      return null
    }
  })

  ipcMain.handle('settings:readWorkspace', async (_event, projectRoot: string) => {
    const filePath = path.join(projectRoot, '.wayangide', 'settings.json')
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
      } catch (err) {
        console.error('Failed to parse workspace settings.json:', err)
        return null
      }
    }
    return null
  })

  ipcMain.handle('settings:writeWorkspace', async (_event, projectRoot: string, settingsData: any) => {
    const filePath = path.join(projectRoot, '.wayangide', 'settings.json')
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(settingsData, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('Failed to write workspace settings.json:', err)
      return false
    }
  })

  ipcMain.handle('spritesheet:save', async (_event, destDir: string, baseName: string, pngBase64: string, jsonContent: string) => {
    try {
      const pngPath = path.join(destDir, `${baseName}.png`)
      const jsonPath = path.join(destDir, `${baseName}.json`)
      
      const base64Data = pngBase64.replace(/^data:image\/png;base64,/, "")
      fs.writeFileSync(pngPath, Buffer.from(base64Data, 'base64'))
      fs.writeFileSync(jsonPath, jsonContent, 'utf8')
      return true
    } catch (err) {
      console.error('Failed to save sprite sheet files:', err)
      return false
    }
  })

  ipcMain.handle('amf:getServices', async (_event, projectRoot: string) => {
    try {
      const migratedPath = path.join(projectRoot, 'src', 'amf', 'MIGRATED_SERVICES.json')
      const auditPath = path.join(projectRoot, 'docs', 'SERVICE_AUDIT.json')
      
      const migrated = fs.existsSync(migratedPath) ? JSON.parse(fs.readFileSync(migratedPath, 'utf8')) : null
      const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null
      
      return { migrated, audit }
    } catch (err) {
      console.error('Failed to get AMF services:', err)
      return { migrated: null, audit: null }
    }
  })

  ipcMain.handle('amf:scaffold', async (_event, projectRoot: string, options: any) => {
    const { execFile } = require('child_process')
    return new Promise((resolve) => {
      const args = ['tools/scaffold-amf-service.js',
        '--domain', sanitizeArg(String(options.domain || '')),
        '--action', sanitizeArg(String(options.action || ''))
      ]
      if (options.wraps) args.push('--wraps', sanitizeArg(String(options.wraps)))
      if (options.legacyKey) args.push('--legacy-key', sanitizeArg(String(options.legacyKey)))
      if (options.client) args.push('--client', sanitizeArg(String(options.client)))
      if (options.phase) args.push('--phase', String(parseInt(options.phase, 10) || 1))
      if (options.apply) args.push('--apply')
      
      execFile('node', args, { cwd: projectRoot, timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
        resolve({
          code: error ? error.code : 0,
          stdout,
          stderr
        })
      })
    })
  })

  ipcMain.handle('system:info', () => {
    const os = require('os')
    const { getPortablePath } = require('../services/config-service')
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron || '',
      chromeVersion: process.versions.chrome || '',
      nodeVersion: process.versions.node || '',
      v8Version: process.versions.v8 || '',
      osPlatform: process.platform,
      osRelease: os.release(),
      osType: os.type(),
      osArch: os.arch(),
      cpuCores: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      flexSdkPath: getPortablePath('bin/flex-sdk'),
      ffdecPath: getPortablePath('bin/ffdec')
    }
  })
}

function sanitizeArg(arg: string): string {
  return arg.replace(/[;&|`$(){}[\]<>!\\'"]/g, '')
}

function getMainWindow() {
  const { BrowserWindow } = require('electron') as typeof import('electron')
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
}
