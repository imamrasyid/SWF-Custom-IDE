import { ipcMain, BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'

const watchers: Map<string, { watcher: FSWatcher; webContents: BrowserWindow['webContents'] }> = new Map()

export function registerWatcherIpc() {
  ipcMain.handle('watcher:start', async (event, watchId: string, dirPath: string, patterns?: string[]) => {
    if (watchers.has(watchId)) {
      watchers.get(watchId)!.watcher.close()
    }
    
    const watchPatterns = patterns || ['**/*']
    const watcher = chokidar.watch(watchPatterns, {
      cwd: dirPath,
      ignored: /(^|[\/\\])node_modules([\/\\]|$)/,
      persistent: true,
      ignoreInitial: true,
      depth: 10
    })
    
    const webContents = event.sender
    
    const emitChange = (type: string, relativePath: string) => {
      if (!webContents.isDestroyed()) {
        webContents.send('watcher:change', watchId, type, relativePath)
      }
    }
    
    watcher.on('add', (p) => emitChange('add', p))
    watcher.on('change', (p) => emitChange('change', p))
    watcher.on('unlink', (p) => emitChange('unlink', p))
    watcher.on('addDir', (p) => { if (p !== '.') emitChange('addDir', p) })
    watcher.on('unlinkDir', (p) => emitChange('unlinkDir', p))
    watcher.on('error', (err) => {
      console.error(`Watcher ${watchId} error:`, err)
    })
    
    watchers.set(watchId, { watcher, webContents })
    return true
  })
  
  ipcMain.handle('watcher:stop', async (_event, watchId: string) => {
    const entry = watchers.get(watchId)
    if (entry) {
      entry.watcher.close()
      watchers.delete(watchId)
      return true
    }
    return false
  })
  
  ipcMain.handle('watcher:stopAll', async () => {
    for (const [id, entry] of watchers) {
      entry.watcher.close()
    }
    watchers.clear()
    return true
  })
}
