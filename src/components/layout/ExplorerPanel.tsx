import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Tree, NodeApi } from 'react-arborist'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import ContextMenu from './ContextMenu'
import { 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  FolderOpen, 
  FileCode, 
  Search, 
  Image as ImageIcon, 
  Compass, 
  Video, 
  Volume2, 
  FileText, 
  Type, 
  Play, 
  Film, 
  Clapperboard, 
  Sparkles, 
  MoreHorizontal, 
  X,
  History,
  RotateCcw,
  Plus,
  FilePlus,
  FolderPlus,
  RotateCw,
  FolderUp
} from 'lucide-react'

type CtxMenu = {
  x: number
  y: number
  items: { label: string; action: string; disabled?: boolean }[]
}

type TreeData = {
  id: string
  name: string
  fullName: string
  nodeType: 'folder' | 'class' | 'asset-category' | 'asset'
  isClass?: boolean
  assetId?: number
  assetCategory?: string
  assetSize?: number
  swfPath?: string
  children?: TreeData[]
}

function buildTreeFromClasses(classes: { fullName: string; name: string; packageName: string }[]): TreeData[] {
  type Node = {
    id: string
    name: string
    fullName: string
    nodeType: 'folder' | 'class'
    isClass: boolean
    children: Node[]
  }

  const root: Node = {
    id: '__root__',
    name: '',
    fullName: '',
    nodeType: 'folder',
    isClass: false,
    children: []
  }

  classes.forEach((cls) => {
    const parts = cls.fullName.split('.')
    let current = root

    if (parts.length <= 1) {
      let defaultPkg = current.children.find((c) => c.name === '<default_package>')
      if (!defaultPkg) {
        defaultPkg = {
          id: '__default_package__',
          name: '<default_package>',
          fullName: '<default_package>',
          nodeType: 'folder',
          isClass: false,
          children: []
        }
        current.children.push(defaultPkg)
      }
      defaultPkg.children.push({
        id: cls.fullName,
        name: cls.fullName,
        fullName: cls.fullName,
        nodeType: 'class',
        isClass: true,
        children: []
      })
      return
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      let child = current.children.find((c) => c.name === part && c.nodeType === 'folder')
      if (!child) {
        child = {
          id: parts.slice(0, i + 1).join('.'),
          name: part,
          fullName: parts.slice(0, i + 1).join('.'),
          nodeType: 'folder',
          isClass: false,
          children: []
        }
        current.children.push(child)
      }
      current = child
    }

    const className = parts[parts.length - 1]
    current.children.push({
      id: cls.fullName,
      name: className,
      fullName: cls.fullName,
      nodeType: 'class',
      isClass: true,
      children: []
    })
  })

  const sortNodes = (nodes: Node[]) => {
    nodes.sort((a, b) => {
      if (a.nodeType !== b.nodeType) return a.nodeType === 'class' ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(root.children)

  return root.children as unknown as TreeData[]
}

const getCategoryColor = (category: string | undefined) => {
  switch (category) {
    case 'shape': return 'text-pink-400'
    case 'morphshape': return 'text-fuchsia-400'
    case 'sprite': return 'text-emerald-400'
    case 'text': return 'text-violet-400'
    case 'image': return 'text-indigo-400'
    case 'sound': return 'text-amber-400'
    case 'button': return 'text-rose-400'
    case 'font': return 'text-teal-400'
    case 'frame': return 'text-sky-400'
    case 'scene': return 'text-orange-400'
    case 'others': return 'text-slate-400'
    default: return 'text-slate-500'
  }
}

const getAssetIcon = (category: string | undefined) => {
  switch (category) {
    case 'shape': return Compass
    case 'morphshape': return Sparkles
    case 'sprite': return Video
    case 'text': return FileText
    case 'image': return ImageIcon
    case 'sound': return Volume2
    case 'button': return Play
    case 'font': return Type
    case 'frame': return Film
    case 'scene': return Clapperboard
    case 'others': return MoreHorizontal
    default: return FileCode
  }
}

const useContainerHeight = () => {
  const [height, setHeight] = useState(240)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }

    if (node !== null) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (entry.contentRect.height) {
            setHeight(Math.max(100, entry.contentRect.height - 6))
          }
        }
      })
      observer.observe(node)
      resizeObserverRef.current = observer
    }
  }, [])

  return [ref, height] as const
}

export type SymbolInfo = {
  name: string
  type: 'class' | 'function' | 'variable' | 'constant'
  modifier: 'public' | 'private' | 'protected' | 'internal' | 'default'
  isStatic: boolean
  line: number
}

export function parseAs3Symbols(code: string): SymbolInfo[] {
  const lines = code.split(/\r?\n/)
  const symbols: SymbolInfo[] = []
  
  const classRegex = /(?:public|private|protected|internal)?\s*class\s+([a-zA-Z0-9_$]+)/
  const funcRegex = /(public|private|protected|internal)?\s*(static)?\s*function\s+(get|set\s+)?([a-zA-Z0-9_$]+)\s*\(/
  const varRegex = /(public|private|protected|internal)?\s*(static)?\s*(var|const)\s+([a-zA-Z0-9_$]+)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue

    const classMatch = line.match(classRegex)
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        modifier: 'public',
        isStatic: false,
        line: i + 1
      })
      continue
    }

    const funcMatch = line.match(funcRegex)
    if (funcMatch) {
      const modifier = (funcMatch[1] || 'default') as any
      const isStatic = !!funcMatch[2]
      const getterSetter = funcMatch[3] || ''
      const name = getterSetter + funcMatch[4]
      symbols.push({
        name,
        type: 'function',
        modifier,
        isStatic,
        line: i + 1
      })
      continue
    }

    const varMatch = line.match(varRegex)
    if (varMatch) {
      const modifier = (varMatch[1] || 'default') as any
      const isStatic = !!varMatch[2]
      const isConst = varMatch[3] === 'const'
      const name = varMatch[4]
      symbols.push({
        name,
        type: isConst ? 'constant' : 'variable',
        modifier,
        isStatic,
        line: i + 1
      })
      continue
    }
  }

  return symbols
}

