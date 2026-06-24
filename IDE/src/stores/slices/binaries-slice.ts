import { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export type DownloadStatusType = 'downloading' | 'verifying' | 'extracting' | 'completed' | 'error' | 'idle'

export interface BinariesSlice {
  binariesStatus: {
    jre: { installed: boolean; path: string }
    ffdec: { installed: boolean; path: string }
    flexSdk: { installed: boolean; path: string }
  }
  binariesLoading: boolean
  hasMissingBinaries: boolean
  diskSpaceCheck: {
    freeBytes: number
    hasEnoughSpace: boolean
  }
  downloadState: {
    file: string
    percent: number
    downloadedBytes: number
    totalBytes: number
    speed: string
    status: DownloadStatusType
    error?: string
  }

  checkBinariesStatus: () => Promise<boolean>
  checkDiskSpace: () => Promise<boolean>
  startBinariesDownload: () => Promise<boolean>
  cancelBinariesDownload: () => Promise<void>
  selectLocalPath: (type: 'jre' | 'ffdec' | 'flexSdk') => Promise<void>
}

const DEFAULT_STATUS = {
  jre: { installed: false, path: '' },
  ffdec: { installed: false, path: '' },
  flexSdk: { installed: false, path: '' }
}

export const createBinariesSlice: StateCreator<AppState, [], [], BinariesSlice> = (set, get) => ({
  binariesStatus: { ...DEFAULT_STATUS },
  binariesLoading: true,
  hasMissingBinaries: false,
  diskSpaceCheck: { freeBytes: 0, hasEnoughSpace: true },
  downloadState: {
    file: '',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: '0 B/s',
    status: 'idle'
  },

  checkBinariesStatus: async () => {
    set({ binariesLoading: true })
    try {
      const status = await window.electronAPI.getBinaryStatus()
      const hasMissing = !status.jre.installed || !status.ffdec.installed || !status.flexSdk.installed
      set({
        binariesStatus: status,
        hasMissingBinaries: hasMissing,
        binariesLoading: false
      })
      return hasMissing
    } catch (err) {
      console.error('Failed to get binaries status:', err)
      set({ binariesLoading: false, hasMissingBinaries: true })
      return true
    }
  },

  checkDiskSpace: async () => {
    try {
      const result = await window.electronAPI.checkDiskSpace()
      set({ diskSpaceCheck: result })
      return result.hasEnoughSpace
    } catch {
      return true
    }
  },

  startBinariesDownload: async () => {
    set((state) => ({
      downloadState: {
        ...state.downloadState,
        status: 'downloading',
        error: undefined
      }
    }))

    // Listen to download progress
    const unsubscribe = window.electronAPI.onDownloaderProgress((data) => {
      set({
        downloadState: {
          file: data.file,
          percent: data.percent,
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes,
          speed: data.speed,
          status: data.status as DownloadStatusType,
          error: data.error
        }
      })
    })

    try {
      const success = await window.electronAPI.downloadBinaries()
      unsubscribe()
      
      // Recheck status
      await get().checkBinariesStatus()
      return success
    } catch (err: any) {
      unsubscribe()
      set((state) => ({
        downloadState: {
          ...state.downloadState,
          status: 'error',
          error: err.message || String(err)
        }
      }))
      return false
    }
  },

  cancelBinariesDownload: async () => {
    try {
      await window.electronAPI.cancelBinariesDownload()
      set((state) => ({
        downloadState: {
          ...state.downloadState,
          status: 'idle',
          speed: '0 B/s'
        }
      }))
    } catch (err) {
      console.error('Failed to cancel download:', err)
    }
  },

  selectLocalPath: async (type) => {
    try {
      const status = await window.electronAPI.selectLocalBinary(type)
      if (status) {
        const hasMissing = !status.jre.installed || !status.ffdec.installed || !status.flexSdk.installed
        set({
          binariesStatus: status,
          hasMissingBinaries: hasMissing
        })
      }
    } catch (err) {
      console.error('Failed to select manual path:', err)
    }
  }
})
