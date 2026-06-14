import type { StateCreator } from 'zustand'
import type { AppState, ModuleName } from '../app-store'

export interface LayoutSlice {
  activityTab: 'explorer' | 'search' | 'builder' | 'settings'
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

  setActivityTab: (tab: 'explorer' | 'search' | 'builder' | 'settings') => void
  toggleSidebar: (open?: boolean) => void
  toggleBottomPanel: (open?: boolean) => void
  setBottomPanelTab: (tab: 'terminal' | 'problems' | 'logs' | 'debug') => void
  setSidebarWidth: (width: number) => void
  setBottomPanelHeight: (height: number) => void
  showPrompt: (title: string, message: string, defaultValue?: string, placeholder?: string) => Promise<string | null>
  closePrompt: (value: string | null) => void
}

export const createLayoutSlice: StateCreator<AppState, [], [], LayoutSlice> = (set, get) => ({
  activityTab: 'explorer',
  isSidebarOpen: true,
  isBottomPanelOpen: false,
  bottomPanelTab: 'terminal',
  sidebarWidth: Number(localStorage.getItem('ide:sidebarWidth') || '288'),
  bottomPanelHeight: Number(localStorage.getItem('ide:bottomPanelHeight') || '240'),
  promptDialog: null,

  setActivityTab: (tab) => {
    set({ activityTab: tab, isSidebarOpen: true })
    if (tab === 'builder') {
      set({ activeModule: 'swf-builder' })
    } else if (tab === 'settings') {
      set({ activeModule: 'settings' })
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
    localStorage.setItem('ide:sidebarWidth', String(width))
    set({ sidebarWidth: width })
  },
  
  setBottomPanelHeight: (height) => {
    localStorage.setItem('ide:bottomPanelHeight', String(height))
    set({ bottomPanelHeight: height })
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
