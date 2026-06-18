import { useAppStore } from '../../stores/app-store'
import { X, FileCode, GitBranch } from 'lucide-react'

interface Reference {
  className: string
  line: number
  column?: number
  text?: string
}

interface ReferencesPanelProps {
  references: Reference[]
  symbolName: string
  onClose: () => void
}

export default function ReferencesPanel({ references, symbolName, onClose }: ReferencesPanelProps) {
  const selectTab = useAppStore((s) => s.selectTab)
  const triggerJumpToLine = useAppStore((s) => s.triggerJumpToLine)

  if (references.length === 0) return null

  // Group references by className
  const grouped = references.reduce((acc, ref) => {
    if (!acc[ref.className]) {
      acc[ref.className] = []
    }
    acc[ref.className].push(ref)
    return acc
  }, {} as Record<string, Reference[]>)

  return (
    <div className="bg-slate-950 border-t border-slate-900/60 max-h-48 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/30 border-b border-slate-900/40 shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <GitBranch size={12} className="text-indigo-400" />
          <span className="font-semibold">References</span>
          <span className="text-slate-600">for</span>
          <span className="text-indigo-400 font-mono">{symbolName}</span>
          <span className="text-slate-600">({references.length} found)</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 p-1 rounded hover:bg-slate-900 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Object.entries(grouped).map(([className, refs]) => (
          <div key={className} className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold px-1 py-0.5">
              <FileCode size={10} className="text-indigo-400" />
              <span className="text-slate-400">{className.split('.').pop()}.as</span>
              <span className="text-slate-600 font-mono text-[9px]">({className})</span>
            </div>
            {refs.map((ref, idx) => (
              <div
                key={idx}
                onClick={() => {
                  selectTab(className)
                  triggerJumpToLine(ref.line)
                }}
                className="flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-900/60 rounded cursor-pointer hover:text-slate-200 transition-colors"
              >
                <span className="text-slate-600 font-mono text-[10px] w-12 text-right">Ln {ref.line}</span>
                {ref.text && (
                  <span className="text-slate-500 font-mono text-[10px] truncate">{ref.text.trim()}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
