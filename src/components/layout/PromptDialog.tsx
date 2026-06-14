import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { HelpCircle, Check, X } from 'lucide-react'

export default function PromptDialog() {
  const promptDialog = useAppStore((s) => s.promptDialog)
  const closePrompt = useAppStore((s) => s.closePrompt)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (promptDialog?.isOpen) {
      setValue(promptDialog.defaultValue || '')
      // Focus and select input on open
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 50)
    }
  }, [promptDialog])

  if (!promptDialog?.isOpen) return null

  const handleConfirm = (e?: React.FormEvent) => {
    e?.preventDefault()
    closePrompt(value)
  }

  const handleCancel = () => {
    closePrompt(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <form 
        onSubmit={handleConfirm}
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.2)] p-6 space-y-4 animate-slide-up backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <HelpCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">{promptDialog.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{promptDialog.message}</p>
          </div>
        </div>

        <div>
          <input
            ref={inputRef}
            type="text"
            placeholder={promptDialog.placeholder || "Enter value..."}
            className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 focus:shadow-[0_0_15px_rgba(99,102,241,0.25)] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <X size={14} />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            className="btn btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Confirm</span>
          </button>
        </div>
      </form>
    </div>
  )
}
