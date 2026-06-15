import { create } from 'zustand'
import { createLayoutSlice } from './slices/layout-slice'
import type { LayoutSlice } from './slices/layout-slice'
import { createSwfSlice } from './slices/swf-slice'
import type { SwfSlice } from './slices/swf-slice'
import { createEditorSlice } from './slices/editor-slice'
import type { EditorSlice } from './slices/editor-slice'
import { createTerminalSlice } from './slices/terminal-slice'
import type { TerminalSlice } from './slices/terminal-slice'
import { createNotificationsSlice } from './slices/notifications-slice'
import type { NotificationsSlice } from './slices/notifications-slice'
import { createDebugSlice } from './slices/debug-slice'
import type { DebugSlice } from './slices/debug-slice'
import { createSnippetsSlice } from './slices/snippets-slice'
import type { SnippetsSlice } from './slices/snippets-slice'
import { createUpdateSlice } from './slices/update-slice'
import type { UpdateSlice } from './slices/update-slice'
import { createFileSlice } from './slices/file-slice'
import type { FileSlice } from './slices/file-slice'
import { createGitSlice } from './slices/git-slice'
import type { GitSlice } from './slices/git-slice'

export type ModuleName =
  | 'explorer'
  | 'script-swapper'
  | 'asset-forge'
  | 'panel-studio'
  | 'swf-builder'
  | 'game-data-editor'
  | 'amf-builder'
  | 'text-localizer'
  | 'mission-editor'
  | 'sound-studio'
  | 'code-editor'
  | 'settings'
  | 'dependency'
  | 'simulator'
  | 'about'

export type EditorDiagnostic = {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

export type AppNotification = {
  id: string
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
  timestamp: number
  read: boolean
}

export interface AppState
  extends LayoutSlice,
    SwfSlice,
    EditorSlice,
    TerminalSlice,
    NotificationsSlice,
    DebugSlice,
    SnippetsSlice,
    UpdateSlice,
    FileSlice,
    GitSlice {
  activeModule: ModuleName | null
  setActiveModule: (module: string) => void
}

export const useAppStore = create<AppState>()((...a) => ({
  activeModule: null,
  setActiveModule: (module) => a[0]({ activeModule: module as ModuleName }),

  ...createLayoutSlice(...a),
  ...createSwfSlice(...a),
  ...createEditorSlice(...a),
  ...createTerminalSlice(...a),
  ...createNotificationsSlice(...a),
  ...createDebugSlice(...a),
  ...createSnippetsSlice(...a),
  ...createUpdateSlice(...a),
  ...createFileSlice(...a),
  ...createGitSlice(...a)
}))

useAppStore.getState().loadPersistedState()
