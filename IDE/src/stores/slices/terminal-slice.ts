import type { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface TerminalInstance {
  id: string
  name: string
  isActive: boolean
}

export interface TerminalSlice {
  compilerOutput: string[]
  terminals: TerminalInstance[]
  activeTerminalId: string | null
  clearCompilerOutput: () => void
  addCompilerOutput: (lines: string[]) => void
  createTerminal: (name?: string) => string
  closeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void
}

export const createTerminalSlice: StateCreator<AppState, [], [], TerminalSlice> = (set, get) => ({
  compilerOutput: [],
  terminals: [],
  activeTerminalId: null,

  clearCompilerOutput: () => set({ compilerOutput: [] }),
  
  addCompilerOutput: (lines) => set((state) => {
    const MAX_LINES = 1000
    const combined = [...state.compilerOutput, ...lines]
    return {
      compilerOutput: combined.slice(-MAX_LINES)
    }
  }),

  createTerminal: (name) => {
    const id = `terminal-${Date.now()}`
    const terminals = get().terminals
    const terminalName = name || `Terminal ${terminals.length + 1}`
    const newTerminal: TerminalInstance = {
      id,
      name: terminalName,
      isActive: true
    }
    set({
      terminals: [...terminals, newTerminal],
      activeTerminalId: id
    })
    return id
  },

  closeTerminal: (id) => {
    const { terminals, activeTerminalId } = get()
    const filtered = terminals.filter(t => t.id !== id)
    let newActiveId = activeTerminalId
    if (activeTerminalId === id) {
      newActiveId = filtered.length > 0 ? filtered[filtered.length - 1].id : null
    }
    set({ terminals: filtered, activeTerminalId: newActiveId })
  },

  setActiveTerminal: (id) => set({ activeTerminalId: id })
})
