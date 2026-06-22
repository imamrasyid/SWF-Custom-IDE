import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Terminal, Send, RefreshCw, Play, Loader2, Check, AlertCircle, Database, Activity } from 'lucide-react'
import Editor from '@monaco-editor/react'

type AmfService = {
  id: string
  service: string
  phase: number
  status: 'live' | 'planned' | 'legacy' | string
  legacy: string[]
  server: {
    controller: string
    method: string
    wraps: string | null
  }
  client: string[]
}

export default function AmfBuilderModule() {
  const { show } = useToast()
  const projectRoot = useAppStore((s) => s.projectRoot)

  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<AmfService[]>([])
  const [auditData, setAuditData] = useState<any>(null)
  
  // Scaffold form states
  const [domain, setDomain] = useState('')
  const [action, setAction] = useState('')
  const [wraps, setWraps] = useState('')
  const [legacyKey, setLegacyKey] = useState('')
  const [client, setClient] = useState('')
  const [phase, setPhase] = useState(2)
  
  // Scaffold result states
  const [executing, setExecuting] = useState(false)
  const [outputLogs, setOutputLogs] = useState<string[]>([])
  const [previewCode, setPreviewCode] = useState<string>('')
  
  // Tab/View states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scaffold'>('dashboard')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (projectRoot) {
      loadServices()
    }
  }, [projectRoot])

  const loadServices = async () => {
    if (!projectRoot) return
    setLoading(true)
    try {
      const data = await window.electronAPI.amfGetServices(projectRoot)
      if (data.migrated && data.migrated.services) {
        setServices(data.migrated.services)
      }
      if (data.audit) {
        setAuditData(data.audit)
      }
    } catch (err) {
      console.error(err)
      show('Failed to load AMF services metadata', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRunScaffold = async (apply: boolean) => {
    if (!projectRoot) return
    if (!domain.trim() || !action.trim()) {
      show('Domain and Action fields are required', 'warning')
      return
    }

    setExecuting(true)
    setOutputLogs([])
    try {
      const result = await window.electronAPI.amfScaffold(projectRoot, {
        domain: domain.trim(),
        action: action.trim(),
        wraps: wraps.trim() || undefined,
        legacyKey: legacyKey.trim() || undefined,
        client: client.trim() || undefined,
        phase,
        apply
      })

      const logs = result.stdout.split(/\r?\n/).concat(result.stderr.split(/\r?\n/)).filter(Boolean)
      setOutputLogs(logs)

      if (result.code === 0) {
        show(apply ? 'AMF Service Scaffolded and Applied!' : 'Dry run successful! Stub preview loaded.', 'success')
        
        // Extract controller stub code from stdout for preview
        const stubMatch = result.stdout.match(/--- 4\. Controller stub ---\r?\nFile: [^\r\n]+\r?\n\r?\n([\s\S]+?)\r?\n\r?\n--- 5\. After implementation ---/)
        if (stubMatch && stubMatch[1]) {
          setPreviewCode(stubMatch[1])
        } else {
          setPreviewCode('')
        }

        if (apply) {
          // Reset form fields
          setDomain('')
          setAction('')
          setWraps('')
          setLegacyKey('')
          setClient('')
          loadServices() // refresh list
        }
      } else {
        show('Scaffolding script failed', 'error')
      }
    } catch (err: any) {
      console.error(err)
      show('Execution error: ' + (err.message || String(err)), 'error')
    } finally {
      setExecuting(false)
    }
  }

  const filteredServices = services.filter(svc => {
    const matchesStatus = filterStatus === 'all' || svc.status === filterStatus
    const matchesSearch = 
      svc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      svc.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (svc.server.wraps && svc.server.wraps.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  if (!projectRoot) {
    return (
      <div className="module-empty flex flex-col items-center justify-center p-8 text-slate-500 h-full bg-[#070b13]">
        <Terminal size={48} className="mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">WayangIDE Project Required</p>
        <p className="text-xs text-slate-600 mt-1">Please open a valid WayangIDE project to build AMF Services.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden w-full select-none bg-[#070a13] text-slate-200">
      
      {/* Module Header */}
      <div className="px-6 py-4 border-b border-slate-900/60 bg-slate-950/20 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            <Terminal className="text-indigo-400" size={18} />
            <span>AMF Service Builder</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Audit, register, and scaffold AMF service endpoints (controllers, gateway mapping, AS3 client constants).
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-900">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all uppercase ${
              activeTab === 'dashboard'
                ? 'bg-indigo-650 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('scaffold')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all uppercase ${
              activeTab === 'scaffold'
                ? 'bg-indigo-650 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            Scaffold Service
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'dashboard' ? (
          <div className="flex-1 flex flex-col min-h-0 p-6 gap-6">
            
            {/* Top Dashboard Analytics Widget */}
            {auditData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-none">
                <div className="bg-slate-950/30 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Activity size={10} className="text-indigo-400" />
                    <span>Mapped Services</span>
                  </span>
                  <span className="text-xl font-extrabold text-white">{auditData.mapped}</span>
                </div>
                <div className="bg-slate-950/30 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Check size={10} className="text-emerald-400" />
                    <span>Live in AS3</span>
                  </span>
                  <span className="text-xl font-extrabold text-emerald-400">{auditData.registeredAndInAs3}</span>
                </div>
                <div className="bg-slate-950/30 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <AlertCircle size={10} className="text-pink-400" />
                    <span>Extra Mapped</span>
                  </span>
                  <span className="text-xl font-extrabold text-pink-400">{auditData.extraInMapOnly}</span>
                </div>
                <div className="bg-slate-950/30 border border-slate-900/60 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Database size={10} className="text-indigo-400" />
                    <span>Migration Progress</span>
                  </span>
                  <span className="text-xl font-extrabold text-indigo-400">
                    {((auditData.registeredAndInAs3 / auditData.mapped) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Service Search & Table Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between flex-none bg-slate-950/40 border border-slate-900/80 rounded-xl p-3">
              <div className="relative flex-1 max-w-md w-full">
                <input
                  className="search-input w-full text-xs py-2 pl-3"
                  type="text"
                  placeholder="Search service names, endpoints, stubs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900 text-xs">
                  {['all', 'live', 'planned'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                        filterStatus === status
                          ? 'bg-indigo-650/20 border border-indigo-500/20 text-indigo-300'
                          : 'bg-transparent text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <button
                  onClick={loadServices}
                  disabled={loading}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Reload list"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Mapped Services Table */}
            <div className="flex-1 min-h-0 bg-slate-950/20 border border-slate-900/60 rounded-xl overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-450 uppercase text-[10px] tracking-wider border-b border-slate-900/80 sticky top-0">
                      <th className="py-3 px-4 font-extrabold">Service Target</th>
                      <th className="py-3 px-4 font-extrabold">Controller Method</th>
                      <th className="py-3 px-4 font-extrabold">Phase</th>
                      <th className="py-3 px-4 font-extrabold">Wraps Legacy</th>
                      <th className="py-3 px-4 font-extrabold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                          No services matched current search parameters.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((svc) => (
                        <tr key={svc.id} className="border-b border-slate-900/40 hover:bg-slate-900/25 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-white break-all">{svc.service}</td>
                          <td className="py-2.5 px-4 text-slate-350 truncate max-w-[200px]" title={svc.server.controller}>
                            {svc.server.controller.split('/').pop()} → <span className="text-indigo-400 font-bold">{svc.server.method}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-400">Phase {svc.phase}</td>
                          <td className="py-2.5 px-4 text-slate-400 break-all">{svc.server.wraps || 'None'}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              svc.status === 'live'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {svc.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            
            {/* Left Column: Form Controls */}
            <div className="w-[420px] shrink-0 border-r border-slate-900 p-6 overflow-y-auto flex flex-col gap-4">
              <div className="border-b border-slate-900 pb-3 mb-1 flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest">
                  Create AMF Service Stub
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-full">
                  DarkblowSaga Namespace
                </span>
              </div>

              {/* Form Input: Domain */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                  PascalCase Domain (e.g. Gear, Pet, Auth)
                </label>
                <input
                  type="text"
                  className="search-input w-full text-xs py-2 px-3"
                  placeholder="e.g. Gear"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>

              {/* Form Input: Action */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                  camelCase Action (e.g. equip, startQuest)
                </label>
                <input
                  type="text"
                  className="search-input w-full text-xs py-2 px-3"
                  placeholder="e.g. equip"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                />
              </div>

              {/* Form Input: Wraps legacy method */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Legacy Wraps Method (Optional)</span>
                  <span className="text-[9px] text-slate-550 capitalize font-medium">e.g. Controller.method</span>
                </label>
                <input
                  type="text"
                  className="search-input w-full text-xs py-2 px-3"
                  placeholder="e.g. SystemCharacter.equipOutfit"
                  value={wraps}
                  onChange={(e) => setWraps(e.target.value)}
                />
              </div>

              {/* Form Input: Legacy Obfuscated Key */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Legacy Obfuscated key (Optional)</span>
                  <span className="text-[9px] text-slate-550 lowercase font-medium">e.g. namespace.obfuscatedKey</span>
                </label>
                <input
                  type="text"
                  className="search-input w-full text-xs py-2 px-3"
                  placeholder="e.g. 5JaVmAo5oMIuPEGT.Gfz8MRbEPd7K"
                  value={legacyKey}
                  onChange={(e) => setLegacyKey(e.target.value)}
                />
              </div>

              {/* Form Input: Client File Location */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                  Client File (Relative to export/scripts) (Optional)
                </label>
                <input
                  type="text"
                  className="search-input w-full text-xs py-2 px-3"
                  placeholder="e.g. Panels/UI_Gear.as"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>

              {/* Form Input: Migration Phase */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                  Migration Phase
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(Number(e.target.value))}
                  className="search-input w-full text-xs py-2 px-2.5 bg-[#090d16]"
                >
                  <option value={1}>Phase 1 (Core & Bootstraps)</option>
                  <option value={2}>Phase 2 (Gameplay & Panels)</option>
                  <option value={3}>Phase 3 (Events & PVP)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-3 border-t border-slate-900/60 pt-4 shrink-0">
                <button
                  onClick={() => handleRunScaffold(false)}
                  disabled={executing}
                  className="flex-1 btn btn-secondary font-bold text-xs py-2 px-3 justify-center flex items-center gap-2 cursor-pointer"
                >
                  {executing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>Dry Run</span>
                </button>
                <button
                  onClick={() => handleRunScaffold(true)}
                  disabled={executing}
                  className="flex-1 btn btn-primary font-bold text-xs py-2 px-3 justify-center flex items-center gap-2 cursor-pointer"
                >
                  {executing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Apply Scaffold</span>
                </button>
              </div>
            </div>

            {/* Right Column: Stub & Logs Output Console */}
            <div className="flex-1 min-w-0 flex flex-col bg-[#05070c]">
              
              {/* Output Top Bar */}
              <div className="px-5 py-2.5 border-b border-slate-900 bg-slate-950/20 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal size={12} className="text-indigo-400" />
                  <span>Output & Controller Stub Preview</span>
                </span>
                
                {previewCode && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                    PREVIEW GENERATED
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                {previewCode ? (
                  <div className="flex-1 min-h-0 relative">
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      theme="vs-dark"
                      value={previewCode}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 11,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 8 }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-600 gap-1.5">
                    <Terminal size={32} className="text-slate-700" />
                    <span className="text-xs font-semibold">Ready to Scaffold</span>
                    <span className="text-[10px] text-slate-650 max-w-xs text-center leading-normal">
                      Fill out the form and hit **Dry Run** to generate the controller code stub preview here.
                    </span>
                  </div>
                )}

                {/* Console Logs */}
                {outputLogs.length > 0 && (
                  <div className="h-44 border-t border-slate-900 bg-black flex flex-col shrink-0">
                    <div className="px-4 py-1.5 border-b border-slate-950 flex items-center text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20 shrink-0">
                      Terminal Logs
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] text-slate-350 select-text leading-relaxed">
                      {outputLogs.map((log, idx) => (
                        <div key={idx} className={log.startsWith('---') || log.startsWith('===') ? 'text-indigo-400 font-bold' : log.includes('Failed') || log.includes('error') ? 'text-red-400' : ''}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

    </div>
  )
}
