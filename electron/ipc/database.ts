import path from 'path'
import { app, ipcMain } from 'electron'
import fs from 'fs'

let state: Record<string, string> = {}
let statePath: string

function save() {
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to save state:', err)
  }
}

export function initDatabase() {
  const userDataPath = app.getPath('userData')
  fs.mkdirSync(userDataPath, { recursive: true })
  statePath = path.join(userDataPath, 'ninjasage-state.json')
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    }
  } catch {
    state = {}
  }
}

export function registerDatabaseIpc() {
  ipcMain.handle('db:getState', (_event, key: string) => {
    return state[key] ?? null
  })

  ipcMain.handle('db:setState', (_event, key: string, value: string) => {
    state[key] = value
    save()
    return true
  })

  ipcMain.handle('db:getAllState', () => {
    return { ...state }
  })

  ipcMain.handle('db:deleteState', (_event, key: string) => {
    delete state[key]
    save()
    return true
  })
}
