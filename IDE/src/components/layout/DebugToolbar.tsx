import { useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Play, Pause, SkipForward, ArrowDown, ArrowUp, Square, RotateCcw, Bug } from 'lucide-react'

export default function DebugToolbar() {
  const { show } = useToast()
  const swfPath = useAppStore((s) => s.swfPath)
  const isDebugging = useAppStore((s) => s.isDebugging)
  const isPaused = useAppStore((s) => s.isPaused)
  const setDebugging = useAppStore((s) => s.setDebugging)
  const setPaused = useAppStore((s) => s.setPaused)
  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition)
  const addDebugOutput = useAppStore((s) => s.addDebugOutput)
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    if (!swfPath) {
      show('No SWF file loaded', 'warning')
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI.debugStart(swfPath)
      if (result.success) {
        setDebugging(true)
        show('Debug session started', 'success')
        addDebugOutput('[Debug] Session started')
      } else {
        show(`Failed to start debugger: ${result.error}`, 'error')
      }
    } catch (err: any) {
      show(`Debug error: ${err.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    try {
      await window.electronAPI.debugStop()
      setDebugging(false)
      setPaused(false)
      setCurrentPosition(null, null)
      show('Debug session stopped', 'info')
      addDebugOutput('[Debug] Session stopped')
    } catch (err: any) {
      show(`Failed to stop debugger: ${err.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async () => {
    try {
      await window.electronAPI.debugContinue()
      setPaused(false)
      addDebugOutput('[Debug] Continuing...')
    } catch (err: any) {
      show(`Failed to continue: ${err.message}`, 'error')
    }
  }

  const handlePause = async () => {
    try {
      await window.electronAPI.debugPause()
      setPaused(true)
      addDebugOutput('[Debug] Paused')
    } catch (err: any) {
      show(`Failed to pause: ${err.message}`, 'error')
    }
  }

  const handleStepOver = async () => {
    try {
      await window.electronAPI.debugStepOver()
      addDebugOutput('[Debug] Step over')
    } catch (err: any) {
      show(`Failed to step over: ${err.message}`, 'error')
    }
  }

  const handleStepIn = async () => {
    try {
      await window.electronAPI.debugStepIn()
      addDebugOutput('[Debug] Step in')
    } catch (err: any) {
      show(`Failed to step in: ${err.message}`, 'error')
    }
  }

  const handleStepOut = async () => {
    try {
      await window.electronAPI.debugStepOut()
      addDebugOutput('[Debug] Step out')
    } catch (err: any) {
      show(`Failed to step out: ${err.message}`, 'error')
    }
  }

  const handleRestart = async () => {
    await handleStop()
    await handleStart()
  }

  if (!swfPath) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[#0a0f1a] border-b border-slate-800">
      <Bug size={14} className="text-purple-400 mr-1" />
      
      {!isDebugging ? (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
          title="Start Debugging (F5)"
        >
          <Play size={12} />
          <span>Start</span>
        </button>
      ) : (
        <>
          {isPaused ? (
            <button
              onClick={handleContinue}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
              title="Continue (F5)"
            >
              <Play size={12} />
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
              title="Pause (F6)"
            >
              <Pause size={12} />
            </button>
          )}

          <button
            onClick={handleStepOver}
            disabled={!isPaused}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-500/10 rounded transition-colors disabled:opacity-30"
            title="Step Over (F10)"
          >
            <SkipForward size={12} />
          </button>

          <button
            onClick={handleStepIn}
            disabled={!isPaused}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-500/10 rounded transition-colors disabled:opacity-30"
            title="Step Into (F11)"
          >
            <ArrowDown size={12} />
          </button>

          <button
            onClick={handleStepOut}
            disabled={!isPaused}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-500/10 rounded transition-colors disabled:opacity-30"
            title="Step Out (Shift+F11)"
          >
            <ArrowUp size={12} />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-500/10 rounded transition-colors"
            title="Restart (Ctrl+Shift+F5)"
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={handleStop}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            title="Stop (Shift+F5)"
          >
            <Square size={12} />
          </button>
        </>
      )}

      {isDebugging && (
        <span className="ml-2 text-[9px] text-purple-400 font-mono">
          {isPaused ? 'PAUSED' : 'RUNNING'}
        </span>
      )}
    </div>
  )
}
