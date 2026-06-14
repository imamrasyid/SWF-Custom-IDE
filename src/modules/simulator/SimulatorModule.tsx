import React, { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Play, Pause, RotateCcw, Monitor, Terminal, Cpu, Trash2, Activity, Sliders } from 'lucide-react'

declare global {
  interface Window {
    RufflePlayer?: any
  }
}

export default function SimulatorModule() {
  const swfPath = useAppStore((s) => s.swfPath)
  const { show } = useToast()
  const [mode, setMode] = useState<'ruffle' | 'adl'>('adl')
  const [logs, setLogs] = useState<string[]>([])
  const [isRuffleLoaded, setIsRuffleLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const ruffleContainerRef = useRef<HTMLDivElement | null>(null)
  const rufflePlayerRef = useRef<any>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // Debugger States
  const [watchVariables, setWatchVariables] = useState<Record<string, {
    key: string
    value: string | number | boolean
    type: string
    timestamp: string
  }>>({})
  const [logFilter, setLogFilter] = useState<'all' | 'system' | 'traces' | 'errors'>('all')

  const isMountedRef = useRef(true)

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Process and extract trace data to variables debugger
  const processLogForVariables = (text: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    
    // 1. JSON IDEDEBUG parser
    if (text.includes('IDEDEBUG:')) {
      const idx = text.indexOf('IDEDEBUG:')
      const jsonStr = text.substring(idx + 9).trim()
      try {
        const parsed = JSON.parse(jsonStr)
        setWatchVariables((prev) => {
          const next = { ...prev }
          Object.keys(parsed).forEach((k) => {
            const val = parsed[k]
            next[k] = {
              key: k,
              value: val,
              type: typeof val,
              timestamp: timeStr
            }
          })
          return next
        })
      } catch (err) {
        console.error('Failed to parse IDEDEBUG JSON:', err)
      }
    }
    
    // 2. trace: key=value parser
    const traceRegex = /trace:\s*([a-zA-Z0-9_]+)\s*[:=]\s*([^\n\r]+)/i
    const match = text.match(traceRegex)
    if (match) {
      const k = match[1].trim()
      let valRaw = match[2].trim()
      let val: string | number | boolean = valRaw
      
      if (valRaw === 'true') val = true
      else if (valRaw === 'false') val = false
      else if (!isNaN(Number(valRaw)) && valRaw !== '') val = Number(valRaw)

      setWatchVariables((prev) => ({
        ...prev,
        [k]: {
          key: k,
          value: val,
          type: typeof val,
          timestamp: timeStr
        }
      }))
    }
  }

  // 1. Dynamic Ruffle Loading
  useEffect(() => {
    if (mode !== 'ruffle') return

    // Setup Ruffle Config
    window.RufflePlayer = window.RufflePlayer || {}
    window.RufflePlayer.config = {
      autoplay: 'on',
      unmuteOverlay: 'hidden',
      letterbox: 'on',
      warnOnUnsupportedContent: false,
      trace: (message: string) => {
        if (isMountedRef.current) {
          const formatted = `trace: ${message}`
          setLogs((prev) => [...prev, formatted])
          processLogForVariables(formatted)
        }
      }
    }

    let active = true

    if (document.getElementById('ruffle-cdn-script') && typeof window.RufflePlayer.newest === 'function') {
      setIsRuffleLoaded(true)
      const timer = setTimeout(() => {
        if (active && isMountedRef.current) {
          initRuffle()
        }
      }, 50)
      return () => {
        active = false
        clearTimeout(timer)
        destroyRuffle()
      }
    }

    // Remove stale script if Ruffle did not load properly (e.g. blocked by CSP earlier)
    const staleScript = document.getElementById('ruffle-cdn-script')
    if (staleScript) {
      staleScript.remove()
    }

    const script = document.createElement('script')
    script.id = 'ruffle-cdn-script'
    script.src = 'https://unpkg.com/@ruffle-rs/ruffle'
    script.async = true
    script.onload = () => {
      if (!active || !isMountedRef.current) return
      setIsRuffleLoaded(true)
      initRuffle()
    }
    script.onerror = () => {
      if (!active || !isMountedRef.current) return
      show('Gagal memuat Ruffle Emulator dari CDN. Periksa koneksi internet Anda.', 'error')
    }
    document.body.appendChild(script)

    return () => {
      active = false
      destroyRuffle()
    }
  }, [mode, swfPath])

  // 2. ADL Logs Listener
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSimulatorLog((text) => {
      if (isMountedRef.current) {
        setLogs((prev) => [...prev, text])
        processLogForVariables(text)
      }
    })
    return () => {
      unsubscribe()
      window.electronAPI.killAdl().catch(console.error)
    }
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const initRuffle = () => {
    if (!window.RufflePlayer || !ruffleContainerRef.current || !swfPath || !isMountedRef.current) return
    destroyRuffle()

    const ruffle = window.RufflePlayer
    let player
    if (typeof ruffle.newest === 'function') {
      player = ruffle.newest().createPlayer()
    } else if (typeof ruffle.createPlayer === 'function') {
      player = ruffle.createPlayer()
    } else {
      console.warn('Ruffle is not fully loaded yet.')
      return
    }
    
    // Style the player to fill container
    player.style.width = '100%'
    player.style.height = '100%'
    player.style.borderRadius = '12px'
    player.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)'

    ruffleContainerRef.current.appendChild(player)
    rufflePlayerRef.current = player

    // Load file via custom protocol ns-asset://load?path=...
    const nsUrl = `ns-asset://load?path=${encodeURIComponent(swfPath)}`
    player.load(nsUrl).catch((err: any) => {
      console.error('Ruffle load error:', err)
      setLogs((prev) => [...prev, `[Ruffle Error] Gagal memuat SWF: ${err.message || err}`])
    })

    setLogs((prev) => [...prev, `[Ruffle] Memuat berkas SWF: ${swfPath.split(/[\\/]/).pop()}`])
    setIsPlaying(true)
  }

  const destroyRuffle = () => {
    if (rufflePlayerRef.current) {
      try {
        rufflePlayerRef.current.remove()
      } catch (err) {
        console.error('Failed to remove ruffle player:', err)
      }
      rufflePlayerRef.current = null
    }
    if (ruffleContainerRef.current) {
      ruffleContainerRef.current.innerHTML = ''
    }
  }

  const handleTogglePlay = () => {
    if (!rufflePlayerRef.current) return
    if (isPlaying) {
      rufflePlayerRef.current.pause()
      setIsPlaying(false)
      setLogs((prev) => [...prev, '[Ruffle] Simulator dihentikan sementara (Paused)'])
    } else {
      rufflePlayerRef.current.play()
      setIsPlaying(true)
      setLogs((prev) => [...prev, '[Ruffle] Simulator dijalankan kembali (Playing)'])
    }
  }

  const handleRestart = () => {
    initRuffle()
    setLogs((prev) => [...prev, '[Ruffle] Mengulang pemuatan SWF...'])
  }

  const handleLaunchAdl = async () => {
    if (!swfPath) return
    setLogs((prev) => [...prev, '[ADL] Mempersiapkan peluncuran AIR Debug Launcher...'])
    
    const sdkPathSetting = localStorage.getItem('setting:compiler.sdkPath') || ''
    const res = await window.electronAPI.runAdl(swfPath, sdkPathSetting)
    
    if (res.success) {
      show('AIR Debug Launcher berhasil dimulai!', 'success')
      setLogs((prev) => [...prev, `[ADL] ${res.log}`])
    } else {
      show(res.log, 'error')
      setLogs((prev) => [...prev, `[ADL Error] ${res.log}`])
    }
  }

  const handleKillAdl = async () => {
    const killed = await window.electronAPI.killAdl()
    if (killed) {
      show('Simulator AIR berhasil dihentikan.', 'info')
    }
  }

  const clearLogs = () => {
    setLogs([])
    setWatchVariables({})
  }

  const filteredLogList = React.useMemo(() => {
    return logs.filter((log) => {
      if (logFilter === 'system') {
        return log.includes('[Ruffle]') || log.includes('[ADL]') || log.includes('[Mock]')
      }
      if (logFilter === 'traces') {
        return log.toLowerCase().includes('trace:') || log.includes('IDEDEBUG:')
      }
      if (logFilter === 'errors') {
        return log.includes('[Ruffle Error]') || log.includes('[ADL Error]') || log.toLowerCase().includes('error')
      }
      return true
    })
  }, [logs, logFilter])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none p-4 space-y-4 text-slate-200 animate-slide-in-right">
      
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900/60 pb-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Cpu className="text-indigo-400" size={22} />
            <span>Live Simulator Test Bed</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-xl">
            Target: {swfPath?.split(/[\\/]/).pop()}
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex bg-slate-950/60 border border-slate-900/80 p-0.5 rounded-xl">
          <button
            onClick={() => setMode('ruffle')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'ruffle'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor size={14} />
            <span>Ruffle WebAssembly</span>
          </button>
          <button
            onClick={() => {
              destroyRuffle()
              setMode('adl')
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'adl'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={14} />
            <span>AIR SDK ADL (Native)</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden min-h-0">
        
        {/* Left Columns (Simulator + Console) */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden min-h-0">
          
          {/* Playback / Simulator Area */}
          <div className="flex-1 flex flex-col bg-slate-950/30 border border-slate-900/60 rounded-2xl overflow-hidden relative">
            
            {/* Ruffle Mode Panel */}
            <div className={`flex-1 flex flex-col p-4 relative overflow-hidden ${mode === 'ruffle' ? '' : 'hidden'}`}>
              {/* Ruffle Mount Point */}
              <div 
                ref={ruffleContainerRef} 
                className="flex-1 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-900/80 relative"
                dangerouslySetInnerHTML={{ __html: '' }}
              />
              {!isRuffleLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-500 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-xs">Mengunduh Ruffle WebAssembly...</span>
                </div>
              )}

              {/* Ruffle Toolbar Controls */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-shrink-0">
                <button
                  onClick={handleTogglePlay}
                  disabled={!isRuffleLoaded}
                  className="w-10 h-10 rounded-full bg-indigo-650 hover:bg-indigo-600 active:scale-95 transition-all flex items-center justify-center shadow-lg disabled:opacity-40 cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={handleRestart}
                  disabled={!isRuffleLoaded}
                  className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center shadow-lg disabled:opacity-40 cursor-pointer"
                  title="Restart"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            {/* ADL Mode Panel */}
            <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 ${mode === 'adl' ? '' : 'hidden'}`}>
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400">
                <Monitor size={32} />
              </div>
              <div className="max-w-md">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  AIR Debug Launcher (ADL)
                </h3>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  Menjalankan game secara *native* menggunakan ADL dari Flex/AIR SDK portabel bawaan. Mode ini memberikan emulasi Flash Player 100% akurat beserta *debug trace output*.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleLaunchAdl}
                  className="btn btn-primary px-5 py-2.5 font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Play size={14} />
                  <span>Jalankan ADL</span>
                </button>
                <button
                  onClick={handleKillAdl}
                  className="btn btn-secondary px-5 py-2.5 font-bold text-xs flex items-center gap-2 border border-slate-800 cursor-pointer"
                >
                  <Pause size={14} />
                  <span>Hentikan ADL</span>
                </button>
              </div>
            </div>
          </div>

          {/* Console Area with Filter Tabs */}
          <div className="h-44 md:h-52 flex flex-col bg-slate-950/60 border border-slate-900/60 rounded-2xl overflow-hidden flex-shrink-0 min-h-0">
            <div className="px-4 py-2 border-b border-slate-900/80 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Terminal size={12} className="text-emerald-400" />
                  <span>Console</span>
                </span>
                
                {/* Filter Tabs */}
                <div className="flex bg-slate-950/40 p-0.5 rounded border border-slate-850 text-[9px] font-bold font-sans uppercase">
                  {(['all', 'system', 'traces', 'errors'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        logFilter === filter ? 'bg-indigo-650 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={clearLogs}
                className="text-slate-650 hover:text-red-405 p-1 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                title="Bersihkan Log"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 font-mono text-[10px] leading-relaxed space-y-0.5 bg-[#05080e] min-h-0 select-text">
              {filteredLogList.length === 0 ? (
                <div className="text-slate-700 italic select-none">Belum ada output log simulator...</div>
              ) : (
                filteredLogList.map((log, index) => {
                  let color = 'text-slate-400'
                  if (log.includes('[Ruffle Error]') || log.includes('[ADL Error]') || log.toLowerCase().includes('error')) color = 'text-red-400 font-semibold'
                  else if (log.includes('[Ruffle]') || log.includes('[ADL]')) color = 'text-indigo-400 font-medium'
                  else if (log.toLowerCase().includes('trace:')) color = 'text-emerald-450'
                  else if (log.includes('[Mock]')) color = 'text-slate-500'
                  
                  return (
                    <div key={index} className={`whitespace-pre-wrap ${color}`}>
                      {log}
                    </div>
                  )
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Right Column: Live Debug Watch & Emulator Stats */}
        <div className="lg:col-span-1 flex flex-col bg-slate-950/30 border border-slate-900/60 rounded-2xl overflow-hidden min-h-0 flex-shrink-0">
          <div className="px-4 py-2 border-b border-slate-900/80 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Activity size={12} className="text-indigo-400" />
              <span>Realtime Debug Watch</span>
            </span>
            <button
              onClick={() => {
                const mockTraces = [
                  "trace: character_name = ShadowNinja",
                  "trace: gold = 45200",
                  "trace: level = 32",
                  "trace: current_hp = 680",
                  "trace: max_hp = 1200",
                  "trace: experience = 8900",
                  "trace: target_boss = Wind_Sage",
                  "IDEDEBUG: {\"damage_dealt\": 3200, \"active_skill\": \"Katon: Dragon Fire\", \"combo_count\": 5}"
                ]
                mockTraces.forEach((log, i) => {
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      setLogs(prev => [...prev, `[Mock] ${log}`])
                      processLogForVariables(log)
                    }
                  }, i * 200)
                })
              }}
              className="text-[9px] font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-455 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              Simulate Traces
            </button>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-4 min-h-0">
            {/* Variable Table */}
            <div className="space-y-2.5">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Watch Variables</div>
              {Object.keys(watchVariables).length === 0 ? (
                <div className="text-xs text-slate-600 italic text-center py-6 px-4 leading-relaxed">
                  No trace variables logged yet. Log custom game data in your AS3 code like <code className="text-[10px] text-indigo-400 font-mono">trace("myVar = " + value)</code> or click "Simulate Traces" above.
                </div>
              ) : (
                <div className="border border-slate-900/60 rounded-xl overflow-hidden bg-slate-950/30">
                  <table className="w-full text-[11px] font-mono border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 text-slate-500 border-b border-slate-900/80">
                        <th className="px-2.5 py-1.5 text-left font-sans font-bold uppercase text-[9px]">Var</th>
                        <th className="px-2.5 py-1.5 text-left font-sans font-bold uppercase text-[9px]">Value</th>
                        <th className="px-2.5 py-1.5 text-right font-sans font-bold uppercase text-[9px]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/40">
                      {Object.values(watchVariables).map((v) => {
                        const isHp = v.key.toLowerCase().includes('hp') || v.key.toLowerCase().includes('health')
                        const isNumber = typeof v.value === 'number'
                        
                        return (
                          <React.Fragment key={v.key}>
                            <tr className="hover:bg-slate-900/20 transition-colors">
                              <td className="px-2.5 py-2 font-semibold text-slate-300 truncate max-w-[100px]" title={v.key}>
                                {v.key}
                              </td>
                              <td className="px-2.5 py-2 text-indigo-300 font-bold truncate max-w-[125px]" title={String(v.value)}>
                                {typeof v.value === 'boolean' ? (v.value ? 'true' : 'false') : String(v.value)}
                              </td>
                              <td className="px-2.5 py-2 text-right text-[10px] text-slate-500">
                                {v.timestamp}
                              </td>
                            </tr>
                            {/* Visual HP progress bar if max_hp is available */}
                            {isHp && isNumber && watchVariables['max_hp'] && v.key !== 'max_hp' && (
                              <tr key={`${v.key}-meter`}>
                                <td colSpan={3} className="px-2.5 pb-2">
                                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 transition-all duration-300"
                                      style={{ width: `${Math.min(100, (Number(v.value) / Number(watchVariables['max_hp'].value)) * 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[9px] text-slate-500 font-sans mt-0.5">
                                    <span>HP Meter</span>
                                    <span>{v.value} / {watchVariables['max_hp'].value}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Performance Stats */}
            <div className="border-t border-slate-900/60 pt-3.5 space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={12} className="text-slate-400" />
                <span>Emulator Stats</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-slate-950/20 border border-slate-900/40 flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase font-sans">Framerate</span>
                  <span className="font-bold text-slate-200">
                    {mode === 'ruffle' && isPlaying ? '60.0 FPS' : 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/20 border border-slate-900/40 flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase font-sans">Target Runtime</span>
                  <span className="font-bold text-indigo-400">
                    {mode === 'ruffle' ? 'Flash Player 10' : 'AIR Runtime'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/20 border border-slate-900/40 flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase font-sans">AVM Type</span>
                  <span className="font-bold text-slate-200">AVM2 (AS3)</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/20 border border-slate-900/40 flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase font-sans">Dimensions</span>
                  <span className="font-bold text-slate-200">800 x 600</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
