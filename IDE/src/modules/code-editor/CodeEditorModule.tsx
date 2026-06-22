import { useState, useEffect, useMemo, useRef } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { findAssetLinkByClassName } from '../../lib/swf-linker'
import { Save, X, Code, Loader2, Columns2, Pin, PinOff, Search, ChevronDown, ChevronRight, ArrowDown, ArrowUp, WrapText, List } from 'lucide-react'
import ContextMenu from '../../components/layout/ContextMenu'
import ConfirmDialog from '../../components/layout/ConfirmDialog'

let hasRegisteredCompletions = false
let hasRegisteredQuickFixes = false
let hasRegisteredFormatter = false
let hasRegisteredHoverAndDefinition = false
let hasRegisteredLanguage = false
let hasRegisteredReferences = false
let hasRegisteredRefactor = false

const resolveClassName = (code: string, word: string): string | null => {
  if (!word) return null
  if (word.includes('.')) return word

  // Cari di baris-baris import
  const importRegex = new RegExp(`import\\s+([a-zA-Z0-9._$]+\\.${word});`, 'g')
  let match
  while ((match = importRegex.exec(code)) !== null) {
    return match[1]
  }

  // Jika tidak ada di import, cari kelas di SWF yang berakhiran dengan .word atau sama dengan word
  const swfClasses = (useAppStore.getState().swfData?.classes || []).map(c => c.fullName)
  const matchClass = swfClasses.find(c => c === word || c.endsWith('.' + word))
  if (matchClass) {
    return matchClass
  }

  return null
}

function parseEmbedAttributes(line: string): { source: string | null; symbol: string | null } | null {
  const match = line.match(/\[Embed\s*\(([^)]+)\)\]/)
  if (!match) return null
  
  const content = match[1]
  const sourceMatch = content.match(/source\s*=\s*["']([^"']+)["']/)
  const symbolMatch = content.match(/symbol\s*=\s*["']([^"']+)["']/)
  
  return {
    source: sourceMatch ? sourceMatch[1] : null,
    symbol: symbolMatch ? symbolMatch[1] : null
  }
}

function parseOutline(code: string) {
  try {
    const lines = code.split(/\r?\n/)
    const list: { name: string; line: number; type: 'function' | 'variable' | 'class' | 'interface' | 'namespace' }[] = []
    
    const classRegex = /^\s*(public|private|protected|internal)?\s*(dynamic|final|static)?\s*class\s+([a-zA-Z0-9_$]+)/
    const interfaceRegex = /^\s*(public|private|protected|internal)?\s*interface\s+([a-zA-Z0-9_$]+)/
    const namespaceRegex = /^\s*(public|private|protected|internal)?\s*namespace\s+([a-zA-Z0-9_$]+)/
    const funcRegex = /^\s*(public|private|protected|internal)?\s*(static)?\s*(override)?\s*(final)?\s*function\s+(get|set)?\s*([a-zA-Z0-9_$]+)\s*\(/
    const varRegex = /^\s*(public|private|protected|internal)?\s*(static)?\s*(const|var|let)\s+([a-zA-Z0-9_$]+)\s*[:=]/
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue
      
      let match = line.match(classRegex)
      if (match) {
        list.push({ name: `class ${match[3]}`, line: i + 1, type: 'class' })
        continue
      }
      
      match = line.match(interfaceRegex)
      if (match) {
        list.push({ name: `interface ${match[2]}`, line: i + 1, type: 'interface' })
        continue
      }
      
      match = line.match(namespaceRegex)
      if (match) {
        list.push({ name: `namespace ${match[2]}`, line: i + 1, type: 'namespace' })
        continue
      }
      
      match = line.match(funcRegex)
      if (match) {
        const funcName = match[6]
        const accessor = match[5] ? `${match[5]} ` : ''
        const modifier = match[1] ? `${match[1]} ` : ''
        const isOverride = match[3] ? 'override ' : ''
        list.push({ name: `${modifier}${isOverride}${accessor}${funcName}`, line: i + 1, type: 'function' })
        continue
      }
      
      match = line.match(varRegex)
      if (match) {
        const modifier = match[1] ? `${match[1]} ` : ''
        const isStatic = match[2] ? 'static ' : ''
        const varType = match[3] === 'const' ? 'const ' : ''
        list.push({ name: `${modifier}${isStatic}${varType}${match[4]}`, line: i + 1, type: 'variable' })
      }
    }
    return list
  } catch (err) {
    console.error('Outline parsing error:', err)
    return []
  }
}

function findReferencedSwfData(sourcePath: string) {
  const state = useAppStore.getState()
  const cleanSource = sourcePath.replace(/\\/g, '/').toLowerCase()
  const filename = cleanSource.split('/').pop() || ''
  
  // 1. Check main SWF
  if (state.swfPath && state.swfPath.replace(/\\/g, '/').toLowerCase().endsWith(filename)) {
    return { path: state.swfPath, data: state.swfData }
  }
  
  // 2. Check loaded asset SWFs
  for (const [path, data] of Object.entries(state.assetSwfsData)) {
    if (path.replace(/\\/g, '/').toLowerCase().endsWith(filename)) {
      return { path, data }
    }
  }
  
  return null
}


