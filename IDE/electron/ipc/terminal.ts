import { ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'

interface TerminalInstance {
  proc: ChildProcess
  id: string
}

const instances: Map<string, TerminalInstance> = new Map()

function getShell(): string {
  const isWin = process.platform === 'win32'
  if (isWin) return 'powershell.exe'
  return process.env.SHELL || 'bash'
}

export function registerTerminalIpc() {
  ipcMain.handle('pty:create', async (event, id: string, cwd?: string) => {
    const existing = instances.get(id)
    if (existing) {
      try { existing.proc.kill() } catch {}
      instances.delete(id)
    }

    const projectCwd = cwd || os.homedir()
    const shell = getShell()

    const proc = spawn(shell, [], {
      cwd: projectCwd,
      env: process.env as NodeJS.ProcessEnv,
      shell: true
    })

    instances.set(id, { proc, id })

    const webContents = event.sender

    proc.stdout?.on('data', (data) => {
      if (!webContents.isDestroyed()) {
        webContents.send('pty:data', id, data.toString())
      }
    })

    proc.stderr?.on('data', (data) => {
      if (!webContents.isDestroyed()) {
        webContents.send('pty:data', id, data.toString())
      }
    })

    proc.on('close', (code) => {
      if (!webContents.isDestroyed()) {
        webContents.send('pty:exit', id, code ?? 0)
      }
      instances.delete(id)
    })

    proc.on('error', (err) => {
      if (!webContents.isDestroyed()) {
        webContents.send('pty:data', id, `\r\n[Terminal error: ${err.message}]\r\n`)
        webContents.send('pty:exit', id, 1)
      }
      instances.delete(id)
    })

    return true
  })

  ipcMain.handle('pty:write', async (_event, id: string, data: string) => {
    const instance = instances.get(id)
    if (instance && instance.proc.stdin) {
      instance.proc.stdin.write(data)
      return true
    }
    return false
  })

  ipcMain.handle('pty:resize', async (_event, _id: string, _cols: number, _rows: number) => {
    return true
  })

  ipcMain.handle('pty:kill', async (_event, id: string) => {
    const instance = instances.get(id)
    if (instance) {
      try { instance.proc.kill() } catch {}
      instances.delete(id)
      return true
    }
    return false
  })
}
