import { useState, useEffect, useCallback } from 'react'

export type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

let toastId = 0
let globalToasts: Toast[] = []
const listeners = new Set<(toasts: Toast[]) => void>()

function emit() {
  globalToasts = [...globalToasts]
  listeners.forEach((listener) => listener(globalToasts))
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts)

  useEffect(() => {
    listeners.add(setToasts)
    return () => {
      listeners.delete(setToasts)
    }
  }, [])

  const show = useCallback((message: string, type: Toast['type'] = 'info', duration = 3000) => {
    const id = `toast-${toastId++}`
    const toast: Toast = { id, message, type, duration }
    
    globalToasts.push(toast)
    emit()
    
    if (duration) {
      setTimeout(() => {
        globalToasts = globalToasts.filter((t) => t.id !== id)
        emit()
      }, duration)
    }
    
    return id
  }, [])

  const remove = useCallback((id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id)
    emit()
  }, [])

  return { toasts, show, remove }
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
