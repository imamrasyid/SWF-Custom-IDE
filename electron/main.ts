import { app, BrowserWindow, Menu, dialog, ipcMain, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'
import { registerFfdecIpc, getOrExtractAssetPath } from './services/ffdec-service'
import { loadConfig, saveConfig, getPortablePath } from './services/config-service'
import { detectNinjasageProject } from './services/project-service'
import { As3DapAdapter } from './dap/as3-adapter'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

protocol.registerSchemesAsPrivileged([
  { scheme: 'ns-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

let mainWindow: BrowserWindow | null = null
let debugAdapter: As3DapAdapter | null = null

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open SWF...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openSwf()
        },
        { type: 'separator' },
        {
          label: 'Build SWF...',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow?.webContents.send('menu-action', 'build')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' }
      ]
    },
    {
      label: 'SWF',
      submenu: [
        { label: 'Export All Scripts...', click: () => mainWindow?.webContents.send('menu-action', 'export-scripts') },
        { label: 'Export All Assets...', click: () => mainWindow?.webContents.send('menu-action', 'export-assets') },
        { type: 'separator' },
        { label: 'Enable Debugging', click: () => mainWindow?.webContents.send('menu-action', 'enable-debug') },
        { label: 'Compress', click: () => mainWindow?.webContents.send('menu-action', 'compress') },
        { type: 'separator' },
        { label: 'Panel Studio', click: () => mainWindow?.webContents.send('menu-action', 'panel-studio') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Game Data Editor', click: () => mainWindow?.webContents.send('menu-action', 'game-data-editor') },
        { label: 'AMF Service Builder', click: () => mainWindow?.webContents.send('menu-action', 'amf-builder') },
        { label: 'Text Localizer', click: () => mainWindow?.webContents.send('menu-action', 'text-localizer') },
        { label: 'Mission Editor', click: () => mainWindow?.webContents.send('menu-action', 'mission-editor') },
        { label: 'Sound Studio', click: () => mainWindow?.webContents.send('menu-action', 'sound-studio') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About', click: () => mainWindow?.webContents.send('menu-action', 'about') },
        { type: 'separator' },
        { label: 'ffdec-cli Help', click: () => mainWindow?.webContents.send('menu-action', 'ffdec-help') }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function openSwf() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open SWF File',
    filters: [
      { name: 'SWF Files', extensions: ['swf'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('swf-opened', result.filePaths[0])
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,  // Borderless window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    title: 'NinjaSage Modding Toolkit'
  })

  // Set CSP to suppress Electron security warning
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
}

// ── IPC Handlers ──────────────────────────────────

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

// ── Config IPC ──────────────────────────────────

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
})

ipcMain.handle('project:detect', async (_event, dir?: string) => {
  // Jika dir tidak diberikan, mulai dari folder app (modding_tools) dan cari ke atas
  const startDir = dir || path.resolve(app.getAppPath(), '..')
  let current = startDir
  for (let i = 0; i < 8; i++) {
    try {
      const result = detectNinjasageProject(current)
      if (result) return result
    } catch {
      // skip jika folder tidak bisa dibaca
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
})

ipcMain.handle('project:detectFromSwf', async (_event, swfPath: string) => {
  const dir = path.dirname(swfPath)
  let current = dir
  for (let i = 0; i < 5; i++) {
    const result = detectNinjasageProject(current)
    if (result) return result
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Destination Folder',
    properties: ['openDirectory', 'createDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
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
    const compressed = zlib.deflateSync(Buffer.from(text, 'utf8'))
    return compressed
  } catch (err) {
    console.error('Zlib compression failed:', err)
    return null
  }
})

ipcMain.handle('settings:readWorkspace', async (_event, projectRoot: string) => {
  const filePath = path.join(projectRoot, '.ninjasage', 'settings.json')
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (err) {
      console.error(`Failed to parse workspace settings.json:`, err)
      return null
    }
  }
  return null
})

ipcMain.handle('settings:writeWorkspace', async (_event, projectRoot: string, settingsData: any) => {
  const filePath = path.join(projectRoot, '.ninjasage', 'settings.json')
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(settingsData, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error(`Failed to write workspace settings.json:`, err)
    return false
  }
})

ipcMain.handle('panels:list', async (_event, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return []
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    return files
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.swf'))
      .map(f => {
        const fullPath = path.join(dirPath, f.name)
        const stat = fs.statSync(fullPath)
        return {
          name: f.name,
          path: fullPath,
          size: stat.size,
          mtime: stat.mtimeMs
        }
      })
  } catch (err) {
    console.error('Failed to list panels:', err)
    return []
  }
})

ipcMain.handle('panels:writeCode', async (_event, filePath: string, content: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  } catch (err) {
    console.error('Failed to write panel code:', err)
    return false
  }
})

ipcMain.handle('panels:readCode', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8')
    }
    return ''
  } catch (err) {
    console.error('Failed to read panel code:', err)
    return ''
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

const PROJECT_TEMPLATES = {
  basic: {
    name: 'Basic AS3 Project',
    description: 'Template dasar dengan Main.as dan konfigurasi minimal',
    files: {
      'src/Main.as': (name: string) => `package {
    import flash.display.Sprite;
    import flash.text.TextField;
    import flash.text.TextFormat;

    [SWF(width="800", height="600", backgroundColor="#070b13", frameRate="60")]
    public class Main extends Sprite {
        public function Main() {
            var txt:TextField = new TextField();
            txt.defaultTextFormat = new TextFormat("Arial", 28, 0xFFFFFF, true);
            txt.text = "Hello ${name}!";
            txt.width = 400;
            txt.x = 250;
            txt.y = 250;
            addChild(txt);
        }
    }
}`,
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: ["src/Main.as"]
      }, null, 2),
      '.ninjasage/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "src/Main.as",
        "compiler.defaultOutput": `build/${name}.swf`
      }, null, 2)
    },
    folders: ['src', 'build', '.ninjasage']
  },
  ninjasage: {
    name: 'NinjaSage Mod',
    description: 'Template untuk modding game NinjaSage dengan struktur folder lengkap',
    files: {
      'src/Main.as': (name: string) => `package {
    import flash.display.Sprite;
    import flash.events.Event;

    [SWF(width="800", height="600", backgroundColor="#070b13", frameRate="60")]
    public class Main extends Sprite {
        public function Main() {
            if (stage) init();
            else addEventListener(Event.ADDED_TO_STAGE, init);
        }
        
        private function init(e:Event = null):void {
            removeEventListener(Event.ADDED_TO_STAGE, init);
            trace("${name} mod loaded!");
        }
    }
}`,
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: ["src/Main.as"]
      }, null, 2),
      '.ninjasage/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "src/Main.as",
        "compiler.defaultOutput": `build/${name}.swf`,
        "workspace.assetSwfPaths": "client/assets/assets.swf"
      }, null, 2),
      'src/classes/.gitkeep': '',
      'src/skills/.gitkeep': '',
      'src/items/.gitkeep': '',
      'src/enemy/.gitkeep': ''
    },
    folders: ['src', 'src/classes', 'src/skills', 'src/items', 'src/enemy', 'build', '.ninjasage']
  },
  empty: {
    name: 'Empty Project',
    description: 'Project kosong tanpa file sample',
    files: {
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: []
      }, null, 2),
      '.ninjasage/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "",
        "compiler.defaultOutput": `build/${name}.swf`
      }, null, 2)
    },
    folders: ['src', 'build', '.ninjasage']
  }
}

