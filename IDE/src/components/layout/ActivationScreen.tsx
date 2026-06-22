import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { ShieldCheck, Key, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import logoUrl from '../../../resources/images/logo.png'

export default function ActivationScreen() {
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  const activateLicenseKey = useAppStore((s) => s.activateLicenseKey)

  useEffect(() => {
    window.electronAPI.getDeviceId().then(setDeviceId).catch(() => {})
  }, [])

  const formatKey = (value: string) => {
    return value.replace(/[^A-Za-z0-9._-]/g, '')
  }

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key')
      return
    }

    setActivating(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await activateLicenseKey(licenseKey.trim())
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Activation failed')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setActivating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !activating) {
      handleActivate()
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#080c14] flex items-center justify-center select-none">
        <div className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-xl font-extrabold text-white mb-2">License Activated</h1>
            <p className="text-sm text-slate-400 mb-6">
              WayangIDE is now fully licensed. Enjoy all features!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
            >
              Continue to App
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#080c14] flex items-center justify-center select-none">
      <div className="w-full max-w-lg p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoUrl} alt="WayangIDE Logo" className="w-14 h-14 rounded-xl object-cover shadow-lg shadow-indigo-900/30 mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight text-white">WayangIDE</h1>
          <p className="text-sm text-slate-500 mt-1">SWF Modding & ActionScript IDE</p>
        </div>

        {/* Activation Card */}
        <div className="bg-slate-950/60 border border-slate-900/80 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ShieldCheck size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Activate License</h2>
              <p className="text-[11px] text-slate-500">Enter your lifetime license key to unlock all features</p>
            </div>
          </div>

          {/* Key Input */}
          <div className="mb-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
              License Key
            </label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-3 text-slate-600" />
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(formatKey(e.target.value))
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                disabled={activating}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-500/60 transition-all disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 mb-4 bg-rose-950/30 border border-rose-900/30 rounded-lg">
              <AlertCircle size={14} className="text-rose-400 shrink-0" />
              <span className="text-[11px] text-rose-300">{error}</span>
            </div>
          )}

          {/* Activate Button */}
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {activating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Activating...
              </>
            ) : (
              'Activate License'
            )}
          </button>

          {/* Device ID */}
          {deviceId && (
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <p className="text-[10px] text-slate-600 text-center">
                Device ID: <span className="font-mono">{deviceId}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-600 text-center mt-4">
          License key is provided upon purchase. Each key is bound to one device.
        </p>
      </div>
    </div>
  )
}