export default function ExplorerPanel() {
  const swfData = useAppStore((s) => s.swfData)
  const swfPath = useAppStore((s) => s.swfPath)
  const openTabs = useAppStore((s) => s.openTabs)
  const editingFile = useAppStore((s) => s.editingFile)
  const selectTab = useAppStore((s) => s.selectTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const setActiveModule = useAppStore((s) => s.setActiveModule)
  const updateTabContent = useAppStore((s) => s.updateTabContent)
  const assetSwfPaths = useAppStore((s) => s.assetSwfPaths)
  const assetSwfsData = useAppStore((s) => s.assetSwfsData)
  
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [targetNode, setTargetNode] = useState<NodeApi<TreeData> | null>(null)
  const [searchClasses, setSearchClasses] = useState('')
  const [searchAssets, setSearchAssets] = useState('')
  const { show } = useToast()

  const handleAddAssetSwf = async () => {
    try {
      const swfPath = await window.electronAPI.openSwf()
      if (swfPath) {
        // Load the secondary asset SWF
        await useAppStore.getState().loadAssetSwf(swfPath)
        
        // Save to workspace settings if projectRoot exists
        const root = useAppStore.getState().projectRoot
        if (root) {
          const workspaceSettings = await window.electronAPI.readWorkspaceSettings(root).catch(() => ({})) || {}
          const currentPathsConfig = workspaceSettings['workspace.assetSwfPaths'] || localStorage.getItem('setting:workspace.assetSwfPaths') || ''
          
          // Add the new path
          const pathsArray = currentPathsConfig.split(',').map((p: string) => p.trim()).filter(Boolean)
          
          // Convert the swfPath to a relative path if it is inside the projectRoot
          let resolvedPath = swfPath
          if (swfPath.startsWith(root)) {
            resolvedPath = swfPath.substring(root.length).replace(/^[\\/]/, '')
          }
          
          if (!pathsArray.includes(resolvedPath)) {
            pathsArray.push(resolvedPath)
            const updatedConfig = pathsArray.join(', ')
            
            // Save to Workspace Settings file
            workspaceSettings['workspace.assetSwfPaths'] = updatedConfig
            await window.electronAPI.writeWorkspaceSettings(root, workspaceSettings)
            
            // Also sync to user localStorage for fallback
            localStorage.setItem('setting:workspace.assetSwfPaths', updatedConfig)
            show(`Added asset SWF to settings: ${resolvedPath}`, 'success')
          }
        } else {
          show('Asset SWF loaded for this session.', 'success')
        }
      }
    } catch (err: any) {
      show(`Failed to add asset SWF: ${err.message}`, 'error')
    }
  }

  // VS Code Collapsible Section states - default collapsed
  const [openEditorsExpanded, setOpenEditorsExpanded] = useState(() => {
    const saved = localStorage.getItem('explorer:openEditorsExpanded')
    return saved !== null ? saved === 'true' : false
  })
  const [classesExpanded, setClassesExpanded] = useState(() => {
    const saved = localStorage.getItem('explorer:classesExpanded')
    return saved !== null ? saved === 'true' : false
  })
  const [assetsExpanded, setAssetsExpanded] = useState(() => {
    const saved = localStorage.getItem('explorer:assetsExpanded')
    return saved !== null ? saved === 'true' : false
  })
  const [classesContainerRef, classesHeight] = useContainerHeight()
  const [assetsContainerRef, assetsHeight] = useContainerHeight()
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [outlineExpanded, setOutlineExpanded] = useState(false)
  const localHistory = useAppStore((s) => s.localHistory)
  const isSplitActive = useAppStore((s) => s.isSplitActive)
  const focusedEditorGroup = useAppStore((s) => s.focusedEditorGroup)

  const activeFile = (isSplitActive && focusedEditorGroup === 'right') ? useAppStore((s) => s.editingFileRight) : useAppStore((s) => s.editingFile)

  const activeClassHistory = useMemo(() => {
    if (!activeFile) return []
    return localHistory[activeFile.className] || []
  }, [activeFile?.className, localHistory])

  const symbols = useMemo(() => {
    if (!activeFile || !activeFile.code) return []
    return parseAs3Symbols(activeFile.code)
  }, [activeFile?.code])

  const classTreeRef = useRef<any>(null)
  const assetTreeRef = useRef<any>(null)

  // Persist expand state to localStorage
  const toggleOpenEditors = () => {
    const next = !openEditorsExpanded
    setOpenEditorsExpanded(next)
    localStorage.setItem('explorer:openEditorsExpanded', String(next))
  }

  const toggleClasses = () => {
    const next = !classesExpanded
    setClassesExpanded(next)
    localStorage.setItem('explorer:classesExpanded', String(next))
  }

  const toggleAssets = () => {
    const next = !assetsExpanded
    setAssetsExpanded(next)
    localStorage.setItem('explorer:assetsExpanded', String(next))
  }

  const handleNewFileHeader = () => {
    const swfPath = useAppStore.getState().swfPath
    if (!swfPath) return
    
    let defaultName = 'com.example.NewClass'
    if (activeFile) {
      const parts = activeFile.className.split('.')
      if (parts.length > 1) {
        defaultName = parts.slice(0, -1).join('.') + '.NewClass'
      }
    }

    useAppStore.getState().showPrompt(
      'New ActionScript Class',
      'Create new class (use full packageName.ClassName):',
      defaultName,
      'Package.ClassName'
    ).then(async (fullName) => {
      if (fullName) {
        useAppStore.setState({ isLoading: true, loadingStatus: 'Creating class...', loadingLogs: [] })
        try {
          const success = await window.electronAPI.addClass(swfPath, fullName)
          if (success) {
            show('Class created successfully!', 'success')
            await useAppStore.getState().loadSwf(swfPath, true)
          } else {
            show('Failed to create class', 'error')
          }
        } catch (err: any) {
          show(`Error: ${err.message}`, 'error')
        } finally {
          useAppStore.setState({ isLoading: false })
        }
      }
    })
  }

  const handleNewFolderHeader = () => {
    const swfPath = useAppStore.getState().swfPath
    if (!swfPath) return

    let defaultFolder = 'com.example.folder'
    if (activeFile) {
      const parts = activeFile.className.split('.')
      if (parts.length > 1) {
        defaultFolder = parts.slice(0, -1).join('.') + '.subpackage'
      }
    }

    useAppStore.getState().showPrompt(
      'New Package Folder',
      'Create package folder path (e.g. com.example.subpackage):',
      defaultFolder,
      'package.path'
    ).then(async (pkgPath) => {
      if (pkgPath) {
        const dummyClass = `${pkgPath}.__placeholder__`
        useAppStore.setState({ isLoading: true, loadingStatus: 'Creating package...', loadingLogs: [] })
        try {
          const success = await window.electronAPI.addClass(swfPath, dummyClass)
          if (success) {
            show('Package folder created!', 'success')
            await useAppStore.getState().loadSwf(swfPath, true)
          } else {
            show('Failed to create package folder', 'error')
          }
        } catch (err: any) {
          show(`Error: ${err.message}`, 'error')
        } finally {
          useAppStore.setState({ isLoading: false })
        }
      }
    })
  }

  const handleRefreshHeader = async () => {
    if (swfPath) {
      useAppStore.setState({ isLoading: true, loadingStatus: 'Refreshing SWF...', loadingLogs: [] })
      try {
        await useAppStore.getState().loadSwf(swfPath, true)
        show('Workspace refreshed!', 'success')
      } catch (err: any) {
        show(`Refresh failed: ${err.message}`, 'error')
      } finally {
        useAppStore.setState({ isLoading: false })
      }
    }
  }

  const handleCollapseAllHeader = () => {
    classTreeRef.current?.closeAll()
    assetTreeRef.current?.closeAll()
    show('Collapsed all folders', 'info')
  }

  // Recalculate Class tree and Asset tree separately
  const classTreeData = useMemo(() => {
    if (!swfData || !swfData.classes) return []
    return buildTreeFromClasses(swfData.classes)
  }, [swfData?.classes])

  const assetTreeData = useMemo(() => {
    const rootNodes: TreeData[] = []

    const buildSwfAssetTree = (data: any, swfName: string): TreeData => {
      const children: TreeData[] = []
      
      // 1. SWF Header
      children.push({
        id: `header-${data.path}`,
        name: 'header',
        fullName: 'header',
        nodeType: 'class',
        isClass: false,
        swfPath: data.path
      })

      // 2. Asset categories
      const categories = [
        { key: 'shape', name: 'shapes', filter: (t: string) => t.startsWith('defineshape') },
        { key: 'morphshape', name: 'morphshapes', filter: (t: string) => t.startsWith('definemorphshape') },
        { key: 'sprite', name: 'sprites', filter: (t: string) => t.startsWith('definesprite') },
        { key: 'text', name: 'texts', filter: (t: string) => t.startsWith('definetext') || t.includes('edittext') },
        { key: 'image', name: 'images', filter: (t: string) => t.startsWith('definebits') || t.includes('lossless') },
        { key: 'sound', name: 'sounds', filter: (t: string) => t.startsWith('definesound') },
        { key: 'button', name: 'buttons', filter: (t: string) => t.startsWith('definebutton') },
        { key: 'font', name: 'fonts', filter: (t: string) => t.startsWith('definefont') },
        { key: 'scene', name: 'scenes/frames', filter: (t: string) => t.includes('scene') || t === 'showframe' }
      ]

      categories.forEach((cat) => {
        const filteredTags = data.tags.filter((t: any) => cat.filter(t.type.toLowerCase()))
        if (filteredTags.length > 0) {
          const catChildren = filteredTags.map((t: any, idx: number) => ({
            id: `tag-${data.path}-${cat.key}-${t.id}-${idx}`,
            name: t.name ? `${t.name} (id: ${t.id})` : `${t.type} (id: ${t.id})`,
            fullName: t.name || `${t.type}_${t.id}`,
            nodeType: 'asset' as const,
            assetId: t.id,
            assetCategory: cat.key,
            assetSize: t.size,
            swfPath: data.path
          }))

          children.push({
            id: `cat-${data.path}-${cat.key}`,
            name: cat.name,
            fullName: cat.name,
            nodeType: 'asset-category',
            isClass: false,
            assetCategory: cat.key,
            children: catChildren,
            swfPath: data.path
          })
        }
      })

      return {
        id: `swf-${data.path}`,
        name: swfName,
        fullName: data.path,
        nodeType: 'folder',
        swfPath: data.path,
        children
      }
    }

    if (swfData && swfData.tags) {
      const mainName = swfPath ? swfPath.split(/[\\/]/).pop() || 'Main SWF' : 'Main SWF'
      rootNodes.push(buildSwfAssetTree(swfData, mainName))
    }

    assetSwfPaths.forEach((path) => {
      const data = assetSwfsData[path]
      if (data && data.tags) {
        const name = path.split(/[\\/]/).pop() || 'Asset SWF'
        rootNodes.push(buildSwfAssetTree(data, name))
      }
    })

    return rootNodes
  }, [swfData, swfPath, assetSwfPaths, assetSwfsData])

  const handleContextMenu = (e: React.MouseEvent, node: NodeApi<TreeData>) => {
    e.preventDefault()
    e.stopPropagation()
    setTargetNode(node)
    
    const items: { label: string; action: string; disabled?: boolean; shortcut?: string }[] = []

    if (node.data.id === 'swf-header-node') {
      items.push({ label: 'View Header Info', action: 'view-header' })
    } else if (node.data.nodeType === 'class') {
      items.push(
        { label: 'Edit ActionScript Code', action: 'edit-code', shortcut: 'Enter' },
        { label: 'Open in Script Swapper', action: 'script-swapper' },
        { label: 'Rename Class...', action: 'rename-class', shortcut: 'F2' },
        { label: 'Duplicate Class...', action: 'duplicate-class' },
        { label: 'Delete Class', action: 'delete-class', shortcut: 'Del' },
        { label: '---', action: 'separator' },
        { label: 'Copy Class Path', action: 'copy-class-path', shortcut: 'Ctrl+Shift+C' },
        { label: 'Copy Code to Clipboard', action: 'copy-code-clipboard', shortcut: 'Ctrl+C' }
      )
    } else if (node.data.nodeType === 'asset') {
      items.push(
        { label: 'Preview Asset', action: 'preview-asset', shortcut: 'Enter' },
        { label: 'Replace Binary Content...', action: 'replace-asset' },
        { label: 'Export Asset File...', action: 'export-asset' },
        { label: '---', action: 'separator' },
        { label: 'Copy Asset ID', action: 'copy-asset-id', shortcut: 'Ctrl+C' },
        { label: 'Delete Asset Tag', action: 'delete-asset', shortcut: 'Del' }
      )
    } else if (node.data.nodeType === 'asset-category') {
      items.push(
        { label: 'Expand All', action: 'expand-all' },
        { label: 'Collapse All', action: 'collapse-all' }
      )
    } else {
      // Package folders
      items.push(
        { label: 'New ActionScript Class...', action: 'add-class' },
        { label: 'Rename Package Folder...', action: 'rename-package', shortcut: 'F2' },
        { label: 'Delete Package Folder', action: 'delete-package', shortcut: 'Del' },
        { label: '---', action: 'separator' },
        { label: 'Expand All Folders', action: 'expand-all' },
        { label: 'Collapse All Folders', action: 'collapse-all' }
      )
    }

    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleSelect = (action: string) => {
    setCtxMenu(null)
    if (!targetNode) return

    if (action === 'expand-all') {
      const expandRecursive = (n: any) => {
        n.open()
        if (n.children) {
          n.children.forEach(expandRecursive)
        }
      }
      expandRecursive(targetNode)
      return
    }

    if (action === 'collapse-all') {
      const collapseRecursive = (n: any) => {
        n.close()
        if (n.children) {
          n.children.forEach(collapseRecursive)
        }
      }
      collapseRecursive(targetNode)
      return
    }

    if (action === 'view-header') {
      setActiveModule('explorer')
      return
    }

    if (action === 'edit-code') {
      useAppStore.getState().openFileForEditing(targetNode.data.fullName)
        .catch((err) => show(`Failed to open class code: ${err.message}`, 'error'))
      return
    }

    if (action === 'script-swapper') {
      useAppStore.getState().setSelectedClassForSwapper(targetNode.data.fullName)
      setActiveModule('script-swapper')
      return
    }

    if (action === 'preview-asset') {
      if (targetNode.data.assetId !== undefined && targetNode.data.assetCategory) {
        useAppStore.getState().viewAsset(targetNode.data.assetId, targetNode.data.assetCategory, targetNode.data.swfPath)
      }
      return
    }

    if (action === 'add-class') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      
      const pkg = targetNode.data.id === 'scripts-root' ? '' : targetNode.data.fullName
      useAppStore.getState().showPrompt(
        'Add New ActionScript Class',
        pkg ? `Create new class in package '${pkg}':` : 'Create new class (use full packageName.ClassName):',
        pkg ? `${pkg}.NewClass` : 'com.example.MyClass',
        'Package.ClassName'
      ).then(async (fullName) => {
        if (fullName) {
          useAppStore.setState({ isLoading: true, loadingStatus: 'Creating class...', loadingLogs: [] })
          try {
            const success = await window.electronAPI.addClass(swfPath, fullName)
            if (success) {
              show('Class created successfully!', 'success')
              await useAppStore.getState().loadSwf(swfPath, true)
            } else {
              show('Failed to create class', 'error')
            }
          } catch (err: any) {
            show(`Error: ${err.message}`, 'error')
          } finally {
            useAppStore.setState({ isLoading: false })
          }
        }
      })
      return
    }

    if (action === 'rename-class') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      
      useAppStore.getState().showPrompt(
        'Rename Class',
        `Enter new name for class ${targetNode.data.fullName}:`,
        targetNode.data.fullName
      ).then(async (newName) => {
        if (newName && newName !== targetNode.data.fullName) {
          useAppStore.setState({ isLoading: true, loadingStatus: 'Renaming class...', loadingLogs: [] })
          try {
            await window.electronAPI.renameClass(swfPath, targetNode.data.fullName, newName)
            show('Class renamed successfully!', 'success')
            await useAppStore.getState().loadSwf(swfPath, true)
          } catch (err: any) {
            show(`Failed to rename class: ${err.message}`, 'error')
          } finally {
            useAppStore.setState({ isLoading: false })
          }
        }
      })
      return
    }

    if (action === 'delete-class') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      
      if (confirm(`Are you sure you want to delete class ${targetNode.data.fullName}?`)) {
        useAppStore.setState({ isLoading: true, loadingStatus: 'Deleting class...', loadingLogs: [] })
        window.electronAPI.deleteClass(swfPath, targetNode.data.fullName)
          .then(async () => {
            show('Class deleted successfully!', 'success')
            await useAppStore.getState().loadSwf(swfPath, true)
          })
          .catch((err: any) => show(`Failed to delete class: ${err.message}`, 'error'))
          .finally(() => useAppStore.setState({ isLoading: false }))
      }
      return
    }

    if (action === 'duplicate-class') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      
      useAppStore.getState().showPrompt(
        'Duplicate ActionScript Class',
        `Enter path and name for the duplicated class:`,
        `${targetNode.data.fullName}Copy`
      ).then(async (newName) => {
        if (newName && newName !== targetNode.data.fullName) {
          useAppStore.setState({ isLoading: true, loadingStatus: 'Duplicating class...', loadingLogs: [] })
          try {
            const oldCode = await window.electronAPI.readScript(swfPath, targetNode.data.fullName)
            const addSuccess = await window.electronAPI.addClass(swfPath, newName)
            if (addSuccess) {
              // Write old class contents into new duplicated class
              await window.electronAPI.writeScript(swfPath, newName, oldCode)
              show('Class duplicated successfully!', 'success')
              await useAppStore.getState().loadSwf(swfPath, true)
            } else {
              show('Failed to duplicate class structure', 'error')
            }
          } catch (err: any) {
            show(`Error duplicating class: ${err.message}`, 'error')
          } finally {
            useAppStore.setState({ isLoading: false })
          }
        }
      })
      return
    }

    if (action === 'copy-class-path') {
      navigator.clipboard.writeText(targetNode.data.fullName)
      show('Class path copied to clipboard!', 'success')
      return
    }

    if (action === 'copy-code-clipboard') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      useAppStore.setState({ isLoading: true, loadingStatus: 'Reading source code...', loadingLogs: [] })
      window.electronAPI.readScript(swfPath, targetNode.data.fullName)
        .then((code) => {
          navigator.clipboard.writeText(code)
          show('Class ActionScript code copied to clipboard!', 'success')
        })
        .catch((err: any) => show(`Failed to copy code: ${err.message}`, 'error'))
        .finally(() => useAppStore.setState({ isLoading: false }))
      return
    }

    if (action === 'rename-package') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath) return
      
      const oldPkgPrefix = targetNode.data.fullName + '.'
      useAppStore.getState().showPrompt(
        'Rename Package Folder',
        `Enter new name for package ${targetNode.data.fullName}:`,
        targetNode.data.fullName
      ).then(async (newName) => {
        if (newName && newName !== targetNode.data.fullName) {
          useAppStore.setState({ isLoading: true, loadingStatus: 'Renaming package classes...', loadingLogs: [] })
          const newPkgPrefix = newName + '.'
          const affectedClasses = (useAppStore.getState().swfData?.classes ?? []).filter(
            (c) => c.fullName.startsWith(oldPkgPrefix) || c.fullName === targetNode.data.fullName
          )
          
          const renameNext = async (index: number) => {
            if (index >= affectedClasses.length) {
              show('Package renamed successfully!', 'success')
              await useAppStore.getState().loadSwf(swfPath, true)
              useAppStore.setState({ isLoading: false })
              return
            }
            const cls = affectedClasses[index]
            let targetNewClassName = cls.fullName
            if (cls.fullName === targetNode.data.fullName) {
              targetNewClassName = newName
            } else if (cls.fullName.startsWith(oldPkgPrefix)) {
              targetNewClassName = newPkgPrefix + cls.fullName.substring(oldPkgPrefix.length)
            }
            try {
              await window.electronAPI.renameClass(swfPath, cls.fullName, targetNewClassName)
              renameNext(index + 1)
            } catch (err: any) {
              show(`Failed on ${cls.fullName}: ${err.message}`, 'error')
              useAppStore.setState({ isLoading: false })
            }
          }
          renameNext(0)
        }
      })
      return
    }

    if (action === 'delete-package') {
      const affectedClasses = (useAppStore.getState().swfData?.classes ?? []).filter(
        (c) => c.fullName.startsWith(targetNode.data.fullName + '.') || c.fullName === targetNode.data.fullName
      )
      if (affectedClasses.length === 0) {
        show('Package is already empty', 'info')
        return
      }
      if (!confirm(`Delete package ${targetNode.data.fullName} (this will delete ${affectedClasses.length} classes)?`)) return

      const swfPath = useAppStore.getState().swfPath
      if (swfPath) {
        useAppStore.setState({ isLoading: true, loadingStatus: 'Deleting package...', loadingLogs: [] })
        
        const deleteNext = async (index: number) => {
          if (index >= affectedClasses.length) {
            show('Package deleted successfully!', 'success')
            await useAppStore.getState().loadSwf(swfPath, true)
            useAppStore.setState({ isLoading: false })
            return
          }
          const cls = affectedClasses[index]
          try {
            await window.electronAPI.deleteClass(swfPath, cls.fullName)
            deleteNext(index + 1)
          } catch (err: any) {
            show(`Failed on ${cls.fullName}: ${err.message}`, 'error')
            useAppStore.setState({ isLoading: false })
          }
        }
        deleteNext(0)
      }
      return
    }

    if (action === 'replace-asset') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath || targetNode.data.assetId === undefined) return
      
      window.electronAPI.openAsFile().then(async (filePath) => {
        if (filePath) {
          useAppStore.setState({ isLoading: true, loadingStatus: 'Replacing asset tag...', loadingLogs: [] })
          try {
            const success = await window.electronAPI.replaceTag(swfPath, targetNode.data.assetId!, filePath)
            if (success) {
              show('Asset replaced successfully!', 'success')
              await useAppStore.getState().loadSwf(swfPath, true)
            } else {
              show('Failed to replace asset', 'error')
            }
          } catch (err: any) {
            show(`Error: ${err.message}`, 'error')
          } finally {
            useAppStore.setState({ isLoading: false })
          }
        }
      })
      return
    }

    if (action === 'export-asset') {
      const swfPath = targetNode.data.swfPath || useAppStore.getState().swfPath
      if (!swfPath || targetNode.data.assetId === undefined || !targetNode.data.assetCategory) return
      
      useAppStore.setState({ isLoading: true, loadingStatus: 'Exporting asset file...', loadingLogs: [] })
      window.electronAPI.exportAsset(swfPath, targetNode.data.assetId, targetNode.data.assetCategory)
        .then((success) => {
          if (success) {
            show('Asset exported successfully!', 'success')
          } else {
            show('Asset export canceled or failed', 'warning')
          }
        })
        .catch((err: any) => show(`Export error: ${err.message}`, 'error'))
        .finally(() => useAppStore.setState({ isLoading: false }))
      return
    }

    if (action === 'copy-asset-id') {
      if (targetNode.data.assetId !== undefined) {
        navigator.clipboard.writeText(String(targetNode.data.assetId))
        show('Asset Tag ID copied to clipboard!', 'success')
      }
      return
    }

    if (action === 'delete-asset') {
      const swfPath = useAppStore.getState().swfPath
      if (!swfPath || targetNode.data.assetId === undefined) return
      if (confirm(`Are you sure you want to delete asset tag ID ${targetNode.data.assetId}?`)) {
        useAppStore.setState({ isLoading: true, loadingStatus: 'Deleting asset tag...', loadingLogs: [] })
        window.electronAPI.deleteTag(swfPath, targetNode.data.assetId!)
          .then(async (success) => {
            if (success) {
              show('Asset tag deleted successfully!', 'success')
              await useAppStore.getState().loadSwf(swfPath, true)
            } else {
              show('Failed to delete asset tag', 'error')
            }
          })
          .catch((err: any) => show(`Failed: ${err.message}`, 'error'))
          .finally(() => useAppStore.setState({ isLoading: false }))
      }
      return
    }
  }

  const Node = ({ node, style, dragHandle }: any) => {
    const data = node.data
    const isLeaf = data.nodeType === 'class' || data.nodeType === 'asset'
    const isOpen = node.isOpen

    const handleNodeClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isLeaf) {
        node.select()
      } else {
        node.toggle()
      }
    }

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (data.nodeType === 'class') {
        useAppStore.getState().openFileForEditing(data.fullName)
          .catch((err) => show(`Failed to open class code: ${err.message}`, 'error'))
      }
    }

    let NodeIcon = FileCode
    let iconColor = 'text-slate-500 group-hover:text-slate-400'

    if (data.id === 'swf-header-node') {
      NodeIcon = FileText
      iconColor = node.isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
    } else if (data.nodeType === 'class') {
      NodeIcon = FileCode
      iconColor = node.isSelected ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'
    } else if (data.nodeType === 'asset') {
      NodeIcon = getAssetIcon(data.assetCategory)
      iconColor = getCategoryColor(data.assetCategory)
    } else if (data.nodeType === 'asset-category') {
      NodeIcon = isOpen ? FolderOpen : Folder
      iconColor = getCategoryColor(data.assetCategory)
    } else {
      NodeIcon = isOpen ? FolderOpen : Folder
      iconColor = 'text-amber-500/80'
    }

    const displayName = data.name

    return (
      <div
        style={style}
        ref={dragHandle}
        className={`flex items-center px-2 py-0.5 cursor-pointer text-xs rounded transition-colors group select-none ${
          node.isSelected
            ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-2 border-indigo-500 pl-1.5'
            : 'text-slate-300 hover:bg-slate-900/40 hover:text-slate-100'
        }`}
        onClick={handleNodeClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        {!isLeaf ? (
          <span 
            className={`w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-transform duration-150 mr-0.5 ${
              isOpen ? 'rotate-90 text-slate-300' : ''
            }`}
          >
            <ChevronRight size={11} />
          </span>
        ) : (
          <span className="w-4 mr-0.5" />
        )}

        <span className={`mr-1.5 flex items-center ${iconColor}`}>
          <NodeIcon size={13} />
        </span>

        <span className="truncate flex-1 font-medium text-[11.5px]">{displayName}</span>

        {!isLeaf && data.children && data.children.length > 0 && (
          <span className="text-[9px] text-slate-500 group-hover:text-slate-400 bg-slate-950/40 px-1.5 py-0.2 rounded-full border border-slate-900/60 font-semibold ml-1.5 transition-colors">
            {data.children.length}
          </span>
        )}
      </div>
    )
  }

  const getSwfName = () => {
    if (!swfPath) return 'SWF IDE'
    const parts = swfPath.split(/[\\/]/)
    return parts[parts.length - 1].toUpperCase()
  }

  return (
    <div className="explorer-panel flex flex-col h-full bg-[#0a0f1b] border-r border-slate-900/80">
      {/* Sidebar main title header with VS Code style action buttons */}
      <div className="px-4 py-2.5 border-b border-slate-900/60 flex items-center justify-between bg-slate-950/20 select-none">
        <span className="font-extrabold text-slate-200 text-xs tracking-wider uppercase truncate max-w-[140px]">
          {getSwfName()}
        </span>
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={handleNewFileHeader}
            className="p-1 rounded hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            title="New Class File"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={handleNewFolderHeader}
            className="p-1 rounded hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            title="New Package Folder"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={handleRefreshHeader}
            className="p-1 rounded hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            title="Refresh Workspace"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={handleCollapseAllHeader}
            className="p-1 rounded hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            title="Collapse All Folders"
          >
            <FolderUp size={14} />
          </button>
          <button
            className="p-1 rounded hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            title="More Actions..."
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden divide-y divide-slate-900/40">
        
        {/* SECTION 1: OPEN EDITORS */}
        <div className="flex flex-col">
          <button
            onClick={toggleOpenEditors}
            className="flex items-center gap-1.5 w-full text-left px-3.5 py-2 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 font-bold uppercase tracking-wider text-[10px] select-none"
          >
            {openEditorsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>Open Editors ({openTabs.length})</span>
          </button>
          
          {openEditorsExpanded && (
            <div className="px-1.5 pb-2.5 flex flex-col gap-0.5 max-h-[160px] overflow-y-auto custom-scrollbar">
              {openTabs.length > 0 ? (
                openTabs.map((tab) => {
                  const isActive = editingFile?.className === tab.className
                  const isDirty = tab.code !== tab.originalCode
                  return (
                    <div
                      key={tab.className}
                      onClick={() => selectTab(tab.className)}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer group text-xs transition-all ${
                        isActive 
                          ? 'bg-indigo-650/15 text-indigo-300 font-semibold border-l-2 border-indigo-500 pl-2'
                          : 'text-slate-400 hover:bg-slate-900/30 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <FileCode size={13} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                        <span className="truncate">{tab.className.split('.').pop()}.as</span>
                        <span className="text-[9px] text-slate-600 truncate font-mono">({tab.className})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Unsaved changes" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isDirty) {
                              if (confirm(`Discard unsaved changes for ${tab.className.split('.').pop()}?`)) {
                                closeTab(tab.className)
                              }
                            } else {
                              closeTab(tab.className)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 hover:bg-slate-900 rounded transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-[11px] text-slate-600 italic px-3 py-1 select-none">No active editors.</div>
              )}
            </div>
          )}
        </div>

        {/* DYNAMIC SCROLLABLE SECTIONS WRAPPER */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden divide-y divide-slate-900/40">
          
          {/* SECTION 2: CLASSES (AS3) */}
          <div className={`flex flex-col min-h-0 overflow-hidden ${classesExpanded ? 'flex-1' : 'shrink-0'}`}>
            <div className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-900/40 group">
              <button
                onClick={toggleClasses}
                className="flex items-center gap-1.5 text-left text-slate-400 hover:text-slate-200 font-bold uppercase tracking-wider text-[10px] select-none"
              >
                {classesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>AS3 Classes ({swfData?.classes.length || 0})</span>
              </button>
              
              {classesExpanded && (
                <div className="flex items-center bg-slate-950/80 border border-slate-900/80 rounded px-1.5 py-0.5">
                  <Search size={10} className="text-slate-600 mr-1 shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter classes..."
                    value={searchClasses}
                    onChange={(e) => setSearchClasses(e.target.value)}
                    className="w-20 bg-transparent text-[10px] text-slate-300 placeholder-slate-700 outline-none"
                  />
                </div>
              )}
            </div>

            {classesExpanded && (
              <div ref={classesContainerRef} className="flex-1 overflow-hidden px-1.5 py-1 min-h-0">
                {classTreeData.length > 0 ? (
                  <Tree<TreeData>
                    disableDrag={true}
                    disableDrop={true}
                    ref={classTreeRef}
                    data={classTreeData}
                    openByDefault={true}
                    indent={12}
                    rowHeight={24}
                    width="100%"
                    height={classesHeight}
                    searchTerm={searchClasses}
                    searchMatch={(node, term) =>
                      node.data.name.toLowerCase().includes(term.toLowerCase())
                    }
                    onActivate={(node) => {
                      if (node.data.nodeType === 'class' || node.data.isClass) {
                        useAppStore.getState().openFileForEditing(node.data.fullName)
                          .catch((err) => show(`Failed to open class code: ${err.message}`, 'error'))
                      }
                    }}
                  >
                    {Node}
                  </Tree>
                ) : (
                  <div className="text-[11px] text-slate-600 italic px-3 py-1 select-none">No classes loaded.</div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: SWF BINARY ASSETS */}
          <div className={`flex flex-col min-h-0 overflow-hidden ${assetsExpanded ? 'flex-1' : 'shrink-0'}`}>
            <div className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-900/40 group">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleAssets}
                  className="flex items-center gap-1.5 text-left text-slate-400 hover:text-slate-200 font-bold uppercase tracking-wider text-[10px] select-none"
                >
                  {assetsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>SWF Binary Assets ({swfData?.tags.length || 0})</span>
                </button>
                {swfPath && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddAssetSwf()
                    }}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Add Asset SWF to Workspace..."
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
              
              {assetsExpanded && (
                <div className="flex items-center bg-slate-950/80 border border-slate-900/80 rounded px-1.5 py-0.5">
                  <Search size={10} className="text-slate-600 mr-1 shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter assets..."
                    value={searchAssets}
                    onChange={(e) => setSearchAssets(e.target.value)}
                    className="w-20 bg-transparent text-[10px] text-slate-300 placeholder-slate-700 outline-none"
                  />
                </div>
              )}
            </div>

            {assetsExpanded && (
              <div ref={assetsContainerRef} className="flex-1 overflow-hidden px-1.5 py-1 min-h-0">
                {assetTreeData.length > 0 ? (
                  <Tree<TreeData>
                    disableDrag={true}
                    disableDrop={true}
                    ref={assetTreeRef}
                    data={assetTreeData}
                    openByDefault={false}
                    indent={12}
                    rowHeight={24}
                    width="100%"
                    height={assetsHeight}
                    searchTerm={searchAssets}
                    searchMatch={(node, term) =>
                      node.data.name.toLowerCase().includes(term.toLowerCase())
                    }
                    onActivate={(node) => {
                      if (node.data.id && node.data.id.startsWith('header-')) {
                        setActiveModule('explorer')
                      } else if (node.data.nodeType === 'asset' && node.data.assetId !== undefined && node.data.assetCategory) {
                        useAppStore.getState().viewAsset(node.data.assetId, node.data.assetCategory, node.data.swfPath)
                      }
                    }}
                  >
                    {Node}
                  </Tree>
                ) : (
                  <div className="text-[11px] text-slate-600 italic px-3 py-1 select-none">No assets loaded.</div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: TIMELINE / LOCAL HISTORY */}
          <div className={`flex flex-col min-h-0 overflow-hidden ${timelineExpanded ? 'flex-1' : 'shrink-0'}`}>
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="flex items-center gap-1.5 w-full text-left px-3.5 py-2 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 font-bold uppercase tracking-wider text-[10px] select-none"
            >
              {timelineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <History size={12} className="text-slate-500" />
              <span>Timeline / History</span>
            </button>

            {timelineExpanded && (
              <div className="flex-1 overflow-y-auto px-3.5 py-2.5 text-[11px] text-slate-400 min-h-0 custom-scrollbar">
                {activeFile ? (
                  activeClassHistory.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {/* Current active version */}
                      <div 
                        onClick={() => {
                          useAppStore.getState().setDiffHistoryCode(null)
                          useAppStore.setState({ showDiff: false })
                        }}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-900/50 cursor-pointer border border-transparent hover:border-slate-800 text-slate-200"
                      >
                        <span className="font-semibold text-indigo-400">Current active code</span>
                        <span className="text-[9px] text-slate-600 font-mono">now</span>
                      </div>

                      {/* History versions */}
                      {activeClassHistory.map((entry, idx) => {
                        const dateStr = new Date(entry.timestamp).toLocaleTimeString()
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-slate-900/50 cursor-pointer border border-transparent hover:border-slate-800 text-slate-400 hover:text-slate-200 group/item"
                            title="Click to compare with current code"
                            onClick={() => {
                              useAppStore.getState().setDiffHistoryCode(entry.code)
                              useAppStore.setState({ showDiff: true })
                            }}
                          >
                            <span className="truncate flex-1">Revision {activeClassHistory.length - idx}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-slate-500 font-mono group-hover/item:hidden">{dateStr}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm(`Restore revision ${activeClassHistory.length - idx} for class ${activeFile.className.split('.').pop()}?`)) {
                                    updateTabContent(activeFile.className, entry.code)
                                    show('Revision restored successfully!', 'success')
                                  }
                                }}
                                className="hidden group-hover/item:flex items-center gap-0.5 p-0.5 hover:text-indigo-400 text-slate-500 transition-colors"
                                title="Restore this revision"
                              >
                                <RotateCcw size={10} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-600 italic py-4 text-center select-none">
                      No changes recorded. Edit and save this file (Ctrl+S) to create history points.
                    </div>
                  )
                ) : (
                  <div className="text-slate-600 italic py-4 text-center select-none">
                    Select a class file to view its history timeline.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 5: OUTLINE */}
          <div className={`flex flex-col min-h-0 overflow-hidden ${outlineExpanded ? 'flex-1' : 'shrink-0'}`}>
            <button
              onClick={() => setOutlineExpanded(!outlineExpanded)}
              className="flex items-center gap-1.5 w-full text-left px-3.5 py-2 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 font-bold uppercase tracking-wider text-[10px] select-none"
            >
              {outlineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-slate-500 font-bold text-xs">📄</span>
              <span>Outline ({symbols.length})</span>
            </button>

            {outlineExpanded && (
              <div className="flex-1 overflow-y-auto px-3.5 py-1 text-[11px] text-slate-400 min-h-0 custom-scrollbar">
                {activeFile ? (
                  symbols.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {symbols.map((sym, idx) => {
                        let symIcon = '𝑓'
                        let symColor = 'text-indigo-400'
                        if (sym.type === 'variable') {
                          symIcon = '𝑥'
                          symColor = 'text-sky-400'
                        } else if (sym.type === 'constant') {
                          symIcon = '𝑐'
                          symColor = 'text-amber-500 font-semibold'
                        } else if (sym.type === 'class') {
                          symIcon = '𝐶'
                          symColor = 'text-emerald-400 font-bold'
                        }

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              useAppStore.getState().triggerJumpToLine(sym.line)
                            }}
                            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900/50 cursor-pointer border border-transparent hover:border-slate-800"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-3.5 text-center font-mono ${symColor}`}>{symIcon}</span>
                              <span className="truncate font-sans font-medium text-slate-300">{sym.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-600 font-mono">Ln {sym.line}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-650 italic py-4 text-center select-none">
                      No symbols found in this file.
                    </div>
                  )
                ) : (
                  <div className="text-slate-650 italic py-4 text-center select-none">
                    Select a class file to view class outline.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onSelect={handleSelect}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
