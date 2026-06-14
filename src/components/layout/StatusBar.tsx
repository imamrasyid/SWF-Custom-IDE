import { Terminal, HardDrive, Files, ShieldCheck, Bell, Trash2, X, CheckCircle2, AlertCircle, Info, AlertTriangle, FileCode, List } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useState, useEffect } from 'react'

export default function StatusBar() {
  const swfPath = useAppStore((s) => s.swfPath)
  const swfData = useAppStore((s) => s.swfData)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const isNinjasageProject = useAppStore((s) => s.isNinjasageProject)
  const isBottomPanelOpen = useAppStore((s) => s.isBottomPanelOpen)
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel)
  const editorCursor = useAppStore((s) => s.editorCursor)
  const diagnostics = useAppStore((s) => s.diagnostics)
  const editingFile = useAppStore((s) => s.editingFile)
  const editingFileRight = useAppStore((s) => s.editingFileRight)
  const openTabs = useAppStore((s) => s.openTabs)
  const rightOpenTabs = useAppStore((s) => s.rightOpenTabs)

  const hasErrors = Object.values(diagnostics).some(fileErrors => fileErrors.some(e => e.severity === 'error'))
  const hasWarnings = Object.values(diagnostics).some(fileErrors => fileErrors.some(e => e.severity === 'warning'))

  // Notifications state
  const notifications = useAppStore((s) => s.notifications)
  const clearNotifications = useAppStore((s) => s.clearNotifications)
  const markNotificationsAsRead = useAppStore((s) => s.markNotificationsAsRead)

  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [minimapEnabled, setMinimapEnabled] = useState(localStorage.getItem('setting:editor.minimap.enabled') !== 'false')
  const [encoding, setEncoding] = useState('UTF-8')
  const [lineEnding, setLineEnding] = useState('LF')
  const [showEncodingMenu, setShowEncodingMenu] = useState(false)
  const [showLineEndingMenu, setShowLineEndingMenu] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  // Active file info
  const activeFile = editingFile || editingFileRight
  const activeFileIsDirty = activeFile ? activeFile.code !== activeFile.originalCode : false
  const activeFileLineCount = activeFile ? activeFile.code.split('\n').length : 0

  // Dirty tabs count
  const dirtyCount = [...openTabs, ...rightOpenTabs].filter(t => t.code !== t.originalCode).length

  // Auto mark as read when panel opens
  useEffect(() => {
    if (isNotifOpen && unreadCount > 0) {
      markNotificationsAsRead()
    }
  }, [isNotifOpen, unreadCount, markNotificationsAsRead])

  const getFilename = (path: string | null) => {
    if (!path) return ''
    const parts = path.split(/[\\/]/)
    return parts[parts.length - 1]
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 5) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    return `${diffHour}h ago`
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 size={12} className="text-emerald-450 shrink-0" />
      case 'error':
        return <AlertCircle size={12} className="text-rose-450 shrink-0" />
      case 'warning':
        return <AlertTriangle size={12} className="text-amber-450 shrink-0" />
      default:
        return <Info size={12} className="text-blue-450 shrink-0" />
    }
  }

  return (
    <div className="ide-status-bar relative">
      {/* Left section: Project and active file */}
      <div className="flex items-center gap-4">
        {swfPath ? (
          <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
            <Files size={12} />
            <span>SWF: {getFilename(swfPath)}</span>
            {swfData?.header.fileSize && (
              <span className="text-[10px] text-slate-600 font-medium">({formatSize(swfData.header.fileSize)})</span>
            )}
          </div>
        ) : (
          <span className="text-slate-600 italic">No SWF loaded</span>
        )}

        {activeFile && (
          <div className="flex items-center gap-1.5 text-slate-400 border-l border-slate-900/40 pl-4">
            <FileCode size={12} className={activeFileIsDirty ? 'text-amber-400' : 'text-slate-500'} />
            <span className="text-[11px] font-medium truncate max-w-[180px]" title={activeFile.className}>
              {activeFile.className.split('.').pop()}
            </span>
            {activeFileIsDirty && (
              <span className="text-[9px] bg-amber-950/40 text-amber-500 border border-amber-900/30 px-1 rounded font-semibold">
                Modified
              </span>
            )}
            <span className="text-[10px] text-slate-600">
              {activeFileLineCount} lines
            </span>
          </div>
        )}

        {dirtyCount > 0 && (
          <div className="flex items-center gap-1 text-amber-500 border-l border-slate-900/40 pl-4">
            <span className="text-[10px] font-semibold">{dirtyCount} unsaved</span>
          </div>
        )}

        {projectRoot && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <HardDrive size={12} />
            <span className="truncate max-w-[200px]" title={projectRoot}>Project: {getFilename(projectRoot)}</span>
            {isNinjasageProject && (
              <span className="text-[10px] bg-emerald-950/40 text-emerald-500 border border-emerald-900/30 px-1 rounded flex items-center gap-0.5">
                <ShieldCheck size={9} />
                NinjaSage Project
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right section: SWF stats and bottom panel toggle */}
      <div className="flex items-center gap-4">
        {hasErrors && (
          <span className="text-[9px] bg-rose-950/40 text-rose-500 border border-rose-900/30 px-1 rounded flex items-center gap-0.5 font-bold animate-pulse">
            <AlertCircle size={9} />
            Build Error
          </span>
        )}
        {!hasErrors && hasWarnings && (
          <span className="text-[9px] bg-amber-950/40 text-amber-500 border border-amber-900/30 px-1 rounded flex items-center gap-0.5 font-semibold">
            <AlertTriangle size={9} />
            Build Warning
          </span>
        )}
        {!hasErrors && !hasWarnings && projectRoot && (
          <span className="text-[9px] bg-emerald-950/40 text-emerald-500 border border-emerald-900/30 px-1 rounded flex items-center gap-0.5 font-semibold">
            <CheckCircle2 size={9} />
            Build OK
          </span>
        )}

        {projectRoot && (
          <div className="text-[10px] text-slate-550 select-none font-mono">
            SDK: {localStorage.getItem('setting:compiler.sdkPath')?.split(/[\\/]/).pop() || 'flex_sdk'}
          </div>
        )}

        {editorCursor && (
          <div className="text-slate-400 text-[10px] font-mono select-none">
            Ln {editorCursor.line}, Col {editorCursor.column}
          </div>
        )}
        {swfData && (
          <div className="flex items-center gap-3 text-slate-600 text-[10px]">
            <span>Classes: {swfData.classes.length}</span>
            <span>Tags: {swfData.tags?.length || 0}</span>
            <span>Version: AS{swfData.header.version > 2 ? '3' : '2'} (v{swfData.header.version})</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-slate-500 text-[10px] select-none border-l border-slate-900/40 pl-3">
          {/* Minimap Toggle */}
          <button
            onClick={() => {
              const newEnabled = !minimapEnabled
              setMinimapEnabled(newEnabled)
              localStorage.setItem('setting:editor.minimap.enabled', String(newEnabled))
              window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.minimap.enabled' } }))
            }}
            className={`flex items-center gap-1 hover:text-indigo-400 cursor-pointer transition-colors ${
              minimapEnabled ? 'text-indigo-400' : 'text-slate-500'
            }`}
            title="Toggle Minimap"
          >
            <List size={11} />
            <span>Minimap</span>
          </button>

          {/* Encoding Selector */}
          <div className="relative">
            <button
              onClick={() => setShowEncodingMenu(!showEncodingMenu)}
              className="hover:text-indigo-400 cursor-pointer transition-colors"
            >
              {encoding}
            </button>
            {showEncodingMenu && (
              <div className="absolute bottom-6 left-0 bg-slate-950 border border-slate-900 rounded-lg shadow-xl p-1 z-50 min-w-[100px]">
                {['UTF-8', 'UTF-16', 'ISO-8859-1', 'ASCII'].map(enc => (
                  <button
                    key={enc}
                    onClick={() => {
                      setEncoding(enc)
                      setShowEncodingMenu(false)
                      localStorage.setItem('setting:editor.encoding', enc)
                    }}
                    className={`w-full text-left px-2 py-1 text-[10px] rounded hover:bg-slate-900 transition-colors ${
                      encoding === enc ? 'text-indigo-400 bg-indigo-950/30' : 'text-slate-400'
                    }`}
                  >
                    {enc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line Ending Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLineEndingMenu(!showLineEndingMenu)}
              className="hover:text-indigo-400 cursor-pointer transition-colors"
            >
              {lineEnding}
            </button>
            {showLineEndingMenu && (
              <div className="absolute bottom-6 left-0 bg-slate-950 border border-slate-900 rounded-lg shadow-xl p-1 z-50 min-w-[100px]">
                {['LF', 'CRLF'].map(le => (
                  <button
                    key={le}
                    onClick={() => {
                      setLineEnding(le)
                      setShowLineEndingMenu(false)
                      localStorage.setItem('setting:editor.lineEnding', le)
                    }}
                    className={`w-full text-left px-2 py-1 text-[10px] rounded hover:bg-slate-900 transition-colors ${
                      lineEnding === le ? 'text-indigo-400 bg-indigo-950/30' : 'text-slate-400'
                    }`}
                  >
                    {le}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab Size */}
          <span 
            className="hover:text-indigo-400 cursor-pointer transition-colors"
            onClick={async () => {
              const current = localStorage.getItem('setting:editor.tabSize') || '4'
              const newSize = await useAppStore.getState().showPrompt(
                'Change Tab Size',
                'Enter preferred tab size for the editor (e.g. 2, 4, 8):',
                current
              )
              if (newSize) {
                const parsed = parseInt(newSize, 10)
                if (!isNaN(parsed) && parsed > 0 && parsed <= 16) {
                  localStorage.setItem('setting:editor.tabSize', String(parsed))
                  useAppStore.setState({ jumpToLine: useAppStore.getState().jumpToLine })
                }
              }
            }}
          >
            Spaces: {localStorage.getItem('setting:editor.tabSize') || '4'}
          </span>
          <span className="text-slate-400 font-semibold">ActionScript</span>
        </div>

        {/* Notification Bell Button */}
        <button
          onClick={() => setIsNotifOpen(!isNotifOpen)}
          className={`flex items-center justify-center p-1 rounded transition-all hover:bg-slate-900 text-slate-500 hover:text-slate-350 cursor-pointer relative ${
            isNotifOpen ? 'text-indigo-400 bg-slate-900' : ''
          }`}
          title="Notifications"
        >
          <Bell size={12} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-indigo-650 text-[8px] font-bold text-white shadow-md">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => toggleBottomPanel()}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all hover:bg-slate-900 text-slate-500 hover:text-slate-300 cursor-pointer ${
            isBottomPanelOpen ? 'bg-indigo-650/10 text-indigo-400 hover:bg-indigo-900/10' : ''
          }`}
        >
          <Terminal size={12} />
          <span>Terminal Output</span>
        </button>
      </div>

      {/* Floating Notification Center Panel */}
      {isNotifOpen && (
        <div className="absolute bottom-8 right-3 bg-slate-950/95 border border-slate-900 rounded-xl p-3 shadow-2xl z-50 w-80 max-h-96 flex flex-col backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Bell size={11} className="text-indigo-400" />
              Notifications Log ({notifications.length})
            </span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                  title="Clear All"
                >
                  <Trash2 size={11} />
                </button>
              )}
              <button
                onClick={() => setIsNotifOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                <Bell size={24} className="opacity-30 mb-1" />
                <span className="text-[10px]">No notifications yet</span>
              </div>
            ) : (
              [...notifications].reverse().map((notif) => (
                <div
                  key={notif.id}
                  className={`flex gap-2 p-2 rounded-lg border border-slate-900/60 bg-slate-900/20 text-[10px] leading-relaxed transition-all ${
                    !notif.read ? 'border-indigo-900/40 bg-indigo-950/5' : ''
                  }`}
                >
                  {getSeverityIcon(notif.severity)}
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-slate-300 font-sans">{notif.message}</span>
                    <span className="text-[8px] text-slate-500 font-medium">
                      {formatRelativeTime(notif.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
