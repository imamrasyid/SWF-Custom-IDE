import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Hammer, Play, FolderOpen, Terminal, Loader2, Settings, Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'

export default function SwfBuilderModule() {
  const { show } = useToast()
  const setActivityTab = useAppStore((s) => s.setActivityTab)
  const compilerOutput = useAppStore((s) => s.compilerOutput)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildHooks, setBuildHooks] = useState<{ preBuild: string[]; postBuild: string[] }>({ preBuild: [], postBuild: [] })
  const [newHook, setNewHook] = useState('')
  const [hookType, setHookType] = useState<'preBuild' | 'postBuild'>('preBuild')

  // Read configs dynamically from central setting store keys (synced with SettingsModule)
  const sdkPath = localStorage.getItem('setting:compiler.sdkPath') || localStorage.getItem('swf-builder:sdkPath') || ''
  const mainFile = localStorage.getItem('setting:compiler.defaultMain') || localStorage.getItem('swf-builder:mainFile') || './src/Main.as'
  const outputPath = localStorage.getItem('setting:compiler.defaultOutput') || localStorage.getItem('swf-builder:outputPath') || './build/script.swf'
  const additionalArgs = localStorage.getItem('setting:compiler.additionalArgs') || localStorage.getItem('swf-builder:additionalArgs') || '-static-link-runtime-shared-libraries=true'

  useEffect(() => {
    if (projectRoot) {
      loadBuildHooks()
    }
  }, [projectRoot])

  const loadBuildHooks = async () => {
    try {
      const hooks = await window.electronAPI.getBuildHooks(projectRoot!)
      setBuildHooks(hooks)
    } catch (err) {
      console.error('Failed to load build hooks:', err)
    }
  }

  const runBuild = async () => {
    if (!mainFile.trim() || !outputPath.trim()) {
      show('Main file or output path not configured. Please open settings.', 'warning')
      return
    }

    const { clearCompilerOutput, addCompilerOutput, toggleBottomPanel, setBottomPanelTab } = useAppStore.getState()

    setIsBuilding(true)
    clearCompilerOutput()
    setBottomPanelTab('terminal')
    toggleBottomPanel(true)
    
    addCompilerOutput([
      '[Compiler] Preparing compilation...',
      `[Compiler] SDK Path: ${sdkPath || '(auto-detect)'}`,
      `[Compiler] Main File: ${mainFile}`,
      `[Compiler] Output: ${outputPath}`,
      `[Compiler] Arguments: ${additionalArgs}`,
      ''
    ])
    
    show('Compiling SWF using Flex SDK (mxmlc)...', 'info', 0)

    // Run pre-build hooks
    if (buildHooks.preBuild.length > 0) {
      addCompilerOutput(['[Hooks] Running pre-build hooks...', ''])
      for (const hook of buildHooks.preBuild) {
        addCompilerOutput([`[Hooks] > ${hook}`])
        const result = await window.electronAPI.runBuildHook(projectRoot!, hook)
        if (result.output) {
          addCompilerOutput(result.output.split(/\r?\n/))
        }
        if (!result.success) {
          addCompilerOutput(['[Hooks] Pre-build hook failed. Aborting build.', ''])
          setIsBuilding(false)
          return
        }
      }
      addCompilerOutput(['[Hooks] Pre-build hooks completed.', ''])
    }

    try {
      const argsArray = additionalArgs
        .split(' ')
        .map(a => a.trim())
        .filter(Boolean)

      const result = await window.electronAPI.compileSwf(
        projectRoot || '',
        sdkPath,
        mainFile,
        outputPath,
        argsArray
      )

      if (result.log) {
        addCompilerOutput(result.log.split(/\r?\n/))
      }
      
      if (result.success) {
        addCompilerOutput(['', '[Success] Build completed successfully!'])
        show('SWF compiled successfully!', 'success')
        
        // Run post-build hooks
        if (buildHooks.postBuild.length > 0) {
          addCompilerOutput(['', '[Hooks] Running post-build hooks...', ''])
          for (const hook of buildHooks.postBuild) {
            addCompilerOutput([`[Hooks] > ${hook}`])
            const hookResult = await window.electronAPI.runBuildHook(projectRoot!, hook)
            if (hookResult.output) {
              addCompilerOutput(hookResult.output.split(/\r?\n/))
            }
          }
          addCompilerOutput(['[Hooks] Post-build hooks completed.', ''])
        }
      } else {
        addCompilerOutput(['', '[ERROR] Build failed. Check log above.'])
        show('Build failed. Check build log.', 'error')
      }
    } catch (err: any) {
      addCompilerOutput(['', `[Fatal Error] ${err.message || err}`])
      show('Fatal error during build', 'error')
    } finally {
      setIsBuilding(false)
    }
  }

  const handleAddHook = async () => {
    if (!newHook.trim()) return
    
    const updatedHooks = {
      ...buildHooks,
      [hookType]: [...buildHooks[hookType], newHook.trim()]
    }
    
    await window.electronAPI.saveBuildHooks(projectRoot!, updatedHooks)
    setBuildHooks(updatedHooks)
    setNewHook('')
    show('Hook added', 'success')
  }

  const handleDeleteHook = async (type: 'preBuild' | 'postBuild', index: number) => {
    const updatedHooks = {
      ...buildHooks,
      [type]: buildHooks[type].filter((_, i) => i !== index)
    }
    
    await window.electronAPI.saveBuildHooks(projectRoot!, updatedHooks)
    setBuildHooks(updatedHooks)
    show('Hook removed', 'info')
  }

  const openOutputFolder = async () => {
    show('Opening output folder...', 'info')
    try {
      await window.electronAPI.invokeFfdec('explorer', [outputPath])
    } catch {
      show('Failed to open output folder', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full animate-slide-in-right overflow-hidden gap-4 p-0">
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 shrink-0">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            <Hammer className="text-amber-400" size={18} />
            <span>SWF Builder Console</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-lg truncate" title={outputPath}>
            Target: {outputPath.split(/[\\/]/).pop()} ({mainFile})
          </p>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary flex items-center gap-1.5 py-1 px-3 text-[11px] rounded-md"
            onClick={() => setActivityTab('settings')}
            title="Configure Compiler Settings"
          >
            <Settings size={12} />
            <span>Configure</span>
          </button>

          <button
            className="btn btn-secondary flex items-center gap-1.5 py-1 px-3 text-[11px] rounded-md"
            onClick={openOutputFolder}
            title="Open compiled folder location"
          >
            <FolderOpen size={12} />
            <span>Open Output</span>
          </button>

          <button
            className="btn btn-primary flex items-center gap-1.5 py-1 px-3.5 text-[11px] rounded-md"
            onClick={runBuild}
            disabled={isBuilding}
          >
            {isBuilding ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Compiling...</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Run Build</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Build Hooks Configuration */}
      {projectRoot && (
        <div className="border border-slate-900/80 rounded-xl bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Terminal size={14} className="text-indigo-400" />
            Build Hooks
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Pre-Build Hooks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Pre-Build</span>
                <select
                  value={hookType}
                  onChange={(e) => setHookType(e.target.value as 'preBuild' | 'postBuild')}
                  className="text-[9px] bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-400"
                >
                  <option value="preBuild">Pre-Build</option>
                  <option value="postBuild">Post-Build</option>
                </select>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {buildHooks.preBuild.map((hook, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/50 rounded px-2 py-1">
                    <span className="flex-1 truncate font-mono">{hook}</span>
                    <button onClick={() => handleDeleteHook('preBuild', idx)} className="text-slate-600 hover:text-rose-400">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Post-Build Hooks */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Post-Build</span>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {buildHooks.postBuild.map((hook, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/50 rounded px-2 py-1">
                    <span className="flex-1 truncate font-mono">{hook}</span>
                    <button onClick={() => handleDeleteHook('postBuild', idx)} className="text-slate-600 hover:text-rose-400">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Add Hook */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newHook}
              onChange={(e) => setNewHook(e.target.value)}
              placeholder="Enter command (e.g., npm run lint)"
              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 placeholder-slate-600"
              onKeyDown={(e) => e.key === 'Enter' && handleAddHook()}
            />
            <button
              onClick={handleAddHook}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 flex items-center gap-1"
            >
              <Plus size={10} />
              Add
            </button>
          </div>
        </div>
      )}

      {/* Full Width Console Log Output Container */}
      <div className="flex-1 min-h-0 bg-[#05080e] border border-slate-900/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="card-title font-bold text-slate-200 border-b border-slate-900/80 px-4 py-2 bg-slate-950/60 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5 text-xs">
            <Terminal size={13} className="text-indigo-400" />
            Build Terminal Logs
          </span>
          {isBuilding && (
            <span className="flex items-center gap-1.5 text-[9px] text-indigo-400 font-bold uppercase animate-pulse">
              <Loader2 size={9} className="animate-spin" />
              Compiling...
            </span>
          )}
        </div>
        
        <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto whitespace-pre-wrap select-text selection:bg-indigo-600/30">
          {compilerOutput.length > 0 ? (
            compilerOutput.map((line, idx) => {
              const isError = line.toLowerCase().includes('error:') || line.toLowerCase().includes('failed')
              const isWarning = line.toLowerCase().includes('warning:')
              let colorClass = 'text-slate-300'
              if (isError) colorClass = 'text-rose-400 font-semibold'
              else if (isWarning) colorClass = 'text-amber-400'
              else if (line.startsWith('[Compiler]')) colorClass = 'text-indigo-400'
              else if (line.startsWith('[Success]')) colorClass = 'text-emerald-400 font-semibold'
              else if (line.startsWith('[Hooks]')) colorClass = 'text-purple-400'

              return (
                <div key={idx} className={colorClass}>
                  {line}
                </div>
              )
            })
          ) : (
            <span className="text-slate-600 italic">Compiler logs idle. Configure settings and click "Run Build".</span>
          )}
        </div>
      </div>
    </div>
  )
}