export default function CodeEditorModule() {
  const editingFile = useAppStore((s) => s.editingFile)
  const editingFileRight = useAppStore((s) => s.editingFileRight)
  const openTabs = useAppStore((s) => s.openTabs)
  const rightOpenTabs = useAppStore((s) => s.rightOpenTabs)
  const swfData = useAppStore((s) => s.swfData)
  
  const isSplitActive = useAppStore((s) => s.isSplitActive)
  const focusedEditorGroup = useAppStore((s) => s.focusedEditorGroup)
  const setFocusedEditorGroup = useAppStore((s) => s.setFocusedEditorGroup)
  const splitEditor = useAppStore((s) => s.splitEditor)
  const closeSplit = useAppStore((s) => s.closeSplit)
  
  const selectTabInGroup = useAppStore((s) => s.selectTabInGroup)
  const closeTabInGroup = useAppStore((s) => s.closeTabInGroup)
  const updateTabContent = useAppStore((s) => s.updateTabContent)
  const saveEditingFile = useAppStore((s) => s.saveEditingFile)
  const openFileForEditing = useAppStore((s) => s.openFileForEditing)

  // Store actions for pinning / reordering
  const pinTab = useAppStore((s) => s.pinTab)
  const unpinTab = useAppStore((s) => s.unpinTab)
  const reorderTabs = useAppStore((s) => s.reorderTabs)
  const closeOthers = useAppStore((s) => s.closeOthers)
  const closeAllTabsInGroup = useAppStore((s) => s.closeAllTabsInGroup)
  const closeSavedTabsInGroup = useAppStore((s) => s.closeSavedTabsInGroup)
  
  const diffHistoryCode = useAppStore((s) => s.diffHistoryCode)
  const setDiffHistoryCode = useAppStore((s) => s.setDiffHistoryCode)
  const showDiff = useAppStore((s) => s.showDiff)
  const setEditorCursor = useAppStore((s) => s.setEditorCursor)
  const jumpToLine = useAppStore((s) => s.jumpToLine)
  const diagnostics = useAppStore((s) => s.diagnostics)
  const { show } = useToast()

  // Separate states for Left and Right editors code
  const [leftCode, setLeftCode] = useState('')
  const [rightCode, setRightCode] = useState('')
  const [savingLeft, setSavingLeft] = useState(false)
  const [savingRight, setSavingRight] = useState(false)

  // Track Monaco Editor instances for scrolling/navigation
  const [leftEditor, setLeftEditor] = useState<any>(null)
  const [rightEditor, setRightEditor] = useState<any>(null)
  const [monaco, setMonaco] = useState<any>(null)

  // Context Menu State
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabClassName: string; group: 'left' | 'right' } | null>(null)

  // Breadcrumbs Dropdown State
  const [breadcrumbDropdown, setBreadcrumbDropdown] = useState<{ index: number; group: 'left' | 'right'; x: number; y: number } | null>(null)
  const breadcrumbRef = useRef<HTMLDivElement>(null)

  // Word Wrap & Outline States
  const [leftWordWrap, setLeftWordWrap] = useState<'on' | 'off'>('off')
  const [rightWordWrap, setRightWordWrap] = useState<'on' | 'off'>('off')
  const [leftOutlineOpen, setLeftOutlineOpen] = useState(false)
  const [rightOutlineOpen, setRightOutlineOpen] = useState(false)

  // Drag and Drop State
  const [draggingTab, setDraggingTab] = useState<{ index: number; group: 'left' | 'right' } | null>(null)

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const activeEditor = focusedEditorGroup === 'left' ? leftEditor : rightEditor

  // Sticky Scroll & minimap setting read from localStorage
  const stickyScrollEnabled = localStorage.getItem('setting:editor.stickyScroll.enabled') !== 'false'
  const minimapEnabled = localStorage.getItem('setting:editor.minimap.enabled') !== 'false'

  // Apply editor diagnostics
  useEffect(() => {
    if (!monaco) return

    const updateMarkers = (editor: any, file: any) => {
      if (!editor || !file) return
      const model = editor.getModel()
      if (!model) return

      const fileDiagnostics = [...(diagnostics[file.className] || [])]

      // Custom Embed Linter
      const lines = model.getValue().split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const embed = parseEmbedAttributes(line)
        if (embed && embed.source) {
          const ref = findReferencedSwfData(embed.source)
          if (!ref || !ref.data) {
            fileDiagnostics.push({
              line: i + 1,
              column: line.indexOf(embed.source) + 1,
              message: `Asset SWF file or metadata not found in workspace: "${embed.source}"`,
              severity: 'error'
            })
          } else if (embed.symbol) {
            const symbolStr = embed.symbol
            let tagId: number | null = null
            let tag = ref.data.tags.find((t: any) => t.name === symbolStr)
            if (tag) {
              tagId = tag.id
            } else {
              const numMatch = symbolStr.match(/\d+/)
              if (numMatch) {
                tagId = parseInt(numMatch[0], 10)
                tag = ref.data.tags.find((t: any) => t.id === tagId)
              }
            }
            if (!tag) {
              fileDiagnostics.push({
                line: i + 1,
                column: line.indexOf(embed.symbol) + 1,
                message: `Symbol "${embed.symbol}" not found in SWF: "${embed.source}"`,
                severity: 'warning'
              })
            }
          }
        }
      }

      const markers = fileDiagnostics.map((d) => ({
        startLineNumber: d.line,
        startColumn: d.column || 1,
        endLineNumber: d.line,
        endColumn: d.column ? d.column + 5 : model.getLineMaxColumn(d.line),
        message: d.message,
        severity: d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
      }))

      monaco.editor.setModelMarkers(model, 'compiler', markers)
    }

    updateMarkers(leftEditor, editingFile)
    if (isSplitActive) {
      updateMarkers(rightEditor, editingFileRight)
    }
  }, [diagnostics, leftEditor, rightEditor, editingFile, editingFileRight, monaco, isSplitActive])

  // Listen to jumpToLine changes
  useEffect(() => {
    if (jumpToLine) {
      const targetEditor = focusedEditorGroup === 'left' ? leftEditor : rightEditor
      if (targetEditor) {
        targetEditor.revealLineInCenter(jumpToLine.line)
        targetEditor.setPosition({ lineNumber: jumpToLine.line, column: 1 })
        targetEditor.focus()
      }
    }
  }, [jumpToLine, leftEditor, rightEditor, focusedEditorGroup])

  // Sync left code when tab changes
  useEffect(() => {
    if (editingFile) {
      setLeftCode(editingFile.code)
    }
  }, [editingFile])

  // Sync right code when tab changes
  useEffect(() => {
    if (editingFileRight) {
      setRightCode(editingFileRight.code)
    }
  }, [editingFileRight])

  // Clear cursor and editor instances when unmounting
  useEffect(() => {
    return () => {
      setEditorCursor(null)
      useAppStore.getState().setLeftEditorInstance(null)
      useAppStore.getState().setRightEditorInstance(null)
    }
  }, [setEditorCursor])

  // Listen to menu bar toggles for word wrap
  useEffect(() => {
    const handleToggle = () => {
      const activeGroup = useAppStore.getState().focusedEditorGroup
      if (activeGroup === 'right') {
        setRightWordWrap(prev => prev === 'on' ? 'off' : 'on')
      } else {
        setLeftWordWrap(prev => prev === 'on' ? 'off' : 'on')
      }
    }
    window.addEventListener('editor:toggle-word-wrap', handleToggle)
    return () => window.removeEventListener('editor:toggle-word-wrap', handleToggle)
  }, [])

  // Left Save
  const handleSaveLeft = async () => {
    if (!editingFile) return
    setSavingLeft(true)
    try {
      // Format on save if enabled
      let codeToSave = leftCode
      const formatOnSave = localStorage.getItem('setting:editor.formatOnSave') === 'true'
      if (formatOnSave && leftEditor) {
        await leftEditor.getAction('editor.action.formatDocument')?.run()
        codeToSave = leftEditor.getValue()
        setLeftCode(codeToSave)
      }
      const success = await saveEditingFile(codeToSave)
      if (success) {
        show('Class compiled & saved successfully!', 'success')
      } else {
        show('Compilation failed. Check terminal output.', 'error')
      }
    } catch (err: any) {
      show(`Error: ${err.message || err}`, 'error')
    } finally {
      setSavingLeft(false)
    }
  }

  // Right Save
  const handleSaveRight = async () => {
    if (!editingFileRight) return
    setSavingRight(true)
    try {
      // Format on save if enabled
      let codeToSave = rightCode
      const formatOnSave = localStorage.getItem('setting:editor.formatOnSave') === 'true'
      if (formatOnSave && rightEditor) {
        await rightEditor.getAction('editor.action.formatDocument')?.run()
        codeToSave = rightEditor.getValue()
        setRightCode(codeToSave)
      }
      const success = await saveEditingFile(codeToSave)
      if (success) {
        show('Right class compiled & saved successfully!', 'success')
      } else {
        show('Compilation failed. Check terminal output.', 'error')
      }
    } catch (err: any) {
      show(`Error: ${err.message || err}`, 'error')
    } finally {
      setSavingRight(false)
    }
  }

  // Handle Hotkeys (Ctrl+S, Ctrl+F, Ctrl+H)
  useEffect(() => {
    const matchKeybinding = (e: KeyboardEvent, keybindingStr: string) => {
      const parts = keybindingStr.toLowerCase().split('+')
      const needsCtrl = parts.includes('ctrl')
      const needsShift = parts.includes('shift')
      const needsAlt = parts.includes('alt')
      const keyPart = parts.find(p => p !== 'ctrl' && p !== 'shift' && p !== 'alt')
      
      if (needsCtrl && !(e.ctrlKey || e.metaKey)) return false
      if (needsShift && !e.shiftKey) return false
      if (needsAlt && !e.altKey) return false
      
      if (keyPart) {
        let eKey = e.key.toLowerCase()
        if (eKey === ' ') eKey = 'space'
        return eKey === keyPart
      }
      return false
    }

    const getBinding = (action: string, fallback: string) => {
      return localStorage.getItem(`keybinding:${action}`) || fallback
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchKeybinding(e, getBinding('saveFile', 'ctrl+s'))) {
        e.preventDefault()
        if (focusedEditorGroup === 'right' && editingFileRight && !savingRight) {
          handleSaveRight()
        } else if (focusedEditorGroup === 'left' && editingFile && !savingLeft) {
          handleSaveLeft()
        }
      } else if (matchKeybinding(e, getBinding('find', 'ctrl+f'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('actions.find')?.run()
        }
      } else if (matchKeybinding(e, getBinding('replace', 'ctrl+h'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('editor.action.startFindReplaceAction')?.run()
        }
      } else if (matchKeybinding(e, getBinding('formatDocument', 'shift+alt+f'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('editor.action.formatDocument')?.run()
        }
      } else if (matchKeybinding(e, getBinding('toggleSidebar', 'ctrl+b'))) {
        e.preventDefault()
        useAppStore.getState().toggleSidebar()
      } else if (matchKeybinding(e, getBinding('goToLine', 'ctrl+g'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('editor.action.gotoLine')?.run()
        }
      } else if (matchKeybinding(e, getBinding('closeTab', 'ctrl+w'))) {
        e.preventDefault()
        const tabs = focusedEditorGroup === 'right' ? rightOpenTabs : openTabs
        const editing = focusedEditorGroup === 'right' ? editingFileRight : editingFile
        if (editing && tabs.find(t => t.className === editing.className)) {
          useAppStore.getState().closeTab(editing.className)
        }
      } else if (matchKeybinding(e, getBinding('splitEditor', 'ctrl+\\'))) {
        e.preventDefault()
        useAppStore.getState().splitEditor()
      } else if (matchKeybinding(e, getBinding('goToDefinition', 'f12'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('editor.action.revealDefinition')?.run()
        }
      } else if (matchKeybinding(e, getBinding('renameSymbol', 'f2'))) {
        e.preventDefault()
        const editor = focusedEditorGroup === 'right' ? rightEditor : leftEditor
        if (editor) {
          editor.getAction('editor.action.rename')?.run()
        }
      } else if (matchKeybinding(e, getBinding('increaseFontSize', 'ctrl+='))) {
        e.preventDefault()
        const current = Number(localStorage.getItem('setting:editor.fontSize') || '14')
        localStorage.setItem('setting:editor.fontSize', String(Math.min(32, current + 1)))
        window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.fontSize' } }))
      } else if (matchKeybinding(e, getBinding('decreaseFontSize', 'ctrl+-'))) {
        e.preventDefault()
        const current = Number(localStorage.getItem('setting:editor.fontSize') || '14')
        localStorage.setItem('setting:editor.fontSize', String(Math.max(8, current - 1)))
        window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.fontSize' } }))
      } else if (matchKeybinding(e, getBinding('toggleMinimap', 'ctrl+shift+m'))) {
        e.preventDefault()
        const current = localStorage.getItem('setting:editor.minimap.enabled') !== 'false'
        localStorage.setItem('setting:editor.minimap.enabled', String(!current))
        window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.minimap.enabled' } }))
      } else if (matchKeybinding(e, getBinding('toggleWordWrap', 'alt+z'))) {
        e.preventDefault()
        const current = localStorage.getItem('setting:editor.wordWrap') || 'off'
        localStorage.setItem('setting:editor.wordWrap', current === 'on' ? 'off' : 'on')
        window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.wordWrap' } }))
      } else if (matchKeybinding(e, getBinding('commandPalette', 'ctrl+shift+p'))) {
        e.preventDefault()
        useAppStore.getState().toggleCommandPalette(true, 'command')
      } else if (matchKeybinding(e, getBinding('openFile', 'ctrl+p'))) {
        e.preventDefault()
        useAppStore.getState().toggleCommandPalette(true, 'file')
      } else if (matchKeybinding(e, getBinding('reopenClosedTab', 'ctrl+shift+t'))) {
        e.preventDefault()
        useAppStore.getState().reopenLastClosedTab()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedEditorGroup, leftCode, rightCode, editingFile, editingFileRight, savingLeft, savingRight])

  // Auto-Save Effect (Left Editor)
  useEffect(() => {
    const autoSaveEnabled = localStorage.getItem('setting:editor.autoSave') === 'true'
    if (!autoSaveEnabled || !editingFile) return

    if (leftCode !== editingFile.originalCode && !savingLeft) {
      const timer = setTimeout(() => {
        handleSaveLeft()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [leftCode, editingFile, savingLeft])

  // Auto-Save Effect (Right Editor)
  useEffect(() => {
    const autoSaveEnabled = localStorage.getItem('setting:editor.autoSave') === 'true'
    if (!autoSaveEnabled || !editingFileRight || !isSplitActive) return

    if (rightCode !== editingFileRight.originalCode && !savingRight) {
      const timer = setTimeout(() => {
        handleSaveRight()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [rightCode, editingFileRight, savingRight, isSplitActive])

  // Breadcrumbs siblings finder
  const getBreadcrumbSiblings = (pathIndex: number, className: string) => {
    if (!swfData) return []
    const segments = className.split('.')
    const parentPath = segments.slice(0, pathIndex).join('.')
    
    const siblingSet = new Set<string>()
    const classSet = new Set<string>()

    swfData.classes.forEach(c => {
      if (pathIndex === 0) {
        const parts = c.fullName.split('.')
        if (parts.length > 0) {
          siblingSet.add(parts[0])
          if (parts.length === 1) classSet.add(parts[0])
        }
      } else {
        if (c.fullName.startsWith(parentPath + '.')) {
          const sub = c.fullName.slice(parentPath.length + 1)
          const parts = sub.split('.')
          if (parts.length > 0) {
            siblingSet.add(parts[0])
            if (parts.length === 1) classSet.add(parts[0])
          }
        }
      }
    })

    return Array.from(siblingSet).sort().map(name => {
      const fullPath = parentPath ? `${parentPath}.${name}` : name
      const isClass = classSet.has(name) || swfData.classes.some(c => c.fullName === fullPath)
      return { name, fullPath, isClass }
    })
  }

  // Handle Tab Right-Click (ContextMenu)
  const handleTabContextMenu = (e: React.MouseEvent, tabClassName: string, group: 'left' | 'right') => {
    e.preventDefault()
    setTabCtxMenu({
      x: e.clientX,
      y: e.clientY,
      tabClassName,
      group
    })
  }

  const handleTabCtxSelect = (action: string) => {
    if (!tabCtxMenu) return
    const { tabClassName, group } = tabCtxMenu
    const targetTab = (group === 'left' ? openTabs : rightOpenTabs).find((t) => t.className === tabClassName)

    switch (action) {
      case 'pin':
        pinTab(group, tabClassName)
        break
      case 'unpin':
        unpinTab(group, tabClassName)
        break
      case 'close':
        closeTabInGroup(group, tabClassName)
        break
      case 'closeOthers':
        closeOthers(group, tabClassName)
        break
      case 'closeSaved':
        closeSavedTabsInGroup(group)
        break
      case 'closeAll':
        closeAllTabsInGroup(group)
        break
      case 'copyPath':
        navigator.clipboard.writeText(tabClassName)
        show('Class path copied to clipboard!', 'info')
        break
      case 'reveal':
        useAppStore.setState({ activeModule: 'explorer' })
        // Expand and highlight logic can trigger an event or state
        show(`Revealing ${tabClassName.split('.').pop()} in Explorer...`, 'info')
        break
    }
  }

  // Close breadcrumb dropdown click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (breadcrumbDropdown && !(e.target as HTMLElement).closest('.breadcrumb-select')) {
        setBreadcrumbDropdown(null)
      }
      if (!(e.target as HTMLElement).closest('.relative')) {
        setLeftOutlineOpen(false)
        setRightOutlineOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [breadcrumbDropdown])

  if (!editingFile && (!isSplitActive || !editingFileRight)) {
    return (
      <div className="module-empty flex flex-col items-center justify-center p-8 text-slate-500 h-full bg-[#070b13]">
        <Code size={48} className="mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">No class open for editing</p>
        <p className="text-xs text-slate-600 mt-1">Select a class from the SWF Explorer tree to begin.</p>
      </div>
    )
  }

  const renderTabGroup = (
    group: 'left' | 'right',
    tabs: typeof openTabs,
    activeFile: typeof editingFile,
    currentCode: string,
    onCodeChange: (val: string | undefined) => void,
    onSave: () => void,
    savingState: boolean
  ) => {
    const wordWrap = group === 'left' ? leftWordWrap : rightWordWrap
    const setWordWrap = group === 'left' ? setLeftWordWrap : setRightWordWrap
    const outlineOpen = group === 'left' ? leftOutlineOpen : rightOutlineOpen
    const setOutlineOpen = group === 'left' ? setLeftOutlineOpen : setRightOutlineOpen

    if (!activeFile) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-600 bg-slate-950/30 font-sans select-none">
          <Code size={36} className="mb-1.5 text-slate-800" />
          <p className="text-xs">No active tab in this group</p>
        </div>
      )
    }

    const breadcrumbs = activeFile.className.split('.')
    const isDirty = currentCode !== activeFile.originalCode

    const fontSize = Number(localStorage.getItem('setting:editor.fontSize') || '14')
    const fontFamily = localStorage.getItem('setting:editor.fontFamily') || "'Fira Code', Consolas, Monaco, monospace"
    const tabSize = Number(localStorage.getItem('setting:editor.tabSize') || '4')
    const minimapEnabled = localStorage.getItem('setting:editor.minimap.enabled') !== 'false'
    const cursorBlinking = localStorage.getItem('setting:editor.cursorBlinking') || 'smooth'
    const renderLineHighlight = localStorage.getItem('setting:editor.renderLineHighlight') || 'all' as any

    return (
      <div 
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all relative ${
          focusedEditorGroup === group ? 'bg-[#080b13]' : 'bg-[#06080e] opacity-90'
        }`}
        onClick={() => setFocusedEditorGroup(group)}
      >
        {/* Tab bar */}
        <div className="ide-tab-bar select-none flex items-center justify-between">
          <div className="flex items-center overflow-x-auto h-full scrollbar-none flex-1">
            {tabs.map((tab, idx) => {
              const isActive = tab.className === activeFile.className
              const isTabDirty = tab.code !== tab.originalCode
              return (
                <div
                  key={tab.className}
                  draggable
                  onDragStart={(e) => {
                    setDraggingTab({ index: idx, group })
                    e.dataTransfer.setData('text/plain', JSON.stringify({ index: idx, group }))
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggingTab && draggingTab.group === group) {
                      reorderTabs(group, draggingTab.index, idx)
                      setDraggingTab(null)
                    }
                  }}
                  className={`ide-tab group flex items-center gap-1.5 px-4 h-full border-r border-slate-900/60 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 cursor-pointer transition-all duration-150 relative ${isActive ? 'active' : ''}`}
                  onClick={() => selectTabInGroup(group, tab.className)}
                  onContextMenu={(e) => handleTabContextMenu(e, tab.className, group)}
                >
                  <Code size={12} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                  <span className="truncate max-w-[120px] font-sans flex items-center gap-1">
                    {tab.isPinned && <Pin size={10} className="text-indigo-400 rotate-45 mr-0.5 shrink-0" />}
                    {tab.className.split('.').pop()}.as
                  </span>
                  
                  {isTabDirty && !tab.isPinned && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-0.5" />
                  )}

                  {tab.isPinned ? (
                    <button
                      className="ide-tab-close opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        unpinTab(group, tab.className)
                      }}
                      title="Unpin Tab"
                    >
                      <PinOff size={9} />
                    </button>
                  ) : (
                    <button
                      className="ide-tab-close"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isTabDirty) {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Discard Changes',
                            message: `Discard unsaved changes for ${tab.className.split('.').pop()}?`,
                            onConfirm: () => {
                              closeTabInGroup(group, tab.className)
                              setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                            }
                          })
                        } else {
                          closeTabInGroup(group, tab.className)
                        }
                      }}
                    >
                      <X size={9} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Editor Control Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0d121f] border-b border-slate-900/60 backdrop-blur-md shrink-0 select-none relative z-10">
          {/* Breadcrumbs */}
          <div ref={breadcrumbRef} className="flex items-center gap-1 text-[10px] text-slate-500 font-medium font-sans relative">
            <span className="text-slate-600">src</span>
            {breadcrumbs.map((part, index) => {
              const isLast = index === breadcrumbs.length - 1
              const isOpen = breadcrumbDropdown && breadcrumbDropdown.index === index && breadcrumbDropdown.group === group
              
              return (
                <div key={index} className="flex items-center gap-1 relative">
                  <span className="text-slate-700">/</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const parentRect = breadcrumbRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
                      setBreadcrumbDropdown(isOpen ? null : {
                        index,
                        group,
                        x: rect.left - parentRect.left,
                        y: rect.bottom - parentRect.top + 4
                      })
                    }}
                    className={`hover:text-slate-300 transition-colors flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-slate-900/60 cursor-pointer ${
                      isLast ? 'text-indigo-400 font-semibold' : ''
                    }`}
                  >
                    {isLast && <Code size={10} className="text-indigo-400 mr-0.5" />}
                    <span>{part}</span>
                    <ChevronDown size={8} className="opacity-60" />
                  </button>

                  {/* Sibling Dropdown */}
                  {isOpen && (
                    <div 
                      className="breadcrumb-select absolute left-0 top-6 bg-slate-950 border border-slate-900 rounded-md shadow-2xl p-1 z-50 min-w-[160px] max-h-60 overflow-y-auto"
                      style={{ transform: 'translateX(0px)' }}
                    >
                      {getBreadcrumbSiblings(index, activeFile.className).map((item) => (
                        <button
                          key={item.fullPath}
                          className="w-full text-left px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:bg-indigo-650/20 rounded flex items-center gap-1.5 transition-colors font-sans"
                          onClick={() => {
                            if (item.isClass) {
                              openFileForEditing(item.fullPath)
                            } else {
                              // Open first class inside folder package
                              const firstClass = swfData?.classes.find(c => c.fullName === item.fullPath || c.fullName.startsWith(item.fullPath + '.'))
                              if (firstClass) openFileForEditing(firstClass.fullName)
                            }
                            setBreadcrumbDropdown(null)
                          }}
                        >
                          <Code size={9} className={item.isClass ? 'text-indigo-400' : 'text-amber-500'} />
                          <span className={item.isClass ? '' : 'font-semibold'}>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Outline navigation dropdown */}
            <span className="text-slate-700">/</span>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOutlineOpen(!outlineOpen)
                }}
                className={`hover:text-slate-300 transition-colors flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-slate-900/60 cursor-pointer ${outlineOpen ? 'text-indigo-400 bg-indigo-950/40' : ''}`}
                title="Outline / List functions"
              >
                <List size={10} className="text-slate-500 mr-0.5" />
                <span>Outline</span>
                <ChevronDown size={8} className="opacity-60" />
              </button>

              {outlineOpen && (
                <div className="absolute left-0 top-6 bg-slate-950 border border-slate-900 rounded-md shadow-2xl p-1 z-50 min-w-[200px] max-h-60 overflow-y-auto">
                  {parseOutline(currentCode).map((item, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:bg-indigo-650/20 rounded flex items-center gap-1.5 transition-colors font-sans"
                      onClick={() => {
                        const editor = group === 'left' ? leftEditor : rightEditor
                        if (editor) {
                          editor.revealLineInCenter(item.line)
                          editor.setPosition({ lineNumber: item.line, column: 1 })
                          editor.focus()
                        }
                        setOutlineOpen(false)
                      }}
                    >
                      <Code size={9} className={
                        item.type === 'class' ? 'text-amber-500' :
                        item.type === 'interface' ? 'text-emerald-500' :
                        item.type === 'namespace' ? 'text-purple-500' :
                        item.type === 'variable' ? 'text-cyan-400' :
                        'text-indigo-400'
                      } />
                      <span>{item.name}</span>
                    </button>
                  ))}
                  {parseOutline(currentCode).length === 0 && (
                    <div className="p-2 text-[10px] text-slate-600 font-sans text-center">No symbols found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Minimap Toggle */}
            <button
              onClick={() => {
                const current = localStorage.getItem('setting:editor.minimap.enabled') !== 'false'
                localStorage.setItem('setting:editor.minimap.enabled', String(!current))
                window.dispatchEvent(new CustomEvent('setting-changed', { detail: { key: 'editor.minimap.enabled' } }))
              }}
              className={`flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-900 ${
                minimapEnabled ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-500 hover:text-slate-200'
              }`}
              title="Toggle Minimap"
            >
              <List size={12} />
            </button>

            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
              className={`flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-900 ${
                wordWrap === 'on' ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-500 hover:text-slate-200'
              }`}
              title="Toggle Word Wrap"
            >
              <WrapText size={12} />
            </button>

            {/* Find & Replace Trigger */}
            <button
              onClick={() => {
                const editor = group === 'right' ? rightEditor : leftEditor
                if (editor) {
                  editor.getAction('actions.find')?.run()
                }
              }}
              className="flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-900 text-slate-500 hover:text-slate-200"
              title="Find (Ctrl+F) / Replace (Ctrl+H)"
            >
              <Search size={12} />
            </button>

            {/* Split/Unsplit Button */}
            {group === 'left' && !isSplitActive && (
              <button
                onClick={splitEditor}
                className="btn btn-secondary flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-md"
                title="Split Editor"
              >
                <Columns2 size={12} />
              </button>
            )}

            {group === 'right' && (
              <button
                onClick={closeSplit}
                className="btn btn-secondary flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-md"
                title="Close Split Editor"
              >
                <X size={12} />
              </button>
            )}

            {/* Save Action */}
            <button
              className="btn btn-primary flex items-center gap-1.5 py-1 px-3 text-[11px] rounded-md"
              onClick={onSave}
              disabled={!isDirty || savingState}
            >
              {savingState ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              <span>Save & Compile</span>
            </button>
          </div>
        </div>

        {/* Monaco Instance */}
        <div className="flex-1 min-h-0 bg-slate-950">
          {showDiff || diffHistoryCode ? (
            <DiffEditor
              height="100%"
              language="actionscript"
              theme="vs-dark"
              original={diffHistoryCode || activeFile.originalCode}
              modified={currentCode}
              options={{
                fontSize,
                fontFamily,
                renderSideBySide: true,
                automaticLayout: true,
                readOnly: false
              }}
            />
          ) : (
            <Editor
              height="100%"
              defaultLanguage="actionscript"
              theme="vs-dark"
              value={currentCode}
              onChange={onCodeChange}
              onMount={(editorInstance, monacoInstance) => {
                setMonaco(monacoInstance)
                
                // Register ActionScript 3 custom language
                if (!hasRegisteredLanguage) {
                  hasRegisteredLanguage = true
                  monacoInstance.languages.register({ id: 'actionscript' })
                  monacoInstance.languages.setMonarchTokensProvider('actionscript', {
                    defaultToken: 'invalid',
                    tokenPostfix: '.as',

                    keywords: [
                      'as', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
                      'delete', 'do', 'else', 'extends', 'finally', 'for', 'function', 'if',
                      'in', 'instanceof', 'interface', 'is', 'new', 'return', 'super', 'switch',
                      'this', 'throw', 'try', 'typeof', 'use', 'var', 'void', 'while', 'with',
                      'package', 'import', 'include', 'public', 'private', 'protected', 'internal',
                      'static', 'override', 'final', 'dynamic', 'native', 'get', 'set', 'namespace'
                    ],

                    typeKeywords: [
                      'int', 'uint', 'Number', 'Boolean', 'String', 'Array', 'Object', 'Vector', 'MovieClip', 'Sprite', 'Event', 'Function'
                    ],

                    operators: [
                      '=', '>', '<', '!', '~', '?', ':',
                      '==', '<=', '>=', '!=', '&&', '||', '++', '--',
                      '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>',
                      '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>='
                    ],

                    symbols:  /[=><!~?:&|+\-*\/\^%]+/,
                    escapes:  /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

                    tokenizer: {
                      root: [
                        [/[a-zA-Z_$][\w$]*/, {
                          cases: {
                            '@keywords': 'keyword',
                            '@typeKeywords': 'type',
                            '@default': 'identifier'
                          }
                        }],
                        { include: '@whitespace' },
                        [/[{}()\[\]]/, '@brackets'],
                        [/[<>]/, 'delimiter'],
                        [/@symbols/, {
                          cases: {
                            '@operators': 'operator',
                            '@default': ''
                          }
                        }],
                        [/\d*\.\d+(?:[eE][\-+]?\d+)?/, 'number.float'],
                        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
                        [/\d+/, 'number'],
                        [/[;,.]/, 'delimiter'],
                        [/"([^"\\]|\\.)*$/, 'string.invalid'],
                        [/'([^'\\]|\\.)*$/, 'string.invalid'],
                        [/"/, 'string', '@string_double'],
                        [/'/, 'string', '@string_single']
                      ],
                      whitespace: [
                        [/[ \t\r\n]+/, ''],
                        [/\/\*\*/, 'comment.doc', '@jsdoc'],
                        [/\/\*/, 'comment', '@comment'],
                        [/\/\/.*$/, 'comment']
                      ],
                      comment: [
                        [/[^\/*]+/, 'comment'],
                        [/\*\//, 'comment', '@pop'],
                        [/[\/*]/, 'comment']
                      ],
                      jsdoc: [
                        [/[^\/*]+/, 'comment.doc'],
                        [/\*\//, 'comment.doc', '@pop'],
                        [/[\/*]/, 'comment.doc']
                      ],
                      string_double: [
                        [/[^\\"]+/, 'string'],
                        [/@escapes/, 'string.escape'],
                        [/\\./, 'string.escape.invalid'],
                        [/"/, 'string', '@pop']
                      ],
                      string_single: [
                        [/[^\\']+/, 'string'],
                        [/@escapes/, 'string.escape'],
                        [/\\./, 'string.escape.invalid'],
                        [/'/, 'string', '@pop']
                      ]
                    }
                  })
                }

                if (!hasRegisteredCompletions) {
                  hasRegisteredCompletions = true
                  monacoInstance.languages.registerCompletionItemProvider('actionscript', {
                    provideCompletionItems: (model: any, position: any) => {
                      const word = model.getWordUntilPosition(position)
                      const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                      }

                      const lineContent = model.getLineContent(position.lineNumber)
                      
                      // Auto-complete symbol="..." inside [Embed(...)]
                      const embedMatch = lineContent.match(/\[Embed\s*\(([^)]+)\)\]/)
                      if (embedMatch) {
                        const content = embedMatch[1]
                        const sourceMatch = content.match(/source\s*=\s*["']([^"']+)["']/)
                        if (sourceMatch) {
                          const source = sourceMatch[1]
                          const ref = findReferencedSwfData(source)
                          if (ref && ref.data) {
                            const suggestions = ref.data.tags
                              .filter((t: any) => t.name)
                              .map((t: any) => ({
                                label: t.name,
                                kind: monacoInstance.languages.CompletionItemKind.Field,
                                detail: `Asset Symbol (ID: ${t.id})`,
                                documentation: `Exported symbol class from ${ref.path.split(/[\\/]/).pop()}`,
                                insertText: t.name,
                                range
                              }))
                            return { suggestions }
                          }
                        }
                      }

                      const state = useAppStore.getState()
                      const suggestions: any[] = [
                        // AS3 Core classes
                        ...[
                          'MovieClip', 'Sprite', 'Sound', 'Event', 'ByteArray', 'Stage', 'DisplayObject',
                          'Point', 'Rectangle', 'Matrix', 'ColorTransform', 'SoundTransform', 'Capabilities',
                          'URLLoader', 'URLRequest', 'navigateToURL', 'Loader', 'Bitmap', 'BitmapData',
                          'TextField', 'TextFormat', 'SimpleButton', 'Timer', 'MouseEvent', 'KeyboardEvent'
                        ].map(name => ({
                          label: name,
                          kind: monacoInstance.languages.CompletionItemKind.Class,
                          insertText: name,
                          detail: 'Flash Player Core Class',
                          range
                        })),

                        {
                          label: 'ns-amf',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'WayangIDE AMF Service Call',
                          insertText: [
                            '// Call AMF service',
                            'NetworkManager.getInstance().sendRequest("${1:ServiceName}", "${2:methodName}", [${3:args}], function(response:Object):void {',
                            '\tif (response.status == "success") {',
                            '\t\t${4:// handle success}',
                            '\t} else {',
                            '\t\t${5:// handle error}',
                            '\t}',
                            '});'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'ns-popup',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'WayangIDE Dialog / Pop-up Dialog',
                          insertText: [
                            '// Create and show standard alert popup',
                            'DialogManager.getInstance().showAlert("${1:Title}", "${2:Message}", function():void {',
                            '\t${3:// on close callback}',
                            '});'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'ns-loadasset',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'WayangIDE Asset Loading',
                          insertText: [
                            'AssetManager.getInstance().loadAsset("${1:asset_path}", function(asset:Object):void {',
                            '\t${2:// use loaded asset}',
                            '});'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'as3class',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'ActionScript 3 Class Template',
                          insertText: [
                            'package ${1:package_name} {',
                            '\tpublic class ${2:ClassName} {',
                            '\t\tpublic function ${2:ClassName}() {',
                            '\t\t\t${3:// constructor}',
                            '\t\t}',
                            '\t}',
                            '}'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'as3function',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'ActionScript 3 Method Template',
                          insertText: [
                            'public function ${1:methodName}(${2:args}):${3:void} {',
                            '\t${4:// body}',
                            '}'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'as3foreach',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'ActionScript 3 For Each Loop',
                          insertText: [
                            'for each (var ${1:item}:${2:Type} in ${3:collection}) {',
                            '\t${4:// body}',
                            '}'
                          ].join('\n'),
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        {
                          label: 'as3listener',
                          kind: monacoInstance.languages.CompletionItemKind.Snippet,
                          documentation: 'ActionScript 3 Event Listener',
                          insertText: '${1:target}.addEventListener(${2:Event}.${3:TYPE}, ${4:onEvent});',
                          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          range
                        },
                        ...['package', 'import', 'extends', 'implements', 'public', 'private', 'protected', 'internal', 'static', 'override', 'const', 'var', 'function', 'class', 'interface', 'native', 'uint', 'int', 'Number', 'Boolean', 'String', 'Array', 'Vector', 'Object', 'void', 'trace'].map(keyword => ({
                          label: keyword,
                          kind: monacoInstance.languages.CompletionItemKind.Keyword,
                          insertText: keyword,
                          range
                        }))
                      ]

                      // Inject class autocomplete suggestions
                      if (state.swfData?.classes) {
                        state.swfData.classes.forEach((c) => {
                          suggestions.push({
                            label: c.name,
                            kind: monacoInstance.languages.CompletionItemKind.Class,
                            detail: `class ${c.fullName}`,
                            documentation: `AS3 Class defined in ${state.swfPath?.split(/[\\/]/).pop()}`,
                            insertText: c.name,
                            range
                          })
                        })
                      }

                      // Inject exported Asset Symbols from main SWF
                      if (state.swfData?.tags) {
                        state.swfData.tags.forEach((t: any) => {
                          if (t.name) {
                            suggestions.push({
                              label: t.name,
                              kind: monacoInstance.languages.CompletionItemKind.Interface,
                              detail: `Asset Symbol (ID: ${t.id}, Main SWF)`,
                              documentation: `Exported symbol class from ${state.swfPath?.split(/[\\/]/).pop()}`,
                              insertText: t.name,
                              range
                            })
                          }
                        })
                      }

                      // Inject exported Asset Symbols from secondary SWFs
                      Object.entries(state.assetSwfsData).forEach(([path, data]: [string, any]) => {
                        if (data?.tags) {
                          const swfName = path.split(/[\\/]/).pop() || 'Asset SWF'
                          data.tags.forEach((t: any) => {
                            if (t.name) {
                              suggestions.push({
                                label: t.name,
                                kind: monacoInstance.languages.CompletionItemKind.Interface,
                                detail: `Asset Symbol (ID: ${t.id}, ${swfName})`,
                                documentation: `Exported symbol class from secondary SWF: ${swfName}`,
                                insertText: t.name,
                                range
                              })
                            }
                          })
                        }
                      })

                      return { suggestions }
                    }
                  })
                }

                // Override openCodeEditor to handle custom AS3 file navigation (outline & reference clicks)
                const editorService = (editorInstance as any)._codeEditorService
                if (editorService) {
                  const originalOpenEditor = editorService.openCodeEditor.bind(editorService)
                  editorService.openCodeEditor = async (input: any, source: any, sideBySide: any) => {
                    const uriStr = input.resource.toString()
                    if (uriStr.startsWith('as3file:///')) {
                      const className = uriStr.replace('as3file:///', '')
                      useAppStore.getState().openFileForEditing(className).catch(console.error)
                      return editorInstance
                    }
                    return originalOpenEditor(input, source, sideBySide)
                  }
                }

                // Listen to mouse down events for Ctrl+Click to open definition
                editorInstance.onMouseDown((e: any) => {
                  if (e.event.ctrlKey || e.event.metaKey) {
                    const target = e.target
                    if (target && target.position) {
                      const model = editorInstance.getModel()
                      if (model) {
                        const wordInfo = model.getWordAtPosition(target.position)
                        if (wordInfo) {
                          const resolvedClass = resolveClassName(model.getValue(), wordInfo.word)
                          if (resolvedClass) {
                            const swfClasses = (useAppStore.getState().swfData?.classes || []).map(c => c.fullName)
                            if (swfClasses.includes(resolvedClass)) {
                              e.event.preventDefault()
                              e.event.stopPropagation()
                              useAppStore.getState().openFileForEditing(resolvedClass).catch(console.error)
                            } else {
                              const assetLink = findAssetLinkByClassName(resolvedClass)
                              if (assetLink) {
                                e.event.preventDefault()
                                e.event.stopPropagation()
                                useAppStore.getState().viewAsset(assetLink.tagId, assetLink.category, assetLink.swfPath)
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                })

                if (group === 'left') {
                  setLeftEditor(editorInstance)
                  useAppStore.getState().setLeftEditorInstance(editorInstance)
                } else {
                  setRightEditor(editorInstance)
                  useAppStore.getState().setRightEditorInstance(editorInstance)
                }

                editorInstance.onDidChangeCursorPosition((e) => {
                  if (focusedEditorGroup === group) {
                    setEditorCursor({
                      line: e.position.lineNumber,
                      column: e.position.column
                    })
                  }
                })
                const pos = editorInstance.getPosition()
                if (pos && focusedEditorGroup === group) {
                  setEditorCursor({
                    line: pos.lineNumber,
                    column: pos.column
                  })
                }

                // Register AS3 Hover & Go to Definition Provider
                if (!hasRegisteredHoverAndDefinition) {
                  hasRegisteredHoverAndDefinition = true

                  // 1. Hover Provider
                  monacoInstance.languages.registerHoverProvider('actionscript', {
                    provideHover: async (model: any, position: any) => {
                      const lineContent = model.getLineContent(position.lineNumber)
                      const embed = parseEmbedAttributes(lineContent)
                      if (embed && embed.source && embed.symbol) {
                        const ref = findReferencedSwfData(embed.source)
                        if (ref && ref.data) {
                          const symbolStr = embed.symbol
                          let tagId: number | null = null
                          let tag = ref.data.tags.find((t: any) => t.name === symbolStr)
                          if (tag) {
                            tagId = tag.id
                          } else {
                            const numMatch = symbolStr.match(/\d+/)
                            if (numMatch) {
                              tagId = parseInt(numMatch[0], 10)
                              tag = ref.data.tags.find((t: any) => t.id === tagId)
                            }
                          }
                          
                          if (tag && tagId !== null) {
                            let category = 'image'
                            const type = tag.type.toLowerCase()
                            if (type.startsWith('defineshape')) category = 'shape'
                            else if (type.startsWith('definemorphshape')) category = 'morphshape'
                            else if (type.startsWith('definesprite')) category = 'sprite'
                            else if (type.startsWith('definesound')) category = 'sound'

                            const swfName = ref.path.split(/[\\/]/).pop()
                            const contents: any[] = [
                              { value: `**Embedded Asset Info**`, isTrusted: true },
                              { value: `* **SWF Source**: \`${swfName}\``, isTrusted: true },
                              { value: `* **Tag ID**: \`${tagId}\` (${tag.type})`, isTrusted: true },
                              { value: `* **Size**: \`${(tag.size / 1024).toFixed(1)} KB\``, isTrusted: true }
                            ]

                            if (category !== 'sound') {
                              const assetUrl = `ns-asset://${tagId}?swfPath=${encodeURIComponent(ref.path)}&category=${category}`
                              contents.push({ value: `![Asset Preview](${assetUrl})`, isTrusted: true })
                            } else {
                              contents.push({ value: `*Audio Asset (ID: ${tagId})*`, isTrusted: true })
                            }

                            return {
                              range: new monacoInstance.Range(
                                position.lineNumber,
                                1,
                                position.lineNumber,
                                lineContent.length + 1
                              ),
                              contents
                            }
                          }
                        }
                      }

                      const wordInfo = model.getWordAtPosition(position)
                      if (!wordInfo) return null
                      const word = wordInfo.word

                      const resolvedClass = resolveClassName(model.getValue(), word)
                      if (!resolvedClass) return null

                      const swfClasses = (useAppStore.getState().swfData?.classes || []).map(c => c.fullName)
                      if (!swfClasses.includes(resolvedClass)) {
                        const assetLink = findAssetLinkByClassName(resolvedClass)
                        if (assetLink) {
                          const swfName = assetLink.swfPath.split(/[\\/]/).pop()
                          return {
                            range: new monacoInstance.Range(
                              position.lineNumber,
                              wordInfo.startColumn,
                              position.lineNumber,
                              wordInfo.endColumn
                            ),
                            contents: [
                              { value: `**Asset Link** (linked to SymbolClass)` },
                              { value: `* **Source SWF**: \`${swfName}\`` },
                              { value: `* **Tag ID**: \`${assetLink.tagId}\` (${assetLink.category})` },
                              { value: `*Ctrl+Click to preview in Asset Forge*` }
                            ]
                          }
                        }
                        return null
                      }

                      return {
                        range: new monacoInstance.Range(
                          position.lineNumber,
                          wordInfo.startColumn,
                          position.lineNumber,
                          wordInfo.endColumn
                        ),
                        contents: [
                          { value: `**class** ${resolvedClass}` },
                          { value: `*Ctrl+Click to open class definition*` }
                        ]
                      }
                    }
                  })

                  // 2. Definition Provider
                  monacoInstance.languages.registerDefinitionProvider('actionscript', {
                    provideDefinition: (model: any, position: any) => {
                      const lineContent = model.getLineContent(position.lineNumber)
                      const embed = parseEmbedAttributes(lineContent)
                      if (embed && embed.source && embed.symbol) {
                        const ref = findReferencedSwfData(embed.source)
                        if (ref && ref.data) {
                          const symbolStr = embed.symbol
                          let tagId: number | null = null
                          let tag = ref.data.tags.find((t: any) => t.name === symbolStr)
                          if (tag) {
                            tagId = tag.id
                          } else {
                            const numMatch = symbolStr.match(/\d+/)
                            if (numMatch) {
                              tagId = parseInt(numMatch[0], 10)
                              tag = ref.data.tags.find((t: any) => t.id === tagId)
                            }
                          }
                          
                          if (tag && tagId !== null) {
                            let category = 'image'
                            const type = tag.type.toLowerCase()
                            if (type.startsWith('defineshape')) category = 'shape'
                            else if (type.startsWith('definemorphshape')) category = 'morphshape'
                            else if (type.startsWith('definesprite')) category = 'sprite'
                            else if (type.startsWith('definesound')) category = 'sound'

                            useAppStore.getState().viewAsset(tagId, category, ref.path)
                            return null
                          }
                        }
                      }

                      const wordInfo = model.getWordAtPosition(position)
                      if (!wordInfo) return null
                      const word = wordInfo.word

                      const resolvedClass = resolveClassName(model.getValue(), word)
                      if (!resolvedClass) return null

                      const swfClasses = (useAppStore.getState().swfData?.classes || []).map(c => c.fullName)
                      if (!swfClasses.includes(resolvedClass)) {
                        const assetLink = findAssetLinkByClassName(resolvedClass)
                        if (assetLink) {
                          useAppStore.getState().viewAsset(assetLink.tagId, assetLink.category, assetLink.swfPath)
                          return null
                        }
                        return null
                      }

                      return {
                        uri: model.uri,
                        range: new monacoInstance.Range(
                          position.lineNumber,
                          wordInfo.startColumn,
                          position.lineNumber,
                          wordInfo.endColumn
                        )
                      }
                    }
                  })
                }

                // Register AS3 Find All References Provider
                if (!hasRegisteredReferences) {
                  hasRegisteredReferences = true
                  monacoInstance.languages.registerReferenceProvider('actionscript', {
                    provideReferences: async (model: any, position: any) => {
                      const wordInfo = model.getWordAtPosition(position)
                      if (!wordInfo) return []
                      const word = wordInfo.word

                      const swfPath = useAppStore.getState().swfPath
                      if (!swfPath) return []

                      try {
                        const searchRes = await window.electronAPI.searchScripts(swfPath, word, {
                          caseSensitive: true,
                          wholeWord: true,
                          useRegex: false
                        })

                        return searchRes.map((res: any) => ({
                          uri: monacoInstance.Uri.parse(`as3file:///${res.className}`),
                          range: new monacoInstance.Range(
                            res.lineNumber,
                            1,
                            res.lineNumber,
                            100
                          )
                        }))
                      } catch (err) {
                        console.error(err)
                        return []
                      }
                    }
                  })
                }

                // Register AS3 Diagnostic Quick Fixes
                if (!hasRegisteredQuickFixes) {
                  hasRegisteredQuickFixes = true
                  monacoInstance.languages.registerCodeActionProvider('actionscript', {
                    provideCodeActions: (model: any, range: any, context: any, token: any) => {
                      const actions = context.markers.map((marker: any) => {
                        const quickFixes = []

                        quickFixes.push({
                          title: `Comment out error line: ${marker.message}`,
                          diagnostics: [marker],
                          kind: 'quickfix',
                          edit: {
                            edits: [{
                              resource: model.uri,
                              textEdit: {
                                range: {
                                  startLineNumber: marker.startLineNumber,
                                  startColumn: 1,
                                  endLineNumber: marker.startLineNumber,
                                  endColumn: 1
                                },
                                text: '// '
                              }
                            }]
                          }
                        })

                        if (marker.message.toLowerCase().includes('override')) {
                          quickFixes.push({
                            title: 'Insert override keyword',
                            diagnostics: [marker],
                            kind: 'quickfix',
                            edit: {
                              edits: [{
                                resource: model.uri,
                                textEdit: {
                                  range: {
                                    startLineNumber: marker.startLineNumber,
                                    startColumn: marker.startColumn,
                                    endLineNumber: marker.startLineNumber,
                                    endColumn: marker.startColumn
                                  },
                                  text: 'override '
                                }
                              }]
                            }
                          })
                        }

                        quickFixes.push({
                          title: 'Suppress compilation warning',
                          diagnostics: [marker],
                          kind: 'quickfix',
                          edit: {
                            edits: [{
                              resource: model.uri,
                              textEdit: {
                                range: {
                                  startLineNumber: marker.startLineNumber,
                                  startColumn: 1,
                                  endLineNumber: marker.startLineNumber,
                                  endColumn: 1
                                },
                                text: '/* @nsc-suppress */ '
                              }
                            }]
                          }
                        })

                        return quickFixes
                      }).flat()

                      return {
                        actions,
                        dispose: () => {}
                      }
                    }
                  })
                }

                // Register AS3 Formatter
                if (!hasRegisteredFormatter) {
                  hasRegisteredFormatter = true
                  monacoInstance.languages.registerDocumentFormattingEditProvider('actionscript', {
                    provideDocumentFormattingEdits: (model: any) => {
                      const lines = model.getValue().split(/\r?\n/)
                      let indentLevel = 0
                      const tabSize = Number(localStorage.getItem('setting:editor.tabSize') || '4')
                      const indentStr = ' '.repeat(tabSize)
                      
                      const formattedLines = lines.map((line: string) => {
                        const trimmed = line.trim()
                        if (!trimmed) return ''
                        
                        let currentIndent = indentLevel
                        const startsWithClosing = /^[}\]]/.test(trimmed)
                        if (startsWithClosing) {
                          currentIndent = Math.max(0, currentIndent - 1)
                        }
                        
                        const openBraces = (trimmed.match(/[{[]/g) || []).length
                        const closeBraces = (trimmed.match(/[}\]]/g) || []).length
                        
                        indentLevel = Math.max(0, indentLevel + openBraces - closeBraces)
                        
                        return indentStr.repeat(currentIndent) + trimmed
                      })
                      
                      return [{
                        range: model.getFullModelRange(),
                        text: formattedLines.join('\n')
                      }]
                    }
                  })
                }

                // Register Refactor Tools
                if (!hasRegisteredRefactor) {
                  hasRegisteredRefactor = true
                  // Extract to Method action
                  editorInstance.addAction({
                    id: 'refactor.extractMethod',
                    label: 'Extract to Method',
                    keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyM],
                    contextMenuGroupId: 'modification',
                    contextMenuOrder: 1.5,
                    run: (ed) => {
                      const selection = ed.getSelection()
                      if (!selection || selection.isEmpty()) return
                      const model = ed.getModel()
                      if (!model) return
                      const selectedText = model.getValueInRange(selection)
                      const methodName = 'newMethod'
                      const indent = ' '.repeat(8)
                      const extractedCode = `${indent}private function ${methodName}():void {\n${indent}\t${selectedText}\n${indent}}`
                      const callCode = `${indent}${methodName}()`
                      
                      // Replace selection with method call
                      ed.executeEdits('refactor.extractMethod', [{
                        range: selection,
                        text: callCode,
                        forceMoveMarkers: true
                      }])
                      
                      // Add method at end of class
                      const lastLine = model.getLineCount()
                      const insertPosition = { lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) }
                      ed.executeEdits('refactor.extractMethod', [{
                        range: new monacoInstance.Range(insertPosition.lineNumber, insertPosition.column, insertPosition.lineNumber, insertPosition.column),
                        text: `\n${extractedCode}\n`,
                        forceMoveMarkers: true
                      }])
                    }
                  })

                  // Extract to Variable action
                  editorInstance.addAction({
                    id: 'refactor.extractVariable',
                    label: 'Extract to Variable',
                    keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyM],
                    contextMenuGroupId: 'modification',
                    contextMenuOrder: 1.6,
                    run: (ed) => {
                      const selection = ed.getSelection()
                      if (!selection || selection.isEmpty()) return
                      const model = ed.getModel()
                      if (!model) return
                      const selectedText = model.getValueInRange(selection)
                      const varName = 'extractedVar'
                      const lineContent = model.getLineContent(selection.startLineNumber)
                      const indent = lineContent.match(/^\s*/)?.[0] || '    '
                      
                      // Add variable declaration before current line
                      const insertLine = selection.startLineNumber
                      ed.executeEdits('refactor.extractVariable', [{
                        range: new monacoInstance.Range(insertLine, 1, insertLine, 1),
                        text: `${indent}var ${varName}:* = ${selectedText};\n`,
                        forceMoveMarkers: true
                      }])
                      
                      // Replace selection with variable name
                      ed.executeEdits('refactor.extractVariable', [{
                        range: selection,
                        text: varName,
                        forceMoveMarkers: true
                      }])
                    }
                  })

                  // Rename Symbol action (F2)
                  editorInstance.addAction({
                    id: 'refactor.rename',
                    label: 'Rename Symbol',
                    keybindings: [monacoInstance.KeyCode.F2],
                    contextMenuGroupId: 'modification',
                    contextMenuOrder: 1.7,
                    run: (ed) => {
                      ed.trigger('keyboard', 'editor.action.rename', null)
                    }
                  })
                }

                // Breakpoint toggle on glyph margin click
                const breakpointDecorations: string[] = []
                editorInstance.onMouseDown((e: any) => {
                  if (e.targetType === 'gutter' && e.target && e.target.position) {
                    const lineNumber = e.target.position.lineNumber
                    const fileName = activeFile?.className || ''
                    if (!fileName) return

                    const state = useAppStore.getState()
                    const existingBreakpoint = state.breakpoints.find(
                      b => b.file === fileName && b.line === lineNumber
                    )

                    if (existingBreakpoint) {
                      state.removeBreakpoint(fileName, lineNumber)
                      // Remove decoration by finding the matching one
                      const model = editorInstance.getModel()
                      if (model) {
                        const currentDecorations = editorInstance.getModel()?.getAllDecorations() || []
                        const bpDecoration = currentDecorations.find((d: any) => 
                          d.options.glyphMarginClassName === 'breakpoint-glyph' &&
                          d.range.startLineNumber === lineNumber
                        )
                        if (bpDecoration) {
                          editorInstance.deltaDecorations([bpDecoration.id], [])
                        }
                      }
                    } else {
                      const decorations = editorInstance.deltaDecorations([], [
                        {
                          range: new monacoInstance.Range(lineNumber, 1, lineNumber, 1),
                          options: {
                            isWholeLine: true,
                            glyphMarginClassName: 'breakpoint-glyph',
                            glyphMarginHoverMessage: { value: 'Breakpoint' }
                          }
                        }
                      ])
                      const id = Date.now()
                      state.addBreakpoint(fileName, lineNumber, id)
                    }
                  }
                })

                // Render existing breakpoints for this file
                const fileName = activeFile?.className || ''
                if (fileName) {
                  const existingBreakpoints = useAppStore.getState().breakpoints.filter(b => b.file === fileName)
                  if (existingBreakpoints.length > 0) {
                    const decorations = existingBreakpoints.map(bp => ({
                      range: new monacoInstance.Range(bp.line, 1, bp.line, 1),
                      options: {
                        isWholeLine: true,
                        glyphMarginClassName: 'breakpoint-glyph',
                        glyphMarginHoverMessage: { value: 'Breakpoint' }
                      }
                    }))
                    editorInstance.deltaDecorations([], decorations)
                  }
                }
              }}
              loading={
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                  <span className="text-xs">Loading editor...</span>
                </div>
              }
              options={{
                minimap: { enabled: minimapEnabled },
                fontSize,
                fontFamily,
                fontLigatures: true,
                cursorBlinking: cursorBlinking as any,
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 8, bottom: 8 },
                roundedSelection: true,
                renderLineHighlight,
                tabSize,
                automaticLayout: true,
                wordWrap,
                stickyScroll: { enabled: stickyScrollEnabled },
                // New enhanced options
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                renderWhitespace: 'selection',
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                foldingStrategy: 'indentation',
                links: true,
                colorDecorators: true,
                contextmenu: true,
                mouseWheelZoom: true,
                multiCursorModifier: 'ctrlCmd',
                formatOnPaste: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoIndent: 'advanced',
                trimAutoWhitespace: true,
                suggest: {
                  showMethods: true,
                  showFunctions: true,
                  showConstructors: true,
                  showFields: true,
                  showVariables: true,
                  showClasses: true,
                  showStructs: true,
                  showInterfaces: true,
                  showModules: true,
                  showProperties: true
                },
                quickSuggestions: { other: true, comments: false, strings: false },
                parameterHints: { enabled: true },
                occurrencesHighlight: 'singleFile',
                selectionHighlight: true
              }}
            />
          )}
        </div>

        {/* Tab Context Menu Component */}
        {tabCtxMenu && tabCtxMenu.group === group && (
          <ContextMenu
            x={tabCtxMenu.x}
            y={tabCtxMenu.y}
            items={[
              { label: (tabs.find(t => t.className === tabCtxMenu.tabClassName)?.isPinned ? 'Unpin Tab' : 'Pin Tab'), action: (tabs.find(t => t.className === tabCtxMenu.tabClassName)?.isPinned ? 'unpin' : 'pin') },
              { label: '---', action: '' },
              { label: 'Close', action: 'close' },
              { label: 'Close Others', action: 'closeOthers', disabled: tabs.length <= 1 },
              { label: 'Close Saved', action: 'closeSaved' },
              { label: 'Close All', action: 'closeAll' },
              { label: '---', action: '' },
              { label: 'Copy Path', action: 'copyPath' },
              { label: 'Reveal in Sidebar Explorer', action: 'reveal' }
            ]}
            onSelect={handleTabCtxSelect}
            onClose={() => setTabCtxMenu(null)}
          />
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Discard"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    )
  }

  if (isSplitActive) {
    return (
      <div className="flex h-full w-full divide-x divide-slate-900/60 overflow-hidden bg-slate-950">
        {renderTabGroup(
          'left',
          openTabs,
          editingFile,
          leftCode,
          (val) => {
            if (val !== undefined) {
              setLeftCode(val)
              updateTabContent(editingFile!.className, val)
            }
          },
          handleSaveLeft,
          savingLeft
        )}
        
        {renderTabGroup(
          'right',
          rightOpenTabs,
          editingFileRight,
          rightCode,
          (val) => {
            if (val !== undefined) {
              setRightCode(val)
              updateTabContent(editingFileRight!.className, val)
            }
          },
          handleSaveRight,
          savingRight
        )}
      </div>
    )
  }

  // Non-split rendering
  return renderTabGroup(
    'left',
    openTabs,
    editingFile,
    leftCode,
    (val) => {
      if (val !== undefined) {
        setLeftCode(val)
        updateTabContent(editingFile!.className, val)
      }
    },
    handleSaveLeft,
    savingLeft
  )
}