ipcMain.handle('project:getTemplates', async () => {
  return Object.entries(PROJECT_TEMPLATES).map(([id, tmpl]) => ({
    id,
    name: tmpl.name,
    description: tmpl.description
  }))
})

ipcMain.handle('project:createTemplate', async (_event, projectRoot: string, projectName: string, templateId: string = 'basic') => {
  try {
    const template = PROJECT_TEMPLATES[templateId as keyof typeof PROJECT_TEMPLATES] || PROJECT_TEMPLATES.basic
    
    for (const folder of template.folders) {
      fs.mkdirSync(path.join(projectRoot, folder), { recursive: true })
    }
    
    for (const [filePath, contentFn] of Object.entries(template.files)) {
      const content = typeof contentFn === 'function' ? contentFn(projectName) : contentFn
      fs.writeFileSync(path.join(projectRoot, filePath), content, 'utf8')
    }
    
    return true
  } catch (err) {
    console.error('Failed to create project template:', err)
    return false
  }
})

ipcMain.handle('project:readAsconfig', async (_event, projectRoot: string) => {
  const filePath = path.join(projectRoot, 'asconfig.json')
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (err) {
      console.error('Failed to parse asconfig.json:', err)
      return null
    }
  }
  return null
})

// ── AMF Service Builder IPC ──────────────────────────

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

