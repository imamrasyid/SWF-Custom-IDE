import type { StateCreator } from 'zustand'
import type { AppState, ModuleName } from '../app-store'

export interface LayoutSlice {
  activityTab: 'explorer' | 'search' | 'builder' | 'settings' | 'source-control'
  isSidebarOpen: boolean
  isBottomPanelOpen: boolean
  bottomPanelTab: 'terminal' | 'problems' | 'logs' | 'debug'
  sidebarWidth: number
  bottomPanelHeight: number
  promptDialog: {
    isOpen: boolean
    title: string
    message: string
    defaultValue: string
    placeholder?: string
    resolve: (value: string | null) => void
  } | null

  setActivityTab: (tab: 'explorer' | 'search' | 'builder' | 'settings' | 'source-control') => void
  toggleSidebar: (open?: boolean) => void
  toggleBottomPanel: (open?: boolean) => void
  setBottomPanelTab: (tab: 'terminal' | 'problems' | 'logs' | 'debug') => void
  setSidebarWidth: (width: number) => void
  setBottomPanelHeight: (height: number) => void
  loadPersistedState: () => Promise<void>
  showPrompt: (title: string, message: string, defaultValue?: string, placeholder?: string) => Promise<string | null>
  closePrompt: (value: string | null) => void
}

export const createLayoutSlice: StateCreator<AppState, [], [], LayoutSlice> = (set, get) => ({
  activityTab: 'explorer',
  isSidebarOpen: true,
  isBottomPanelOpen: false,
  bottomPanelTab: 'terminal',
  sidebarWidth: 288,
  bottomPanelHeight: 240,
  promptDialog: null,

  setActivityTab: (tab) => {
    set({ activityTab: tab, isSidebarOpen: true })
    if (tab === 'builder') {
      set({ activeModule: 'swf-builder' })
    } else if (tab === 'settings') {
      set({ activeModule: 'settings' })
    } else if (tab === 'source-control') {
      set({ activeModule: 'explorer' as ModuleName })
    } else if (tab === 'explorer') {
      const state = get()
      if (state.editingFile) {
        set({ activeModule: 'code-editor' as ModuleName })
      } else {
        set({ activeModule: 'explorer' as ModuleName })
      }
    }
  },

  toggleSidebar: (open) => set((state) => ({ isSidebarOpen: open !== undefined ? open : !state.isSidebarOpen })),
  
  toggleBottomPanel: (open) => set((state) => ({ isBottomPanelOpen: open !== undefined ? open : !state.isBottomPanelOpen })),
  
  setBottomPanelTab: (tab: 'terminal' | 'problems' | 'logs' | 'debug') => set({ bottomPanelTab: tab, isBottomPanelOpen: true }),
  
  setSidebarWidth: (width) => {
    window.electronAPI?.dbSetState('ide:sidebarWidth', String(width))
    set({ sidebarWidth: width })
  },
  
  setBottomPanelHeight: (height) => {
    window.electronAPI?.dbSetState('ide:bottomPanelHeight', String(height))
    set({ bottomPanelHeight: height })
  },

  loadPersistedState: async () => {
    const api = window.electronAPI
    if (!api) return
    const [sidebarWidth, bottomPanelHeight] = await Promise.all([
      api.dbGetState('ide:sidebarWidth'),
      api.dbGetState('ide:bottomPanelHeight')
    ])
    const updates: Partial<LayoutSlice> = {}
    if (sidebarWidth !== null) updates.sidebarWidth = Number(sidebarWidth)
    if (bottomPanelHeight !== null) updates.bottomPanelHeight = Number(bottomPanelHeight)
    if (Object.keys(updates).length > 0) set(updates as any)
  },

  showPrompt: (title, message, defaultValue = '', placeholder = '') => {
    return new Promise<string | null>((resolve) => {
      set({
        promptDialog: {
          isOpen: true,
          title,
          message,
          defaultValue,
          placeholder,
          resolve: (val) => {
            set({ promptDialog: null })
            resolve(val)
          }
        }
      })
    })
  },

  closePrompt: (value) => {
    const dialog = get().promptDialog
    if (dialog) {
      dialog.resolve(value)
    }
  }
})
