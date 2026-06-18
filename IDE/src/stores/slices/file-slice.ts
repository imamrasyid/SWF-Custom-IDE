import type { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
  size?: number
  mtime?: number
}

const FILE_WATCHER_ID = 'file-tree-watcher'

let refreshTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh(refreshFn: () => Promise<void>) {
  if (refreshTimeout) clearTimeout(refreshTimeout)
  refreshTimeout = setTimeout(() => {
    refreshFn()
    refreshTimeout = null
  }, 300)
}

export interface FileSlice {
  fileTree: FileTreeNode[]
  fileTreeRoot: string | null
  expandedFolders: Set<string>
  selectedFile: string | null
  fileTreeFilter: string
  isLoadingFileTree: boolean
  setFileTreeRoot: (root: string | null) => void
  loadFileTree: (rootPath: string) => Promise<void>
  refreshFileTree: () => Promise<void>
  setExpandedFolders: (folders: Set<string>) => void
  toggleFolder: (folderPath: string) => void
  setSelectedFile: (filePath: string | null) => void
  setFileTreeFilter: (filter: string) => void
}

export const createFileSlice: StateCreator<AppState, [], [], FileSlice> = (set, get) => ({
  fileTree: [],
  fileTreeRoot: null,
  expandedFolders: new Set<string>(),
  selectedFile: null,
  fileTreeFilter: '',
  isLoadingFileTree: false,

  setFileTreeRoot: (root) => set({ fileTreeRoot: root }),

  loadFileTree: async (rootPath) => {
    set({ isLoadingFileTree: true, fileTreeRoot: rootPath })
    try {
      const tree = await window.electronAPI.fsReadTree(rootPath, 8)
      set({ fileTree: tree, isLoadingFileTree: false })
      const expanded = new Set<string>()
      for (const node of tree) {
        if (node.isDirectory) expanded.add(node.id)
      }
      set({ expandedFolders: expanded })

      await window.electronAPI.watcherStop(FILE_WATCHER_ID)
      await window.electronAPI.watcherStart(FILE_WATCHER_ID, rootPath)
      window.electronAPI.onWatcherChange((_watchId, _type, _path) => {
        scheduleRefresh(get().refreshFileTree)
      })
    } catch {
      set({ fileTree: [], isLoadingFileTree: false })
    }
  },

  refreshFileTree: async () => {
    const root = get().fileTreeRoot
    if (!root) return
    set({ isLoadingFileTree: true })
    try {
      const tree = await window.electronAPI.fsReadTree(root, 8)
      set({ fileTree: tree, isLoadingFileTree: false })
    } catch {
      set({ fileTree: [], isLoadingFileTree: false })
    }
  },

  setExpandedFolders: (folders) => set({ expandedFolders: folders }),

  toggleFolder: (folderPath) => {
    const expanded = new Set(get().expandedFolders)
    if (expanded.has(folderPath)) {
      expanded.delete(folderPath)
    } else {
      expanded.add(folderPath)
    }
    set({ expandedFolders: expanded })
  },

  setSelectedFile: (filePath) => set({ selectedFile: filePath }),

  setFileTreeFilter: (filter) => set({ fileTreeFilter: filter }),
})
