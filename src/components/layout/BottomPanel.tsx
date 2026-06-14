import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal, AlertTriangle, Trash2, X, Bug, Plus } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import DebugPanel from './DebugPanel'

export default function BottomPanel() {
  const isBottomPanelOpen = useAppStore((s) => s.isBottomPanelOpen)
  const bottomPanelTab = useAppStore((s) => s.bottomPanelTab)
  const compilerOutput = useAppStore((s) => s.compilerOutput)
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel)
  const setBottomPanelTab = useAppStore((s) => s.setBottomPanelTab)
  const clearCompilerOutput = useAppStore((s) => s.clearCompilerOutput)
  const bottomPanelHeight = useAppStore((s) => s.bottomPanelHeight)
  const setBottomPanelHeight = useAppStore((s) => s.setBottomPanelHeight)
  const projectRoot = useAppStore((s) => s.projectRoot)
  
  const terminals = useAppStore((s) => s.terminals)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const createTerminalStore = useAppStore((s) => s.createTerminal)
  const closeTerminal = useAppStore((s) => s.closeTerminal)
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal)
  
  const [filterText, setFilterText] = useState('')
  const terminalEndRef = useRef<HTMLDivElement>(null)

  const [terminalInputs, setTerminalInputs] = useState<Record<string, string>>({})
  const [commandHistories, setCommandHistories] = useState<Record<string, string[]>>({})
  const [historyIndices, setHistoryIndices] = useState<Record<string, number>>({})
  const interactiveTerminalEndRef = useRef<HTMLDivElement>(null)
  const terminalInputRef = useRef<HTMLInputElement>(null)

  const backendCreatedRef = useRef<Set<string>>(new Set())

  const createBackendTerminal = useCallback((id: string) => {
    if (backendCreatedRef.current.has(id)) return
    backendCreatedRef.current.add(id)
    window.electronAPI.createTerminal(id, projectRoot || undefined).catch(() => {
      backendCreatedRef.current.delete(id)
    })
  }, [projectRoot])

  useEffect(() => {
    if (terminals.length === 0) {
      const id = createTerminalStore('Terminal 1')
      createBackendTerminal(id)
    }
  }, [])

  useEffect(() => {
    return () => {
      backendCreatedRef.current.forEach((id) => {
        window.electronAPI.destroyTerminal(id).catch(() => {})
      })
      backendCreatedRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (isBottomPanelOpen && bottomPanelTab === 'terminal') {
      const unsubscribe = window.electronAPI.onTerminalData((id, data) => {
        useAppStore.getState().addTerminalLine(id, data)
      })

      return () => {
        unsubscribe()
      }
    }
  }, [isBottomPanelOpen, bottomPanelTab])

  useEffect(() => {
    if (activeTerminalId && bottomPanelTab === 'terminal' && isBottomPanelOpen) {
      createBackendTerminal(activeTerminalId)
    }
  }, [activeTerminalId, bottomPanelTab, isBottomPanelOpen, createBackendTerminal])

  useEffect(() => {
    if (interactiveTerminalEndRef.current) {
      interactiveTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminals, bottomPanelTab, activeTerminalId])

  useEffect(() => {
    if (isBottomPanelOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [compilerOutput, isBottomPanelOpen, bottomPanelTab])

  const activeTerminal = terminals.find(t => t.id === activeTerminalId)
  const activeLines = activeTerminal?.lines || []
  const activeInput = terminalInputs[activeTerminalId || ''] || ''

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = activeInput
      if (activeTerminalId) {
        window.electronAPI.writeTerminal(activeTerminalId, cmd + '\n')
        if (cmd.trim()) {
          setCommandHistories(prev => ({
            ...prev,
            [activeTerminalId]: [...(prev[activeTerminalId] || []), cmd.trim()]
          }))
        }
      }
      setHistoryIndices(prev => ({ ...prev, [activeTerminalId || '']: -1 }))
      setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: '' }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const history = commandHistories[activeTerminalId || ''] || []
      if (history.length > 0) {
        const currentIndex = historyIndices[activeTerminalId || ''] ?? -1
        const nextIndex = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1)
        setHistoryIndices(prev => ({ ...prev, [activeTerminalId || '']: nextIndex }))
        setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: history[nextIndex] }))
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const history = commandHistories[activeTerminalId || ''] || []
      const currentIndex = historyIndices[activeTerminalId || ''] ?? -1
      if (currentIndex !== -1) {
        const nextIndex = currentIndex + 1
        if (nextIndex >= history.length) {
          setHistoryIndices(prev => ({ ...prev, [activeTerminalId || '']: -1 }))
          setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: '' }))
        } else {
          setHistoryIndices(prev => ({ ...prev, [activeTerminalId || '']: nextIndex }))
          setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: history[nextIndex] }))
        }
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      if (activeTerminalId) {
        window.electronAPI.writeTerminal(activeTerminalId, '\x03')
      }
      setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: '' }))
    }
  }

  const handleNewTerminal = () => {
    const id = createTerminalStore()
    createBackendTerminal(id)
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.destroyTerminal(id).catch(() => {})
    backendCreatedRef.current.delete(id)
    closeTerminal(id)
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = bottomPanelHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY
      const newHeight = Math.max(120, Math.min(600, startHeight + deltaY))
      setBottomPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const diagnostics = useAppStore((s) => s.diagnostics)
  const selectTab = useAppStore((s) => s.selectTab)
  const triggerJumpToLine = useAppStore((s) => s.triggerJumpToLine)

  if (!isBottomPanelOpen) return null

  const filteredLogs = compilerOutput.filter(line => 
    line.toLowerCase().includes(filterText.toLowerCase())
  )

  const allDiagnostics = Object.values(diagnostics).flat()
  const errorCount = allDiagnostics.filter(d => d.severity === 'error').length
  const warningCount = allDiagnostics.filter(d => d.severity === 'warning').length
  const totalProblems = errorCount + warningCount
  
  const promptDir = projectRoot ? projectRoot.split(/[\\/]/).pop() : 'NinjaSage'

  return (
    <div className="ide-bottom-panel relative flex flex-col" style={{ height: `${bottomPanelHeight}px` }}>
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-all z-[999] select-none"
        onMouseDown={handleResizeStart}
      />
      <div className="h-9 bg-[#090d16] border-b border-slate-900/60 px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setBottomPanelTab('terminal')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-slate-100 cursor-pointer ${
              bottomPanelTab === 'terminal' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400'
            }`}
          >
            <Terminal size={14} />
            Terminal
          </button>

          <button
            onClick={() => setBottomPanelTab('logs')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-slate-100 cursor-pointer ${
              bottomPanelTab === 'logs' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400'
            }`}
          >
            <Terminal size={14} />
            Output Logs
          </button>

          <button
            onClick={() => setBottomPanelTab('problems')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-slate-100 cursor-pointer ${
              bottomPanelTab === 'problems' ? 'text-slate-200 border-b-2 border-indigo-500' : 'text-slate-400'
            }`}
          >
            <AlertTriangle size={14} className={totalProblems > 0 ? (errorCount > 0 ? 'text-red-400' : 'text-amber-400') : ''} />
            <span>Problems</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 rounded-full text-[9px] font-bold">
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-bold">
                {warningCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setBottomPanelTab('debug')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-slate-100 cursor-pointer ${
              bottomPanelTab === 'debug' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-slate-400'
            }`}
          >
            <Bug size={14} />
            Debug Console
          </button>
        </div>

        <div className="flex items-center gap-3">
          {bottomPanelTab === 'logs' && (
            <>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter logs..."
                className="px-2 py-0.5 bg-slate-950/80 border border-slate-900 rounded text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={clearCompilerOutput}
                title="Clear Logs"
                className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}

          {bottomPanelTab === 'terminal' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewTerminal}
                title="New Terminal"
                className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => {
                  if (activeTerminalId) {
                    useAppStore.getState().clearTerminal(activeTerminalId)
                  }
                }}
                title="Clear Terminal Screen"
                className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}

          <button
            onClick={() => toggleBottomPanel(false)}
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-3.5 bg-[#060a11] font-mono text-[11px] leading-relaxed text-slate-300 selection:bg-indigo-600/30 flex flex-col min-h-0"
        onClick={() => {
          if (bottomPanelTab === 'terminal') {
            terminalInputRef.current?.focus()
          }
        }}
      >
        {bottomPanelTab === 'terminal' ? (
          <div className="flex-1 flex flex-col min-h-0">
            {terminals.length > 1 && (
              <div className="flex items-center gap-1 border-b border-slate-900/60 pb-1 mb-2 shrink-0">
                {terminals.map((term) => (
                  <div
                    key={term.id}
                    className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${
                      term.id === activeTerminalId 
                        ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
                    }`}
                    onClick={() => setActiveTerminal(term.id)}
                  >
                    <Terminal size={10} />
                    <span>{term.name}</span>
                    {term.lines.length > 0 && (
                      <span className="text-[8px] text-slate-600">({term.lines.length})</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTerminal(term.id)
                      }}
                      className="ml-1 text-slate-600 hover:text-red-400"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto whitespace-pre-wrap select-text pr-2 custom-scrollbar font-mono text-[11px] leading-relaxed text-slate-350">
              {activeLines.join('')}
              <div ref={interactiveTerminalEndRef} />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-400 border-t border-slate-900/60 pt-2 shrink-0">
              <span className="select-none font-bold">PS {promptDir}&gt;</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={activeInput}
                onChange={(e) => setTerminalInputs(prev => ({ ...prev, [activeTerminalId || '']: e.target.value }))}
                onKeyDown={handleTerminalKeyDown}
                className="flex-1 bg-transparent text-slate-100 outline-none border-none p-0 font-mono text-[11px]"
                placeholder="Type command here..."
                autoFocus
              />
            </div>
          </div>
        ) : bottomPanelTab === 'logs' ? (
          <div className="flex flex-col gap-1 min-w-0">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((line, idx) => {
                const isError = line.toLowerCase().includes('error:') || line.toLowerCase().includes('failed')
                const isWarning = line.toLowerCase().includes('warning:')
                let colorClass = 'text-slate-300'
                if (isError) colorClass = 'text-rose-400 font-semibold'
                else if (isWarning) colorClass = 'text-amber-400'
                else if (line.startsWith('[Compiler]')) colorClass = 'text-indigo-400'
                else if (line.startsWith('[Success]')) colorClass = 'text-emerald-400 font-semibold'

                return (
                  <div key={idx} className={`whitespace-pre-wrap truncate ${colorClass}`}>
                    {line}
                  </div>
                )
              })
            ) : (
              <span className="text-slate-600 italic">No output logged yet. Run compiler or exporter to see output.</span>
            )}
            <div ref={terminalEndRef} />
          </div>
        ) : bottomPanelTab === 'debug' ? (
          <DebugPanel />
        ) : (
          <div className="flex flex-col gap-1.5 font-sans">
            {totalProblems > 0 ? (
              <>
                {errorCount > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1 px-1">
                      <AlertTriangle size={10} />
                      Errors ({errorCount})
                    </div>
                    {Object.entries(diagnostics).flatMap(([className, list]) => 
                      list.filter(d => d.severity === 'error').map((d, idx) => (
                        <div 
                          key={`error-${className}-${idx}`} 
                          onClick={() => {
                            selectTab(className)
                            triggerJumpToLine(d.line)
                          }}
                          className="flex gap-2 items-start hover:bg-slate-900/60 p-1.5 rounded cursor-pointer border border-transparent hover:border-slate-800/50 transition-all group text-rose-400"
                        >
                          <span className="font-bold shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide text-red-500 bg-red-950/40">
                            error
                          </span>
                          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-1 min-w-0">
                            <span className="text-xs text-slate-300 group-hover:text-slate-100 truncate">{d.message}</span>
                            <div className="flex gap-1.5 text-[10px] text-slate-500 font-mono shrink-0 select-none">
                              <span className="text-indigo-400">{className.split('.').pop()}.as</span>
                              <span>[Line {d.line}, Col {d.column}]</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {warningCount > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 px-1">
                      <AlertTriangle size={10} />
                      Warnings ({warningCount})
                    </div>
                    {Object.entries(diagnostics).flatMap(([className, list]) => 
                      list.filter(d => d.severity === 'warning').map((d, idx) => (
                        <div 
                          key={`warning-${className}-${idx}`} 
                          onClick={() => {
                            selectTab(className)
                            triggerJumpToLine(d.line)
                          }}
                          className="flex gap-2 items-start hover:bg-slate-900/60 p-1.5 rounded cursor-pointer border border-transparent hover:border-slate-800/50 transition-all group text-amber-400"
                        >
                          <span className="font-bold shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide text-amber-500 bg-amber-950/40">
                            warning
                          </span>
                          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-1 min-w-0">
                            <span className="text-xs text-slate-300 group-hover:text-slate-100 truncate">{d.message}</span>
                            <div className="flex gap-1.5 text-[10px] text-slate-500 font-mono shrink-0 select-none">
                              <span className="text-indigo-400">{className.split('.').pop()}.as</span>
                              <span>[Line {d.line}, Col {d.column}]</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : (
              <span className="text-emerald-500/80 italic font-mono text-[11px]">No problems detected. Everything looks good!</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
