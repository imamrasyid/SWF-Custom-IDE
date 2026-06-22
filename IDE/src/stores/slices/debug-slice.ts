import { StateCreator } from 'zustand'
import { AppState } from '../app-store'
import { safeJsonParse } from '../../lib/utils'

export type DebugState = {
  isDebugging: boolean
  isPaused: boolean
  currentFile: string | null
  currentLine: number | null
  breakpoints: { file: string; line: number; id: number; condition?: string }[]
  callStack: { id: number; name: string; file: string; line: number }[]
  variables: { name: string; value: string; type: string }[]
  watchExpressions: string[]
  watchResults: { expression: string; value: string }[]
  debugOutput: string[]
}

export type DebugActions = {
  setDebugging: (isDebugging: boolean) => void
  setPaused: (isPaused: boolean) => void
  setCurrentPosition: (file: string | null, line: number | null) => void
  addBreakpoint: (file: string, line: number, id: number, condition?: string) => void
  removeBreakpoint: (file: string, line: number) => void
  clearBreakpoints: (file?: string) => void
  setCallStack: (frames: { id: number; name: string; file: string; line: number }[]) => void
  setVariables: (variables: { name: string; value: string; type: string }[]) => void
  addWatchExpression: (expression: string) => void
  removeWatchExpression: (expression: string) => void
  setWatchResults: (results: { expression: string; value: string }[]) => void
  addDebugOutput: (line: string) => void
  clearDebugOutput: () => void
}

export type DebugSlice = DebugState & DebugActions

const initialState: DebugState = {
  isDebugging: false,
  isPaused: false,
  currentFile: null,
  currentLine: null,
  breakpoints: safeJsonParse('wayangide:breakpoints', []),
  callStack: [],
  variables: [],
  watchExpressions: safeJsonParse('wayangide:watchExpressions', []),
  watchResults: [],
  debugOutput: []
}

export const createDebugSlice: StateCreator<AppState, [], [], DebugSlice> = (set) => ({
  ...initialState,

  setDebugging: (isDebugging) => set({ isDebugging, isPaused: !isDebugging }),

  setPaused: (isPaused) => set({ isPaused }),

  setCurrentPosition: (file, line) => set({ currentFile: file, currentLine: line }),

  addBreakpoint: (file, line, id, condition) => set((state) => {
    const breakpoints = [...state.breakpoints.filter(b => !(b.file === file && b.line === line)), { file, line, id, condition }]
    localStorage.setItem('wayangide:breakpoints', JSON.stringify(breakpoints))
    return { breakpoints }
  }),

  removeBreakpoint: (file, line) => set((state) => {
    const breakpoints = state.breakpoints.filter(b => !(b.file === file && b.line === line))
    localStorage.setItem('wayangide:breakpoints', JSON.stringify(breakpoints))
    return { breakpoints }
  }),

  clearBreakpoints: (file) => set((state) => {
    const breakpoints = file ? state.breakpoints.filter(b => b.file !== file) : []
    localStorage.setItem('wayangide:breakpoints', JSON.stringify(breakpoints))
    return { breakpoints }
  }),

  setCallStack: (frames) => set({ callStack: frames }),

  setVariables: (variables) => set({ variables }),

  addWatchExpression: (expression) => set((state) => {
    const watchExpressions = [...state.watchExpressions.filter(e => e !== expression), expression]
    localStorage.setItem('wayangide:watchExpressions', JSON.stringify(watchExpressions))
    return { watchExpressions }
  }),

  removeWatchExpression: (expression) => set((state) => {
    const watchExpressions = state.watchExpressions.filter(e => e !== expression)
    localStorage.setItem('wayangide:watchExpressions', JSON.stringify(watchExpressions))
    return { watchExpressions }
  }),

  setWatchResults: (results) => set({ watchResults: results }),

  addDebugOutput: (line) => set((state) => ({
    debugOutput: [...state.debugOutput.slice(-500), line]
  })),

  clearDebugOutput: () => set({ debugOutput: [] })
})
