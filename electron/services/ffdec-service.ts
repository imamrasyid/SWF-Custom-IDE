import { execFile, execSync } from 'child_process'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadConfig, getPortablePath } from './config-service'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

export type FfdecResult = {
  code: number
  stdout: string
  stderr: string
}

function getFfdecPath(): string {
  return loadConfig().ffdecPath
}

function getJavaPath(): string {
  const embeddedJava = getPortablePath(path.join('bin', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  if (embeddedJava) {
    return embeddedJava
  }
  return 'java'
}

function getCacheDir(swfPath: string): string {
  const hash = crypto.createHash('md5').update(swfPath).digest('hex')
  return path.join(os.tmpdir(), `ffdec-cache-${hash}`)
}

// Recursively find first image file in a directory
function findImageFile(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        const found = findImageFile(fullPath)
        if (found) return found
      } else {
        const ext = path.extname(entry).toLowerCase()
        if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
          return fullPath
        }
      }
    }
  } catch {}
  return null
}

function findCachedPreviewFile(previewsDir: string, tagId: number): string | null {
  if (!fs.existsSync(previewsDir)) return null
  try {
    const entries = fs.readdirSync(previewsDir)
    const targetStr = tagId.toString()
    for (const entry of entries) {
      const fullPath = path.join(previewsDir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        const found = findCachedPreviewFile(fullPath, tagId)
        if (found) return found
      } else {
        const nameWithoutExt = path.basename(entry, path.extname(entry))
        const matchPattern = new RegExp(`(^|\\D)${targetStr}(\\D|$)`)
        if (matchPattern.test(nameWithoutExt)) {
          return fullPath
        }
      }
    }
  } catch {}
  return null
}

