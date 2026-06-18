import { useEffect, useRef } from 'react'
import { AlertTriangle, X, Check } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.15)] p-6 space-y-4 animate-slide-up backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{message}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <X size={14} />
            <span>{cancelLabel}</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn px-4 py-2 text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white border-0"
          >
            <Check size={14} />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
