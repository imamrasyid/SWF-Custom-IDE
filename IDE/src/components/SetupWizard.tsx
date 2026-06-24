import React, { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app-store'
import {
  Download,
  FolderOpen,
  AlertTriangle,
  Cpu,
  CheckCircle,
  RefreshCw,
  Play,
  HardDrive,
  Pause
} from 'lucide-react'

export const SetupWizard: React.FC = () => {
  const {
    binariesStatus,
    downloadState,
    diskSpaceCheck,
    checkBinariesStatus,
    checkDiskSpace,
    startBinariesDownload,
    cancelBinariesDownload,
    selectLocalPath
  } = useAppStore()

  const [wizardStep, setWizardStep] = useState<'welcome' | 'downloading' | 'manual'>('welcome')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    checkBinariesStatus()
    checkDiskSpace()
  }, [])

  useEffect(() => {
    if (downloadState.status === 'completed') {
      setErrorMessage(null)
    } else if (downloadState.status === 'error' && downloadState.error) {
      setErrorMessage(downloadState.error)
      setWizardStep('welcome')
    }
  }, [downloadState.status, downloadState.error])

  const handleStartDownload = async () => {
    if (!diskSpaceCheck.hasEnoughSpace) {
      const confirm = window.confirm(
        'Warning: Low disk space detected. Downloading and extracting binaries might fail. Proceed anyway?'
      )
      if (!confirm) return
    }
    setWizardStep('downloading')
    setErrorMessage(null)
    const success = await startBinariesDownload()
    if (!success) {
      setWizardStep('welcome')
    }
  }

  const getStatusText = () => {
    switch (downloadState.status) {
      case 'downloading':
        return `Downloading ${downloadState.file}...`
      case 'verifying':
        return `Verifying integrity of ${downloadState.file}...`
      case 'extracting':
        return `Extracting ${downloadState.file} (using native tar)...`
      case 'completed':
        return 'Installation completed! Preparing IDE...'
      default:
        return 'Starting installation...'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-slate-100 font-sans p-6 select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4 animate-pulse">
            <Cpu className="w-9 h-9 text-slate-100" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            WayangIDE Setup Wizard
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            WayangIDE requires Java Runtime Environment, JPEXS Decompiler (FFDec), and Flex SDK compiler to mod and compile ActionScript 3.
          </p>
        </div>

        {/* Step: Welcome */}
        {wizardStep === 'welcome' && (
          <div className="w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Status Checks list */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/50 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dependency Status</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Java Runtime Environment (JRE)</span>
                {binariesStatus.jre.installed ? (
                  <span className="flex items-center text-emerald-400 gap-1.5"><CheckCircle className="w-4 h-4" /> Configured</span>
                ) : (
                  <span className="flex items-center text-amber-500 gap-1.5"><AlertTriangle className="w-4 h-4" /> Missing</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">JPEXS Flash Decompiler (FFDec)</span>
                {binariesStatus.ffdec.installed ? (
                  <span className="flex items-center text-emerald-400 gap-1.5"><CheckCircle className="w-4 h-4" /> Configured</span>
                ) : (
                  <span className="flex items-center text-amber-500 gap-1.5"><AlertTriangle className="w-4 h-4" /> Missing</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Flex SDK Compiler (mxmlc)</span>
                {binariesStatus.flexSdk.installed ? (
                  <span className="flex items-center text-emerald-400 gap-1.5"><CheckCircle className="w-4 h-4" /> Configured</span>
                ) : (
                  <span className="flex items-center text-amber-500 gap-1.5"><AlertTriangle className="w-4 h-4" /> Missing</span>
                )}
              </div>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-300">Setup failed</h4>
                  <p className="text-xs text-red-400/90 mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Disk Space Warning */}
            {!diskSpaceCheck.hasEnoughSpace && (
              <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4 flex gap-3 items-start">
                <HardDrive className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-300">Low disk space</h4>
                  <p className="text-xs text-amber-400/90 mt-1">
                    You only have {(diskSpaceCheck.freeBytes / (1024 * 1024)).toFixed(0)}MB free space. 500MB is required.
                  </p>
                </div>
              </div>
            )}

            {/* Setup Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleStartDownload}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-cyan-500/10 to-blue-600/5 hover:from-cyan-500/20 hover:to-blue-600/10 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl transition duration-200 cursor-pointer text-center group"
              >
                <Download className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition duration-200" />
                <span className="text-sm font-bold text-slate-200 mt-3">Auto Download</span>
                <span className="text-xs text-slate-400 mt-1">Download components automatically (~120MB)</span>
              </button>

              <button
                onClick={() => setWizardStep('manual')}
                className="flex flex-col items-center justify-center p-6 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl transition duration-200 cursor-pointer text-center group"
              >
                <FolderOpen className="w-8 h-8 text-slate-400 group-hover:scale-110 transition duration-200" />
                <span className="text-sm font-bold text-slate-200 mt-3">Locate Locally</span>
                <span className="text-xs text-slate-400 mt-1">Use pre-installed folders from your computer</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: Downloading */}
        {wizardStep === 'downloading' && (
          <div className="w-full flex flex-col space-y-6 items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="relative w-full bg-slate-950 rounded-xl p-6 border border-slate-800 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin mb-4" />
              <h3 className="text-md font-semibold text-slate-200 text-center">
                {getStatusText()}
              </h3>
              
              {downloadState.status === 'downloading' && (
                <div className="w-full mt-6 space-y-4 flex flex-col items-center">
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{downloadState.percent}%</span>
                      <span>{downloadState.speed}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${downloadState.percent}%` }}
                      />
                    </div>
                    <div className="text-center text-[10px] text-slate-500 mt-1">
                      {((downloadState.downloadedBytes || 0) / (1024 * 1024)).toFixed(1)}MB of {((downloadState.totalBytes || 0) / (1024 * 1024)).toFixed(1)}MB
                    </div>
                  </div>
                  
                  <button
                    onClick={async () => {
                      await cancelBinariesDownload()
                      setWizardStep('welcome')
                    }}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 border border-slate-850 hover:border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition duration-150 text-slate-300"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Manual Configuration */}
        {wizardStep === 'manual' && (
          <div className="w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-4">
              {/* Java Path picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Java Executable Path (java.exe)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={binariesStatus.jre.path || 'Not Configured'}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  />
                  <button
                    onClick={() => selectLocalPath('jre')}
                    className="px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition duration-150"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Browse
                  </button>
                </div>
              </div>

              {/* FFDec Path picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">FFDec Jar or Exe Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={binariesStatus.ffdec.path || 'Not Configured'}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  />
                  <button
                    onClick={() => selectLocalPath('ffdec')}
                    className="px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition duration-150"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Browse
                  </button>
                </div>
              </div>

              {/* Flex SDK Path picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Flex/AIR SDK Root Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={binariesStatus.flexSdk.path || 'Not Configured'}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  />
                  <button
                    onClick={() => selectLocalPath('flexSdk')}
                    className="px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition duration-150"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Browse
                  </button>
                </div>
              </div>
            </div>

            {/* Manual actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setWizardStep('welcome')}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-xs font-bold rounded-lg cursor-pointer transition duration-150 text-slate-300"
              >
                Back
              </button>

              <button
                onClick={async () => {
                  const hasMissing = await checkBinariesStatus()
                  if (!hasMissing) {
                    // Start application
                  } else {
                    alert('Please configure all required paths before continuing.')
                  }
                }}
                disabled={!binariesStatus.jre.installed || !binariesStatus.ffdec.installed || !binariesStatus.flexSdk.installed}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-blue-500 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition duration-150"
              >
                <Play className="w-3.5 h-3.5" /> Launch IDE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
