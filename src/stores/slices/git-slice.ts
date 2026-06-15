import type { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface GitSlice {
  gitBranch: string | null
  gitStaged: string[]
  gitModified: string[]
  gitDeleted: string[]
  gitUntracked: string[]
  gitAhead: number
  gitBehind: number
  gitIsRepo: boolean
  gitLog: { hash: string; message: string; author: string; date: string }[]
  gitDiff: Record<string, string>
  isGitLoading: boolean
  refreshGitStatus: () => Promise<void>
  refreshGitLog: () => Promise<void>
  gitAdd: (files: string[]) => Promise<void>
  gitUnstage: (files: string[]) => Promise<void>
  gitCommit: (message: string) => Promise<void>
  gitCheckout: (branch: string) => Promise<void>
  gitPush: () => Promise<void>
  gitPull: () => Promise<void>
  gitCreateBranch: (name: string) => Promise<void>
}

export const createGitSlice: StateCreator<AppState, [], [], GitSlice> = (set, get) => ({
  gitBranch: null,
  gitStaged: [],
  gitModified: [],
  gitDeleted: [],
  gitUntracked: [],
  gitAhead: 0,
  gitBehind: 0,
  gitIsRepo: false,
  gitLog: [],
  gitDiff: {},
  isGitLoading: false,

  refreshGitStatus: async () => {
    const root = get().projectRoot
    if (!root) return
    set({ isGitLoading: true })
    try {
      const status = await window.electronAPI.gitStatus(root)
      set({
        gitBranch: status.branch,
        gitStaged: status.staged,
        gitModified: status.modified,
        gitDeleted: status.deleted,
        gitUntracked: status.untracked,
        gitAhead: status.ahead,
        gitBehind: status.behind,
        gitIsRepo: status.isRepo,
        isGitLoading: false
      })
    } catch {
      set({ isGitLoading: false })
    }
  },

  refreshGitLog: async () => {
    const root = get().projectRoot
    if (!root) return
    try {
      const log = await window.electronAPI.gitLog(root)
      set({ gitLog: log })
    } catch {
      set({ gitLog: [] })
    }
  },

  gitAdd: async (files) => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitAdd(root, files)
    await get().refreshGitStatus()
  },

  gitUnstage: async (files) => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitUnstage(root, files)
    await get().refreshGitStatus()
  },

  gitCommit: async (message) => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitCommit(root, message)
    await get().refreshGitStatus()
    await get().refreshGitLog()
  },

  gitCheckout: async (branch) => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitCheckout(root, branch)
    await get().refreshGitStatus()
    await get().refreshGitLog()
  },

  gitPush: async () => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitPush(root)
    await get().refreshGitStatus()
  },

  gitPull: async () => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitPull(root)
    await get().refreshGitStatus()
    await get().refreshGitLog()
  },

  gitCreateBranch: async (name) => {
    const root = get().projectRoot
    if (!root) return
    await window.electronAPI.gitCreateBranch(root, name)
    await get().refreshGitStatus()
  }
})
