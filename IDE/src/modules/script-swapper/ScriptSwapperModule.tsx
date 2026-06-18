import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { RefreshCw, Play, Trash2, Search, FileCode, FolderOpen, Plus, X, CheckCircle2, AlertCircle } from 'lucide-react'

type ReplacementItem = {
  className: string
  asFile: string | null
  status: 'pending' | 'ready' | 'done' | 'error'
}

export default function ScriptSwapperModule() {
  const swfPath = useAppStore((s) => s.swfPath)
  const swfData = useAppStore((s) => s.swfData)
  const selectedClassForSwapper = useAppStore((s) => s.selectedClassForSwapper)
  const { show } = useToast()
  const [items, setItems] = useState<ReplacementItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // Auto-enqueue class from Explorer context menu
  useEffect(() => {
    if (selectedClassForSwapper) {
      setItems((prev) => {
        if (prev.some((it) => it.className === selectedClassForSwapper)) return prev
        return [...prev, { className: selectedClassForSwapper, asFile: null, status: 'pending' as const }]
      })
      useAppStore.getState().setSelectedClassForSwapper(null)
    }
  }, [selectedClassForSwapper])

  const availableClasses = (swfData?.classes ?? []).filter(
    (c) => c.fullName && c.fullName.trim().length > 0
  )

  const filteredClasses = availableClasses.filter((c) =>
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const addReplacement = (className: string) => {
    if (items.some((it) => it.className === className)) {
      show('Class already in replacement queue', 'warning')
      return
    }
    setItems((prev) => [
      ...prev,
      { className, asFile: null, status: 'pending' }
    ])
  }

  const removeReplacement = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const assignFile = async (index: number) => {
    const filePath = await window.electronAPI.openAsFile()
    if (filePath) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index ? { ...it, asFile: filePath, status: 'ready' as const } : it
        )
      )
      show('ActionScript file assigned', 'success')
    }
  }

  const runReplacements = async () => {
    if (!swfPath || items.length === 0) return
    
    const itemsToRun = items.filter((it) => it.asFile)
    if (itemsToRun.length === 0) {
      show('No ActionScript files assigned', 'warning')
      return
    }

    setIsRunning(true)
    useAppStore.setState({
      isLoading: true,
      loadingStatus: `Mengganti kelas ActionScript (0/${itemsToRun.length})...`,
      loadingLogs: []
    })

    let currentInput = swfPath
    const ext = swfPath.lastIndexOf('.')
    let currentOutput = swfPath.substring(0, ext) + '.work.swf'
    let successCount = 0

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item.asFile) continue

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'pending' as const } : it
          )
        )

        useAppStore.setState({
          loadingStatus: `Mengganti kelas ${item.className.split('.').pop()} (${successCount + 1}/${itemsToRun.length})...`
        })

        const result = await window.electronAPI.invokeFfdec('replace', [
          currentInput,
          currentOutput,
          item.className,
          item.asFile
        ])

        const isSuccess = result.code === 0
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: isSuccess ? ('done' as const) : ('error' as const) }
              : it
          )
        )

        if (isSuccess) {
          successCount++
          currentInput = currentOutput
          currentOutput = currentInput.replace('.work.swf', Math.random().toString(36).slice(2) + '.swf')
        } else {
          show(`Gagal mengganti kelas ${item.className}`, 'error')
          break
        }
      }
      show(`Selesai: ${successCount}/${itemsToRun.length} kelas berhasil diganti`, 'success')
    } catch (err) {
      show('Terjadi kesalahan saat mengganti kelas', 'error')
    } finally {
      setIsRunning(false)
      useAppStore.setState({ isLoading: false })
    }
  }

  const clearAll = () => {
    setItems([])
    show('Queue cleared', 'info')
  }

  return (
    <div className="module animate-slide-in-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900/60 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <RefreshCw size={24} className="text-indigo-400" />
            <span>Script Swapper</span>
          </h2>
          <p className="module-desc">Replace ActionScript classes in SWF with compiled .as files</p>
        </div>

        <div className="action-bar">
          <button
            className="btn btn-primary"
            onClick={runReplacements}
            disabled={isRunning || items.filter((it) => it.asFile).length === 0}
          >
            {isRunning ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            <span>{isRunning ? 'Swapping...' : `Run Swapper (${items.filter((it) => it.asFile).length})`}</span>
          </button>
          <button className="btn btn-secondary" onClick={clearAll} disabled={items.length === 0}>
            <Trash2 size={14} className="text-red-400" />
            <span>Clear Queue</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Classes */}
        <div className="card">
          <div className="card-title">
            <span className="flex items-center gap-1.5">
              <FileCode size={14} className="text-indigo-400" />
              SWF Classes ({availableClasses.length})
            </span>
          </div>
          <div className="p-3 border-b border-slate-900/60 relative">
            <Search size={14} className="absolute left-[26px] top-[22px] text-slate-500" />
            <input
              className="search-input pl-[38px]"
              type="text"
              placeholder="Search classes to swap..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="explorer-class-list max-h-[460px]">
            {availableClasses.length === 0 ? (
              <p className="text-slate-500 p-8 text-center text-sm">No classes found in SWF</p>
            ) : filteredClasses.length === 0 ? (
              <p className="text-slate-500 p-8 text-center text-sm">No matches found</p>
            ) : (
              filteredClasses.map((cls, i) => (
                <div
                  key={i}
                  className="explorer-class-item hover:bg-slate-950/60 group hover:pl-4 transition-all"
                  onClick={() => addReplacement(cls.fullName)}
                >
                  <span className="font-mono text-xs truncate max-w-sm">{cls.fullName}</span>
                  <button className="btn btn-sm btn-ghost p-1 hover:bg-indigo-600/20 hover:text-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Replacement Queue */}
        <div className="card">
          <div className="card-title">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className="text-pink-400 animate-pulse" />
              Swap Queue
            </span>
            <span className="text-[10px] bg-slate-900/60 px-2.5 py-1 rounded-full font-bold border border-slate-800">
              {items.filter((it) => it.status === 'done').length}/{items.length} COMPLETED
            </span>
          </div>
          <div className="explorer-class-list max-h-[510px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
                <span className="text-3xl">📥</span>
                <p className="text-slate-500 text-sm">Click a class from the left list to queue it</p>
              </div>
            ) : items.map((item, i) => (
              <div key={i} className="explorer-class-item flex items-center justify-between p-3.5 bg-slate-950/20 border-slate-900 hover:border-slate-800 transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-sm font-semibold text-slate-200 truncate">{item.className.split('.').pop()}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{item.className}</div>
                    {item.asFile && (
                      <div className="text-[11px] text-indigo-400 flex items-center gap-1 mt-1 truncate">
                        <FolderOpen size={10} />
                        <span className="truncate">{item.asFile}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 items-center flex-shrink-0">
                    {item.status === 'done' && (
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle2 size={10} /> Done
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="badge badge-error flex items-center gap-1">
                        <AlertCircle size={10} /> Error
                      </span>
                    )}
                    {item.status === 'pending' && item.asFile && isRunning && (
                      <span className="badge badge-warning flex items-center gap-1 animate-pulse">
                        ⧖ Processing
                      </span>
                    )}
                    {item.status === 'ready' && (
                      <span className="badge badge-info flex items-center gap-1">
                        Ready
                      </span>
                    )}
                    {item.status === 'pending' && !item.asFile && (
                      <span className="badge bg-slate-900 text-slate-500 border border-slate-800 flex items-center gap-1">
                        No File
                      </span>
                    )}
                    
                    <button
                      className="btn btn-sm btn-secondary font-semibold"
                      onClick={() => assignFile(i)}
                      disabled={isRunning}
                    >
                      Browse
                    </button>
                    <button
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-900 transition-colors"
                      onClick={() => removeReplacement(i)}
                      disabled={isRunning}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
