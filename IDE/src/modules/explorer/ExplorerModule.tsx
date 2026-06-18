import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { formatBytes } from '../../lib/ffdec-parser'
import { Cpu, Terminal, FileCode, Hammer, Compass, Layout } from 'lucide-react'

export default function ExplorerModule() {
  const swfData = useAppStore((s) => s.swfData)
  const swfPath = useAppStore((s) => s.swfPath)
  const setActivityTab = useAppStore((s) => s.setActivityTab)
  const { show } = useToast()

  if (!swfData) {
    return (
      <div className="module-empty flex flex-col items-center justify-center p-12 text-slate-500 h-full">
        <Cpu size={48} className="mb-3 text-slate-700 animate-pulse" />
        <p className="text-sm">No SWF archive loaded.</p>
        <p className="text-xs text-slate-600 mt-1.5">Open a file from the title menu (File → Open) to begin.</p>
      </div>
    )
  }

  const { header, classes, tags } = swfData

  const handleExportClassList = async () => {
    if (!swfPath) return
    try {
      show('Exporting class list...', 'info', 0)
      const result = await window.electronAPI.invokeFfdec('dumpAS3', [swfPath])
      if (result.code === 0) {
        show('Classes exported successfully', 'success')
      } else {
        show('Failed to export class list', 'error')
      }
    } catch (err) {
      show('Error exporting class list', 'error')
    }
  }

  const openBuildTab = () => {
    setActivityTab('builder')
  }

  return (
    <div className="module flex flex-col h-full animate-slide-in-right overflow-y-auto p-6 max-w-4xl mx-auto space-y-8 select-none">
      {/* Title & Info */}
      <div className="border-b border-slate-900/60 pb-5">
        <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
          <Cpu className="text-indigo-400" size={22} />
          <span>SWF Archive Inspector</span>
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-1 bg-slate-950/40 p-2 rounded border border-slate-900/40 truncate max-w-full">
          {swfPath}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Properties sheet (3/5) */}
        <div className="card md:col-span-3">
          <div className="card-title text-xs font-bold text-slate-300 bg-slate-950/40 px-4 py-3 border-b border-slate-900/60 flex items-center gap-2">
            <Layout size={14} className="text-indigo-400" />
            <span>SWF METADATA PROPERTIES</span>
          </div>
          
          <div className="divide-y divide-slate-900/40 text-xs text-slate-300">
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">SWF Version</span>
              <span className="col-span-2 font-mono text-indigo-400 font-bold">AS{header.version > 2 ? '3' : '2'} (v{header.version})</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">File Size</span>
              <span className="col-span-2 font-mono text-slate-200">{formatBytes(header.fileSize)}</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Frame Rate</span>
              <span className="col-span-2 font-mono text-emerald-400 font-semibold">{header.frameRate.toFixed(1)} FPS</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Dimensions</span>
              <span className="col-span-2 font-mono text-amber-400 font-semibold">{header.width} × {header.height} px</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Total Frames</span>
              <span className="col-span-2 font-mono text-slate-200">{header.frameCount} frames</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">AS3 Classes</span>
              <span className="col-span-2 font-mono text-violet-400 font-semibold">{classes.length} decompiled classes</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Total Tags</span>
              <span className="col-span-2 font-mono text-teal-400 font-semibold">{tags.length} tags in archive</span>
            </div>
          </div>
        </div>

        {/* Quick actions panel (2/5) */}
        <div className="card md:col-span-2">
          <div className="card-title text-xs font-bold text-slate-300 bg-slate-950/40 px-4 py-3 border-b border-slate-900/60 flex items-center gap-2">
            <Compass size={14} className="text-indigo-400" />
            <span>QUICK ACTIONS</span>
          </div>

          <div className="p-4 flex flex-col gap-2.5">
            <button
              onClick={handleExportClassList}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-indigo-650/20 hover:text-indigo-300 border border-slate-800/80 rounded-lg text-xs font-medium text-slate-200 transition-all text-left w-full cursor-pointer"
            >
              <FileCode size={14} className="text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold">Dump AS3 Class List</div>
                <div className="text-[10px] text-slate-500 font-normal">Export full lists using JPEXS dump tool</div>
              </div>
            </button>

            <button
              onClick={openBuildTab}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-indigo-650/20 hover:text-indigo-300 border border-slate-800/80 rounded-lg text-xs font-medium text-slate-200 transition-all text-left w-full cursor-pointer"
            >
              <Hammer size={14} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold">SWF Compiler Utility</div>
                <div className="text-[10px] text-slate-500 font-normal">Open compiler layout config menu</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
