import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export type AppConfig = {
  ffdecPath: string
  jrePath?: string
  flexSdkPath?: string
  lastOpenedSwf?: string
  recentFiles: string[]
  wayangideProjectPath?: string
  theme: 'light' | 'dark' | 'system'
}

// Helper to check and resolve path to bundled resources/binaries
export function getPortablePath(subPath: string): string | null {
  const possibleDirs = [
    // Development Mode
    path.join(process.cwd(), subPath),
    // Production Mode (app.asar.unpacked/bin or resources/bin)
    path.join(app.getAppPath(), '..', subPath),
    path.join(app.getAppPath(), subPath),
  ]
  
  if (process.resourcesPath) {
    possibleDirs.push(path.join(process.resourcesPath, subPath))
  }

  for (const resolvedPath of possibleDirs) {
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath
    }
  }
  return null
}

// Try to find ffdec-cli.exe in multiple possible locations
function getFfdecDefaultPath(): string {
  // Prioritize embedded portable jar or exe
  const portableJar = getPortablePath(path.join('bin', 'ffdec', 'ffdec.jar'))
  if (portableJar) return portableJar

  const portableExe = getPortablePath(path.join('bin', 'ffdec', 'ffdec-cli.exe'))
  if (portableExe) return portableExe

  const possiblePaths = [
    // During development (project root)
    path.join(process.cwd(), 'ffdec', 'ffdec-cli.exe'),
    // In production (app resources)
    path.join(app.getAppPath(), 'ffdec', 'ffdec-cli.exe'),
    // Also check parent directory (in case app is nested)
    path.join(app.getAppPath(), '..', 'ffdec', 'ffdec-cli.exe'),
    // System installed ffdec
    'D:\\Apps\\Jpexs Decompiler\\ffdec-cli.exe'
  ]
  
  for (const ffdecPath of possiblePaths) {
    try {
      if (fs.existsSync(ffdecPath)) {
        console.log(`Found ffdec at: ${ffdecPath}`)
        return ffdecPath
      }
    } catch {
      // Skip if path check fails
    }
  }
  
  // Default if nothing found (user can configure manually)
  return possiblePaths[possiblePaths.length - 1]
}

const DEFAULT_CONFIG: AppConfig = {
  ffdecPath: getFfdecDefaultPath(),
  recentFiles: [],
  theme: 'system'
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): AppConfig {
  try {
    const data = fs.readFileSync(configPath(), 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2))
  } catch (err) {
    console.error('Failed to save config:', err)
    throw new Error(`Failed to save configuration: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function getBinaryStatus() {
  const config = loadConfig()
  
  // Check JRE
  let hasJre = false
  let resolvedJrePath = config.jrePath || ''
  if (resolvedJrePath && fs.existsSync(resolvedJrePath)) {
    hasJre = true
  } else {
    // Check portable or default
    const embeddedJava = getPortablePath(path.join('bin', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
    if (embeddedJava) {
      hasJre = true
      resolvedJrePath = embeddedJava
    } else {
      // Check %APPDATA%/wayangide/bin/jre/bin/java.exe
      const appDataJava = path.join(app.getPath('userData'), 'bin', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
      if (fs.existsSync(appDataJava)) {
        hasJre = true
        resolvedJrePath = appDataJava
      }
    }
  }

  // Check FFDec
  let hasFfdec = false
  let resolvedFfdecPath = config.ffdecPath || ''
  if (resolvedFfdecPath && fs.existsSync(resolvedFfdecPath)) {
    hasFfdec = true
  } else {
    const embeddedFfdec = getPortablePath(path.join('bin', 'ffdec', 'ffdec.jar')) || getPortablePath(path.join('bin', 'ffdec', 'ffdec-cli.exe'))
    if (embeddedFfdec) {
      hasFfdec = true
      resolvedFfdecPath = embeddedFfdec
    } else {
      const appDataFfdec = path.join(app.getPath('userData'), 'bin', 'ffdec', 'ffdec.jar')
      if (fs.existsSync(appDataFfdec)) {
        hasFfdec = true
        resolvedFfdecPath = appDataFfdec
      }
    }
  }

  // Check Flex SDK
  let hasFlex = false
  let resolvedFlexPath = config.flexSdkPath || ''
  if (resolvedFlexPath && fs.existsSync(resolvedFlexPath)) {
    hasFlex = true
  } else {
    const embeddedFlex = getPortablePath(path.join('bin', 'flex-sdk'))
    if (embeddedFlex) {
      hasFlex = true
      resolvedFlexPath = embeddedFlex
    } else {
      const appDataFlex = path.join(app.getPath('userData'), 'bin', 'flex-sdk', 'bin', process.platform === 'win32' ? 'mxmlc.bat' : 'mxmlc')
      if (fs.existsSync(appDataFlex)) {
        hasFlex = true
        resolvedFlexPath = path.dirname(path.dirname(appDataFlex))
      }
    }
  }

  return {
    jre: { installed: hasJre, path: resolvedJrePath },
    ffdec: { installed: hasFfdec, path: resolvedFfdecPath },
    flexSdk: { installed: hasFlex, path: resolvedFlexPath }
  }
}

