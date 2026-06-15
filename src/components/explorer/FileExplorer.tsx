import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Tree, NodeApi } from 'react-arborist'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  FileText,
  Image as ImageIcon,
  Film,
  Volume2,
  Archive,
  Search,
  MoreHorizontal,
  X,
  RefreshCw,
  FolderUp
} from 'lucide-react'

type CtxMenu = {
  x: number
  y: number
  items: { label: string; action: string; disabled?: boolean }[]
  node: any
}

const fileIcons: Record<string, any> = {
  code: FileCode,
  image: ImageIcon,
  film: Film,
  volume: Volume2,
  text: FileText,
  archive: Archive,
  file: FileText,
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return Folder
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, any> = {
    as: FileCode, mxml: FileCode, xml: FileCode, json: FileCode,
    js: FileCode, ts: FileCode, css: FileCode, html: FileCode,
    py: FileCode, java: FileCode,
    png: ImageIcon, jpg: ImageIcon, jpeg: ImageIcon, gif: ImageIcon, svg: ImageIcon,
    swf: Film, flv: Film,
    mp3: Volume2, wav: Volume2, ogg: Volume2,
    zip: Archive, rar: Archive, '7z': Archive,
    txt: FileText, md: FileText, log: FileText,
  }
  return iconMap[ext] || FileText
}

function filterTree(nodes: any[], filter: string): any[] {
  if (!filter) return nodes
  const lowerFilter = filter.toLowerCase()
  const result: any[] = []
  for (const node of nodes) {
    if (node.isDirectory) {
      const filteredChildren = filterTree(node.children || [], filter)
      if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerFilter)) {
        result.push({ ...node, children: filteredChildren })
      }
    } else if (node.name.toLowerCase().includes(lowerFilter)) {
      result.push(node)
    }
  }
  return result
}

