import { Download, X, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'

export default function UpdateBanner() {
  const updateStatus = useAppStore((s) => s.updateStatus)
  const updateInfo = useAppStore((s) => s.updateInfo)
  const updateProgress = useAppStore((s) => s.updateProgress)
  const updateError = useAppStore((s) => s.updateError)
  const showUpdateBanner = useAppStore((s) => s.showUpdateBanner)
  const setShowUpdateBanner = useAppStore((s) => s.setShowUpdateBanner)
  const downloadUpdate = useAppStore((s) => s.downloadUpdate)
  const installUpdate = useAppStore((s) => s.installUpdate)
  const checkForUpdates = useAppStore((s) => s.checkForUpdates)

  if (!showUpdateBanner) return null

  return (
    <div className="fixed bottom-14 right-4 z-[9999] w-[380px] bg-[#0c1220] border border-slate-800/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          {updateStatus === 'error' ? (
            <AlertCircle size={15} className="text-red-400" />
          ) : updateStatus === 'downloaded' ? (
            <Check size={15} className="text-emerald-400" />
          ) : (
            <Download size={15} className="text-indigo-400" />
          )}
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {updateStatus === 'checking' && 'Checking for updates...'}
            {updateStatus === 'available' && `Update Available: v${updateInfo?.version}`}
            {updateStatus === 'downloading' && 'Downloading Update...'}
            {updateStatus === 'downloaded' && 'Update Ready to Install'}
            {updateStatus === 'up-to-date' && 'Up to Date'}
            {updateStatus === 'error' && 'Update Error'}
          </span>
        </div>
        <button
          onClick={() => setShowUpdateBanner(false)}
          className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {updateStatus === 'checking' && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <RefreshCw size={13} className="animate-spin text-indigo-400" />
            <span>Checking for new versions...</span>
          </div>
        )}

        {updateStatus === 'available' && updateInfo && (
          <div className="flex flex-col gap-2.5">
            {updateInfo.releaseNotes && (
              <div className="text-[11px] text-slate-400 max-h-[80px] overflow-y-auto custom-scrollbar leading-relaxed">
                {typeof updateInfo.releaseNotes === 'string'
                  ? updateInfo.releaseNotes
                  : Array.isArray(updateInfo.releaseNotes)
                    ? updateInfo.releaseNotes.map((n, i) => (
                        <span key={i}>{n.note}</span>
                      ))
                    : null}
              </div>
            )}
            <button
              onClick={downloadUpdate}
              className="btn btn-primary flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold cursor-pointer"
            >
              <Download size={12} />
              Download v{updateInfo.version}
            </button>
          </div>
        )}

        {updateStatus === 'downloading' && updateProgress && (
          <div className="flex flex-col gap-2">
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(updateProgress.percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{Math.round(updateProgress.percent)}%</span>
              <span>
                {(updateProgress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s
              </span>
            </div>
          </div>
        )}

        {updateStatus === 'downloaded' && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-slate-400">
              Update has been downloaded. Restart to apply.
            </p>
            <button
              onClick={installUpdate}
              className="btn btn-primary flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold cursor-pointer"
            >
              <RefreshCw size={12} />
              Restart & Install
            </button>
          </div>
        )}

        {updateStatus === 'up-to-date' && (
          <p className="text-[11px] text-slate-500">
            You are running the latest version.
          </p>
        )}

        {updateStatus === 'error' && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-red-400">
              {updateError || 'Failed to check for updates. Please try again.'}
            </p>
            <button
              onClick={checkForUpdates}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
