import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Minus, Square, X } from 'lucide-react'

type MenuItem = {
  label?: string
  action?: string
  accelerator?: string
  separator?: boolean
  requiresSwf?: boolean
}

type MenuGroup = {
  label: string
  requiresSwf?: boolean
  items: MenuItem[]
}

const menus: MenuGroup[] = [
  {
    label: 'File',
    items: [
      { label: 'Open SWF File...', action: 'open-swf', accelerator: 'Ctrl+O' },
      { label: 'Close SWF File', action: 'close-swf', requiresSwf: true },
      { label: 'Save Code Changes', action: 'save-code', requiresSwf: true, separator: true },
      { label: 'Preferences: Settings', action: 'settings', accelerator: 'Ctrl+,' },
      { label: 'Exit', action: 'exit', accelerator: 'Alt+F4', separator: true }
    ]
  },
  {
    label: 'Edit',
    requiresSwf: true,
    items: [
      { label: 'Undo', action: 'undo', accelerator: 'Ctrl+Z' },
      { label: 'Redo', action: 'redo', accelerator: 'Ctrl+Y', separator: true },
      { label: 'Cut', action: 'cut', accelerator: 'Ctrl+X' },
      { label: 'Copy', action: 'copy', accelerator: 'Ctrl+C' },
      { label: 'Paste', action: 'paste', accelerator: 'Ctrl+V', separator: true },
      { label: 'Find', action: 'find', accelerator: 'Ctrl+F' },
      { label: 'Replace', action: 'replace', accelerator: 'Ctrl+H', separator: true },
      { label: 'Toggle Line Comment', action: 'toggle-line-comment', accelerator: 'Ctrl+/' },
      { label: 'Toggle Block Comment', action: 'toggle-block-comment', accelerator: 'Shift+Alt+A' }
    ]
  },
  {
    label: 'Selection',
    requiresSwf: true,
    items: [
      { label: 'Select All', action: 'select-all', accelerator: 'Ctrl+A', separator: true },
      { label: 'Copy Line Up', action: 'copy-line-up', accelerator: 'Shift+Alt+Up' },
      { label: 'Copy Line Down', action: 'copy-line-down', accelerator: 'Shift+Alt+Down' },
      { label: 'Move Line Up', action: 'move-line-up', accelerator: 'Alt+Up' },
      { label: 'Move Line Down', action: 'move-line-down', accelerator: 'Alt+Down' }
    ]
  },
  {
    label: 'Build',
    requiresSwf: true,
    items: [
      { label: 'Run Compiler Build', action: 'build', accelerator: 'Ctrl+B', requiresSwf: true },
      { label: 'Reload SWF Archive', action: 'reload-swf', accelerator: 'F5', requiresSwf: true, separator: true },
      { label: 'Dump AS3 Class List', action: 'export-class-list', requiresSwf: true }
    ]
  },
  {
    label: 'Tools',
    requiresSwf: true,
    items: [
      { label: 'Script Swapper', action: 'script-swapper', requiresSwf: true },
      { label: 'Asset Forge Inspector', action: 'asset-forge', requiresSwf: true },
      { label: 'Panel Studio', action: 'panel-studio' },
      { label: 'Dependency Graph', action: 'dependency', requiresSwf: true, separator: true },
      { label: 'AMF Service Builder', action: 'standalone:amf-builder' },
      { label: 'Game Data Editor', action: 'game-data-editor' }
    ]
  },
  {
    label: 'View',
    requiresSwf: true,
    items: [
      { label: 'Command Palette', action: 'command-palette', accelerator: 'Ctrl+Shift+P' },
      { label: 'Toggle Sidebar Panel', action: 'toggle-sidebar', accelerator: 'Ctrl+B' },
      { label: 'Toggle Output Terminal', action: 'toggle-terminal', accelerator: 'Ctrl+`' },
      { label: 'Toggle Word Wrap', action: 'word-wrap', accelerator: 'Alt+Z', separator: true },
      { label: 'SWF Properties Inspector', action: 'explorer', requiresSwf: true }
    ]
  },
  {
    label: 'Go',
    requiresSwf: true,
    items: [
      { label: 'Go to Line...', action: 'go-to-line', accelerator: 'Ctrl+G' },
      { label: 'Go to Definition', action: 'go-to-definition', accelerator: 'F12' },
      { label: 'Go to References', action: 'go-to-references', accelerator: 'Shift+F12' }
    ]
  }
]

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const swfPath = useAppStore((s) => s.swfPath)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const hasWorkspace = !!(swfPath || projectRoot)
  const { show } = useToast()

  // Close active dropdown menu when clicking outside of the MenuBar
  useEffect(() => {
    if (!activeMenu) return

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.menubar')) {
        setActiveMenu(null)
      }
    }

    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [activeMenu])

  const handleAction = async (action: string) => {
    const { 
      closeSwf, 
      setActiveModule, 
      setActivityTab, 
      toggleSidebar, 
      toggleBottomPanel,
      editingFile,
      saveEditingFile,
      leftEditorInstance,
      rightEditorInstance,
      focusedEditorGroup
    } = useAppStore.getState()

    const activeEditor = focusedEditorGroup === 'right' ? rightEditorInstance : leftEditorInstance

    if (action.startsWith('standalone:')) {
      const toolName = action.replace('standalone:', '')
      window.electronAPI.openToolWindow(toolName)
    } else if (action === 'exit') {
      window.electronAPI.closeWindow()
    } else if (action === 'open-swf') {
      window.electronAPI.openSwf().then((path) => {
        if (path) {
          useAppStore.getState().loadSwf(path)
        }
      })
    } else if (action === 'close-swf') {
      closeSwf()
      show('SWF closed successfully', 'info')
    } else if (action === 'save-code') {
      if (editingFile) {
        const success = await saveEditingFile(editingFile.code)
        if (success) {
          show('Class saved and compiled', 'success')
        } else {
          show('Failed to save class', 'error')
        }
      } else {
        show('No active code file to save', 'warning')
      }
    } else if (action === 'reload-swf') {
      if (swfPath) {
        show('Reloading SWF...', 'info')
        await useAppStore.getState().loadSwf(swfPath, true)
        show('SWF reloaded successfully', 'success')
      }
    } else if (action === 'toggle-sidebar') {
      toggleSidebar()
    } else if (action === 'toggle-terminal') {
      toggleBottomPanel()
    } else if (action === 'settings') {
      setActivityTab('settings')
    } else if (action === 'export-class-list') {
      if (swfPath) {
        show('Exporting class list...', 'info')
        const result = await window.electronAPI.invokeFfdec('dumpAS3', [swfPath])
        if (result.code === 0) {
          show('Classes exported successfully', 'success')
        } else {
          show('Failed to export class list', 'error')
        }
      }
    } else if (action === 'about') {
      alert('WayangIDE SWF IDE v1.0.0\nBuilt on Electron + Monaco Editor + Flex SDK Compiler')
    } else if (action === 'undo') {
      activeEditor?.focus()
      activeEditor?.trigger('menu', 'undo', null)
    } else if (action === 'redo') {
      activeEditor?.focus()
      activeEditor?.trigger('menu', 'redo', null)
    } else if (action === 'cut') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.clipboardCutAction')?.run()
    } else if (action === 'copy') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.clipboardCopyAction')?.run()
    } else if (action === 'paste') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.clipboardPasteAction')?.run()
    } else if (action === 'find') {
      activeEditor?.focus()
      activeEditor?.getAction('actions.find')?.run()
    } else if (action === 'replace') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.startFindReplaceAction')?.run()
    } else if (action === 'toggle-line-comment') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.commentLine')?.run()
    } else if (action === 'toggle-block-comment') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.blockComment')?.run()
    } else if (action === 'select-all') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.selectAll')?.run()
    } else if (action === 'copy-line-up') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.copyLinesUpAction')?.run()
    } else if (action === 'copy-line-down') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.copyLinesDownAction')?.run()
    } else if (action === 'move-line-up') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.moveLinesUpAction')?.run()
    } else if (action === 'move-line-down') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.moveLinesDownAction')?.run()
    } else if (action === 'command-palette') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.quickCommand')?.run()
    } else if (action === 'word-wrap') {
      window.dispatchEvent(new CustomEvent('editor:toggle-word-wrap'))
    } else if (action === 'go-to-line') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.gotoLine')?.run()
    } else if (action === 'go-to-definition') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.revealDefinition')?.run()
    } else if (action === 'go-to-references') {
      activeEditor?.focus()
      activeEditor?.getAction('editor.action.referenceSearch.trigger')?.run()
    } else {
      setActiveModule(action)
    }
    setActiveMenu(null)
  }

  return (
    <div
      className="menubar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {menus.map((menu) => {
        const isMenuDisabled = menu.requiresSwf && !hasWorkspace

        return (
          <div
            key={menu.label}
            className="relative"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
              disabled={isMenuDisabled}
              className={`menubar-item ${isMenuDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {menu.label}
            </button>
            
            {activeMenu === menu.label && (
              <div className="dropdown-menu top-full left-0 mt-0">
                {menu.items.map((item, idx) => {
                  const isItemDisabled = item.requiresSwf && !hasWorkspace

                  return (
                    <div key={idx}>
                      <button
                        onClick={() => item.action && handleAction(item.action)}
                        disabled={isItemDisabled}
                        className={`dropdown-item w-full text-left ${isItemDisabled ? 'disabled' : ''}`}
                      >
                        <span>{item.label}</span>
                        {item.accelerator && (
                          <span className="text-xs text-slate-500">{item.accelerator}</span>
                        )}
                      </button>
                      {item.separator && <div className="dropdown-separator" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      
      {/* Window Controls */}
      <div
        className="ml-auto flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          className="window-control-btn"
          title="Minimize"
        >
          <Minus size={12} strokeWidth={2} />
        </button>
        <button
          onClick={() => window.electronAPI.maximizeWindow()}
          className="window-control-btn"
          title="Maximize"
        >
          <Square size={10} strokeWidth={2} />
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="window-control-btn window-control-close"
          title="Close"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