export default function FileExplorer() {
  const fileTree = useAppStore(s => s.fileTree)
  const fileTreeRoot = useAppStore(s => s.fileTreeRoot)
  const selectedFile = useAppStore(s => s.selectedFile)
  const fileTreeFilter = useAppStore(s => s.fileTreeFilter)
  const isLoadingFileTree = useAppStore(s => s.isLoadingFileTree)
  const loadFileTree = useAppStore(s => s.loadFileTree)
  const refreshFileTree = useAppStore(s => s.refreshFileTree)
  const setSelectedFile = useAppStore(s => s.setSelectedFile)
  const setFileTreeFilter = useAppStore(s => s.setFileTreeFilter)
  const { show } = useToast()

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [renameNode, setRenameNode] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const treeRef = useRef<any>(null)

  const filteredTree = useMemo(
    () => filterTree(fileTree, fileTreeFilter),
    [fileTree, fileTreeFilter]
  )

  const handleOpenFolder = useCallback(async () => {
    const dir = await window.electronAPI.openDirectory()
    if (dir) {
      await loadFileTree(dir)
    }
  }, [loadFileTree])

  const handleContextMenu = useCallback((e: React.MouseEvent, node: NodeApi) => {
    e.preventDefault()
    const items = node.data.isDirectory
      ? [
          { label: 'New File', action: 'newFile' },
          { label: 'New Folder', action: 'newFolder' },
          { label: 'Rename', action: 'rename' },
          { label: 'Delete', action: 'delete' },
          { label: 'Copy Path', action: 'copyPath' },
          { label: 'Open in Explorer', action: 'openInExplorer' },
        ]
      : [
          { label: 'Open', action: 'open' },
          { label: 'Rename', action: 'rename' },
          { label: 'Delete', action: 'delete' },
          { label: 'Copy Path', action: 'copyPath' },
          { label: 'Open in Explorer', action: 'openInExplorer' },
        ]
    setCtxMenu({ x: e.clientX, y: e.clientY, items, node: node.data })
  }, [])

  const handleCtxAction = useCallback(async (action: string) => {
    if (!ctxMenu) return
    const nodePath = ctxMenu.node.path
    const nodeDir = ctxMenu.node.isDirectory ? nodePath : nodePath.substring(0, nodePath.lastIndexOf('\\') + 1)

    switch (action) {
      case 'newFile': {
        const name = prompt('New file name:')
        if (name) {
          const ok = await window.electronAPI.fsWriteFile(nodeDir + name, '')
          if (ok) await refreshFileTree()
          else show('Failed to create file', 'error')
        }
        break
      }
      case 'newFolder': {
        const name = prompt('New folder name:')
        if (name) {
          const ok = await window.electronAPI.fsCreateDir(nodeDir + name)
          if (ok) await refreshFileTree()
          else show('Failed to create folder', 'error')
        }
        break
      }
      case 'rename': {
        setRenameNode(nodePath)
        setRenameValue(ctxMenu.node.name)
        break
      }
      case 'delete': {
        if (confirm(`Delete "${ctxMenu.node.name}"?`)) {
          const ok = await window.electronAPI.fsDeletePath(nodePath)
          if (ok) await refreshFileTree()
          else show('Failed to delete', 'error')
        }
        break
      }
      case 'copyPath': {
        await navigator.clipboard.writeText(nodePath)
        show('Path copied', 'info')
        break
      }
      case 'openInExplorer': {
        await window.electronAPI.fsOpenInExplorer(nodePath)
        break
      }
      case 'open': {
        setSelectedFile(nodePath)
        break
      }
    }
    setCtxMenu(null)
  }, [ctxMenu, refreshFileTree, show, setSelectedFile])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameNode || !renameValue) {
      setRenameNode(null)
      return
    }
    const dir = renameNode.substring(0, renameNode.lastIndexOf('\\') + 1)
    const newPath = dir + renameValue
    const ok = await window.electronAPI.fsRename(renameNode, newPath)
    if (ok) await refreshFileTree()
    else show('Failed to rename', 'error')
    setRenameNode(null)
  }, [renameNode, renameValue, refreshFileTree, show])

  useEffect(() => {
    const handleClick = () => setCtxMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  if (!fileTreeRoot) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center" style={{ minHeight: 120 }}>
        <FolderUp className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs opacity-50 mb-3">No project folder open</p>
        <button
          onClick={handleOpenFolder}
          className="px-3 py-1.5 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 transition"
        >
          Open Folder
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5">
        <button
          onClick={handleOpenFolder}
          className="p-1 hover:bg-white/10 rounded transition"
          title="Open Folder"
        >
          <FolderUp className="w-3.5 h-3.5 opacity-60" />
        </button>
        <button
          onClick={refreshFileTree}
          className="p-1 hover:bg-white/10 rounded transition"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 opacity-60 ${isLoadingFileTree ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex-1 relative ml-1">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40" />
          <input
            value={fileTreeFilter}
            onChange={e => setFileTreeFilter(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-white/5 border border-white/10 rounded px-1.5 pl-5 py-0.5 text-[11px] outline-none focus:border-blue-500/50 placeholder-white/30"
          />
          {fileTreeFilter && (
            <button
              onClick={() => setFileTreeFilter('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded"
            >
              <X className="w-2.5 h-2.5 opacity-40" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        <Tree
          ref={treeRef}
          data={filteredTree}
          openByDefault={false}
          width="100%"
          height={Math.max(300, filteredTree.length * 24)}
          rowHeight={24}
          padding={4}
          disableDrag
          disableDrop
          onActivate={(node) => {
            if (!node.data.isDirectory) {
              setSelectedFile(node.data.path)
            }
          }}
        >
          {({ node, style }) => {
            const Icon = getFileIcon(node.data.name, node.data.isDirectory)
            const isSelected = selectedFile === node.data.path
            const isRenaming = renameNode === node.data.path

            return (
              <div
                style={style}
                className={`flex items-center gap-1.5 pr-2 cursor-pointer group text-[12px] select-none
                  ${isSelected ? 'bg-blue-500/15 text-blue-300' : 'hover:bg-white/5'}
                `}
                onClick={() => {
                  if (!node.data.isDirectory) {
                    setSelectedFile(node.data.path)
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, node)}
              >
                <span className="w-4 flex items-center justify-center flex-shrink-0">
                  {node.data.isDirectory ? (
                    node.isOpen ? (
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    ) : (
                      <ChevronRight className="w-3 h-3 opacity-50" />
                    )
                  ) : null}
                </span>
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${
                  node.data.isDirectory ? 'text-blue-400/70' : 'opacity-50'
                }`} />
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSubmit()
                      if (e.key === 'Escape') setRenameNode(null)
                    }}
                    className="flex-1 bg-white/10 border border-blue-500/50 rounded px-1 text-[12px] outline-none min-w-0"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate min-w-0">{node.data.name}</span>
                )}
                {!isRenaming && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContextMenu(e, node)
                    }}
                    className="p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10 rounded transition"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          }}
        </Tree>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-[#1a1f2e] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {ctxMenu.items.map((item) => (
            <button
              key={item.action}
              disabled={item.disabled}
              onClick={() => handleCtxAction(item.action)}
              className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-white/10 disabled:opacity-30 transition"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