export async function getOrExtractAssetPath(swfPath: string, tagId: number, category: string): Promise<string | null> {
  const cacheDir = getCacheDir(swfPath)
  const previewsDir = path.join(cacheDir, 'previews')

  const cachedFile = findCachedPreviewFile(previewsDir, tagId)
  if (cachedFile) {
    return cachedFile
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-image-'))
  try {
    let exportType = 'image'
    if (category === 'sprite') exportType = 'sprite'
    else if (category === 'shape') exportType = 'shape'
    else if (category === 'morphshape') exportType = 'morphshape'
    else if (category === 'frame') exportType = 'frame'
    
    const result = await runFfdec('-export', [exportType, tempDir, swfPath, '-select', tagId.toString()])
    if (result.code !== 0) {
      return null
    }

    const imageFile = findImageFile(tempDir)
    if (!imageFile) return null

    try {
      const catDir = path.join(previewsDir, category)
      fs.mkdirSync(catDir, { recursive: true })
      const destFile = path.join(catDir, path.basename(imageFile))
      fs.copyFileSync(imageFile, destFile)
      return destFile
    } catch (err) {
      console.error('Failed to save preview to cache:', err)
      return imageFile
    }
  } catch (err) {
    console.error('getOrExtractAssetPath error:', err)
    return null
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

export function registerFfdecIpc() {
  ipcMain.handle('ffdec:run', async (event, command: string, args: string[]): Promise<FfdecResult> => {
    const webContents = event.sender
    return new Promise((resolve) => {
      const ffdecPath = getFfdecPath()
      const javaPath = getJavaPath()
      
      let spawnFile = ffdecPath
      let spawnArgs = [command, ...args]
      
      if (ffdecPath.endsWith('.jar')) {
        spawnFile = javaPath
        spawnArgs = ['-jar', ffdecPath, command, ...args]
      }
      
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

      const child = execFile(
        spawnFile,
        spawnArgs,
        { timeout: 120_000, env }
      )

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        const text = data.toString()
        stdout += text
        webContents.send('ffdec:progress', text)
      })

      child.stderr?.on('data', (data) => {
        const text = data.toString()
        stderr += text
        webContents.send('ffdec:progress', text)
      })

      child.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr })
      })

      child.on('error', (err) => {
        resolve({ code: 1, stdout, stderr: err.message })
      })
    })
  })

  // ── Script / Namespace Editor IPC Handlers ─────────────────

  // Helper to recursively find any .as file in exported temp directory
  function findAsFile(dir: string): string | null {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        const found = findAsFile(fullPath)
        if (found) return found
      } else if (file.endsWith('.as')) {
        return fullPath
      }
    }
    return null
  }

  ipcMain.handle('script:preCache', async (event, swfPath: string): Promise<boolean> => {
    const cacheDir = getCacheDir(swfPath)
    const scriptsDir = path.join(cacheDir, 'scripts')
    if (fs.existsSync(scriptsDir)) {
      return true
    }
    fs.mkdirSync(cacheDir, { recursive: true })
    // Run background decompile of all scripts
    runFfdec('-export', ['script', cacheDir, swfPath])
      .then((res) => {
        if (res.code === 0) {
          console.log(`Pre-cached all scripts for ${swfPath} successfully.`)
        } else {
          console.error(`Pre-cache failed: ${res.stderr}`)
        }
      })
      .catch(err => console.error('Pre-cache error:', err))
    return true
  })

  ipcMain.handle('script:search', async (
    event,
    swfPath: string,
    query: string,
    options?: { caseSensitive?: boolean; wholeWord?: boolean; useRegex?: boolean }
  ): Promise<{ className: string; lineNumber: number; lineContent: string }[]> => {
    if (!query || query.trim().length === 0) return []
    
    const cacheDir = getCacheDir(swfPath)
    const scriptsDir = path.join(cacheDir, 'scripts')
    if (!fs.existsSync(scriptsDir)) {
      return []
    }

    const results: { className: string; lineNumber: number; lineContent: string }[] = []

    // Prepare Regex based on options
    let regex: RegExp
    try {
      let pattern = options?.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (options?.wholeWord) {
        pattern = `\\b${pattern}\\b`
      }
      regex = new RegExp(pattern, options?.caseSensitive ? '' : 'i')
    } catch (err) {
      // Return empty if invalid regex
      return []
    }
    
    function searchDir(dir: string) {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          searchDir(fullPath)
        } else if (file.endsWith('.as')) {
          const content = fs.readFileSync(fullPath, 'utf8')
          if (regex.test(content)) {
            const relative = path.relative(scriptsDir, fullPath)
            const className = relative.slice(0, -3).replace(/[\/\\]/g, '.')
            
            const lines = content.split(/\r?\n/)
            lines.forEach((line, idx) => {
              if (regex.test(line)) {
                results.push({
                  className,
                  lineNumber: idx + 1,
                  lineContent: line.trim()
                })
              }
            })
          }
        }
      }
    }

    try {
      searchDir(scriptsDir)
    } catch (err) {
      console.error('Search failed:', err)
    }
    
    return results.slice(0, 150)
  })

  ipcMain.handle('script:read', async (event, swfPath: string, className: string): Promise<string> => {
    const relativePath = className.replace(/\./g, path.sep) + '.as'
    
    // Try reading from cache first
    const cacheDir = getCacheDir(swfPath)
    const cachedFilePath = path.join(cacheDir, 'scripts', relativePath)
    if (fs.existsSync(cachedFilePath)) {
      return fs.readFileSync(cachedFilePath, 'utf8')
    }

    // Fallback to on-demand export if cache not ready
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-export-'))
    try {
      const result = await runFfdec('-export', ['script', tempDir, swfPath, '-select', className])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to export script: ${result.stderr}`)
      }
      const filePath = findAsFile(tempDir)
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Exported script file not found in ${tempDir}`)
      }
      return fs.readFileSync(filePath, 'utf8')
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Failed to clean up temp dir:', err)
      }
    }
  })

  ipcMain.handle('script:write', async (event, swfPath: string, className: string, codeContent: string): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-import-'))
    try {
      const relativePath = className.replace(/\./g, path.sep) + '.as'
      const filePath = path.join(tempDir, relativePath)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, codeContent, 'utf8')

      // Sync with cache if cache directory exists
      const cacheDir = getCacheDir(swfPath)
      const cachedFilePath = path.join(cacheDir, 'scripts', relativePath)
      try {
        if (fs.existsSync(path.dirname(cachedFilePath))) {
          fs.writeFileSync(cachedFilePath, codeContent, 'utf8')
        }
      } catch (err) {
        console.error('Failed to sync write to cache:', err)
      }

      const tempSwf = path.join(tempDir, 'output.swf')
      const result = await runFfdec('-replace', [swfPath, tempSwf, className, filePath])
      if (result.code !== 0) {
        const stderr = result.stderr || ''
        if (stderr.includes('package internal access')) {
          throw new Error(`Cannot replace "${className}": FFDec cannot recompile this class because it references internal/built-in properties (e.g. "init" in Object). Try editing the original decompiled code instead of writing new code, or use a different class structure.`)
        }
        throw new Error(`FFDec failed to replace script: ${stderr}`)
      }
      fs.copyFileSync(tempSwf, swfPath)
      return true
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Failed to clean up temp dir:', err)
      }
    }
  })

  ipcMain.handle('script:addClass', async (event, swfPath: string, className: string): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-add-'))
    try {
      const parts = className.split('.')
      const classNameOnly = parts[parts.length - 1]
      const packageName = parts.slice(0, -1).join('.')
      
      const template = `package ${packageName} {
    public class ${classNameOnly} {
        public function ${classNameOnly}() {
            // Constructor
        }
    }
}`

      // Write in a scripts/ folder so that -import is able to detect it correctly
      const relativePath = className.replace(/\./g, path.sep) + '.as'
      const filePath = path.join(tempDir, 'scripts', relativePath)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, template, 'utf8')

      const tempSwf = path.join(tempDir, 'output.swf')
      const result = await runFfdec('-import', [swfPath, tempSwf, tempDir])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to import new class: ${result.stderr}`)
      }
      fs.copyFileSync(tempSwf, swfPath)
      return true
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Failed to clean up temp dir:', err)
      }
    }
  })

  ipcMain.handle('script:deleteClass', async (event, swfPath: string, className: string): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-delete-'))
    try {
      const tempSwf = path.join(tempDir, 'output.swf')
      const result = await runFfdec('-remove', [swfPath, tempSwf, 'script', className])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to remove class: ${result.stderr}`)
      }
      fs.copyFileSync(tempSwf, swfPath)
      return true
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Failed to clean up temp dir:', err)
      }
    }
  })

  ipcMain.handle('script:renameClass', async (event, swfPath: string, oldClassName: string, newClassName: string): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-rename-'))
    let importDir: string | null = null
    try {
      const exportResult = await runFfdec('-export', ['script', tempDir, swfPath, '-select', oldClassName])
      if (exportResult.code !== 0) {
        throw new Error(`Failed to export old script: ${exportResult.stderr}`)
      }

      const oldPathParts = oldClassName.split('.')
      const oldClassOnly = oldPathParts[oldPathParts.length - 1]
      const oldPackage = oldPathParts.slice(0, -1).join('.')

      const filePath = findAsFile(tempDir)
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Exported script file not found in ${tempDir}`)
      }

      let code = fs.readFileSync(filePath, 'utf8')

      const newPathParts = newClassName.split('.')
      const newClassOnly = newPathParts[newPathParts.length - 1]
      const newPackage = newPathParts.slice(0, -1).join('.')

      if (oldPackage) {
        code = code.replace(new RegExp(`package\\s+${oldPackage}\\b`), `package ${newPackage}`)
      } else {
        code = code.replace(/package\s*\{/, `package ${newPackage} {`)
      }

      code = code.replace(new RegExp(`\\bclass\\s+${oldClassOnly}\\b`), `class ${newClassOnly}`)
      code = code.replace(new RegExp(`\\bfunction\\s+${oldClassOnly}\\b`), `function ${newClassOnly}`)

      importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-rename-import-'))
      const newRelativePath = newClassName.replace(/\./g, path.sep) + '.as'
      // Write in a scripts/ folder so that -import is able to detect it correctly
      const newFilePath = path.join(importDir, 'scripts', newRelativePath)
      fs.mkdirSync(path.dirname(newFilePath), { recursive: true })
      fs.writeFileSync(newFilePath, code, 'utf8')

      const tempSwf1 = path.join(tempDir, 'temp1.swf')
      const removeResult = await runFfdec('-remove', [swfPath, tempSwf1, 'script', oldClassName])
      if (removeResult.code !== 0) {
        throw new Error(`Failed to remove old class: ${removeResult.stderr}`)
      }

      const tempSwf2 = path.join(tempDir, 'temp2.swf')
      const importResult = await runFfdec('-import', [tempSwf1, tempSwf2, importDir])
      if (importResult.code !== 0) {
        throw new Error(`Failed to import renamed class: ${importResult.stderr}`)
      }

      fs.copyFileSync(tempSwf2, swfPath)
      return true
    } finally {
      try {
        if (importDir) fs.rmSync(importDir, { recursive: true, force: true })
      } catch {}
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('sound:extract', async (event, swfPath: string, soundId: number): Promise<string | null> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-sound-'))
    try {
      const result = await runFfdec('-export', ['sound', tempDir, swfPath, '-select', soundId.toString()])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to export sound: ${result.stderr}`)
      }
      const files = fs.readdirSync(tempDir)
      if (files.length === 0) return null
      
      const audioFile = path.join(tempDir, files[0])
      const ext = path.extname(audioFile).toLowerCase()
      const mime = ext === '.wav' ? 'audio/wav' : 'audio/mpeg'
      const base64 = fs.readFileSync(audioFile, 'base64')
      return `data:${mime};base64,${base64}`
    } catch (err) {
      console.error('Sound extraction error:', err)
      return null
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('image:extract', async (event, swfPath: string, tagId: number, category: string): Promise<string | null> => {
    const cacheDir = getCacheDir(swfPath)
    const previewsDir = path.join(cacheDir, 'previews')

    // 1. Coba cari di folder cache previews terlebih dahulu
    const cachedFile = findCachedPreviewFile(previewsDir, tagId)
    if (cachedFile) {
      try {
        const ext = path.extname(cachedFile).toLowerCase()
        let mime = 'image/png'
        if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
        else if (ext === '.gif') mime = 'image/gif'
        else if (ext === '.bmp') mime = 'image/bmp'
        else if (ext === '.webp') mime = 'image/webp'
        else if (ext === '.svg') mime = 'image/svg+xml'
        
        const base64 = fs.readFileSync(cachedFile, 'base64')
        return `data:${mime};base64,${base64}`
      } catch (err) {
        console.error('Failed to read cached preview file:', err)
      }
    }

    // 2. Cache Miss: Jalankan pengeksporan tag tunggal seperti biasa
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-image-'))
    try {
      // category can be 'image', 'shape', 'morphshape', 'sprite', or 'frame'
      let exportType = 'image'
      if (category === 'sprite') exportType = 'sprite'
      else if (category === 'shape') exportType = 'shape'
      else if (category === 'morphshape') exportType = 'morphshape'
      else if (category === 'frame') exportType = 'frame'
      
      const result = await runFfdec('-export', [exportType, tempDir, swfPath, '-select', tagId.toString()])
      if (result.code !== 0) {
        // Jangan cetak stderr untuk tag-tag yang gagal di-preview secara normal (non-visual)
        return null
      }

      const imageFile = findImageFile(tempDir)
      if (!imageFile) return null

      // Salin ke cache previews agar berikutnya cepat
      try {
        const catDir = path.join(previewsDir, category)
        fs.mkdirSync(catDir, { recursive: true })
        const destFile = path.join(catDir, path.basename(imageFile))
        fs.copyFileSync(imageFile, destFile)
      } catch (err) {
        console.error('Failed to save preview to cache:', err)
      }

      const ext = path.extname(imageFile).toLowerCase()
      let mime = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
      else if (ext === '.gif') mime = 'image/gif'
      else if (ext === '.bmp') mime = 'image/bmp'
      else if (ext === '.webp') mime = 'image/webp'
      else if (ext === '.svg') mime = 'image/svg+xml'

      const base64 = fs.readFileSync(imageFile, 'base64')
      return `data:${mime};base64,${base64}`
    } catch (err) {
      console.error('Image extraction error:', err)
      return null
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('tag:replace', async (event, swfPath: string, tagId: number, filePath: string): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-tag-replace-'))
    try {
      const tempSwf = path.join(tempDir, 'output.swf')
      const result = await runFfdec('-replace', [swfPath, tempSwf, tagId.toString(), filePath])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to replace tag: ${result.stderr}`)
      }
      fs.copyFileSync(tempSwf, swfPath)
      
      // Invalidate metadata cache by removing it when tag is replaced
      try {
        const cacheDir = getCacheDir(swfPath)
        const cacheFile = path.join(cacheDir, 'metadata.json')
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile)
        }
      } catch {}

      return true
    } catch (err) {
      console.error('Tag replacement error:', err)
      return false
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('tag:delete', async (event, swfPath: string, tagId: number): Promise<boolean> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-tag-delete-'))
    try {
      const tempSwf = path.join(tempDir, 'output.swf')
      const result = await runFfdec('-removeCharacter', [swfPath, tempSwf, tagId.toString()])
      if (result.code !== 0) {
        throw new Error(`FFDec failed to remove character: ${result.stderr}`)
      }
      fs.copyFileSync(tempSwf, swfPath)
      
      // Invalidate metadata cache and preview cache
      try {
        const cacheDir = getCacheDir(swfPath)
        const cacheFile = path.join(cacheDir, 'metadata.json')
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile)
        }
        const previewsDir = path.join(cacheDir, 'previews')
        const cachedFile = findCachedPreviewFile(previewsDir, tagId)
        if (cachedFile && fs.existsSync(cachedFile)) {
          fs.unlinkSync(cachedFile)
        }
      } catch {}

      return true
    } catch (err) {
      console.error('Tag deletion error:', err)
      return false
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('asset:export', async (event, swfPath: string, tagId: number, category: string): Promise<boolean> => {
    let ext = '.png'
    let filterName = 'Images'
    if (category === 'sound') {
      ext = '.mp3'
      filterName = 'Audio'
    } else if (category === 'sprite') {
      ext = '.png'
      filterName = 'Sprites'
    } else if (category === 'shape' || category === 'morphshape') {
      ext = '.svg'
      filterName = 'Vector Shapes'
    }

    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Asset File',
      defaultPath: `asset_${tagId}${ext}`,
      filters: [
        { name: filterName, extensions: [ext.replace('.', '')] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) return false

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffdec-export-'))
    try {
      let exportType = 'image'
      if (category === 'sound') exportType = 'sound'
      else if (category === 'sprite') exportType = 'sprite'
      else if (category === 'shape') exportType = 'shape'
      else if (category === 'morphshape') exportType = 'morphshape'
      else if (category === 'frame') exportType = 'frame'

      const exportRes = await runFfdec('-export', [exportType, tempDir, swfPath, '-select', tagId.toString()])
      if (exportRes.code !== 0) {
        throw new Error(`FFDec failed to export: ${exportRes.stderr}`)
      }
      const files = fs.readdirSync(tempDir)
      if (files.length === 0) return false

      const exportedFile = path.join(tempDir, files[0])
      fs.copyFileSync(exportedFile, result.filePath)
      return true
    } catch (err) {
      console.error('Asset export error:', err)
      return false
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('swf:getMetadataCache', async (event, swfPath: string) => {
    try {
      const cacheDir = getCacheDir(swfPath)
      const cacheFile = path.join(cacheDir, 'metadata.json')
      if (fs.existsSync(cacheFile) && fs.existsSync(swfPath)) {
        const swfMtime = fs.statSync(swfPath).mtimeMs
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
        if (cacheData.mtime === swfMtime) {
          return cacheData
        }
      }
    } catch (err) {
      console.error('Failed to read metadata cache:', err)
    }
    return null
  })

  ipcMain.handle('swf:saveMetadataCache', async (event, swfPath: string, data: any) => {
    try {
      const cacheDir = getCacheDir(swfPath)
      fs.mkdirSync(cacheDir, { recursive: true })
      const cacheFile = path.join(cacheDir, 'metadata.json')
      const swfMtime = fs.existsSync(swfPath) ? fs.statSync(swfPath).mtimeMs : 0
      const payload = {
        mtime: swfMtime,
        ...data
      }
      fs.writeFileSync(cacheFile, JSON.stringify(payload), 'utf8')
      return true
    } catch (err) {
      console.error('Failed to write metadata cache:', err)
      return false
    }
  })

  ipcMain.handle('swf:preExtractAssets', async (event, swfPath: string) => {
    const cacheDir = getCacheDir(swfPath)
    const previewsDir = path.join(cacheDir, 'previews')
    fs.mkdirSync(previewsDir, { recursive: true })

    const categoriesToPreExtract = ['image', 'shape', 'morphshape', 'button'];
    
    // Process async in background without blocking the main event loop
    (async () => {
      for (const cat of categoriesToPreExtract) {
        try {
          const catDir = path.join(previewsDir, cat)
          if (fs.existsSync(catDir) && fs.readdirSync(catDir).length > 0) {
            continue // Skip if already pre-extracted
          }
          fs.mkdirSync(catDir, { recursive: true })
          console.log(`[Batch Extract] Starting background pre-extraction for category "${cat}"...`)
          await runFfdec('-export', [cat, catDir, swfPath])
          console.log(`[Batch Extract] Finished background pre-extraction for category "${cat}".`)
        } catch (err) {
          console.error(`[Batch Extract] Failed to pre-extract ${cat}:`, err)
        }
      }
    })().catch(console.error)

    return true
  })

  ipcMain.handle('swf:compile', async (event, projectRoot: string, sdkPath: string, mainFile: string, outputFile: string, additionalArgs: string[]): Promise<{ success: boolean; log: string }> => {
    return new Promise((resolve) => {
      // Auto-detect embedded Flex SDK if sdkPath is missing, invalid or is default placeholder
      let resolvedSdkPath = sdkPath
      const embeddedFlexSdk = getPortablePath(path.join('bin', 'flex-sdk'))
      if (embeddedFlexSdk && (!sdkPath || !fs.existsSync(sdkPath) || sdkPath.includes('flex_sdk'))) {
        resolvedSdkPath = embeddedFlexSdk
      }

      let compilerPath = path.join(resolvedSdkPath, 'bin', process.platform === 'win32' ? 'mxmlc.bat' : 'mxmlc')
      if (!fs.existsSync(compilerPath)) {
        if (fs.existsSync(resolvedSdkPath) && (resolvedSdkPath.endsWith('mxmlc.bat') || resolvedSdkPath.endsWith('mxmlc') || resolvedSdkPath.endsWith('mxmlc.exe'))) {
          compilerPath = resolvedSdkPath
        } else {
          resolve({ success: false, log: `Flex SDK Compiler (mxmlc) not found. Checked: ${compilerPath}. Please configure valid Flex/AIR SDK path.` })
          return
        }
      }

      const args = [
        mainFile,
        '-output',
        outputFile,
        ...additionalArgs
      ]

      console.log(`[mxmlc] Running compile: ${compilerPath} ${args.join(' ')}`)
      
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

      execFile(
        compilerPath,
        args,
        { cwd: projectRoot || undefined, env, timeout: 60_000 },
        (error, stdout, stderr) => {
          const log = stdout + '\n' + stderr
          if (error && (error as any).code !== 0) {
            resolve({ success: false, log })
            return
          }
          resolve({ success: true, log })
        }
      )
    })
  })
}


export function runFfdec(command: string, args: string[]): Promise<FfdecResult> {
  return new Promise((resolve) => {
    const ffdecPath = getFfdecPath()
    const javaPath = getJavaPath()
    
    let spawnFile = ffdecPath
    let spawnArgs = [command, ...args]
    
    if (ffdecPath.endsWith('.jar')) {
      spawnFile = javaPath
      spawnArgs = ['-jar', ffdecPath, command, ...args]
    }
    
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

    const child = execFile(
      spawnFile,
      spawnArgs,
      { timeout: 120_000, env },
      (error, stdout, stderr) => {
        if (error && (error as any).code !== 0) {
          resolve({ code: (error as any).code || 1, stdout, stderr })
          return
        }
        resolve({ code: 0, stdout, stderr })
      }
    )
  })
}
