import type { StateCreator } from 'zustand'
import type { AppState, EditorDiagnostic, ModuleName } from '../app-store'

export interface EditorSlice {
  openTabs: { className: string; code: string; originalCode: string; isPinned?: boolean }[]
  rightOpenTabs: { className: string; code: string; originalCode: string; isPinned?: boolean }[]
  editingFile: { className: string; code: string; originalCode: string; isPinned?: boolean } | null
  editingFileRight: { className: string; code: string; originalCode: string; isPinned?: boolean } | null
  isSplitActive: boolean
  focusedEditorGroup: 'left' | 'right'
  editorCursor: { line: number; column: number } | null
  isCommandPaletteOpen: boolean
  commandPaletteMode: 'command' | 'file' | 'line'
  leftEditorInstance: any | null
  rightEditorInstance: any | null
  localHistory: Record<string, { timestamp: number; code: string }[]>
  diffHistoryCode: string | null
  showDiff: boolean
  jumpToLine: { line: number; timestamp: number } | null
  diagnostics: Record<string, EditorDiagnostic[]>
  selectedClassForSwapper: string | null
  selectedAssetForPreview: { id: number; category: string } | null
  closedTabs: { className: string; code: string; originalCode: string }[]

  setSelectedClassForSwapper: (className: string | null) => void
  viewAsset: (id: number, category: string, swfPath?: string) => void
  clearAssetPreview: () => void
  openFileForEditing: (className: string) => Promise<void>
  saveEditingFile: (codeContent: string) => Promise<boolean>
  closeEditingFile: () => void
  selectTab: (className: string) => void
  closeTab: (className: string) => void
  updateTabContent: (className: string, code: string) => void
  setEditorCursor: (cursor: { line: number; column: number } | null) => void
  toggleCommandPalette: (open?: boolean, mode?: 'command' | 'file' | 'line') => void
  setFocusedEditorGroup: (group: 'left' | 'right') => void
  splitEditor: () => void
  closeSplit: () => void
  addLocalHistoryEntry: (className: string, code: string) => void
  selectTabInGroup: (group: 'left' | 'right', className: string) => void
  closeTabInGroup: (group: 'left' | 'right', className: string) => void
  setDiagnostics: (className: string, diagnostics: EditorDiagnostic[]) => void
  clearDiagnostics: (className: string) => void
  clearAllDiagnostics: () => void
  setLeftEditorInstance: (editor: any) => void
  setRightEditorInstance: (editor: any) => void
  insertTextAtCursor: (text: string) => void
  triggerJumpToLine: (line: number) => void
  pinTab: (group: 'left' | 'right', className: string) => void
  unpinTab: (group: 'left' | 'right', className: string) => void
  reorderTabs: (group: 'left' | 'right', fromIndex: number, toIndex: number) => void
  closeOthers: (group: 'left' | 'right', className: string) => void
  closeAllTabsInGroup: (group: 'left' | 'right') => void
  closeSavedTabsInGroup: (group: 'left' | 'right') => void
  setDiffHistoryCode: (code: string | null) => void
  reopenLastClosedTab: () => void
}

