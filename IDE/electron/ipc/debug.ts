import { ipcMain } from 'electron'
import { As3DapAdapter } from '../dap/as3-adapter'
import { BrowserWindow } from 'electron'

function getMainWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
}

let debugAdapter: As3DapAdapter | null = null

export function registerDebugIpc() {
  ipcMain.handle('debug:start', async (event, swfPath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (debugAdapter) {
        debugAdapter.dispose()
      }
      
      debugAdapter = new As3DapAdapter()
      
      debugAdapter.on('event', (dapEvent) => {
        getMainWindow()?.webContents.send('debug:event', dapEvent)
      })
      
      debugAdapter.on('response', (response) => {
        getMainWindow()?.webContents.send('debug:response', response)
      })
      
      await debugAdapter.initialize({ swfPath })
      
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
}
