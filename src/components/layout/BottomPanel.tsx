import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal, AlertTriangle, Trash2, X, Bug, Plus } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import DebugPanel from './DebugPanel'
import { Terminal as XTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

interface XtermEntry {
  term: XTerminal
  fitAddon: FitAddon
  container: HTMLDivElement
}

const terminalInstances = new Map<string, XtermEntry>()

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

  const terminalHostRef = useRef<HTMLDivElement>(null)
  const backendCreatedRef = useRef<Set<string>>(new Set())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const disposeTerminal = useCallback((id: string) => {
    const entry = terminalInstances.get(id)
    if (!entry) return
    entry.term.dispose()
    if (entry.container.parentNode) {
      entry.container.parentNode.removeChild(entry.container)
    }
    terminalInstances.delete(id)
  }, [])

  const createXtermInstance = useCallback((id: string): XtermEntry => {
    const term = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      fontFamily: "'Fira Code', Consolas, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: '#060a11',
        foreground: '#c9d1d9',
        cursor: '#c9d1d9',
        cursorAccent: '#060a11',
        selectionBackground: '#3b5bdb44',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())

    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.position = 'absolute'
    container.style.top = '0'
    container.style.left = '0'

    term.open(container)

    const entry: XtermEntry = { term, fitAddon, container }
    terminalInstances.set(id, entry)

    term.onData((data) => {
      window.electronAPI.writeTerminal(id, data)
    })

    return entry
  }, [])

  const ensureXterm = useCallback((id: string): XtermEntry => {
    let entry = terminalInstances.get(id)
    if (!entry) {
      entry = createXtermInstance(id)
    }
    return entry
  }, [createXtermInstance])

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
        window.electronAPI.killTerminal(id).catch(() => {})
      })
      backendCreatedRef.current.clear()
      terminalInstances.forEach((_, id) => disposeTerminal(id))
    }
  }, [disposeTerminal])

  useEffect(() => {
    const unsubData = window.electronAPI.onTerminalData((id, data) => {
      const entry = terminalInstances.get(id)
      if (entry) {
        entry.term.write(data)
      }
    })

    const unsubExit = window.electronAPI.onTerminalExit((id, exitCode) => {
      const entry = terminalInstances.get(id)
      if (entry) {
        entry.term.writeln(`\r\n\x1b[38;5;240m[Process exited with code ${exitCode}]\x1b[0m`)
      }
      backendCreatedRef.current.delete(id)
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [])

  useEffect(() => {
    if (activeTerminalId && bottomPanelTab === 'terminal' && isBottomPanelOpen) {
      createBackendTerminal(activeTerminalId)
    }
  }, [activeTerminalId, bottomPanelTab, isBottomPanelOpen, createBackendTerminal])

  useEffect(() => {
    if (!isBottomPanelOpen || bottomPanelTab !== 'terminal') return

    const host = terminalHostRef.current
    if (!host || !activeTerminalId) return

    const entry = ensureXterm(activeTerminalId)

    if (entry.container.parentNode !== host) {
      host.appendChild(entry.container)
    }

    const resize = () => {
      entry.fitAddon.fit()
      window.electronAPI.resizeTerminal(activeTerminalId!, entry.term.cols, entry.term.rows)
    }

    resize()

    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = new ResizeObserver(() => {
      resize()
    })
    resizeObserverRef.current.observe(host)

    entry.term.focus()

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [isBottomPanelOpen, bottomPanelTab, activeTerminalId, ensureXterm])

  useEffect(() => {
    if (isBottomPanelOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [compilerOutput, isBottomPanelOpen, bottomPanelTab])

  const handleNewTerminal = () => {
    const id = createTerminalStore()
    createBackendTerminal(id)
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.killTerminal(id).catch(() => {})
    backendCreatedRef.current.delete(id)
    disposeTerminal(id)
    closeTerminal(id)
  }

  const handleClearTerminal = () => {
    if (activeTerminalId) {
      const entry = terminalInstances.get(activeTerminalId)
      if (entry) {
        entry.term.clear()
      }
    }
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
                onClick={handleClearTerminal}
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
        className="flex-1 overflow-hidden bg-[#060a11] flex flex-col min-h-0"
      >
        {bottomPanelTab === 'terminal' ? (
          <div className="flex-1 flex flex-col min-h-0">
            {terminals.length > 1 && (
              <div className="flex items-center gap-1 border-b border-slate-900/60 px-3 py-1 shrink-0">
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

            <div
              ref={terminalHostRef}
              className="flex-1 relative min-h-0"
            />
          </div>
        ) : bottomPanelTab === 'logs' ? (
          <div className="flex flex-col gap-1 p-3.5 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto min-h-0 custom-scrollbar">
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
          <div className="flex flex-col gap-1.5 font-sans p-3.5 overflow-y-auto min-h-0">
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
