import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Layout, FolderOpen, RefreshCw, Plus, Search, ChevronRight, Cpu, AlertCircle, FileCode, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

type PanelFile = {
  name: string
  path: string
  size: number
  mtime: number
}

// Per-panel decompiled data stored in a map keyed by panel path
type PanelClassesMap = Record<string, string[]>

export default function PanelStudioModule() {
  const { show } = useToast()
  const projectRoot = useAppStore((s) => s.projectRoot)
  const showPrompt = useAppStore((s) => s.showPrompt)
  const assetSwfPaths = useAppStore((s) => s.assetSwfPaths)

  const [panelDir, setPanelDir] = useState<string>('')
  const [panels, setPanels] = useState<PanelFile[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedPanel, setSelectedPanel] = useState<PanelFile | null>(null)
  
  const [loading, setLoading] = useState<boolean>(false)
  const [decompileProgress, setDecompileProgress] = useState<string>('')
  const [decompileLogs, setDecompileLogs] = useState<string[]>([])
  const [classesMap, setClassesMap] = useState<PanelClassesMap>({})

  // Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [newPanelClass, setNewPanelClass] = useState<string>('id.ninjasage.features.MyCustomPanel')

  // ── Core: Decompile a single panel SWF and extract classes ──
  const decompilePanel = useCallback(async (panelPath: string): Promise<string[]> => {
    try {
      const res = await window.electronAPI.invokeFfdec('-dumpSWF', [panelPath])
      if (res.code !== 0) return []

      const lines = res.stdout.split('\n')
      const detectedClasses: string[] = []
      lines.forEach(l => {
        if (l.includes('DoABC') || l.includes('SymbolClass')) {
          const classMatch = l.match(/"([^"]+)"/)
          if (classMatch && classMatch[1] && !detectedClasses.includes(classMatch[1])) {
            detectedClasses.push(classMatch[1])
          }
        }
      })

      // Fallback: use filename as class name if no classes detected
      if (detectedClasses.length === 0) {
        const name = panelPath.replace(/\\/g, '/').split('/').pop()?.replace('.swf', '')
        if (name) detectedClasses.push(name)
      }

      return detectedClasses
    } catch {
      return []
    }
  }, [])

  // ── Core: Batch-decompile all panels and populate classesMap ──
  const batchDecompile = useCallback(async (panelList: PanelFile[]) => {
    if (panelList.length === 0) return

    setLoading(true)
    setDecompileProgress(`Decompiling 0 / ${panelList.length} panels...`)
    setDecompileLogs([`[Panel Studio] Auto-decompiling ${panelList.length} panel(s)...`])

    const newMap: PanelClassesMap = {}
    let completed = 0

    // Decompile in batches of 3 to avoid overloading FFDec
    const batchSize = 3
    for (let i = 0; i < panelList.length; i += batchSize) {
      const batch = panelList.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          const classes = await decompilePanel(p.path)
          return { path: p.path, name: p.name, classes }
        })
      )

      results.forEach(r => {
        if (r.status === 'fulfilled') {
          newMap[r.value.path] = r.value.classes
          completed++
          setDecompileProgress(`Decompiling ${completed} / ${panelList.length} panels...`)
          setDecompileLogs(prev => [
            ...prev,
            `[✓] ${r.value.name}: ${r.value.classes.length} class(es) detected`
          ])
        } else {
          completed++
          setDecompileProgress(`Decompiling ${completed} / ${panelList.length} panels...`)
        }
      })
    }

    setClassesMap(prev => ({ ...prev, ...newMap }))
    setDecompileLogs(prev => [
      ...prev,
      `[Panel Studio] Done. ${Object.keys(newMap).length} panel(s) indexed successfully.`
    ])
    setDecompileProgress('')
    setLoading(false)
    show(`${Object.keys(newMap).length} panel(s) auto-decompiled`, 'success')
  }, [decompilePanel, show])

  // ── Resolve asset directories from workspace settings ──
  const resolveAssetDirs = useCallback(async (): Promise<string[]> => {
    // 1. Try store's already-resolved assetSwfPaths first
    const storeAssetPaths = useAppStore.getState().assetSwfPaths
    if (storeAssetPaths.length > 0) {
      const dirs = [...new Set(storeAssetPaths.map(p => {
        const normalized = p.replace(/\\/g, '/')
        return normalized.substring(0, normalized.lastIndexOf('/'))
      }).filter(Boolean))]
      if (dirs.length > 0) return dirs
    }

    // 2. Try reading workspace settings from disk
    if (projectRoot) {
      try {
        const workspaceSettings = await window.electronAPI.readWorkspaceSettings(projectRoot)
        const configValue = workspaceSettings?.['workspace.assetSwfPaths']
        if (configValue && typeof configValue === 'string') {
          const paths = configValue.split(',').map((p: string) => p.trim()).filter(Boolean)
          const dirs = [...new Set(paths.map(p => {
            const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
            const fullPath = (isAbsolute ? p : `${projectRoot}/${p}`).replace(/\\/g, '/')
            return fullPath.substring(0, fullPath.lastIndexOf('/'))
          }).filter(Boolean))]
          if (dirs.length > 0) return dirs
        }
      } catch { /* workspace settings file may not exist */ }
    }

    // 3. Fallback to user-level settings from localStorage
    const lsValue = localStorage.getItem('setting:workspace.assetSwfPaths')
    if (lsValue && projectRoot) {
      const paths = lsValue.split(',').map(p => p.trim()).filter(Boolean)
      const dirs = [...new Set(paths.map(p => {
        const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
        const fullPath = (isAbsolute ? p : `${projectRoot}/${p}`).replace(/\\/g, '/')
        return fullPath.substring(0, fullPath.lastIndexOf('/'))
      }).filter(Boolean))]
      if (dirs.length > 0) return dirs
    }

    return []
  }, [projectRoot])

  // ── Auto-detect + auto-decompile on project load ──
  useEffect(() => {
    if (!projectRoot) return

    const autoDetect = async () => {
      const assetDirs = await resolveAssetDirs()

      if (assetDirs.length === 0) return

      // Scan each resolved directory, use the first one that contains SWF panels
      for (const dir of assetDirs) {
        try {
          const list = await window.electronAPI.panelsList(dir)
          if (list && list.length > 0) {
            setPanelDir(dir)
            setPanels(list)
            setSelectedPanel(list[0])
            // Auto-decompile all panels immediately
            batchDecompile(list)
            return
          }
        } catch {
          // Directory doesn't exist or is inaccessible, try next
        }
      }

      // All directories scanned but none had SWF panels — set first dir as working folder
      setPanelDir(assetDirs[0])
    }

    autoDetect()
  }, [projectRoot, assetSwfPaths.length, resolveAssetDirs, batchDecompile])

  // ── Manual load + auto-decompile ──
  const loadPanels = async (dirPath: string) => {
    setLoading(true)
    try {
      const list = await window.electronAPI.panelsList(dirPath)
      setPanels(list)
      if (list.length > 0) {
        setSelectedPanel(list[0])
        // Auto-decompile all panels after manual load
        batchDecompile(list)
      } else {
        setSelectedPanel(null)
      }
    } catch (err) {
      console.error(err)
      show('Failed to scan panel directory', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.openDirectory()
    if (path) {
      setPanelDir(path)
      loadPanels(path)
    }
  }

  // Re-decompile a single panel manually (e.g. after modification)
  const handleRedecompile = async () => {
    if (!selectedPanel) return
    setLoading(true)
    setDecompileLogs([`[Decompiler] Re-decompiling ${selectedPanel.name}...`])

    const classes = await decompilePanel(selectedPanel.path)
    setClassesMap(prev => ({ ...prev, [selectedPanel.path]: classes }))
    setDecompileLogs(prev => [
      ...prev,
      `[✓] Found ${classes.length} class(es) in ${selectedPanel.name}`
    ])
    setLoading(false)
    show('Panel re-decompiled successfully', 'success')
  }

  const handleReplaceScript = async (className: string) => {
    if (!selectedPanel) return
    const asFile = await window.electronAPI.openAsFile()
    if (!asFile) return

    setLoading(true)
    show('Replacing panel script class...', 'info')
    try {
      const outputSwf = selectedPanel.path
      const res = await window.electronAPI.invokeFfdec('replace', [
        selectedPanel.path,
        outputSwf,
        className,
        asFile
      ])
      
      if (res.code === 0) {
        show('Panel class script replaced successfully!', 'success')
        // Re-decompile the modified panel to refresh its classes
        const classes = await decompilePanel(selectedPanel.path)
        setClassesMap(prev => ({ ...prev, [selectedPanel.path]: classes }))
        loadPanels(panelDir)
      } else {
        show(`Script swap failed: ${res.stderr}`, 'error')
      }
    } catch (err: any) {
      show(`Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPanelClass.trim()) return

    const parts = newPanelClass.trim().split('.')
    const className = parts[parts.length - 1]
    const packageName = parts.slice(0, -1).join('.')

    const asCode = `package ${packageName} {
    import flash.display.MovieClip;
    import flash.events.Event;
    
    public class ${className} extends MovieClip {
        public function ${className}() {
            if (stage) init();
            else addEventListener(Event.ADDED_TO_STAGE, init);
        }
        
        private function init(e:Event = null):void {
            removeEventListener(Event.ADDED_TO_STAGE, init);
            trace("[${className}] Panel Initialized!");
            // Add custom elements, components, or logic here
        }
    }
}`

    setLoading(true)
    try {
      const srcPath = projectRoot || panelDir
      const asFilePath = `${srcPath}/src/${packageName.replace(/\./g, '/')}/${className}.as`
      const success = await window.electronAPI.panelsWriteCode(asFilePath, asCode)

      if (success) {
        show('Boilerplate panel ActionScript file generated!', 'success')
        setIsCreateModalOpen(false)

        const sdkPath = localStorage.getItem('setting:compiler.sdkPath') || ''
        const outputSwf = `${panelDir}/${className}.swf`

        show('Compiling new panel class to SWF...', 'info')
        const compileRes = await window.electronAPI.compileSwf(
          srcPath,
          sdkPath,
          asFilePath,
          outputSwf,
          []
        )

        if (compileRes.success) {
          show(`Panel compiled to SWF successfully: ${className}.swf`, 'success')
          loadPanels(panelDir)
        } else {
          show('AS3 stub created, but compilation failed. Check log.', 'warning')
          console.error(compileRes.log)
        }
      } else {
        show('Failed to write AS3 file', 'error')
      }
    } catch (err: any) {
      show(`Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived state ──
  const filteredPanels = panels.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get classes for the currently selected panel from the map
  const selectedClasses = selectedPanel ? (classesMap[selectedPanel.path] || []) : []
  const isSelectedDecompiled = selectedPanel ? selectedPanel.path in classesMap : false
  const totalIndexed = Object.keys(classesMap).length

  return (
    <div className="module animate-slide-in-right flex flex-col h-full min-h-0 text-slate-100">
      
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-900/40">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layout className="text-indigo-400" size={24} />
            <span>Panel Studio</span>
            {totalIndexed > 0 && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-500/20">
                {totalIndexed} indexed
              </span>
            )}
          </h2>
          <p className="module-desc">Manage, compile, and edit external panel SWFs loaded during runtime</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="secondary" size="sm" onClick={() => loadPanels(panelDir)} className="flex items-center gap-1" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1">
            <Plus size={14} />
            <span>Create Panel</span>
          </Button>
        </div>
      </div>

      {/* Directory Select + Progress */}
      <div className="flex items-center gap-2 mt-4 bg-slate-950/20 p-2 border border-slate-900/40 rounded-xl">
        <span className="text-xs text-slate-500 font-bold uppercase pl-2 shrink-0">Working Folder:</span>
        <input
          type="text"
          readOnly
          value={panelDir || 'No folder selected'}
          className="bg-transparent text-xs text-slate-350 outline-none flex-1 font-mono truncate"
        />
        {decompileProgress && (
          <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1.5 shrink-0 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            <Loader2 size={10} className="animate-spin" />
            {decompileProgress}
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={handleSelectFolder} className="flex items-center gap-1 shrink-0">
          <FolderOpen size={12} />
          <span>Browse...</span>
        </Button>
      </div>

      {/* Workspace Panel Split */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 mt-4">
        {/* Left Column: Panel List */}
        <div className="col-span-1 border-r border-slate-900/40 pr-3 flex flex-col min-h-0 h-full">
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pl-1 mb-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Panels ({filteredPanels.length})</span>
            </div>
            
            <div className="relative flex items-center mb-3">
              <Search size={13} className="absolute left-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input w-full text-xs py-1.5 pl-8"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {filteredPanels.length > 0 ? (
                filteredPanels.map((p) => {
                  const isSelected = selectedPanel?.path === p.path
                  const classes = classesMap[p.path]
                  const hasClasses = classes && classes.length > 0
                  return (
                    <div
                      key={p.path}
                      onClick={() => setSelectedPanel(p)}
                      className={`p-3 rounded-lg text-xs font-semibold cursor-pointer transition-all border flex justify-between items-center ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-300'
                          : 'bg-slate-950/10 border-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          {hasClasses && <CheckCircle size={10} className="text-emerald-400 shrink-0" />}
                          <span className="font-bold truncate text-slate-200">{p.name}</span>
                          {hasClasses && (
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0 rounded-full font-mono shrink-0 border border-emerald-500/15">
                              {classes.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 truncate">{p.path}</span>
                      </div>
                      <ChevronRight size={13} className={isSelected ? 'text-indigo-400' : 'text-slate-600'} />
                    </div>
                  )
                })
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6">
                  <AlertCircle size={20} className="mb-1 text-slate-600" />
                  <span>No SWF panels found</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Panel Detail Inspector */}
        <div className="col-span-2 flex flex-col min-h-0 h-full">
          {selectedPanel ? (
            <div className="flex flex-col h-full min-h-0 bg-slate-950/10 border border-slate-900/40 rounded-xl p-4">
              {/* Header Info */}
              <div className="flex justify-between items-start pb-3 border-b border-slate-900/30 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    {selectedPanel.name}
                    {isSelectedDecompiled && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle size={8} />
                        Indexed
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-lg">{selectedPanel.path}</p>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span className="text-[10px] bg-slate-950/60 px-2 py-0.5 rounded text-indigo-400 font-mono">
                    {(selectedPanel.size / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-[9px] text-slate-600 mt-1 font-mono">
                    Modified: {new Date(selectedPanel.mtime).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Inspector Content */}
              <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1">
                {/* Class Mapping Section — auto-populated */}
                <div className="bg-slate-900/10 border border-slate-900/60 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300">ActionScript Class Mapping</h4>
                      <p className="text-[10px] text-slate-500">
                        {isSelectedDecompiled
                          ? `${selectedClasses.length} class(es) auto-detected from panel SWF`
                          : 'Waiting for decompilation...'
                        }
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRedecompile}
                      disabled={loading}
                    >
                      <Cpu size={12} className="mr-1" />
                      <span>Re-Decompile</span>
                    </Button>
                  </div>

                  {selectedClasses.length > 0 && (
                    <div className="space-y-2.5 mt-2 border-t border-slate-900/40 pt-3">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500">Exposed Panel Classes:</span>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                        {selectedClasses.map((cls, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-900/60 hover:border-slate-800 transition-colors">
                            <span className="text-indigo-300 truncate font-semibold">{cls}</span>
                            <button
                              onClick={() => handleReplaceScript(cls)}
                              className="btn btn-secondary px-2 py-0.5 text-[9px] flex items-center gap-1 shrink-0 bg-indigo-600/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600/20"
                            >
                              <FileCode size={10} />
                              <span>Replace Class</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isSelectedDecompiled && !loading && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-400/80 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                      <AlertCircle size={12} />
                      <span>This panel has not been decompiled yet. Click "Re-Decompile" or wait for auto-indexing.</span>
                    </div>
                  )}

                  {decompileLogs.length > 0 && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 font-mono text-[9px] text-slate-400 max-h-32 overflow-y-auto leading-relaxed">
                      {decompileLogs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Boilerplate & Custom Action Tools */}
                <div className="bg-slate-900/10 border border-slate-900/60 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-300">Quick Tools</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950/20 rounded-lg border border-slate-900/50 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400">Class Stub Replacement</span>
                        <p className="text-[9px] text-slate-600 mt-1">Directly select any `.as` file and swap it inside this SWF panel archive.</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => handleReplaceScript(selectedClasses[0] || selectedPanel.name.replace('.swf', ''))} className="mt-3 w-max">
                        <span>Swap Custom Script</span>
                        <ArrowRight size={10} className="ml-1" />
                      </Button>
                    </div>

                    <div className="p-3 bg-slate-950/20 rounded-lg border border-slate-900/50 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400">SWF Metadata Report</span>
                        <p className="text-[9px] text-slate-600 mt-1">Query sizes, tags structures, and binary properties from Flex SDK.</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={async () => {
                        setLoading(true)
                        const res = await window.electronAPI.invokeFfdec('-header', [selectedPanel.path])
                        setDecompileLogs([res.stdout])
                        setLoading(false)
                      }} className="mt-3 w-max">
                        <span>Query Headers</span>
                        <ArrowRight size={10} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-850 rounded-xl p-12 bg-slate-950/5 text-center">
              <Layout size={40} className="text-slate-700 mb-2" />
              <h3 className="text-sm font-semibold text-slate-400">No Panel Selected</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs">Select an external panel SWF from the left side library, or click "Create Panel" to scaffold a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Panel Creator Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePanel}
            className="w-full max-w-md bg-[#090e18] border border-slate-900 rounded-xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={16} className="text-indigo-400" />
                Scaffold New Panel SWF
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Generates a boilerplate ActionScript 3 MovieClip panel class, opens it in the IDE, and compiles it to SWF.
              </p>
            </div>

            <Input
              label="Fully Qualified Class Name"
              type="text"
              value={newPanelClass}
              onChange={(e) => setNewPanelClass(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
              placeholder="id.ninjasage.features.MyCustomPanel"
              required
            />

            <div className="flex gap-2 justify-end mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Compiling stub...' : 'Create Panel'}
              </Button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