function parseCompilerErrors(log: string): EditorDiagnostic[] {
  try {
    const errors: EditorDiagnostic[] = []
    const lines = log.split(/\r?\n/)
    
    const regex1 = /\((\d+)\):(?:\s*col:\s*(\d+))?\s*(Error|Warning):\s*(.+)/i
    const regex2 = /:(\d+):(\d+):\s*(Error|Warning):\s*(.+)/i
    const regex3 = /\[line\s+(\d+)\]\s*(Error|Warning):\s*(.+)/i
    const regex4 = /line\s+(\d+):\s*(.+)/i

    for (const line of lines) {
      let match = line.match(regex1)
      if (match) {
        const lineNum = parseInt(match[1], 10)
        const colNum = match[2] ? parseInt(match[2], 10) : 1
        const severity = match[3].toLowerCase() === 'warning' ? 'warning' : 'error'
        const message = match[4].trim()
        errors.push({ line: lineNum, column: colNum, severity, message })
        continue
      }

      match = line.match(regex2)
      if (match) {
        const lineNum = parseInt(match[1], 10)
        const colNum = parseInt(match[2], 10)
        const severity = match[3].toLowerCase() === 'warning' ? 'warning' : 'error'
        const message = match[4].trim()
        errors.push({ line: lineNum, column: colNum, severity, message })
        continue
      }

      match = line.match(regex3)
      if (match) {
        const lineNum = parseInt(match[1], 10)
        const severity = match[2].toLowerCase() === 'warning' ? 'warning' : 'error'
        const message = match[3].trim()
        errors.push({ line: lineNum, column: 1, severity, message })
        continue
      }

      match = line.match(regex4)
      if (match) {
        const lineNum = parseInt(match[1], 10)
        const message = match[2].trim()
        const severity = message.toLowerCase().includes('warning') ? 'warning' : 'error'
        errors.push({ line: lineNum, column: 1, severity, message })
        continue
      }
    }

    return errors
  } catch (err) {
    console.error('Failed to parse compiler errors:', err)
    return []
  }
}

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (set, get) => ({
  openTabs: [],
  rightOpenTabs: [],
  editingFile: null,
  editingFileRight: null,
  isSplitActive: false,
  focusedEditorGroup: 'left',
  editorCursor: null,
  isCommandPaletteOpen: false,
  commandPaletteMode: 'file',
  leftEditorInstance: null,
  rightEditorInstance: null,
  localHistory: {},
  diffHistoryCode: null,
  showDiff: false,
  jumpToLine: null,
  diagnostics: {},
  selectedClassForSwapper: null,
  selectedAssetForPreview: null,
  closedTabs: [],

  setSelectedClassForSwapper: (className) => set({ selectedClassForSwapper: className }),

  viewAsset: (id, category, path) => set((state) => ({
    selectedAssetForPreview: { id, category },
    activeModule: 'asset-forge' as ModuleName,
    activeAssetSourcePath: path || state.activeAssetSourcePath || state.swfPath
  })),

  clearAssetPreview: () => set({ selectedAssetForPreview: null }),

  openFileForEditing: async (className) => {
    const swfPath = get().swfPath
    if (!swfPath) return

    const isSplit = get().isSplitActive
    const group = get().focusedEditorGroup

    if (isSplit && group === 'right') {
      const existingTab = get().rightOpenTabs.find((t) => t.className === className)
      if (existingTab) {
        set({
          editingFileRight: existingTab,
          activeModule: 'code-editor' as ModuleName
        })
        return
      }

      set({ isLoading: true, loadingStatus: `Mengekspor & membaca kelas ${className}...`, loadingLogs: [] })
      try {
        const code = await window.electronAPI.readScript(swfPath, className)
        const newTab = { className, code, originalCode: code }
        
        set((state) => ({
          rightOpenTabs: [...state.rightOpenTabs, newTab],
          editingFileRight: newTab,
          activeModule: 'code-editor' as ModuleName,
          isLoading: false
        }))
      } catch (err: any) {
        console.error(err)
        set({ isLoading: false })
        throw err
      }
    } else {
      const existingTab = get().openTabs.find((t) => t.className === className)
      if (existingTab) {
        set({
          editingFile: existingTab,
          activeModule: 'code-editor' as ModuleName
        })
        return
      }

      set({ isLoading: true, loadingStatus: `Mengekspor & membaca kelas ${className}...`, loadingLogs: [] })
      try {
        const code = await window.electronAPI.readScript(swfPath, className)
        const newTab = { className, code, originalCode: code }
        
        set((state) => ({
          openTabs: [...state.openTabs, newTab],
          editingFile: newTab,
          activeModule: 'code-editor' as ModuleName,
          isLoading: false
        }))
      } catch (err: any) {
        console.error(err)
        set({ isLoading: false })
        throw err
      }
    }
  },

  saveEditingFile: async (codeContent) => {
    const swfPath = get().swfPath
    const isSplit = get().isSplitActive
    const group = get().focusedEditorGroup
    const editing = (isSplit && group === 'right') ? get().editingFileRight : get().editingFile
    
    if (!swfPath || !editing) return false
    set({ isLoading: true, loadingStatus: `Mengompilasi & menulis kelas ${editing.className}...`, loadingLogs: [] })
    try {
      const success = await window.electronAPI.writeScript(swfPath, editing.className, codeContent)
      if (success) {
        get().clearDiagnostics(editing.className)
        get().addLocalHistoryEntry(editing.className, codeContent)

        set((state) => {
          const updatedTabs = state.openTabs.map((t) =>
            t.className === editing.className
              ? { ...t, code: codeContent, originalCode: codeContent }
              : t
          )
          const updatedEditing = state.editingFile && state.editingFile.className === editing.className
            ? { ...state.editingFile, code: codeContent, originalCode: codeContent }
            : state.editingFile

          const updatedRightTabs = state.rightOpenTabs.map((t) =>
            t.className === editing.className
              ? { ...t, code: codeContent, originalCode: codeContent }
              : t
          )
          const updatedEditingRight = state.editingFileRight && state.editingFileRight.className === editing.className
            ? { ...state.editingFileRight, code: codeContent, originalCode: codeContent }
            : state.editingFileRight

          return {
            openTabs: updatedTabs,
            editingFile: updatedEditing,
            rightOpenTabs: updatedRightTabs,
            editingFileRight: updatedEditingRight,
            isLoading: false
          }
        })
        get().addNotification(`Successfully compiled and saved class ${editing.className.split('.').pop()}`, 'success')
        await get().loadSwf(swfPath, true)
        // Stay on code editor after save — don't let loadSwf switch to explorer
        set({ activeModule: 'code-editor' as ModuleName })
        return true
      }
      set({ isLoading: false })
      return false
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.message || String(err)
      const parsedErrors = parseCompilerErrors(errorMsg)
      
      get().setDiagnostics(editing.className, parsedErrors)

      const logLines = errorMsg.split(/\r?\n/)
      get().addCompilerOutput([
        `[Compiler Error - ${editing.className.split('.').pop()}]`,
        ...logLines,
        ''
      ])

      set({ isBottomPanelOpen: true, bottomPanelTab: 'problems', isLoading: false })
      get().addNotification(`Failed to compile class ${editing.className.split('.').pop()}`, 'error')
      return false
    }
  },

  closeEditingFile: () => {
    set({ editingFile: null, activeModule: 'explorer' as ModuleName })
  },

  selectTab: (className) => {
    const group = get().focusedEditorGroup
    get().selectTabInGroup(group, className)
  },
  
  closeTab: (className) => {
    const group = get().focusedEditorGroup
    get().closeTabInGroup(group, className)
  },

  updateTabContent: (className, code) => {
    set((state) => {
      const updatedTabs = state.openTabs.map((t) =>
        t.className === className ? { ...t, code } : t
      )
      const updatedEditing =
        state.editingFile?.className === className
          ? { ...state.editingFile, code }
          : state.editingFile

      const updatedRightTabs = state.rightOpenTabs.map((t) =>
        t.className === className ? { ...t, code } : t
      )
      const updatedEditingRight =
        state.editingFileRight?.className === className
          ? { ...state.editingFileRight, code }
          : state.editingFileRight

      return {
        openTabs: updatedTabs,
        editingFile: updatedEditing,
        rightOpenTabs: updatedRightTabs,
        editingFileRight: updatedEditingRight
      }
    })
  },

  setEditorCursor: (cursor) => set({ editorCursor: cursor }),
  
  toggleCommandPalette: (open, mode) =>
    set((state) => ({
      isCommandPaletteOpen: open !== undefined ? open : !state.isCommandPaletteOpen,
      commandPaletteMode: mode ?? state.commandPaletteMode
    })),

  setFocusedEditorGroup: (group) => set({ focusedEditorGroup: group }),

  splitEditor: () => {
    const currentFile = get().editingFile
    if (!currentFile) return
    
    const rightTabs = get().rightOpenTabs
    const exists = rightTabs.some((t) => t.className === currentFile.className)
    const newRightTabs = exists ? rightTabs : [...rightTabs, currentFile]
    
    set({
      isSplitActive: true,
      rightOpenTabs: newRightTabs,
      editingFileRight: currentFile,
      focusedEditorGroup: 'right'
    })
  },

  closeSplit: () => {
    set({
      isSplitActive: false,
      rightOpenTabs: [],
      editingFileRight: null,
      focusedEditorGroup: 'left'
    })
  },

  addLocalHistoryEntry: (className, code) => {
    const history = get().localHistory
    const fileHistory = history[className] || []
    const newEntry = { timestamp: Date.now(), code }
    const newFileHistory = [newEntry, ...fileHistory].slice(0, 10)
    set({
      localHistory: {
        ...history,
        [className]: newFileHistory
      }
    })
  },

  setDiffHistoryCode: (code) => set({ diffHistoryCode: code }),

  selectTabInGroup: (group, className) => {
    if (group === 'right') {
      const tab = get().rightOpenTabs.find((t) => t.className === className)
      if (tab) {
        set({ editingFileRight: tab, activeModule: 'code-editor' as ModuleName, focusedEditorGroup: 'right' })
      }
    } else {
      const tab = get().openTabs.find((t) => t.className === className)
      if (tab) {
        set({ editingFile: tab, activeModule: 'code-editor' as ModuleName, focusedEditorGroup: 'left' })
      }
    }
  },

  closeTabInGroup: (group, className) => {
    if (group === 'right') {
      set((state) => {
        const remainingTabs = state.rightOpenTabs.filter((t) => t.className !== className)
        let nextEditingRight = state.editingFileRight
        const closedTab = state.rightOpenTabs.find((t) => t.className === className)
        if (state.editingFileRight?.className === className) {
          nextEditingRight = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : null
        }
        return {
          rightOpenTabs: remainingTabs,
          editingFileRight: nextEditingRight,
          closedTabs: closedTab 
            ? [closedTab, ...state.closedTabs].slice(0, 20) 
            : state.closedTabs
        }
      })
    } else {
      set((state) => {
        const remainingTabs = state.openTabs.filter((t) => t.className !== className)
        let nextEditing = state.editingFile
        let nextActiveModule = state.activeModule
        const closedTab = state.openTabs.find((t) => t.className === className)

        if (state.editingFile?.className === className) {
          if (remainingTabs.length > 0) {
            nextEditing = remainingTabs[remainingTabs.length - 1]
          } else {
            nextEditing = null
            if (!state.isSplitActive || !state.editingFileRight) {
              nextActiveModule = 'explorer' as ModuleName
            }
          }
        }

        return {
          openTabs: remainingTabs,
          editingFile: nextEditing,
          activeModule: nextActiveModule,
          closedTabs: closedTab 
            ? [closedTab, ...state.closedTabs].slice(0, 20) 
            : state.closedTabs
        }
      })
    }
  },

  triggerJumpToLine: (line) => set({ jumpToLine: { line, timestamp: Date.now() } }),

  setDiagnostics: (className, diagnostics) => set((state) => ({
    diagnostics: {
      ...state.diagnostics,
      [className]: diagnostics
    }
  })),

  clearDiagnostics: (className) => set((state) => {
    const updated = { ...state.diagnostics }
    delete updated[className]
    return { diagnostics: updated }
  }),

  clearAllDiagnostics: () => set({ diagnostics: {} }),

  setLeftEditorInstance: (editor) => set({ leftEditorInstance: editor }),
  setRightEditorInstance: (editor) => set({ rightEditorInstance: editor }),

  insertTextAtCursor: (text) => {
    const state = get()
    const group = state.focusedEditorGroup
    const editor = group === 'right' ? state.rightEditorInstance : state.leftEditorInstance
    if (editor) {
      const selection = editor.getSelection()
      if (selection) {
        const range = {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn
        }
        editor.executeEdits('insert-text', [
          {
            range,
            text,
            forceMoveMarkers: true
          }
        ])
        editor.focus()
      }
    }
  },

  pinTab: (group, className) => set((state) => {
    if (group === 'right') {
      const updated = state.rightOpenTabs.map((t) =>
        t.className === className ? { ...t, isPinned: true } : t
      )
      const sorted = [...updated].sort((a, b) => (a.isPinned && !b.isPinned ? -1 : !a.isPinned && b.isPinned ? 1 : 0))
      const nextEditingRight = state.editingFileRight && state.editingFileRight.className === className
        ? { ...state.editingFileRight, isPinned: true }
        : state.editingFileRight
      return { rightOpenTabs: sorted, editingFileRight: nextEditingRight }
    } else {
      const updated = state.openTabs.map((t) =>
        t.className === className ? { ...t, isPinned: true } : t
      )
      const sorted = [...updated].sort((a, b) => (a.isPinned && !b.isPinned ? -1 : !a.isPinned && b.isPinned ? 1 : 0))
      const nextEditing = state.editingFile && state.editingFile.className === className
        ? { ...state.editingFile, isPinned: true }
        : state.editingFile
      return { openTabs: sorted, editingFile: nextEditing }
    }
  }),

  unpinTab: (group, className) => set((state) => {
    if (group === 'right') {
      const updated = state.rightOpenTabs.map((t) =>
        t.className === className ? { ...t, isPinned: false } : t
      )
      const sorted = [...updated].sort((a, b) => (a.isPinned && !b.isPinned ? -1 : !a.isPinned && b.isPinned ? 1 : 0))
      const nextEditingRight = state.editingFileRight && state.editingFileRight.className === className
        ? { ...state.editingFileRight, isPinned: false }
        : state.editingFileRight
      return { rightOpenTabs: sorted, editingFileRight: nextEditingRight }
    } else {
      const updated = state.openTabs.map((t) =>
        t.className === className ? { ...t, isPinned: false } : t
      )
      const sorted = [...updated].sort((a, b) => (a.isPinned && !b.isPinned ? -1 : !a.isPinned && b.isPinned ? 1 : 0))
      const nextEditing = state.editingFile && state.editingFile.className === className
        ? { ...state.editingFile, isPinned: false }
        : state.editingFile
      return { openTabs: sorted, editingFile: nextEditing }
    }
  }),

  reorderTabs: (group, fromIndex, toIndex) => set((state) => {
    if (group === 'right') {
      const updated = [...state.rightOpenTabs]
      const [removed] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, removed)
      return { rightOpenTabs: updated }
    } else {
      const updated = [...state.openTabs]
      const [removed] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, removed)
      return { openTabs: updated }
    }
  }),

  closeOthers: (group, className) => set((state) => {
    if (group === 'right') {
      const remaining = state.rightOpenTabs.filter((t) => t.className === className || t.isPinned)
      let nextEditingRight = state.editingFileRight
      if (state.editingFileRight && !remaining.some(t => t.className === state.editingFileRight?.className)) {
        nextEditingRight = remaining.length > 0 ? remaining[remaining.length - 1] : null
      }
      return { rightOpenTabs: remaining, editingFileRight: nextEditingRight }
    } else {
      const remaining = state.openTabs.filter((t) => t.className === className || t.isPinned)
      let nextEditing = state.editingFile
      let nextActiveModule = state.activeModule
      if (state.editingFile && !remaining.some(t => t.className === state.editingFile?.className)) {
        if (remaining.length > 0) {
          nextEditing = remaining[remaining.length - 1]
        } else {
          nextEditing = null
          if (!state.isSplitActive || !state.editingFileRight) {
            nextActiveModule = 'explorer' as ModuleName
          }
        }
      }
      return { openTabs: remaining, editingFile: nextEditing, activeModule: nextActiveModule }
    }
  }),

  closeAllTabsInGroup: (group) => set((state) => {
    if (group === 'right') {
      const remaining = state.rightOpenTabs.filter((t) => t.isPinned)
      let nextEditingRight = state.editingFileRight
      if (state.editingFileRight && !remaining.some(t => t.className === state.editingFileRight?.className)) {
        nextEditingRight = remaining.length > 0 ? remaining[remaining.length - 1] : null
      }
      return { rightOpenTabs: remaining, editingFileRight: nextEditingRight }
    } else {
      const remaining = state.openTabs.filter((t) => t.isPinned)
      let nextEditing = state.editingFile
      let nextActiveModule = state.activeModule
      if (state.editingFile && !remaining.some(t => t.className === state.editingFile?.className)) {
        if (remaining.length > 0) {
          nextEditing = remaining[remaining.length - 1]
        } else {
          nextEditing = null
          if (!state.isSplitActive || !state.editingFileRight) {
            nextActiveModule = 'explorer' as ModuleName
          }
        }
      }
      return { openTabs: remaining, editingFile: nextEditing, activeModule: nextActiveModule }
    }
  }),

  closeSavedTabsInGroup: (group) => set((state) => {
    if (group === 'right') {
      const remaining = state.rightOpenTabs.filter((t) => t.isPinned || t.code !== t.originalCode)
      let nextEditingRight = state.editingFileRight
      if (state.editingFileRight && !remaining.some(t => t.className === state.editingFileRight?.className)) {
        nextEditingRight = remaining.length > 0 ? remaining[remaining.length - 1] : null
      }
      return { rightOpenTabs: remaining, editingFileRight: nextEditingRight }
    } else {
      const remaining = state.openTabs.filter((t) => t.isPinned || t.code !== t.originalCode)
      let nextEditing = state.editingFile
      let nextActiveModule = state.activeModule
      if (state.editingFile && !remaining.some(t => t.className === state.editingFile?.className)) {
        if (remaining.length > 0) {
          nextEditing = remaining[remaining.length - 1]
        } else {
          nextEditing = null
          if (!state.isSplitActive || !state.editingFileRight) {
            nextActiveModule = 'explorer' as ModuleName
          }
        }
      }
      return { openTabs: remaining, editingFile: nextEditing, activeModule: nextActiveModule }
    }
  }),

  reopenLastClosedTab: () => {
    const { closedTabs, openTabs } = get()
    if (closedTabs.length === 0) return
    
    const [lastClosed, ...remaining] = closedTabs
    // Check if already open
    if (openTabs.some(t => t.className === lastClosed.className)) {
      set({ closedTabs: remaining })
      return
    }
    
    set((state) => ({
      openTabs: [...state.openTabs, lastClosed],
      editingFile: lastClosed,
      activeModule: 'code-editor' as ModuleName,
      closedTabs: remaining
    }))
  }
})
