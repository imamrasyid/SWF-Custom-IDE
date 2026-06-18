import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import {
  GitBranch,
  GitCommit,
  Check,
  Plus,
  Minus,
  RefreshCw,
  Upload,
  Download,
  FileCode,
  FileText,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react'

export default function SourceControlPanel() {
  const {
    gitBranch, gitStaged, gitModified, gitDeleted, gitUntracked,
    gitAhead, gitBehind, gitIsRepo, gitLog, gitDiff,
    isGitLoading, refreshGitStatus, refreshGitLog,
    gitAdd, gitUnstage, gitCommit, gitPush, gitPull
  } = useAppStore()

  const [commitMsg, setCommitMsg] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState('')
  const [stagedOpen, setStagedOpen] = useState(true)
  const [unstagedOpen, setUnstagedOpen] = useState(true)
  const [untrackedOpen, setUntrackedOpen] = useState(true)

  const root = useAppStore(s => s.projectRoot)

  useEffect(() => {
    if (root) {
      refreshGitStatus()
      refreshGitLog()
    }
  }, [root])

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    await gitCommit(commitMsg.trim())
    setCommitMsg('')
  }

  const handleFileClick = async (file: string) => {
    if (selectedFile === file) {
      setSelectedFile(null)
      setDiffContent('')
      return
    }
    setSelectedFile(file)
    if (root) {
      const diff = await window.electronAPI.gitDiff(root, file)
      setDiffContent(diff)
    }
  }

  const handleStageAll = () => {
    gitAdd([...gitModified, ...gitDeleted, ...gitUntracked])
  }

  const handleUnstageAll = () => {
    gitUnstage([...gitStaged])
  }

  if (!gitIsRepo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <GitBranch size={32} className="mb-2 opacity-50" />
        <span className="text-sm">No Git repository detected</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-gray-200 text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <GitBranch size={14} className="text-blue-400" />
        <span className="font-medium text-xs truncate">{gitBranch || 'none'}</span>
        {gitAhead > 0 && <span className="text-xs text-green-400">↑{gitAhead}</span>}
        {gitBehind > 0 && <span className="text-xs text-red-400">↓{gitBehind}</span>}
        <div className="flex-1" />
        <button onClick={refreshGitStatus} className="p-1 hover:bg-gray-700 rounded" title="Refresh">
          <RefreshCw size={12} className={isGitLoading ? 'animate-spin' : ''} />
        </button>
        <button onClick={gitPush} className="p-1 hover:bg-gray-700 rounded" title="Push">
          <Upload size={12} />
        </button>
        <button onClick={gitPull} className="p-1 hover:bg-gray-700 rounded" title="Pull">
          <Download size={12} />
        </button>
      </div>

      {/* Commit */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <input
          type="text"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
          placeholder="Commit message..."
          className="flex-1 bg-[#2a2a3e] border border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim()}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs"
        >
          <GitCommit size={12} />
          Commit
        </button>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-700 text-xs">
        <button onClick={handleStageAll} className="px-2 py-0.5 hover:bg-gray-700 rounded">
          Stage All
        </button>
        <button onClick={handleUnstageAll} className="px-2 py-0.5 hover:bg-gray-700 rounded">
          Unstage All
        </button>
      </div>

      {/* File sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged */}
        {gitStaged.length > 0 && (
          <div>
            <button
              onClick={() => setStagedOpen(!stagedOpen)}
              className="flex items-center gap-1 w-full px-3 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-750"
            >
              {stagedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Changes ({gitStaged.length})
            </button>
            {stagedOpen && gitStaged.map(file => (
              <FileItem
                key={file}
                file={file}
                type="staged"
                selected={selectedFile === file}
                onClick={() => handleFileClick(file)}
                onUnstage={() => gitUnstage([file])}
              />
            ))}
          </div>
        )}

        {/* Unstaged */}
        {gitModified.length > 0 && (
          <div>
            <button
              onClick={() => setUnstagedOpen(!unstagedOpen)}
              className="flex items-center gap-1 w-full px-3 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-750"
            >
              {unstagedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Unstaged Changes ({gitModified.length})
            </button>
            {unstagedOpen && gitModified.map(file => (
              <FileItem
                key={file}
                file={file}
                type="modified"
                selected={selectedFile === file}
                onClick={() => handleFileClick(file)}
                onStage={() => gitAdd([file])}
              />
            ))}
          </div>
        )}

        {/* Deleted */}
        {gitDeleted.length > 0 && (
          <div>
            <button
              onClick={() => setUnstagedOpen(!unstagedOpen)}
              className="flex items-center gap-1 w-full px-3 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-750"
            >
              {unstagedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Deleted ({gitDeleted.length})
            </button>
            {unstagedOpen && gitDeleted.map(file => (
              <FileItem
                key={file}
                file={file}
                type="deleted"
                selected={selectedFile === file}
                onClick={() => handleFileClick(file)}
                onStage={() => gitAdd([file])}
              />
            ))}
          </div>
        )}

        {/* Untracked */}
        {gitUntracked.length > 0 && (
          <div>
            <button
              onClick={() => setUntrackedOpen(!untrackedOpen)}
              className="flex items-center gap-1 w-full px-3 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-750"
            >
              {untrackedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Untracked Files ({gitUntracked.length})
            </button>
            {untrackedOpen && gitUntracked.map(file => (
              <FileItem
                key={file}
                file={file}
                type="untracked"
                selected={selectedFile === file}
                onClick={() => handleFileClick(file)}
                onStage={() => gitAdd([file])}
              />
            ))}
          </div>
        )}
      </div>

      {/* Diff viewer */}
      {selectedFile && diffContent && (
        <div className="border-t border-gray-700 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1 bg-[#252536] text-xs">
            <span className="truncate">{selectedFile}</span>
            <button onClick={() => { setSelectedFile(null); setDiffContent('') }} className="p-0.5 hover:bg-gray-700 rounded">
              <X size={10} />
            </button>
          </div>
          <pre className="p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-300">
            {diffContent}
          </pre>
        </div>
      )}

      {/* Log */}
      {gitLog.length > 0 && (
        <div className="border-t border-gray-700 max-h-36 overflow-y-auto">
          <div className="px-3 py-1 text-xs font-semibold text-gray-400">History</div>
          {gitLog.slice(0, 10).map(c => (
            <div key={c.hash} className="px-3 py-0.5 text-xs flex gap-2 hover:bg-gray-750">
              <span className="text-blue-400 font-mono">{c.hash.slice(0, 7)}</span>
              <span className="truncate">{c.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FileItem({
  file, type, selected, onClick, onStage, onUnstage
}: {
  file: string
  type: 'staged' | 'modified' | 'deleted' | 'untracked'
  selected: boolean
  onClick: () => void
  onStage?: () => void
  onUnstage?: () => void
}) {
  const iconColor = {
    staged: 'text-green-400',
    modified: 'text-yellow-400',
    deleted: 'text-red-400',
    untracked: 'text-gray-400'
  }[type]

  const indicator = {
    staged: '+',
    modified: '±',
    deleted: '-',
    untracked: '?'
  }[type]

  const name = file.split(/[/\\]/).pop() || file

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-0.5 text-xs cursor-pointer ${
        selected ? 'bg-blue-900/40' : 'hover:bg-gray-750'
      }`}
    >
      <span className={`w-3 text-center font-mono ${iconColor}`}>{indicator}</span>
      <FileText size={12} className="text-gray-500 shrink-0" />
      <span className="truncate flex-1" title={file}>{name}</span>
      {onStage && type !== 'staged' && (
        <button
          onClick={(e) => { e.stopPropagation(); onStage() }}
          className="p-0.5 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100"
          title="Stage"
        >
          <Plus size={10} className="text-green-400" />
        </button>
      )}
      {onUnstage && type === 'staged' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnstage() }}
          className="p-0.5 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100"
          title="Unstage"
        >
          <Minus size={10} className="text-yellow-400" />
        </button>
      )}
    </div>
  )
}
