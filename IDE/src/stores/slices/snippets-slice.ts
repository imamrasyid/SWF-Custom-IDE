import { StateCreator } from 'zustand'
import { AppState } from '../app-store'
import { safeJsonParse } from '../../lib/utils'

export interface CodeSnippet {
  id: string
  name: string
  prefix: string
  body: string
  description: string
  language: string
  isBuiltIn?: boolean
}

export interface SnippetsSlice {
  snippets: CodeSnippet[]
  addSnippet: (snippet: Omit<CodeSnippet, 'id'>) => void
  removeSnippet: (id: string) => void
  updateSnippet: (id: string, updates: Partial<CodeSnippet>) => void
  getSnippetsByLanguage: (language: string) => CodeSnippet[]
  importSnippets: (snippets: CodeSnippet[]) => void
  exportSnippets: () => CodeSnippet[]
}

const DEFAULT_SNIPPETS: CodeSnippet[] = [
  {
    id: 'sn-class',
    name: 'Class Template',
    prefix: 'class',
    body: 'package ${1:package_name} {\n\tpublic class ${2:ClassName} {\n\n\t\tpublic function ${2:ClassName}() {\n\t\t\t${3:// constructor}\n\t\t}\n\t}\n}',
    description: 'Create a new ActionScript 3 class',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-func',
    name: 'Function Template',
    prefix: 'func',
    body: 'public function ${1:methodName}(${2:params}):${3:void} {\n\t${4:// body}\n}',
    description: 'Create a new function',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-for',
    name: 'For Loop',
    prefix: 'for',
    body: 'for (var ${1:i}:int = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3:// body}\n}',
    description: 'Create a for loop',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-foreach',
    name: 'For Each Loop',
    prefix: 'foreach',
    body: 'for each (var ${1:item}:${2:Type} in ${3:collection}) {\n\t${4:// body}\n}',
    description: 'Create a for each loop',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-if',
    name: 'If Statement',
    prefix: 'if',
    body: 'if (${1:condition}) {\n\t${2:// body}\n}',
    description: 'Create an if statement',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-try',
    name: 'Try-Catch',
    prefix: 'try',
    body: 'try {\n\t${1:// code}\n} catch (e:Error) {\n\t${2:// handle error}\n}',
    description: 'Create a try-catch block',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-listener',
    name: 'Event Listener',
    prefix: 'listen',
    body: '${1:target}.addEventListener(${2:Event}.${3:TYPE}, ${4:onEvent});',
    description: 'Add an event listener',
    language: 'actionscript',
    isBuiltIn: true
  },
  {
    id: 'sn-embed',
    name: 'Embed Asset',
    prefix: 'embed',
    body: '[Embed(source="${1:path}", symbol="${2:symbolName}")]\nprivate static var ${3:AssetName}:Class;',
    description: 'Embed an asset',
    language: 'actionscript',
    isBuiltIn: true
  }
]

export const createSnippetsSlice: StateCreator<AppState, [], [], SnippetsSlice> = (set, get) => ({
  snippets: safeJsonParse('wayangide:snippets', DEFAULT_SNIPPETS),

  addSnippet: (snippet) => set((state) => {
    const newSnippet: CodeSnippet = {
      ...snippet,
      id: `sn-${Date.now()}`
    }
    const snippets = [...state.snippets, newSnippet]
    localStorage.setItem('wayangide:snippets', JSON.stringify(snippets))
    return { snippets }
  }),

  removeSnippet: (id) => set((state) => {
    const snippets = state.snippets.filter(s => s.id !== id)
    localStorage.setItem('wayangide:snippets', JSON.stringify(snippets))
    return { snippets }
  }),

  updateSnippet: (id, updates) => set((state) => {
    const snippets = state.snippets.map(s => 
      s.id === id ? { ...s, ...updates } : s
    )
    localStorage.setItem('wayangide:snippets', JSON.stringify(snippets))
    return { snippets }
  }),

  getSnippetsByLanguage: (language) => {
    return get().snippets.filter(s => s.language === language || s.language === '*')
  },

  importSnippets: (snippets) => set((state) => {
    const existing = state.snippets.filter(s => s.isBuiltIn)
    const imported = snippets.filter(s => !existing.some(e => e.id === s.id))
    const allSnippets = [...existing, ...imported]
    localStorage.setItem('wayangide:snippets', JSON.stringify(allSnippets))
    return { snippets: allSnippets }
  }),

  exportSnippets: () => {
    return get().snippets.filter(s => !s.isBuiltIn)
  }
})
