import type { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface UpdateInfo {
  version: string
  releaseNotes: string | ReleaseNoteInfo[]
  releaseName: string
  releaseDate: string
  files?: { name: string; size: number; url: string }[]
}

export interface ReleaseNoteInfo {
  version: string
  note: string | null
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'

export interface UpdateSlice {
  currentVersion: string
  updateStatus: UpdateStatus
  updateInfo: UpdateInfo | null
  updateProgress: UpdateProgress | null
  updateError: string | null
  showUpdateBanner: boolean

  setCurrentVersion: (version: string) => void
  setUpdateStatus: (status: UpdateStatus) => void
  setUpdateInfo: (info: UpdateInfo | null) => void
  setUpdateProgress: (progress: UpdateProgress | null) => void
  setUpdateError: (error: string | null) => void
  setShowUpdateBanner: (show: boolean) => void

  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void
}

export const createUpdateSlice: StateCreator<AppState, [], [], UpdateSlice> = (set, get) => ({
  currentVersion: '',
  updateStatus: 'idle',
  updateInfo: null,
  updateProgress: null,
  updateError: null,
  showUpdateBanner: false,

  setCurrentVersion: (version) => set({ currentVersion: version }),
  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),
  setUpdateError: (error) => set({ updateError: error }),
  setShowUpdateBanner: (show) => set({ showUpdateBanner: show }),

  checkForUpdates: async () => {
    set({ updateStatus: 'checking', updateError: null })
    try {
      await window.electronAPI.checkForUpdates()
    } catch (err: any) {
      set({ updateStatus: 'error', updateError: err.message || 'Failed to check for updates' })
    }
  },

  downloadUpdate: async () => {
    set({ updateStatus: 'downloading', updateProgress: null })
    try {
      await window.electronAPI.downloadUpdate()
    } catch (err: any) {
      set({ updateStatus: 'error', updateError: err.message || 'Failed to download update' })
    }
  },

  installUpdate: () => {
    window.electronAPI.installUpdate()
  }
})