function sanitizeArg(arg: string): string {
  // Remove shell metacharacters to prevent command injection
  return arg.replace(/[;&|`$(){}[\]<>!\\'"]/g, '')
}

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

// ── Custom Toolbar Actions IPC ──────────────────────────

ipcMain.handle('config:getToolbarActions', async (_event, projectRoot?: string) => {
  const configPath = projectRoot
    ? path.join(projectRoot, '.ninjasage', 'toolbar.json')
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
    ? path.join(projectRoot, '.ninjasage')
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

// ── Build Hooks IPC ──────────────────────────

ipcMain.handle('config:getBuildHooks', async (_event, projectRoot: string) => {
  const hooksPath = path.join(projectRoot, '.ninjasage', 'hooks.json')
  try {
    if (fs.existsSync(hooksPath)) {
      return JSON.parse(fs.readFileSync(hooksPath, 'utf8'))
    }
  } catch {}
  return { preBuild: [], postBuild: [] }
})

ipcMain.handle('config:saveBuildHooks', async (_event, projectRoot: string, hooks: any) => {
  const hooksDir = path.join(projectRoot, '.ninjasage')
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
  // Basic validation: reject commands with dangerous shell operators
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

// ── Export/Import Config IPC ──────────────────────────

ipcMain.handle('config:export', async (_event, projectRoot?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Configuration',
    defaultPath: `ninjasage-config-${Date.now()}.json`,
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
      const settingsPath = path.join(projectRoot, '.ninjasage', 'settings.json')
      const settings = safeReadJson(settingsPath)
      if (settings) config.settings = settings
      
      const toolbarPath = path.join(projectRoot, '.ninjasage', 'toolbar.json')
      const toolbar = safeReadJson(toolbarPath)
      if (toolbar) config.toolbar = toolbar
      
      const hooksPath = path.join(projectRoot, '.ninjasage', 'hooks.json')
      const hooks = safeReadJson(hooksPath)
      if (hooks) config.hooks = hooks
    } else {
      const userDataPath = app.getPath('userData')
      
      const settingsPath = path.join(userDataPath, 'config.json')
      const userConfig = safeReadJson(settingsPath)
      if (userConfig) config.userConfig = userConfig
      
      const toolbarPath = path.join(userDataPath, 'toolbar.json')
      const toolbar = safeReadJson(toolbarPath)
      if (toolbar) config.toolbar = toolbar
      
      const keybindingsPath = path.join(userDataPath, 'keybindings.json')
      const keybindings = safeReadJson(keybindingsPath)
      if (keybindings) config.keybindings = keybindings
    }
    
    if (warnings.length > 0) {
      config._warnings = warnings
    }
    
    fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('Failed to export config:', err)
    return false
  }
})

ipcMain.handle('config:import', async (_event, projectRoot?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Configuration',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  
  if (result.canceled || result.filePaths.length === 0) return false
  
  try {
    const config = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    
    if (projectRoot) {
      const settingsDir = path.join(projectRoot, '.ninjasage')
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

let adlProcess: ChildProcess | null = null

ipcMain.handle('simulator:runAdl', async (event, swfPath: string, sdkPath?: string): Promise<{ success: boolean; log: string }> => {
  if (adlProcess) {
    try {
      adlProcess.kill()
    } catch {}
    adlProcess = null
  }

  return new Promise((resolve) => {
    try {
      const swfDir = path.dirname(swfPath)
      const swfName = path.basename(swfPath)

      // Resolve Flex/AIR SDK path
      let resolvedSdkPath = sdkPath || ''
      const adlExeName = process.platform === 'win32' ? 'adl.exe' : 'adl'
      let adlPath = resolvedSdkPath ? path.join(resolvedSdkPath, 'bin', adlExeName) : ''

      if (!adlPath || !fs.existsSync(adlPath)) {
        // Fallback to embedded SDK path if it contains adl.exe
        const embeddedSdk = getPortablePath(path.join('bin', 'flex-sdk'))
        if (embeddedSdk) {
          const testAdl = path.join(embeddedSdk, 'bin', adlExeName)
          if (fs.existsSync(testAdl)) {
            resolvedSdkPath = embeddedSdk
            adlPath = testAdl
          }
        }
      }

      if (!adlPath || !fs.existsSync(adlPath)) {
        resolve({ success: false, log: `AIR Debug Launcher (adl) not found at: ${adlPath || 'configured path'}. Please configure a valid Flex/AIR SDK path.` })
        return
      }

      // Generate temp application descriptor XML
      const tempDescPath = path.join(os.tmpdir(), 'ns-app-descriptor.xml')
      const xmlContent = `<?xml version="1.0" encoding="utf-8" ?>
<application xmlns="http://ns.adobe.com/air/application/51.3">
  <id>com.ninjasage.simulator</id>
  <versionNumber>1.0.0</versionNumber>
  <filename>NinjaSageSimulator</filename>
  <initialWindow>
    <content>${swfName}</content>
    <visible>true</visible>
    <width>1000</width>
    <height>600</height>
  </initialWindow>
</application>`
      fs.writeFileSync(tempDescPath, xmlContent, 'utf8')

      console.log(`[ADL] Spawning: ${adlPath} ${tempDescPath} ${swfDir}`)

      // Inject portable JRE to PATH/JAVA_HOME if present
      const env = { ...process.env }
      const jrePath = getPortablePath(path.join('bin', 'jre'))
      if (jrePath) {
        env.JAVA_HOME = jrePath
        const jreBin = path.join(jrePath, 'bin')
        if (process.platform === 'win32') {
          env.PATH = `${jreBin};${env.PATH || ''}`
        } else {
          env.PATH = `${jreBin}:${env.PATH || ''}`
        }
      }

      adlProcess = spawn(adlPath, [tempDescPath, swfDir], { env })

      const webContents = event.sender
      
      adlProcess.stdout?.on('data', (data) => {
        webContents.send('simulator:log', data.toString())
      })

      adlProcess.stderr?.on('data', (data) => {
        webContents.send('simulator:log', data.toString())
      })

      adlProcess.on('close', (code) => {
        webContents.send('simulator:log', `[ADL Process exited with code ${code}]`)
        adlProcess = null
      })

      adlProcess.on('error', (err) => {
        webContents.send('simulator:log', `[ADL Process error: ${err.message}]`)
        adlProcess = null
      })

      resolve({ success: true, log: `AIR Debug Launcher started successfully.` })
    } catch (err: any) {
      resolve({ success: false, log: `Failed to launch ADL: ${err.message}` })
    }
  })
})

ipcMain.handle('simulator:killAdl', async () => {
  if (adlProcess) {
    try {
      adlProcess.kill()
    } catch {}
    adlProcess = null
    return true
  }
  return false
})

const terminalProcesses: Map<string, ChildProcess> = new Map()

ipcMain.handle('terminal:create', async (event, id: string, cwd?: string) => {
  // Kill existing process for this ID if any
  const existing = terminalProcesses.get(id)
  if (existing) {
    try { existing.kill() } catch {}
    terminalProcesses.delete(id)
  }

  const projectCwd = cwd || app.getAppPath()
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'powershell.exe' : 'bash'
  
  const proc = spawn(shell, [], {
    cwd: projectCwd,
    env: process.env,
    shell: true
  })

  terminalProcesses.set(id, proc)

  const webContents = event.sender

  proc.stdout?.on('data', (data) => {
    webContents.send('terminal:data', id, data.toString())
  })

  proc.stderr?.on('data', (data) => {
    webContents.send('terminal:data', id, data.toString())
  })

  proc.on('close', (code) => {
    webContents.send('terminal:data', id, `\r\n[Terminal process exited with code ${code}]\r\n`)
    terminalProcesses.delete(id)
  })

  proc.on('error', (err) => {
    webContents.send('terminal:data', id, `\r\n[Terminal process error: ${err.message}]\r\n`)
    terminalProcesses.delete(id)
  })

  return true
})

ipcMain.handle('terminal:write', async (_event, id: string, text: string) => {
  const proc = terminalProcesses.get(id)
  if (proc && proc.stdin) {
    proc.stdin.write(text)
    return true
  }
  return false
})

ipcMain.handle('terminal:destroy', async (_event, id: string) => {
  const proc = terminalProcesses.get(id)
  if (proc) {
    try { proc.kill() } catch {}
    terminalProcesses.delete(id)
    return true
  }
  return false
})


// ── App Lifecycle ─────────────────────────────────

app.whenReady().then(() => {
  protocol.handle('ns-asset', async (request) => {
    try {
      const url = new URL(request.url)
      
      // Support direct loading of files (e.g. SWF for simulator)
      if (url.host === 'load') {
        const filePath = url.searchParams.get('path')
        if (!filePath) {
          return new Response('Missing path parameter', { status: 400 })
        }
        // Validate path exists and is a file (not a directory)
        try {
          const stat = fs.statSync(filePath)
          if (!stat.isFile()) {
            return new Response('Not a file', { status: 400 })
          }
        } catch {
          return new Response('File Not Found', { status: 404 })
        }
        const fileBuffer = fs.readFileSync(filePath)
        return new Response(fileBuffer, {
          headers: { 'Content-Type': 'application/x-shockwave-flash' }
        })
      }

      const swfPath = url.searchParams.get('swfPath')
      const category = url.searchParams.get('category') || 'image'
      
      let tagIdStr = url.host
      if (tagIdStr === 'extract') {
        tagIdStr = url.pathname.replace(/^\//, '')
      }
      const tagId = parseInt(tagIdStr, 10)

      if (!swfPath || isNaN(tagId)) {
        return new Response('Invalid Request', { status: 400 })
      }

      const filePath = await getOrExtractAssetPath(swfPath, tagId, category)
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Asset Not Found', { status: 404 })
      }

      const fileBuffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      let mime = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
      else if (ext === '.gif') mime = 'image/gif'
      else if (ext === '.bmp') mime = 'image/bmp'
      else if (ext === '.webp') mime = 'image/webp'
      else if (ext === '.svg') mime = 'image/svg+xml'

      return new Response(fileBuffer, {
        headers: { 'Content-Type': mime }
      })
    } catch (err: any) {
      console.error('ns-asset protocol error:', err)
      return new Response(err.message || 'Error', { status: 500 })
    }
  })

// ── Debug Adapter IPC ──────────────────────────

ipcMain.handle('debug:start', async (event, swfPath: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (debugAdapter) {
      debugAdapter.dispose()
    }
    
    debugAdapter = new As3DapAdapter()
    
    // Forward debug events to renderer
    debugAdapter.on('event', (dapEvent) => {
      mainWindow?.webContents.send('debug:event', dapEvent)
    })
    
    debugAdapter.on('response', (response) => {
      mainWindow?.webContents.send('debug:response', response)
    })
    
    await debugAdapter.initialize({ swfPath })
    
    // Send launch request
    await debugAdapter.handleRequest({
      seq: 1,
      type: 'request',
      command: 'launch',
      arguments: { program: swfPath }
    })
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('debug:stop', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.terminate()
      debugAdapter.dispose()
      debugAdapter = null
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:pause', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.handleRequest({
        seq: Date.now(),
        type: 'request',
        command: 'pause'
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:continue', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.handleRequest({
        seq: Date.now(),
        type: 'request',
        command: 'continue'
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:stepOver', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.handleRequest({
        seq: Date.now(),
        type: 'request',
        command: 'next'
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:stepIn', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.handleRequest({
        seq: Date.now(),
        type: 'request',
        command: 'stepIn'
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:stepOut', async (): Promise<{ success: boolean }> => {
  try {
    if (debugAdapter) {
      await debugAdapter.handleRequest({
        seq: Date.now(),
        type: 'request',
        command: 'stepOut'
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('debug:setBreakpoints', async (event, file: string, breakpoints: { line: number; condition?: string }[]): Promise<{ breakpoints: { id: number; verified: boolean; line: number }[] }> => {
  if (!debugAdapter) {
    return { breakpoints: [] }
  }
  
  try {
    await debugAdapter.handleRequest({
      seq: Date.now(),
      type: 'request',
      command: 'setBreakpoints',
      arguments: {
        source: { path: file },
        breakpoints
      }
    })
  } catch (err) {
    console.error('debug:setBreakpoints error:', err)
  }
  
  return { breakpoints: [] }
})

ipcMain.handle('debug:evaluate', async (event, expression: string): Promise<{ result: string; type: string }> => {
  if (!debugAdapter) {
    return { result: '', type: 'undefined' }
  }
  
  try {
    await debugAdapter.handleRequest({
      seq: Date.now(),
      type: 'request',
      command: 'evaluate',
      arguments: { expression, frameId: 0 }
    })
  } catch (err) {
    console.error('debug:evaluate error:', err)
  }
  
  return { result: '', type: 'string' }
})

ipcMain.handle('debug:stackTrace', async (): Promise<{ frames: any[] }> => {
  if (!debugAdapter) {
    return { frames: [] }
  }
  
  // Stack trace is returned via events, so we return current frame
  return { frames: [] }
})

ipcMain.handle('debug:variables', async (event, reference: number): Promise<{ variables: any[] }> => {
  if (!debugAdapter) {
    return { variables: [] }
  }
  
  try {
    await debugAdapter.handleRequest({
      seq: Date.now(),
      type: 'request',
      command: 'variables',
      arguments: { variablesReference: reference }
    })
  } catch (err) {
    console.error('debug:variables error:', err)
  }
  
  return { variables: [] }
})

  registerFfdecIpc()
  createMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
