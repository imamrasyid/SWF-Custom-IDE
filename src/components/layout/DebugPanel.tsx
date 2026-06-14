import { useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { Play, Trash2, Plus, X, Eye } from 'lucide-react'

export default function DebugPanel() {
  const debugOutput = useAppStore((s) => s.debugOutput)
  const variables = useAppStore((s) => s.variables)
  const callStack = useAppStore((s) => s.callStack)
  const watchExpressions = useAppStore((s) => s.watchExpressions)
  const watchResults = useAppStore((s) => s.watchResults)
  const addWatchExpression = useAppStore((s) => s.addWatchExpression)
  const removeWatchExpression = useAppStore((s) => s.removeWatchExpression)
  const clearDebugOutput = useAppStore((s) => s.clearDebugOutput)
  const isDebugging = useAppStore((s) => s.isDebugging)

  const [newWatch, setNewWatch] = useState('')
  const [activeTab, setActiveTab] = useState<'output' | 'variables' | 'callstack' | 'watch'>('output')

  const handleAddWatch = async () => {
    if (!newWatch.trim()) return
    addWatchExpression(newWatch.trim())
    setNewWatch('')
    
    // Evaluate expression
    try {
      const result = await window.electronAPI.debugEvaluate(newWatch.trim())
      useAppStore.getState().setWatchResults([
        ...useAppStore.getState().watchResults.filter(w => w.expression !== newWatch.trim()),
        { expression: newWatch.trim(), value: result.result || 'undefined' }
      ])
    } catch {}
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-900/60 px-2 shrink-0">
        <button
          onClick={() => setActiveTab('output')}
          className={`px-2 py-1 text-[10px] font-bold uppercase ${activeTab === 'output' ? 'text-purple-400 border-b border-purple-500' : 'text-slate-500'}`}
        >
          Output
        </button>
        <button
          onClick={() => setActiveTab('variables')}
          className={`px-2 py-1 text-[10px] font-bold uppercase ${activeTab === 'variables' ? 'text-purple-400 border-b border-purple-500' : 'text-slate-500'}`}
        >
          Variables ({variables.length})
        </button>
        <button
          onClick={() => setActiveTab('callstack')}
          className={`px-2 py-1 text-[10px] font-bold uppercase ${activeTab === 'callstack' ? 'text-purple-400 border-b border-purple-500' : 'text-slate-500'}`}
        >
          Call Stack ({callStack.length})
        </button>
        <button
          onClick={() => setActiveTab('watch')}
          className={`px-2 py-1 text-[10px] font-bold uppercase ${activeTab === 'watch' ? 'text-purple-400 border-b border-purple-500' : 'text-slate-500'}`}
        >
          Watch ({watchExpressions.length})
        </button>

        <div className="flex-1" />

        <button
          onClick={clearDebugOutput}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
          title="Clear Output"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] min-h-0">
        {activeTab === 'output' && (
          <div className="space-y-0.5">
            {debugOutput.length > 0 ? (
              debugOutput.map((line, idx) => {
                let colorClass = 'text-slate-300'
                if (line.startsWith('[Debug]')) colorClass = 'text-purple-400'
                else if (line.startsWith('[Breakpoint]')) colorClass = 'text-rose-400'
                else if (line.includes('error') || line.includes('Error')) colorClass = 'text-rose-400'
                return (
                  <div key={idx} className={`whitespace-pre-wrap ${colorClass}`}>
                    {line}
                  </div>
                )
              })
            ) : (
              <span className="text-slate-600 italic">
                {isDebugging ? 'Waiting for debug output...' : 'Start a debug session to see output.'}
              </span>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="space-y-1">
            {variables.length > 0 ? (
              variables.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2 hover:bg-slate-900/40 p-1 rounded">
                  <span className="text-purple-400 font-bold">{v.name}</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-emerald-400">{v.value}</span>
                  <span className="text-slate-600 text-[9px] ml-auto">{v.type}</span>
                </div>
              ))
            ) : (
              <span className="text-slate-600 italic">
                {isDebugging ? 'Pause execution to see variables.' : 'No variables available.'}
              </span>
            )}
          </div>
        )}

        {activeTab === 'callstack' && (
          <div className="space-y-1">
            {callStack.length > 0 ? (
              callStack.map((frame, idx) => (
                <div key={idx} className="flex items-center gap-2 hover:bg-slate-900/40 p-1 rounded cursor-pointer">
                  <span className="text-purple-400 text-[9px]">#{frame.id}</span>
                  <span className="text-slate-300">{frame.name}</span>
                  <span className="text-slate-500 text-[9px]">
                    {frame.file}:{frame.line}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-slate-600 italic">
                {isDebugging ? 'Pause execution to see call stack.' : 'No call stack available.'}
              </span>
            )}
          </div>
        )}

        {activeTab === 'watch' && (
          <div className="space-y-2">
            {/* Add watch input */}
            <div className="flex items-center gap-1 border-b border-slate-900/60 pb-2">
              <input
                type="text"
                value={newWatch}
                onChange={(e) => setNewWatch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                placeholder="Add expression to watch..."
                className="flex-1 bg-transparent text-slate-300 outline-none text-[11px] placeholder-slate-600"
              />
              <button
                onClick={handleAddWatch}
                className="text-slate-500 hover:text-purple-400 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Watch results */}
            {watchResults.length > 0 ? (
              watchResults.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2 hover:bg-slate-900/40 p-1 rounded group">
                  <Eye size={10} className="text-purple-400 shrink-0" />
                  <span className="text-slate-400">{w.expression}</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-emerald-400">{w.value}</span>
                  <button
                    onClick={() => {
                      removeWatchExpression(w.expression)
                      useAppStore.getState().setWatchResults(
                        useAppStore.getState().watchResults.filter(r => r.expression !== w.expression)
                      )
                    }}
                    className="ml-auto text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-slate-600 italic">Add expressions to watch their values.</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
