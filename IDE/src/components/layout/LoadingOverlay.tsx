import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { Cpu } from 'lucide-react'

export default function LoadingOverlay() {
  const isLoading = useAppStore((s) => s.isLoading)
  const loadingStatus = useAppStore((s) => s.loadingStatus)
  const [progress, setProgress] = useState(0)

  // Simulate progress smoothly
  useEffect(() => {
    if (!isLoading) {
      setProgress(0)
      return
    }

    setProgress(5)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95
        const increment = Math.max(1, (95 - prev) / 15)
        return Math.min(95, prev + increment)
      })
    }, 350)

    return () => clearInterval(interval)
  }, [isLoading])

  if (!isLoading) return null

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        {/* Neon Concentric Spinner */}
        <div className="loading-glow-ring">
          <Cpu size={24} className="text-indigo-400 animate-pulse" />
        </div>

        {/* Status texts */}
        <div className="space-y-2 mt-2 w-full">
          <div className="loading-status-text px-2">{loadingStatus}</div>
          
          {/* Simulated progress bar */}
          <div className="w-full bg-slate-900/60 border border-slate-900 rounded-full h-2.5 overflow-hidden p-[2px] shadow-inner">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-indigo-400 font-bold font-mono tracking-wider">
            {Math.round(progress)}%
          </div>

          <div className="loading-sub-text">Mengekstrak & memproses data game flash...</div>
        </div>
      </div>
    </div>
  )
}
