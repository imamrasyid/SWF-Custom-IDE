import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app, dialog } from 'electron'

const TAMPER_CHECK_ENABLED = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV
const PERIODIC_CHECK_INTERVAL = 30000

function getAppPath(): string {
  return app.getAppPath()
}

function calculateFileHash(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch {
    return null
  }
}

function isRunningFromAsar(): boolean {
  return getAppPath().endsWith('.asar')
}

function checkDevTools(): boolean {
  try {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (win.webContents.isDevToolsOpened()) return true
    }
  } catch {}
  return false
}

function checkForDebugger(): boolean {
  // Skip this check as it can be triggered by terminal/shell environments
  // The more important check is the DevTools check
  return false
}

function checkDevToolsProcess(): boolean {
  try {
    const { execSync } = require('child_process')
    const platform = process.platform
    if (platform === 'win32') {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8', timeout: 5000 })
      const suspicious = ['ollydbg.exe', 'x64dbg.exe', 'x32dbg.exe', 'ida.exe', 'ida64.exe', 'windbg.exe', 'dnSpy.exe']
      for (const proc of suspicious) {
        if (output.toLowerCase().includes(proc.toLowerCase())) return true
      }
    }
  } catch {}
  return false
}

function showTamperDialog(message: string): void {
  try {
    dialog.showMessageBox({
      type: 'error',
      title: 'Security Alert',
      message: 'Application Integrity Violation',
      detail: message,
      buttons: ['OK']
    }).then(() => {
      app.quit()
    }).catch(() => {
      app.quit()
    })
  } catch {
    app.quit()
  }
}

function isLicenseDisabled(): boolean {
  if (process.env.DISABLE_LICENSE === 'true') {
    return true
  }
  try {
    const possibleEnvPaths = [
      path.join(process.cwd(), '.env'),
      path.join(app?.getAppPath() || '', '.env'),
      path.join(path.dirname(app?.getPath('exe') || ''), '.env')
    ]
    for (const envPath of possibleEnvPaths) {
      if (envPath && fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        if (/^\s*DISABLE_LICENSE\s*=\s*true/m.test(content)) {
          return true
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return false
}

function performStartupChecks(): boolean {
  if (!TAMPER_CHECK_ENABLED || isLicenseDisabled()) {
    console.log('[Tamper] Tamper check disabled (development mode or disabled via config)')
    return true
  }

  if (checkForDebugger()) {
    console.error('[Security] Debugger/inspector detected at startup')
    showTamperDialog('Debugger detected. Application cannot run in debug mode.')
    return false
  }

  if (process.env.NODE_ENV === 'production' && !isRunningFromAsar()) {
    console.error('[Security] App is NOT running from ASAR - possible repack!')
    showTamperDialog('Application integrity check failed. The app may have been tampered with.')
    return false
  }

  let buildHashFile = path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'dist-electron', '.integrity')
  if (!fs.existsSync(buildHashFile)) {
    buildHashFile = path.join(path.dirname(process.execPath), 'app.asar.unpacked', 'dist-electron', '.integrity')
  }
  if (!fs.existsSync(buildHashFile)) {
    buildHashFile = path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', '.integrity')
  }
  if (!fs.existsSync(buildHashFile)) {
    buildHashFile = path.join(path.dirname(process.execPath), 'app.asar.unpacked', '.integrity')
  }

  if (fs.existsSync(buildHashFile)) {
    try {
      const storedHashStr = fs.readFileSync(buildHashFile, 'utf-8').trim()
      let expectedHash = storedHashStr
      try {
        const integrityObj = JSON.parse(storedHashStr)
        if (integrityObj && typeof integrityObj === 'object') {
          expectedHash = integrityObj['main.js'] || expectedHash
        }
      } catch {
        // Fallback if not JSON
      }

      const currentHash = calculateFileHash(require.resolve('./main'))
      if (currentHash && expectedHash !== currentHash) {
        console.error('[Security] File integrity check failed!')
        showTamperDialog('Application files have been modified. Please reinstall the application.')
        return false
      }
    } catch (e) {
      console.error('[Security] Could not verify integrity:', e)
    }
  }

  return true
}

let periodicCheckTimer: ReturnType<typeof setInterval> | null = null

function startPeriodicChecks(): void {
  if (!TAMPER_CHECK_ENABLED || isLicenseDisabled()) return

  periodicCheckTimer = setInterval(() => {
    if (checkDevTools()) {
      console.error('[Security] DevTools opened during runtime')
      showTamperDialog('Developer tools detected during runtime. Application will exit.')
      return
    }
    if (checkForDebugger()) {
      console.error('[Security] Debugger attached during runtime')
      showTamperDialog('Debugger detected during runtime. Application will exit.')
      return
    }
    if (process.env.NODE_ENV === 'production' && !isRunningFromAsar()) {
      console.error('[Security] ASAR check failed during runtime')
      showTamperDialog('Application integrity compromised. Application will exit.')
      return
    }
  }, PERIODIC_CHECK_INTERVAL)
}

export function performTamperCheck(): boolean {
  const result = performStartupChecks()
  if (result) {
    startPeriodicChecks()
  }
  return result
}

export function stopPeriodicChecks(): void {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer)
    periodicCheckTimer = null
  }
}

export { isRunningFromAsar, checkDevTools }

