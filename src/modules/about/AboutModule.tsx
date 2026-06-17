import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { Info, Monitor, Cpu, HardDrive, Terminal, RefreshCw, Github, ExternalLink, FileCode, Zap, Code2, Boxes, Globe, Shield, ShieldCheck } from 'lucide-react'

type SystemInfo = {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  v8Version: string
  osPlatform: string
  osRelease: string
  osType: string
  osArch: string
  cpuCores: number
  totalMemory: string
  flexSdkPath: string
  ffdecPath: string
}

const REPO_URL = 'https://github.com/imamrasyid/SWF-Custom-IDE'

const techStack = [
  { name: 'Electron', icon: Zap, desc: 'Desktop Runtime', color: 'text-cyan-400' },
  { name: 'Vite', icon: Boxes, desc: 'Build Tool', color: 'text-purple-400' },
  { name: 'React', icon: Code2, desc: 'UI Framework', color: 'text-sky-400' },
  { name: 'TypeScript', icon: FileCode, desc: 'Type System', color: 'text-blue-400' },
  { name: 'Monaco Editor', icon: Terminal, desc: 'Code Editor', color: 'text-emerald-400' },
  { name: 'FFDec (JPEXS)', icon: FileCode, desc: 'SWF Decompiler', color: 'text-amber-400' },
  { name: 'Apache Flex SDK', icon: Boxes, desc: 'AS3 Compiler', color: 'text-rose-400' },
]

const credits = [
  { label: 'JPEXS Free Flash Decompiler', url: 'https://github.com/nickyur/swf2java' },
  { label: 'Monaco Editor (Microsoft)', url: 'https://microsoft.github.io/monaco-editor/' },
  { label: 'Apache Flex SDK', url: 'https://flex.apache.org/' },
  { label: 'Electron', url: 'https://www.electronjs.org/' },
]

export default function AboutModule() {
  const currentVersion = useAppStore((s) => s.currentVersion)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const checkForUpdates = useAppStore((s) => s.checkForUpdates)
  const installUpdate = useAppStore((s) => s.installUpdate)
  const licenseInfo = useAppStore((s) => s.licenseInfo)
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    window.electronAPI.getSystemInfo().then((info) => {
      setSysInfo(info)
    }).catch(() => {})
  }, [])

  const formatPlatform = (p: string) => {
    switch (p) {
      case 'win32': return 'Windows'
      case 'darwin': return 'macOS'
      case 'linux': return 'Linux'
      default: return p
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-6 animate-slide-in-right select-none">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-slate-900/60 shrink-0">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-900/30 shrink-0">
          <span className="text-xl font-black text-white tracking-tighter">NS</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-white">NinjaSage Modding Toolkit</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">SWF Modding & ActionScript IDE</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 bg-indigo-950/50 border border-indigo-900/30 rounded-full text-[10px] font-bold text-indigo-400 tracking-wider">
            v{currentVersion || '1.0.0'}
          </span>
          <button
            onClick={checkForUpdates}
            disabled={updateStatus === 'checking'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={10} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
            {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>
      </div>

      {updateStatus === 'downloaded' && (
        <div className="flex items-center justify-between mt-3 px-3 py-2 bg-emerald-950/30 border border-emerald-900/30 rounded-lg shrink-0">
          <span className="text-[11px] text-emerald-400 font-medium">Update downloaded and ready to install</span>
          <button
            onClick={installUpdate}
            className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
          >
            Restart Now
          </button>
        </div>
      )}

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-2 gap-4 mt-4 min-h-0 overflow-hidden">

        {/* Left column */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">

          {/* System Info */}
          <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="card-title shrink-0">
              <div className="flex items-center gap-2">
                <Monitor size={13} className="text-indigo-400" />
                <span>System Information</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 min-h-0">
              {sysInfo ? (
                <>
                  <InfoRow label="OS" value={`${formatPlatform(sysInfo.osPlatform)} ${sysInfo.osRelease}`} icon={Monitor} />
                  <InfoRow label="Architecture" value={sysInfo.osArch} icon={Cpu} />
                  <InfoRow label="CPU" value={`${sysInfo.cpuCores} cores`} icon={Cpu} />
                  <InfoRow label="Memory" value={sysInfo.totalMemory} icon={HardDrive} />
                  <InfoRow label="Electron" value={sysInfo.electronVersion} icon={Zap} />
                  <InfoRow label="Chrome" value={sysInfo.chromeVersion} icon={Globe} />
                  <InfoRow label="Node.js" value={sysInfo.nodeVersion} icon={Terminal} />
                  <InfoRow label="V8 Engine" value={sysInfo.v8Version} icon={Code2} />
                  <InfoRow label="Flex SDK" value={sysInfo.flexSdkPath} icon={Boxes} />
                  <InfoRow label="FFDec CLI" value={sysInfo.ffdecPath} icon={FileCode} />
                </>
              ) : (
                <div className="p-4 text-[11px] text-slate-600 italic">Loading system info...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">

          {/* Tech Stack */}
          <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="card-title shrink-0">
              <div className="flex items-center gap-2">
                <Boxes size={13} className="text-indigo-400" />
                <span>Tech Stack</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              <div className="grid grid-cols-1 gap-1.5">
                {techStack.map((tech) => (
                  <div key={tech.name} className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-950/40 border border-slate-900/60 rounded-lg">
                    <tech.icon size={13} className={tech.color} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-200">{tech.name}</p>
                      <p className="text-[9px] text-slate-600">{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4 mt-4 shrink-0">

        {/* Credits */}
        <div className="card">
          <div className="card-title">
            <div className="flex items-center gap-2">
              <ExternalLink size={13} className="text-indigo-400" />
              <span>Credits & Links</span>
            </div>
          </div>
          <div className="divide-y divide-slate-900/60">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 hover:bg-slate-900/30 transition-colors group"
            >
              <Github size={13} className="text-slate-500 group-hover:text-white" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate">GitHub Repository</p>
              </div>
              <ExternalLink size={10} className="text-slate-700 group-hover:text-slate-400 shrink-0" />
            </a>
            {credits.map((c) => (
              <a
                key={c.label}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-900/30 transition-colors group"
              >
                <ExternalLink size={13} className="text-slate-500 group-hover:text-indigo-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate">{c.label}</p>
                </div>
                <ExternalLink size={10} className="text-slate-700 group-hover:text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* License */}
        <div className="card">
          <div className="card-title">
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-indigo-400" />
              <span>License</span>
            </div>
          </div>
          <div className="p-4">
            {licenseInfo.licenseId ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-400">Activated</span>
                </div>
                <div className="space-y-1">
                  <InfoRow label="License ID" value={licenseInfo.licenseId} icon={ShieldCheck} />
                  <InfoRow label="Type" value={licenseInfo.type || 'lifetime'} icon={Shield} />
                  <InfoRow label="Features" value={licenseInfo.features.join(', ') || 'all'} icon={Info} />
                  <InfoRow label="Activated" value={licenseInfo.activatedAt ? new Date(licenseInfo.activatedAt).toLocaleDateString() : 'N/A'} icon={Info} />
                  <InfoRow label="Device" value={licenseInfo.deviceBound ? 'Bound' : 'Unbound'} icon={Monitor} />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  No license activated
                </p>
                <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
                  Enter a valid license key to unlock all features of NinjaSage Modding Toolkit.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={11} className="text-slate-600 shrink-0" />
        <span className="text-[11px] text-slate-400 truncate">{label}</span>
      </div>
      <span className="text-[11px] text-slate-300 font-mono ml-2 shrink-0">{value}</span>
    </div>
  )
}
