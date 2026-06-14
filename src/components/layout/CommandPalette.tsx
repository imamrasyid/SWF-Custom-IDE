import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '../../stores/app-store'
import { Search, FileCode, Terminal, Command, Code } from 'lucide-react'
import { parseAs3Symbols } from './ExplorerPanel'

export default function CommandPalette() {
  const isCommandPaletteOpen = useAppStore((s) => s.isCommandPaletteOpen)
  const commandPaletteMode = useAppStore((s) => s.commandPaletteMode)
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette)
  const swfData = useAppStore((s) => s.swfData)
  const editingFile = useAppStore((s) => s.editingFile)
  const setActivityTab = useAppStore((s) => s.setActivityTab)
  const snippets = useAppStore((s) => s.snippets)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery(commandPaletteMode === 'line' ? ':' : '')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isCommandPaletteOpen, commandPaletteMode])

  // List of command palette commands
  const commands = useMemo(() => [
    {
      id: 'open-swf',
      name: 'Open SWF File',
      shortcut: 'Ctrl+O',
      icon: FileCode,
      action: async () => {
        const path = await window.electronAPI.openSwf()
        if (path) useAppStore.getState().loadSwf(path)
      }
    },
    {
      id: 'toggle-sidebar',
      name: 'View: Toggle Sidebar Visibility',
      shortcut: 'Ctrl+B',
      icon: Terminal,
      action: () => useAppStore.getState().toggleSidebar()
    },
    {
      id: 'toggle-bottom-panel',
      name: 'View: Toggle Bottom Panel (Output)',
      shortcut: 'Ctrl+`',
      icon: Terminal,
      action: () => useAppStore.getState().toggleBottomPanel()
    },
    {
      id: 'close-editor',
      name: 'File: Close Active Editor Tab',
      shortcut: 'Ctrl+W',
      icon: Terminal,
      action: () => {
        if (editingFile) useAppStore.getState().closeTab(editingFile.className)
      }
    },
    {
      id: 'clear-logs',
      name: 'Developer: Clear Compiler Output Logs',
      shortcut: '',
      icon: Terminal,
      action: () => useAppStore.getState().clearCompilerOutput()
    },
    {
      id: 'go-explorer',
      name: 'Navigation: Go to Explorer Panel',
      shortcut: 'Ctrl+Shift+E',
      icon: Command,
      action: () => setActivityTab('explorer')
    },
    {
      id: 'go-builder',
      name: 'Navigation: Go to SWF Builder Module',
      shortcut: 'Ctrl+Shift+B',
      icon: Command,
      action: () => setActivityTab('builder')
    },
    {
      id: 'go-settings',
      name: 'Navigation: Go to IDE Preferences Settings',
      shortcut: 'Ctrl+,',
      icon: Command,
      action: () => setActivityTab('settings')
    },
    {
      id: 'close-swf',
      name: 'File: Close Current SWF Workspace',
      shortcut: '',
      icon: FileCode,
      action: () => useAppStore.getState().closeSwf()
    },
    // Snippet commands
    ...snippets.map(snippet => ({
      id: `snippet-${snippet.id}`,
      name: `Snippet: ${snippet.name}`,
      shortcut: snippet.prefix,
      icon: Code,
      action: () => {
        useAppStore.getState().insertTextAtCursor(snippet.body)
        toggleCommandPalette(false)
      }
    }))
  ], [editingFile, setActivityTab, snippets, toggleCommandPalette])

  // Filter lists based on input query
  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    
    // Check if line jump mode
    if (commandPaletteMode === 'line' || term.startsWith(':')) {
      const targetStr = term.startsWith(':') ? term.slice(1) : term
      const lineNum = parseInt(targetStr, 10)
      if (!isNaN(lineNum)) {
        return [
          {
            id: 'goto-line',
            name: `Go to line ${lineNum}`,
            packageName: `Jump to line ${lineNum} in active file`,
            fullName: `goto-line-${lineNum}`,
            icon: FileCode,
            action: () => {
              useAppStore.getState().triggerJumpToLine(lineNum)
            }
          }
        ]
      } else {
        return [
          {
            id: 'goto-line-placeholder',
            name: 'Go to line...',
            packageName: 'Type a line number to jump to',
            fullName: 'goto-line-placeholder',
            icon: FileCode,
            action: () => {}
          }
        ]
      }
    }

    // Check if symbol jump mode
    if (term.startsWith('@')) {
      if (!editingFile || !editingFile.code) {
        return [
          {
            id: 'no-active-file',
            name: 'No active class file',
            packageName: 'Open a class file to see symbols',
            fullName: 'no-active-file',
            icon: FileCode,
            action: () => {}
          }
        ]
      }
      
      const symbolTerm = term.slice(1).toLowerCase()
      const symbols = parseAs3Symbols(editingFile.code)
      
      const filteredSymbols = symbols.filter(sym => 
        sym.name.toLowerCase().includes(symbolTerm)
      )

      if (filteredSymbols.length === 0) {
        return [
          {
            id: 'no-symbols-found',
            name: 'No symbols match search',
            packageName: 'Try searching for other classes or functions',
            fullName: 'no-symbols-found',
            icon: FileCode,
            action: () => {}
          }
        ]
      }

      return filteredSymbols.map(sym => ({
        id: `symbol-${sym.name}-${sym.line}`,
        name: sym.name,
        packageName: `${sym.modifier} ${sym.isStatic ? 'static ' : ''}${sym.type} (Line ${sym.line})`,
        fullName: `${sym.type}-${sym.name}`,
        icon: FileCode,
        action: () => {
          useAppStore.getState().triggerJumpToLine(sym.line)
        }
      }))
    }

    if (commandPaletteMode === 'command') {
      return commands.filter(cmd => 
        cmd.name.toLowerCase().includes(term)
      )
    } else {
      // File mode
      if (!swfData || !swfData.classes) return []
      
      const fileItems = swfData.classes.map(cls => ({
        id: cls.fullName,
        name: cls.name + '.as',
        packageName: cls.packageName,
        fullName: cls.fullName,
        icon: FileCode,
        action: () => {
          useAppStore.getState().openFileForEditing(cls.fullName)
        }
      }))

      if (!term) return fileItems.slice(0, 100) // Limit default list
      
      return fileItems
        .filter(item => item.fullName.toLowerCase().includes(term))
        .slice(0, 100)
    }
  }, [query, commandPaletteMode, commands, swfData, editingFile])

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Auto-scroll selected element into view inside container
  useEffect(() => {
    if (resultsContainerRef.current) {
      const container = resultsContainerRef.current
      const selectedElement = container.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        const containerTop = container.scrollTop
        const containerBottom = containerTop + container.clientHeight
        const elemTop = selectedElement.offsetTop
        const elemBottom = elemTop + selectedElement.clientHeight

        if (elemTop < containerTop) {
          container.scrollTop = elemTop
        } else if (elemBottom > containerBottom) {
          container.scrollTop = elemBottom - container.clientHeight
        }
      }
    }
  }, [selectedIndex])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action()
        toggleCommandPalette(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      toggleCommandPalette(false)
    }
  }

  if (!isCommandPaletteOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center pt-24 z-[9999]"
      onClick={() => toggleCommandPalette(false)}
    >
      <div 
        className="w-full max-w-xl bg-[#0f1422] border border-slate-800/80 rounded-lg shadow-2xl flex flex-col max-h-[360px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Area */}
        <div className="flex items-center px-3.5 py-3 border-b border-slate-900/80 bg-slate-950/20 shrink-0">
          {commandPaletteMode === 'command' ? (
            <span className="text-xs text-indigo-400 font-bold font-mono mr-2 select-none">&gt;</span>
          ) : commandPaletteMode === 'line' || query.trim().startsWith(':') ? (
            <span className="text-xs text-indigo-400 font-bold font-mono mr-2 select-none">:</span>
          ) : (
            <Search size={14} className="text-slate-500 mr-2.5 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={
              commandPaletteMode === 'command' 
                ? 'Type a command to run...' 
                : commandPaletteMode === 'line' || query.trim().startsWith(':')
                ? 'Type a line number to jump to...'
                : query.trim().startsWith('@')
                ? 'Search symbols in current file...'
                : 'Search classes by name... (Type @ for symbols, : for line)'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-0 outline-none text-xs text-slate-200 placeholder-slate-600 font-sans"
          />
          <span className="text-[9px] bg-slate-900/60 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono select-none uppercase">
            {commandPaletteMode}
          </span>
        </div>

        {/* Results List Area */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto py-1.5 divide-y divide-slate-900/10 custom-scrollbar"
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action()
                    toggleCommandPalette(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-600/20 text-indigo-200 border-l-2 border-indigo-500 pl-3.5' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={13} className={isSelected ? 'text-indigo-400' : 'text-slate-600'} />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[11px] font-semibold ${isSelected ? 'text-indigo-200' : 'text-slate-300'}`}>
                        {item.name}
                      </span>
                      {'packageName' in item && item.packageName && (
                        <span className="text-[9px] text-slate-600 truncate font-mono mt-0.5">
                          {item.packageName}
                        </span>
                      )}
                    </div>
                  </div>
                  {'shortcut' in item && item.shortcut && (
                    <span className="text-[9px] text-slate-500 font-mono tracking-wider">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-center py-8 text-slate-600 text-xs italic select-none">
              No matching items found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
