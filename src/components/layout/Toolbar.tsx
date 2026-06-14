import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { FolderOpen, RefreshCw, Play, Plus, Trash2, Settings } from 'lucide-react'

type ToolbarAction = {
  id: string
  label: string
  icon: string
  type: 'command' | 'openFile' | 'openUrl' | 'runScript'
  payload: string
}

export default function Toolbar() {
  const swfPath = useAppStore((s) => s.swfPath)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const hasWorkspace = !!(swfPath || projectRoot)
  const isLoading = useAppStore((s) => s.isLoading)
  const { show } = useToast()
  
  const [customActions, setCustomActions] = useState<ToolbarAction[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editAction, setEditAction] = useState<Partial<ToolbarAction>>({})

  useEffect(() => {
    loadCustomActions()
  }, [projectRoot])

  const loadCustomActions = async () => {
    try {
      const actions = await window.electronAPI.getToolbarActions(projectRoot || undefined)
      setCustomActions(actions as ToolbarAction[])
    } catch (err) {
      console.error('Failed to load toolbar actions:', err)
    }
  }

  const handleOpen = async () => {
    const path = await window.electronAPI.openSwf()
    if (path) {
      useAppStore.getState().loadSwf(path)
    }
  }

  const handleReload = async () => {
    if (swfPath) {
      show('Reloading SWF...', 'info', 1500)
      try {
        await useAppStore.getState().loadSwf(swfPath, true)
        show('SWF reloaded successfully', 'success')
      } catch (err) {
        show('Failed to reload SWF', 'error')
      }
    } else if (projectRoot) {
      show('Reloading Project config...', 'info', 1500)
      try {
        const detected = await window.electronAPI.detectProject(projectRoot)
        if (detected) {
          useAppStore.getState().setProject(detected.root)
          show('Workspace refreshed!', 'success')
        }
      } catch (err) {
        show('Failed to refresh project workspace', 'error')
      }
    }
  }

  const handleBuild = () => {
    useAppStore.getState().setActiveModule('swf-builder')
  }

  const handleRunAction = async (action: ToolbarAction) => {
    try {
      switch (action.type) {
        case 'openFile':
          if (projectRoot) {
            const filePath = `${projectRoot}/${action.payload}`
            await window.electronAPI.invokeFfdec('explorer', [filePath])
          }
          break
        case 'openUrl':
          window.open(action.payload, '_blank')
          break
        case 'runScript':
          if (projectRoot) {
            const result = await window.electronAPI.runBuildHook(projectRoot, action.payload)
            if (result.success) {
              show(result.output || 'Script executed successfully', 'success')
            } else {
              show(result.output || 'Script execution failed', 'error')
            }
          }
          break
        case 'command':
          if (action.payload === 'settings') {
            useAppStore.getState().setActivityTab('settings')
          } else if (action.payload === 'build') {
            handleBuild()
          }
          break
      }
    } catch (err: any) {
      show(`Failed to execute action: ${err.message}`, 'error')
    }
  }

  const handleSaveAction = async () => {
    if (!editAction.label || !editAction.payload) {
      show('Label and payload are required', 'warning')
      return
    }
    
    const newAction: ToolbarAction = {
      id: editAction.id || `custom-${Date.now()}`,
      label: editAction.label,
      icon: editAction.icon || '⚡',
      type: editAction.type || 'command',
      payload: editAction.payload
    }
    
    const updatedActions = editAction.id
      ? customActions.map(a => a.id === editAction.id ? newAction : a)
      : [...customActions, newAction]
    
    await window.electronAPI.saveToolbarActions(updatedActions, projectRoot || undefined)
    setCustomActions(updatedActions)
    setIsEditing(false)
    setEditAction({})
    show('Action saved', 'success')
  }

  const handleDeleteAction = async (id: string) => {
    const updatedActions = customActions.filter(a => a.id !== id)
    await window.electronAPI.saveToolbarActions(updatedActions, projectRoot || undefined)
    setCustomActions(updatedActions)
    show('Action deleted', 'info')
  }

  return (
    <div className="toolbar">
      <button 
        className="toolbar-btn" 
        onClick={handleOpen} 
        disabled={isLoading}
        title="Open SWF (Ctrl+O)"
      >
        <FolderOpen size={14} className="text-indigo-400" />
        <span>Open</span>
      </button>
      
      <button
        className="toolbar-btn"
        onClick={handleReload}
        disabled={!hasWorkspace || isLoading}
        title={!hasWorkspace ? "Reload (Load SWF or open project folder first)" : "Reload"}
      >
        <RefreshCw size={14} className={`text-pink-400 ${isLoading ? 'animate-spin' : ''}`} />
        <span>Reload</span>
      </button>
      
      <div className="toolbar-separator" />
      
      <button
        className="toolbar-btn"
        onClick={handleBuild}
        disabled={!hasWorkspace || isLoading}
        title={!hasWorkspace ? "Build SWF (Load SWF or open project folder first)" : "Build SWF (Ctrl+B)"}
      >
        <Play size={14} className="text-emerald-400" />
        <span>Build</span>
      </button>
      
      {/* Custom Actions */}
      {customActions.map((action) => (
        <button
          key={action.id}
          className="toolbar-btn"
          onClick={() => handleRunAction(action)}
          title={action.label}
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
      
      {/* Add Custom Action Button */}
      {hasWorkspace && (
        <>
          <div className="toolbar-separator" />
          <button
            className="toolbar-btn"
            onClick={() => {
              setEditAction({ type: 'command' })
              setIsEditing(true)
            }}
            title="Add Custom Action"
          >
            <Plus size={14} className="text-slate-400" />
          </button>
        </>
      )}
      
      {/* Edit Modal */}
      {isEditing && (
        <div className="absolute top-full left-0 mt-2 bg-[#0a0f1a] border border-slate-800 rounded-lg p-4 shadow-xl z-50 w-72">
          <h4 className="text-xs font-bold text-white mb-3">Add Custom Action</h4>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Label"
              value={editAction.label || ''}
              onChange={(e) => setEditAction({ ...editAction, label: e.target.value })}
              className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
            />
            <select
              value={editAction.type || 'command'}
              onChange={(e) => setEditAction({ ...editAction, type: e.target.value as any })}
              className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
            >
              <option value="command">Command</option>
              <option value="openFile">Open File</option>
              <option value="openUrl">Open URL</option>
              <option value="runScript">Run Script</option>
            </select>
            <input
              type="text"
              placeholder="Payload (command, URL, or script)"
              value={editAction.payload || ''}
              onChange={(e) => setEditAction({ ...editAction, payload: e.target.value })}
              className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAction}
                className="flex-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
