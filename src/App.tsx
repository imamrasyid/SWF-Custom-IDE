import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import { useToast, ToastContainer } from './hooks/useToast'
import { Minus, Square, X } from 'lucide-react'
import MenuBar from './components/layout/MenuBar'
import DebugToolbar from './components/layout/DebugToolbar'
import ExplorerPanel from './components/layout/ExplorerPanel'
import SearchPanel from './components/layout/SearchPanel'
import ContentPanel from './components/layout/ContentPanel'
import WelcomePage from './modules/welcome/WelcomePage'
import LoadingOverlay from './components/layout/LoadingOverlay'
import PromptDialog from './components/layout/PromptDialog'
import GameDataEditorModule from './modules/game-data-editor/GameDataEditorModule'
import AmfBuilderModule from './modules/amf-builder/AmfBuilderModule'
import ActivityBar from './components/layout/ActivityBar'
import BottomPanel from './components/layout/BottomPanel'
import StatusBar from './components/layout/StatusBar'
import CommandPalette from './components/layout/CommandPalette'
import ErrorBoundary from './components/layout/ErrorBoundary'

export default function App() {
  const swfPath = useAppStore((s) => s.swfPath)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const activityTab = useAppStore((s) => s.activityTab)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const { toasts, show, remove } = useToast()

  useEffect(() => {
    const matchKeybinding = (e: KeyboardEvent, keybindingStr: string) => {
      const parts = keybindingStr.toLowerCase().split('+')
      const needsCtrl = parts.includes('ctrl')
      const needsShift = parts.includes('shift')
      const needsAlt = parts.includes('alt')
      const keyPart = parts.find(p => p !== 'ctrl' && p !== 'shift' && p !== 'alt')
      
      if (needsCtrl && !(e.ctrlKey || e.metaKey)) return false
      if (needsShift && !e.shiftKey) return false
      if (needsAlt && !e.altKey) return false
      
      if (keyPart) {
        let eKey = e.key.toLowerCase()
        if (eKey === ' ') eKey = 'space'
        return eKey === keyPart
      }
      return false
    }

    const getBinding = (action: string, fallback: string) => {
      return localStorage.getItem(`keybinding:${action}`) || fallback
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (matchKeybinding(e, getBinding('toggleSidebar', 'ctrl+b'))) {
        e.preventDefault()
        useAppStore.getState().toggleSidebar()
      } else if (matchKeybinding(e, getBinding('commandPaletteCommand', 'ctrl+shift+p'))) {
        e.preventDefault()
        useAppStore.getState().toggleCommandPalette(undefined, 'command')
      } else if (matchKeybinding(e, getBinding('commandPaletteFile', 'ctrl+p'))) {
        e.preventDefault()
        useAppStore.getState().toggleCommandPalette(undefined, 'file')
      } else if (matchKeybinding(e, getBinding('gotoLine', 'ctrl+g'))) {
        e.preventDefault()
        useAppStore.getState().toggleCommandPalette(true, 'line')
      } else if (matchKeybinding(e, getBinding('toggleTerminal', 'ctrl+`'))) {
        e.preventDefault()
        useAppStore.getState().toggleBottomPanel()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        const state = useAppStore.getState()
        if (state.editingFile) {
          e.preventDefault()
          state.closeTab(state.editingFile.className)
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(200, Math.min(600, startWidth + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const urlParams = new URLSearchParams(window.location.search)
  const standaloneTool = urlParams.get('standalone')

  useEffect(() => {
    window.electronAPI.onMenuAction((action) => {
      if (action === 'open-swf') {
        handleOpenSwf()
      } else {
        useAppStore.getState().setActiveModule(action)
      }
    })

    window.electronAPI.onSwfOpened((path) => {
      useAppStore.getState().loadSwf(path)
    })

    // Deteksi proyek secara otomatis saat aplikasi dimulai (hanya di main window)
    if (!new URLSearchParams(window.location.search).get('standalone')) {
      window.electronAPI.detectProject().then((project) => {
        if (project) {
          useAppStore.getState().setProject(project.root)
        }
      })
    }

    const unsubProgress = window.electronAPI.onFfdecProgress((text) => {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length > 0) {
        useAppStore.setState((s) => {
          if (!s.isLoading) return {}

          // Batasi logs maksimal 40 baris agar memori efisien
          const newLogs = [...s.loadingLogs, ...lines].slice(-40)
          const lastLine = lines[lines.length - 1]
          let currentStatus = s.loadingStatus

          if (lastLine.toLowerCase().includes('decompiling')) {
            const match = lastLine.match(/decompiling\s+([a-zA-Z0-9._$]+)/i)
            if (match) {
              currentStatus = `Mendekompilasi ${match[1]}...`
            } else {
              currentStatus = lastLine
            }
          } else if (lastLine.toLowerCase().includes('saving') || lastLine.toLowerCase().includes('writing')) {
            currentStatus = 'Menyimpan berkas...'
          } else if (lastLine.toLowerCase().includes('reading')) {
            currentStatus = 'Membaca struktur SWF...'
          } else if (lastLine.toLowerCase().includes('replacing') || lastLine.toLowerCase().includes('replace')) {
            currentStatus = 'Mengganti skrip kelas...'
          }

          return {
            loadingLogs: newLogs,
            loadingStatus: currentStatus
          }
        })
      }
    })

    return () => {
      unsubProgress()
    }
  }, [])

  // Debug event listeners
  useEffect(() => {
    const unsubEvent = window.electronAPI.onDebugEvent((event) => {
      const { event: eventType, body } = event
      
      if (eventType === 'stopped') {
        useAppStore.getState().setPaused(true)
        useAppStore.getState().addDebugOutput(`[Debug] ${body?.reason || 'Stopped'}`)
        
        if (body?.reason === 'breakpoint') {
          useAppStore.getState().addDebugOutput(`[Breakpoint] Hit at line ${body.line || '?'}`)
        }
        
        // Fetch stack trace and variables
        window.electronAPI.debugStackTrace().then(({ frames }) => {
          if (frames.length > 0) {
            useAppStore.getState().setCallStack(frames)
            useAppStore.getState().setCurrentPosition(frames[0].file, frames[0].line)
          }
        })
        
        window.electronAPI.debugVariables(1).then(({ variables }) => {
          useAppStore.getState().setVariables(variables)
        })
      } else if (eventType === 'terminated') {
        useAppStore.getState().setDebugging(false)
        useAppStore.getState().addDebugOutput('[Debug] Session ended')
      }
    })

    return () => {
      unsubEvent()
    }
  }, [])

  // Warn before close if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { openTabs, rightOpenTabs } = useAppStore.getState()
      const hasUnsaved = [...openTabs, ...rightOpenTabs].some(tab => tab.code !== tab.originalCode)
      if (hasUnsaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleOpenSwf = async () => {
    const path = await window.electronAPI.openSwf()
    if (path) {
      useAppStore.getState().loadSwf(path)
    }
  }

  if (standaloneTool) {
    return (
      <div className="app-container flex flex-col h-screen overflow-hidden">
        {/* Custom drag area title bar for standalone window */}
        <div 
          className="h-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-900/60 flex items-center justify-between px-4 select-none z-50"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-[12px] font-extrabold text-indigo-400 uppercase tracking-widest">
            {standaloneTool.replace(/-/g, ' ')}
          </span>
          <div 
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={() => window.electronAPI.minimizeWindow()}
              className="window-control-btn"
              title="Minimize"
            >
              <Minus size={12} strokeWidth={2} />
            </button>
            <button
              onClick={() => window.electronAPI.maximizeWindow()}
              className="window-control-btn"
              title="Maximize"
            >
              <Square size={10} strokeWidth={2} />
            </button>
            <button
              onClick={() => window.electronAPI.closeWindow()}
              className="window-control-btn window-control-close"
              title="Close"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content Panel for standalone tool */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col bg-[#080c14] min-h-0">
          {standaloneTool === 'game-data-editor' && <GameDataEditorModule />}
          {standaloneTool === 'amf-builder' && <AmfBuilderModule />}
        </div>
        <LoadingOverlay />
        <PromptDialog />
        <ToastContainer toasts={toasts} onRemove={remove} />
      </div>
    )
  }

  const currentTheme = localStorage.getItem('setting:appearance.theme') || 'slate'

  return (
    <div className={`app-container theme-${currentTheme} flex flex-col h-screen w-screen overflow-hidden`}>
      <MenuBar />
      <div className="app-body flex flex-1 overflow-hidden relative">
        {(swfPath || projectRoot) ? (
          <>
            <ActivityBar />
            {isSidebarOpen && (activityTab === 'explorer' || activityTab === 'search') && (
              <div 
                className="relative flex shrink-0 h-full border-r border-slate-900/80" 
                style={{ width: `${sidebarWidth}px` }}
              >
                <ErrorBoundary fallbackTitle="Panel Error" fallbackMessage="The sidebar panel crashed.">
                  {activityTab === 'explorer' && <ExplorerPanel />}
                  {activityTab === 'search' && <SearchPanel />}
                </ErrorBoundary>
                {/* Sash resizer */}
                <div 
                  className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-all z-[999] select-none"
                  onMouseDown={handleSidebarResizeStart}
                />
              </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              <ErrorBoundary fallbackTitle="Module Error" fallbackMessage="The current module crashed. Try switching to a different module.">
                <ContentPanel />
              </ErrorBoundary>
              <DebugToolbar />
              <BottomPanel />
            </div>
          </>
        ) : (
          <WelcomePage />
        )}
      </div>
      {(swfPath || projectRoot) && <StatusBar />}
      <CommandPalette />
      <LoadingOverlay />
      <PromptDialog />
      <ToastContainer toasts={toasts} onRemove={remove} />
    </div>
  )
}
