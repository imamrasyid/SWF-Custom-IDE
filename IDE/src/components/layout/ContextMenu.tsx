import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

type ContextMenuItem = {
  label: string
  action: string
  disabled?: boolean
  shortcut?: string
}

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (action: string) => void
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onSelect, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ x, y })

  // Close context menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Position and viewport boundary checking
  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      // Check right boundary overflow
      if (x + rect.width > winWidth) {
        adjustedX = winWidth - rect.width - 8
      }
      // Check bottom boundary overflow
      if (y + rect.height > winHeight) {
        adjustedY = winHeight - rect.height - 8
      }

      // Ensure it doesn't go off the left/top edges either
      if (adjustedX < 8) adjustedX = 8
      if (adjustedY < 8) adjustedY = 8

      setCoords({ x: adjustedX, y: adjustedY })
    }
  }, [x, y, items])

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: coords.x, top: coords.y, position: 'fixed' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <div
            key={i}
            className={`context-menu-item${item.disabled ? ' disabled' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!item.disabled) {
                onSelect(item.action)
                onClose()
              }
            }}
          >
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && (
              <span className="ml-auto text-[10px] text-slate-500 font-mono tracking-wider pl-6">{item.shortcut}</span>
            )}
          </div>
        )
      )}
    </div>,
    document.body
  )
}
