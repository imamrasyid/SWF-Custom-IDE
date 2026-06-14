import { useAppStore } from '../../stores/app-store'
import { X, Keyboard } from 'lucide-react'

interface ShortcutsPanelProps {
  onClose: () => void
}

const SHORTCUTS = [
  { category: 'File', items: [
    { keys: 'Ctrl+S', action: 'Save & Compile' },
    { keys: 'Ctrl+W', action: 'Close Tab' },
    { keys: 'Ctrl+Shift+T', action: 'Reopen Closed Tab' },
    { keys: 'Ctrl+N', action: 'New File' },
  ]},
  { category: 'Edit', items: [
    { keys: 'Ctrl+Z', action: 'Undo' },
    { keys: 'Ctrl+Shift+Z', action: 'Redo' },
    { keys: 'Ctrl+X', action: 'Cut' },
    { keys: 'Ctrl+C', action: 'Copy' },
    { keys: 'Ctrl+V', action: 'Paste' },
    { keys: 'Ctrl+A', action: 'Select All' },
    { keys: 'Ctrl+D', action: 'Select Next Occurrence' },
    { keys: 'Ctrl+Alt+Up/Down', action: 'Add Cursor Above/Below' },
  ]},
  { category: 'Search', items: [
    { keys: 'Ctrl+F', action: 'Find in File' },
    { keys: 'Ctrl+H', action: 'Find & Replace' },
    { keys: 'Ctrl+Shift+F', action: 'Find in Files' },
  ]},
  { category: 'Navigation', items: [
    { keys: 'Ctrl+G', action: 'Go to Line' },
    { keys: 'F12', action: 'Go to Definition' },
    { keys: 'Ctrl+Shift+O', action: 'Go to Symbol' },
    { keys: 'Ctrl+P', action: 'Quick Open File' },
    { keys: 'Ctrl+Shift+P', action: 'Command Palette' },
  ]},
  { category: 'View', items: [
    { keys: 'Ctrl+B', action: 'Toggle Sidebar' },
    { keys: 'Ctrl+`', action: 'Toggle Terminal' },
    { keys: 'Ctrl+\\', action: 'Split Editor' },
    { keys: 'Ctrl+=', action: 'Zoom In' },
    { keys: 'Ctrl+-', action: 'Zoom Out' },
    { keys: 'Ctrl+0', action: 'Reset Zoom' },
    { keys: 'Alt+Z', action: 'Toggle Word Wrap' },
    { keys: 'Ctrl+Shift+M', action: 'Toggle Minimap' },
  ]},
  { category: 'Editor', items: [
    { keys: 'F2', action: 'Rename Symbol' },
    { keys: 'Shift+Alt+F', action: 'Format Document' },
    { keys: 'Ctrl+M', action: 'Extract to Method' },
    { keys: 'Ctrl+Shift+M', action: 'Extract to Variable' },
    { keys: 'Ctrl+/', action: 'Toggle Line Comment' },
    { keys: 'Shift+Alt+Up/Down', action: 'Copy Line Up/Down' },
    { keys: 'Alt+Up/Down', action: 'Move Line Up/Down' },
  ]},
  { category: 'Debug', items: [
    { keys: 'F5', action: 'Start/Continue Debug' },
    { keys: 'F6', action: 'Pause Debug' },
    { keys: 'F7', action: 'Step Into' },
    { keys: 'F8', action: 'Step Over' },
    { keys: 'Shift+F8', action: 'Step Out' },
    { keys: 'F9', action: 'Toggle Breakpoint' },
    { keys: 'Ctrl+Shift+F5', action: 'Restart Debug' },
    { keys: 'Shift+F5', action: 'Stop Debug' },
  ]},
]

export default function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-slide-up backdrop-blur-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Keyboard size={20} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-400 mt-0.5">All available shortcuts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-900 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4">
          {SHORTCUTS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{group.category}</h4>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.action} className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/50">
                    <span className="text-[11px] text-slate-300">{item.action}</span>
                    <kbd className="text-[9px] text-slate-500 bg-slate-950/50 border border-slate-800/50 px-1.5 py-0.5 rounded font-mono">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
