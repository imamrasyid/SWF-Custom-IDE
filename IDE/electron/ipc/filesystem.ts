import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

const fileWatchers = new Map<string, fs.FSWatcher>()
const watcherEmitter = new EventEmitter()
watcherEmitter.setMaxListeners(100)

function buildFileTree(dirPath: string, depth: number = 0, maxDepth: number = 10): any[] {
  if (depth > maxDepth) return []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const items: any[] = []
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    for (const entry of sorted) {
      if (entry.name.startsWith('.') && entry.name !== '.gitkeep') continue
      if (entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)
      try {
        const stat = fs.statSync(fullPath)
        if (entry.isDirectory()) {
          items.push({
            id: fullPath,
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children: buildFileTree(fullPath, depth + 1, maxDepth)
          })
        } else {
          items.push({
            id: fullPath,
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            size: stat.size,
            mtime: stat.mtimeMs
          })
        }
      } catch {
        items.push({
          id: fullPath,
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          size: 0,
          mtime: 0
        })
      }
    }
    return items
  } catch {
    return []
  }
}

function getFileIcon(name: string): string {
  const ext = path.extname(name).toLowerCase()
  const iconMap: Record<string, string> = {
    '.as': 'code',
    '.mxml': 'code',
    '.xml': 'code',
    '.json': 'code',
    '.js': 'code',
    '.ts': 'code',
    '.css': 'code',
    '.html': 'code',
    '.htm': 'code',
    '.java': 'code',
    '.py': 'code',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.bmp': 'image',
    '.ico': 'image',
    '.swf': 'film',
    '.flv': 'film',
    '.mp3': 'volume',
    '.wav': 'volume',
    '.ogg': 'volume',
    '.mp4': 'video',
    '.avi': 'video',
    '.mkv': 'video',
    '.txt': 'text',
    '.md': 'text',
    '.log': 'text',
    '.pdf': 'text',
    '.zip': 'archive',
    '.rar': 'archive',
    '.7z': 'archive',
    '.tar': 'archive',
    '.gz': 'archive',
  }
  return iconMap[ext] || 'file'
}

export function registerFilesystemIpc() {
  ipcMain.handle('fs:readTree', async (_event, dirPath: string, maxDepth?: number) => {
    return buildFileTree(dirPath, 0, maxDepth ?? 10)
  })

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory()
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf8')
    } catch {
      return null
    }
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content, 'utf8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:deletePath', async (_event, targetPath: string) => {
    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(targetPath)
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:stat', async (_event, targetPath: string) => {
    try {
      const stat = fs.statSync(targetPath)
      return {
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtime: stat.mtimeMs
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('fs:exists', async (_event, targetPath: string) => {
    return fs.existsSync(targetPath)
  })

  ipcMain.handle('fs:icon', async (_event, name: string) => {
    return getFileIcon(name)
  })

  ipcMain.handle('fs:openInExplorer', async (_event, targetPath: string) => {
    const { shell } = require('electron')
    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) {
        shell.openPath(targetPath)
      } else {
        shell.showItemInFolder(targetPath)
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:watch', async (_event, watchId: string, dirPath: string) => {
    if (fileWatchers.has(watchId)) {
      fileWatchers.get(watchId)!.close()
    }
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          watcherEmitter.emit('change', watchId, eventType, filename)
        }
      })
      fileWatchers.set(watchId, watcher)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:unwatch', async (_event, watchId: string) => {
    const watcher = fileWatchers.get(watchId)
    if (watcher) {
      watcher.close()
      fileWatchers.delete(watchId)
      return true
    }
    return false
  })

  ipcMain.handle('fs:copy', async (_event, source: string, dest: string) => {
    try {
      fs.cpSync(source, dest, { recursive: true })
      return true
    } catch {
      return false
    }
  })
}
