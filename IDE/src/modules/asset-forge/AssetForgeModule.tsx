import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import {
  Image as ImageIcon, Compass, Video, Volume2, FileText, Type,
  Download, Eye, RefreshCw, Send, Sparkles, FolderOpen, Search,
  X, ZoomIn, Loader2, ImageOff, ChevronLeft, ChevronRight,
  Play, Film, Clapperboard, MoreHorizontal,
  ChevronsLeft, ChevronsRight, Trash2
} from 'lucide-react'

type Asset = {
  id: number
  type: string
  name: string
  size: number
  globalIndex: number
}

const categories = [
  { key: 'shape', label: 'Shapes', icon: Compass, color: 'text-pink-400', bg: 'hover:bg-pink-600/10', previewable: true },
  { key: 'morphshape', label: 'MorphShapes', icon: Sparkles, color: 'text-fuchsia-400', bg: 'hover:bg-fuchsia-600/10', previewable: true },
  { key: 'sprite', label: 'Sprites', icon: Video, color: 'text-emerald-400', bg: 'hover:bg-emerald-600/10', previewable: true },
  { key: 'text', label: 'Texts', icon: FileText, color: 'text-violet-400', bg: 'hover:bg-violet-600/10', previewable: false },
  { key: 'image', label: 'Images', icon: ImageIcon, color: 'text-indigo-400', bg: 'hover:bg-indigo-600/10', previewable: true },
  { key: 'sound', label: 'Sounds', icon: Volume2, color: 'text-amber-400', bg: 'hover:bg-amber-600/10', previewable: true },
  { key: 'button', label: 'Buttons', icon: Play, color: 'text-rose-400', bg: 'hover:bg-rose-600/10', previewable: false },
  { key: 'font', label: 'Fonts', icon: Type, color: 'text-teal-400', bg: 'hover:bg-teal-600/10', previewable: false },
  { key: 'frame', label: 'Frames', icon: Film, color: 'text-sky-400', bg: 'hover:bg-sky-600/10', previewable: false },
  { key: 'scene', label: 'Scenes', icon: Clapperboard, color: 'text-orange-400', bg: 'hover:bg-orange-600/10', previewable: false },
  { key: 'others', label: 'Others', icon: MoreHorizontal, color: 'text-slate-400', bg: 'hover:bg-slate-600/10', previewable: false }
]

const isCategorizedTag = (type: string): boolean => {
  const t = type.toLowerCase()
  return (
    t.startsWith('defineshape') ||
    t.startsWith('definemorphshape') ||
    t.startsWith('definesprite') ||
    t.startsWith('definetext') ||
    t.includes('edittext') ||
    t.startsWith('definebits') ||
    t.includes('lossless') ||
    t.startsWith('definesound') ||
    t.startsWith('definebutton') ||
    t.startsWith('definefont') ||
    t.includes('scene') ||
    t === 'showframe'
  )
}

const filterTagByCategory = (tag: any, category: string): boolean => {
  const type = tag.type.toLowerCase()
  switch (category) {
    case 'shape':
      return type.startsWith('defineshape')
    case 'morphshape':
      return type.startsWith('definemorphshape')
    case 'sprite':
      return type.startsWith('definesprite')
    case 'text':
      return type.startsWith('definetext') || type.includes('edittext')
    case 'image':
      return type.startsWith('definebits') || type.includes('lossless')
    case 'sound':
      return type.startsWith('definesound')
    case 'button':
      return type.startsWith('definebutton')
    case 'font':
      return type.startsWith('definefont')
    case 'frame':
      return type === 'showframe'
    case 'scene':
      return type.includes('scene')
    case 'others':
      return !isCategorizedTag(tag.type)
    default:
      return false
  }
}

export default function AssetForgeModule() {
  const mainSwfPath = useAppStore((s) => s.swfPath)
  const activeAssetSourcePath = useAppStore((s) => s.activeAssetSourcePath) || mainSwfPath
  const assetSwfPaths = useAppStore((s) => s.assetSwfPaths)
  const assetSwfsData = useAppStore((s) => s.assetSwfsData)
  const mainSwfData = useAppStore((s) => s.swfData)
  const setActiveAssetSourcePath = useAppStore((s) => s.setActiveAssetSourcePath)

  const tags = useMemo(() => {
    if (!activeAssetSourcePath) return []
    if (activeAssetSourcePath === mainSwfPath) {
      return mainSwfData?.tags || []
    }
    return assetSwfsData[activeAssetSourcePath]?.tags || []
  }, [activeAssetSourcePath, mainSwfPath, mainSwfData, assetSwfsData])

  const selectedAssetForPreview = useAppStore((s) => s.selectedAssetForPreview)
  const clearAssetPreview = useAppStore((s) => s.clearAssetPreview)
  const { show } = useToast()
  
  const [selectedCategory, setSelectedCategory] = useState<string>('image')
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set())
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 120

  // Image preview cache: Map<`${category}-${id}`, dataUrl>
  const [previewCache, setPreviewCache] = useState<Map<string, string>>(new Map())
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set())
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set())

  // Preview modal
  const [previewModal, setPreviewModal] = useState<{ asset: Asset; dataUrl: string } | null>(null)

  // Premium Features States
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [checkerboard, setCheckerboard] = useState<'light' | 'dark' | 'none'>('dark')

  // Before/After Comparison Slider State
  const [comparisonData, setComparisonData] = useState<{
    id: number
    oldDataUrl: string
    newDataUrl: string
    newFilePath: string
  } | null>(null)
  const [compareRatio, setCompareRatio] = useState(0.5)

  // Batch Swapping State
  const [batchStatus, setBatchStatus] = useState<{
    total: number
    current: number
    logs: string[]
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const assetsList = tags
      .filter((tag) => filterTagByCategory(tag, selectedCategory))
      .map((t) => ({
        id: t.id,
        type: selectedCategory,
        name: t.name || `${t.type}_${t.id}`,
        size: t.size,
        globalIndex: t.globalIndex ?? 0
      }))
    
    setFilteredAssets(assetsList)
    setSelectedAssets(new Set())
  }, [tags, selectedCategory])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery])

  const currentCatInfo = categories.find(c => c.key === selectedCategory)
  const isPreviewable = currentCatInfo?.previewable ?? false

  const getCacheKey = (category: string, id: number) => `${category}-${id}`

  // Filter by search query (Moved up to avoid TDZ issues in navigatePreview)
  const displayedAssets = useMemo(() => {
    return filteredAssets.filter((a: Asset) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.id.toString().includes(q)
    })
  }, [filteredAssets, searchQuery])

  const totalPages = Math.ceil(displayedAssets.length / itemsPerPage)

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return displayedAssets.slice(start, start + itemsPerPage)
  }, [displayedAssets, currentPage])

  const loadPreview = useCallback(async (asset: Asset) => {
    if (!activeAssetSourcePath) return
    const category = asset.type
    const key = getCacheKey(category, asset.id)
    if (previewCache.has(key) || loadingPreviews.has(key) || failedPreviews.has(key)) return

    setLoadingPreviews(prev => new Set(prev).add(key))
    try {
      const dataUrl = category === 'sound'
        ? await window.electronAPI.extractSound(activeAssetSourcePath, asset.id)
        : await window.electronAPI.extractImage(activeAssetSourcePath, asset.id, category)
      if (dataUrl) {
        setPreviewCache(prev => new Map(prev).set(key, dataUrl))
      } else {
        setFailedPreviews(prev => new Set(prev).add(key))
      }
    } catch (err) {
      console.error(`Failed to load preview for ${key}:`, err)
      setFailedPreviews(prev => new Set(prev).add(key))
    } finally {
      setLoadingPreviews(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [activeAssetSourcePath, previewCache, loadingPreviews, failedPreviews])

  const openPreviewModal = useCallback(async (asset: Asset) => {
    const category = asset.type
    const key = getCacheKey(category, asset.id)
    const cached = previewCache.get(key)
    if (cached) {
      setPreviewModal({ asset, dataUrl: cached })
    } else {
      if (!activeAssetSourcePath) return
      setLoadingPreviews(prev => new Set(prev).add(key))
      try {
        const dataUrl = category === 'sound'
          ? await window.electronAPI.extractSound(activeAssetSourcePath, asset.id)
          : await window.electronAPI.extractImage(activeAssetSourcePath, asset.id, category)
        if (dataUrl) {
          setPreviewCache(prev => new Map(prev).set(key, dataUrl))
          setPreviewModal({ asset, dataUrl })
        } else {
          show('Preview not available for this asset', 'error')
        }
      } catch {
        show('Failed to generate preview', 'error')
      } finally {
        setLoadingPreviews(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    }
  }, [activeAssetSourcePath, previewCache, show])

  const navigatePreview = useCallback((direction: 1 | -1) => {
    if (!previewModal) return
    const idx = displayedAssets.findIndex((a: Asset) => a.id === previewModal.asset.id)
    if (idx < 0) return
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= displayedAssets.length) return
    const nextAsset = displayedAssets[nextIdx]
    openPreviewModal(nextAsset)
  }, [previewModal, openPreviewModal, displayedAssets])

  // Listen to assets selected from external source (like Sidebar Tree)
  useEffect(() => {
    if (selectedAssetForPreview) {
      const { id, category } = selectedAssetForPreview
      setSelectedCategory(category)
      
      const tag = tags.find(t => t.id === id)
      if (tag) {
        const asset: Asset = {
          id: tag.id,
          type: category,
          name: tag.name || `${tag.type}_${tag.id}`,
          size: tag.size,
          globalIndex: tag.globalIndex ?? 0
        }
        // Small timeout to allow category tab switch to paint
        setTimeout(() => {
          openPreviewModal(asset)
        }, 50)
      }
      clearAssetPreview()
    }
  }, [selectedAssetForPreview, tags, openPreviewModal, clearAssetPreview])

  const handleExportAll = async () => {
    if (!activeAssetSourcePath) return
    const destFolder = await window.electronAPI.openDirectory()
    if (!destFolder) return

    show(`Exporting all ${selectedCategory} assets...`, 'info', 0)
    try {
      const result = await window.electronAPI.invokeFfdec('-export', [
        selectedCategory,
        destFolder,
        activeAssetSourcePath
      ])
      if (result.code === 0) {
        show(`${selectedCategory} assets exported successfully`, 'success')
      } else {
        show('Export failed', 'error')
      }
    } catch (err) {
      show('Error exporting assets', 'error')
    }
  }

  const handleGenerateSpriteSheet = async () => {
    if (!activeAssetSourcePath || selectedAssets.size < 2) return
    const destFolder = await window.electronAPI.openDirectory()
    if (!destFolder) return

    const baseName = await useAppStore.getState().showPrompt(
      "Sprite Sheet File Name",
      "Enter base name for PNG and JSON files:",
      "spritesheet"
    )
    if (!baseName) return

    show("Generating sprite sheet...", "info", 0)

    try {
      const ids = Array.from(selectedAssets)
      const imageAssets = filteredAssets.filter(a => ids.includes(a.id))
      
      const images: { img: HTMLImageElement; asset: Asset }[] = []
      for (const asset of imageAssets) {
        const dataUrl = await window.electronAPI.extractImage(activeAssetSourcePath, asset.id, 'image')
        if (dataUrl) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image()
            tempImg.onload = () => resolve(tempImg)
            tempImg.onerror = reject
            tempImg.src = dataUrl
          })
          images.push({ img, asset })
        }
      }

      if (images.length === 0) {
        show("No images could be extracted.", "error")
        return
      }

      images.sort((a, b) => b.img.height - a.img.height)

      const maxWidth = 1024
      let currentX = 0
      let currentY = 0
      let currentRowHeight = 0
      let sheetWidth = 0
      let sheetHeight = 0

      const positions: { x: number; y: number; width: number; height: number; asset: Asset; img: HTMLImageElement }[] = []

      for (const item of images) {
        const { img, asset } = item
        if (currentX + img.width > maxWidth) {
          currentX = 0
          currentY += currentRowHeight
          currentRowHeight = 0
        }

        positions.push({
          x: currentX,
          y: currentY,
          width: img.width,
          height: img.height,
          asset,
          img
        })

        currentRowHeight = Math.max(currentRowHeight, img.height)
        currentX += img.width
        sheetWidth = Math.max(sheetWidth, currentX)
        sheetHeight = Math.max(sheetHeight, currentY + currentRowHeight)
      }

      const canvas = document.createElement('canvas')
      canvas.width = sheetWidth
      canvas.height = sheetHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error("Could not create canvas 2D context")

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const frames: Record<string, any> = {}

      positions.forEach((pos) => {
        ctx.drawImage(pos.img, pos.x, pos.y)
        frames[pos.asset.name] = {
          frame: { x: pos.x, y: pos.y, w: pos.width, h: pos.height },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: pos.width, h: pos.height },
          sourceSize: { w: pos.width, h: pos.height }
        }
      })

      const pngData = canvas.toDataURL('image/png')
      const jsonContent = JSON.stringify({
        frames,
        meta: {
          app: "NinjaSage SWF IDE Sprite Sheet Compiler",
          version: "1.0",
          image: `${baseName}.png`,
          format: "RGBA8888",
          size: { w: canvas.width, h: canvas.height },
          scale: "1"
        }
      }, null, 2)

      const success = await window.electronAPI.saveSpriteSheet(destFolder, baseName, pngData, jsonContent)
      if (success) {
        show("Sprite sheet and JSON metadata compiled successfully!", "success")
        setSelectedAssets(new Set())
      } else {
        show("Failed to save sprite sheet files", "error")
      }

    } catch (err: any) {
      console.error(err)
      show(`Failed to generate sprite sheet: ${err.message || err}`, "error")
    }
  }

  const handleExportSelected = async () => {
    if (!activeAssetSourcePath) return
    if (selectedAssets.size === 0) return
    const destFolder = await window.electronAPI.openDirectory()
    if (!destFolder) return

    show(`Exporting selected ${selectedCategory} assets...`, 'info', 0)
    try {
      const ids = Array.from(selectedAssets).join(',')
      const result = await window.electronAPI.invokeFfdec('-export', [
        selectedCategory,
        destFolder,
        activeAssetSourcePath,
        '-select',
        ids
      ])
      if (result.code === 0) {
        show(`Exported ${selectedAssets.size} assets successfully`, 'success')
        setSelectedAssets(new Set())
      } else {
        show('Export failed', 'error')
      }
    } catch (err) {
      show('Error exporting selected assets', 'error')
    }
  }

  const toggleAsset = (id: number) => {
    const newSet = new Set(selectedAssets)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedAssets(newSet)
  }

  const confirmAssetReplace = async (id: number, filePath: string) => {
    if (!activeAssetSourcePath) return
    show(`Replacing asset [${id}]...`, 'info', 0)
    try {
      const success = await window.electronAPI.replaceTag(activeAssetSourcePath, id, filePath)
      if (success) {
        show(`Asset [${id}] replaced successfully! Reloading SWF...`, 'success')
        const key = getCacheKey(selectedCategory, id)
        setPreviewCache(prev => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        setFailedPreviews(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        
        // Update current preview modal if it's open for this asset
        if (previewModal && previewModal.asset.id === id) {
          const dataUrl = selectedCategory === 'sound'
            ? await window.electronAPI.extractSound(activeAssetSourcePath, id)
            : await window.electronAPI.extractImage(activeAssetSourcePath, id, selectedCategory)
          if (dataUrl) {
            setPreviewModal({ asset: previewModal.asset, dataUrl })
          }
        }

        if (mainSwfPath && activeAssetSourcePath === mainSwfPath) {
          await useAppStore.getState().loadSwf(mainSwfPath, true)
        } else {
          await useAppStore.getState().loadAssetSwf(activeAssetSourcePath)
        }
      } else {
        show('Failed to replace asset', 'error')
      }
    } catch (err) {
      show('Error replacing asset', 'error')
    }
  }

  const handleAssetReplace = async (id: number) => {
    if (!activeAssetSourcePath) return
    show(`Select a replacement file for Asset ID ${id}`, 'info')
    const newFilePath = await window.electronAPI.openAsFile()
    if (!newFilePath) return

    const isVisual = ['image', 'shape', 'morphshape'].includes(selectedCategory)
    if (isVisual) {
      setLoadingPreviews(prev => new Set(prev).add(`replace-load-${id}`))
      try {
        const newDataUrl = await window.electronAPI.readDataUrl(newFilePath)
        const key = getCacheKey(selectedCategory, id)
        let oldDataUrl = previewCache.get(key) || ""
        if (!oldDataUrl) {
          oldDataUrl = await window.electronAPI.extractImage(activeAssetSourcePath, id, selectedCategory) || ""
        }
        if (oldDataUrl && newDataUrl) {
          setComparisonData({ id, oldDataUrl, newDataUrl, newFilePath })
          return
        }
      } catch (err) {
        console.error('Failed to load comparison data', err)
      } finally {
        setLoadingPreviews(prev => {
          const next = new Set(prev)
          next.delete(`replace-load-${id}`)
          return next
        })
      }
    }

    await confirmAssetReplace(id, newFilePath)
  }

  // Zoom & Pan Wheel/Mouse Handlers
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (selectedCategory === 'sound') return
    e.preventDefault()
    const zoomFactor = 1.1
    const nextZoom = e.deltaY < 0 ? Math.min(8, zoom * zoomFactor) : Math.max(0.25, zoom / zoomFactor)
    setZoom(nextZoom)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedCategory === 'sound') return
    if (e.button !== 0) return // Left click only
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || selectedCategory === 'sound') return
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = e.currentTarget.parentElement
    if (!container) return
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      setCompareRatio(ratio)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Auto-reset Zoom & Pan when asset changes
  useEffect(() => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }, [previewModal?.asset?.id])

  // Batch Drop Handler
  const handleBatchDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!activeAssetSourcePath) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const matches: { path: string; name: string; id: number }[] = []
    
    for (const file of files) {
      const name = file.name
      const match = name.match(/(?:^|\D)(\d+)(?:\D|$)/)
      if (match) {
        const id = parseInt(match[1], 10)
        const tagExists = tags.some(t => t.id === id)
        if (tagExists) {
          matches.push({
            path: (file as any).path,
            name: name,
            id
          })
        }
      }
    }

    if (matches.length === 0) {
      show('No matching asset IDs found in the dropped file names.', 'warning')
      return
    }

    const confirm = window.confirm(`Terdeteksi ${matches.length} file pencocokan ID. Apakah Anda ingin melakukan batch replace untuk semua aset ini secara otomatis?`)
    if (!confirm) return

    setBatchStatus({ total: matches.length, current: 0, logs: ['Memulai batch swapping...'] })

    let successCount = 0
    for (let i = 0; i < matches.length; i++) {
      const item = matches[i]
      setBatchStatus(prev => prev ? {
        ...prev,
        current: i + 1,
        logs: [...prev.logs, `Mengganti asset ID ${item.id} dengan ${item.name}...`]
      } : null)

      try {
        const success = await window.electronAPI.replaceTag(activeAssetSourcePath, item.id, item.path)
        if (success) {
          successCount++
          const key = getCacheKey(selectedCategory, item.id)
          setPreviewCache(prev => {
            const next = new Map(prev)
            next.delete(key)
            return next
          })
        } else {
          setBatchStatus(prev => prev ? {
            ...prev,
            logs: [...prev.logs, `[ERROR] Gagal mengganti asset ID ${item.id}`]
          } : null)
        }
      } catch (err: any) {
        setBatchStatus(prev => prev ? {
          ...prev,
          logs: [...prev.logs, `[ERROR] Kesalahan mengganti ID ${item.id}: ${err.message || err}`]
        } : null)
      }
    }

    show(`Batch swap selesai: ${successCount} dari ${matches.length} berhasil diganti.`, 'success')
    
    if (activeAssetSourcePath === mainSwfPath) {
      await useAppStore.getState().loadSwf(mainSwfPath, true)
    } else {
      await useAppStore.getState().loadAssetSwf(activeAssetSourcePath)
    }

    setTimeout(() => {
      setBatchStatus(null)
    }, 4000)
  }

  const handleAssetExport = async (id: number) => {
    if (!activeAssetSourcePath) return
    const destFolder = await window.electronAPI.openDirectory()
    if (!destFolder) return

    show(`Exporting asset [${id}]...`, 'info', 0)
    try {
      const result = await window.electronAPI.invokeFfdec('-export', [
        selectedCategory,
        destFolder,
        activeAssetSourcePath,
        '-select',
        id.toString()
      ])
      if (result.code === 0) {
        show(`Asset [${id}] exported successfully`, 'success')
      } else {
        show('Export failed', 'error')
      }
    } catch (err) {
      show('Error exporting asset', 'error')
    }
  }

  const handleAssetDelete = async (id: number) => {
    if (!activeAssetSourcePath) return
    const confirm = window.confirm(`Apakah Anda yakin ingin menghapus tag aset [ID: ${id}] ini secara permanen dari berkas SWF? Tindakan ini dapat menyebabkan crash jika aset masih dirujuk oleh kode game.`)
    if (!confirm) return

    show(`Menghapus aset [${id}]...`, 'info', 0)
    try {
      const success = await window.electronAPI.deleteTag(activeAssetSourcePath, id)
      if (success) {
        show(`Aset [${id}] berhasil dihapus! Memuat ulang SWF...`, 'success')
        const key = getCacheKey(selectedCategory, id)
        setPreviewCache(prev => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        setFailedPreviews(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        if (activeAssetSourcePath === mainSwfPath) {
          await useAppStore.getState().loadSwf(mainSwfPath, true)
        } else {
          await useAppStore.getState().loadAssetSwf(activeAssetSourcePath)
        }
      } else {
        show('Gagal menghapus aset', 'error')
      }
    } catch (err) {
      show('Error menghapus aset', 'error')
    }
  }


  // Filter by search query (Already moved up to avoid TDZ issues)

  if (!activeAssetSourcePath) {
    return (
      <div className="module">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles size={24} className="text-indigo-400" />
            <span>Asset Forge</span>
          </h2>
          <p className="module-desc">Extract, export, and replace visual/audio assets in SWF files</p>
        </div>
        <div className="card bg-slate-800 border border-slate-700 text-center p-8 flex flex-col items-center justify-center gap-3">
          <FolderOpen size={48} className="text-slate-500" />
          <div>
            <p className="text-slate-300 font-medium">No SWF file loaded</p>
            <p className="text-sm text-slate-500 mt-1">Load a SWF file to inspect assets</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-slide-in-right overflow-hidden gap-4">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900/60 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-400" />
            <span>Asset Forge</span>
          </h2>
        </div>

        {/* SWF Selector Dropdown */}
        {assetSwfPaths.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-lg border border-slate-900 text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px] pl-1.5 pr-0.5">Active SWF Source:</span>
            <select
              value={activeAssetSourcePath || ''}
              onChange={(e) => setActiveAssetSourcePath(e.target.value || null)}
              className="bg-transparent text-slate-300 font-bold uppercase tracking-wide py-0.5 px-1 bg-slate-950 outline-none border border-transparent rounded cursor-pointer hover:text-white"
            >
              <option value={mainSwfPath || ''}>{(mainSwfPath || '').split(/[\\/]/).pop()}</option>
              {assetSwfPaths.map((path) => (
                <option key={path} value={path}>{path.split(/[\\/]/).pop()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Split Layout Body */}
      <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
        {/* Left Side: Category List (Compact Panel) */}
        <div className="w-56 flex-none flex flex-col gap-1 overflow-y-auto bg-slate-950/20 border border-slate-900/60 rounded-xl p-2">
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900/40 mb-1">
            Categories
          </div>
          {categories.map((cat) => {
            const IconComponent = cat.icon
            const isSelected = selectedCategory === cat.key
            const catAssets = tags.filter((tag) => filterTagByCategory(tag, cat.key))
            return (
              <button
                key={cat.key}
                onClick={() => { setSelectedCategory(cat.key); setSearchQuery('') }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500/30 text-white shadow-sm'
                    : `bg-transparent border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200`
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent size={14} className={isSelected ? 'text-indigo-400 scale-110' : cat.color} />
                  <span>{cat.label}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isSelected ? 'bg-indigo-600/30 text-indigo-200' : 'bg-slate-950/40 text-slate-500'}`}>
                  {catAssets.length
                }</span>
              </button>
            )
          })}
        </div>

        {/* Right Side: Grid and Toolbar */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {/* Toolbar: Search + Export */}
          <div className="bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="search-input pl-9 w-full text-xs py-2"
                type="text"
                placeholder={`Search ${currentCatInfo?.label || 'assets'} by name or ID...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {selectedCategory === 'image' && selectedAssets.size > 1 && (
                <button
                  className="btn btn-primary font-semibold text-xs py-1.5 px-3 bg-gradient-to-r from-pink-650 to-fuchsia-650 border-none shadow-pink-500/20 hover:from-pink-550 hover:to-fuchsia-555 hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer"
                  onClick={handleGenerateSpriteSheet}
                >
                  <Sparkles size={13} />
                  <span>Generate Sprite Sheet ({selectedAssets.size})</span>
                </button>
              )}
              <button
                className="btn btn-secondary font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                onClick={handleExportSelected}
                disabled={selectedAssets.size === 0}
              >
                <Download size={13} />
                <span>Export Selected ({selectedAssets.size})</span>
              </button>
              <button className="btn btn-primary font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer" onClick={handleExportAll}>
                <Send size={13} />
                <span>Export All</span>
              </button>
            </div>
          </div>

          {/* Assets Grid Card */}
          <div className="flex-1 min-h-0 bg-slate-950/40 border border-slate-900/80 rounded-xl flex flex-col overflow-hidden">
            <div className="card-title font-bold text-slate-200 border-b border-slate-900/80 px-4 py-2.5 bg-slate-950/60 flex items-center justify-between flex-none">
              <span className="flex items-center gap-1.5">
                {currentCatInfo && <currentCatInfo.icon size={14} className={currentCatInfo.color} />}
                {currentCatInfo?.label} ({displayedAssets.length})
              </span>
              {selectedAssets.size > 0 && (
                <span className="text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedAssets.size} SELECTED
                </span>
              )}
            </div>

            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto p-4"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleBatchDrop}
            >
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))'
                }}>
                {displayedAssets.length === 0 ? (
                  <div className="col-span-full text-center text-slate-500 py-8 text-sm">
                    {searchQuery ? 'No assets match your search.' : 'No assets of this category found in the SWF.'}
                  </div>
                ) : (
                  paginatedAssets.map((asset: Asset) => {
                    const isSelected = selectedAssets.has(asset.id)
                    const key = getCacheKey(selectedCategory, asset.id)
                    const cachedPreview = previewCache.get(key)
                    const isLoading = loadingPreviews.has(key)
                    const isFailed = failedPreviews.has(key)
                    const Icon = currentCatInfo?.icon || ImageIcon

                    return (
                      <AssetCard
                        key={asset.globalIndex}
                        asset={asset}
                        isSelected={isSelected}
                        isPreviewable={isPreviewable}
                        cachedPreview={cachedPreview}
                        isLoading={isLoading}
                        isFailed={isFailed}
                        Icon={Icon}
                        catColor={currentCatInfo?.color || 'text-slate-400'}
                        onToggle={() => toggleAsset(asset.id)}
                        onLoadPreview={() => loadPreview(asset)}
                        onOpenPreview={() => openPreviewModal(asset)}
                        onReplace={() => handleAssetReplace(asset.id)}
                        onExport={() => handleAssetExport(asset.id)}
                        onDelete={() => handleAssetDelete(asset.id)}
                        onDropFile={async (file) => {
                          show(`Replacing asset [${asset.id}] with dropped file: ${file.name}...`, 'info', 0)
                          try {
                            const success = await window.electronAPI.replaceTag(activeAssetSourcePath, asset.id, (file as any).path)
                            if (success) {
                              show(`Asset [${asset.id}] replaced successfully!`, 'success')
                              const key = getCacheKey(selectedCategory, asset.id)
                              setPreviewCache(prev => {
                                const next = new Map(prev)
                                next.delete(key)
                                return next
                              })
                              setFailedPreviews(prev => {
                                const next = new Set(prev)
                                next.delete(key)
                                return next
                              })
                              if (activeAssetSourcePath === mainSwfPath) {
                                await useAppStore.getState().loadSwf(mainSwfPath, true)
                              } else {
                                await useAppStore.getState().loadAssetSwf(activeAssetSourcePath)
                              }
                            } else {
                              show('Failed to replace asset', 'error')
                            }
                          } catch (err) {
                            show('Error replacing asset', 'error')
                          }
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>


            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-900/40 bg-slate-950/20 flex-none">
                <span className="text-[11px] text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-200">{Math.min(displayedAssets.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(displayedAssets.length, currentPage * itemsPerPage)}</span> of <span className="font-bold text-slate-200">{displayedAssets.length}</span> assets
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded bg-slate-950/60 border border-slate-900/60 hover:bg-slate-900 hover:border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950/60 disabled:hover:border-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                    title="First Page"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded bg-slate-950/60 border border-slate-900/60 hover:bg-slate-900 hover:border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950/60 disabled:hover:border-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-semibold text-slate-300 px-3 py-0.5 rounded bg-slate-950/40 border border-slate-900/40">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 rounded bg-slate-950/60 border border-slate-900/60 hover:bg-slate-900 hover:border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950/60 disabled:hover:border-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                    title="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 rounded bg-slate-950/60 border border-slate-900/60 hover:bg-slate-900 hover:border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950/60 disabled:hover:border-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                    title="Last Page"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Preview Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl max-w-[85vw] max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                  <Eye size={16} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{previewModal.asset.name}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono">ID: {previewModal.asset.id}</span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-slate-400 font-mono">{(previewModal.asset.size / 1024).toFixed(1)} KB</span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase">{selectedCategory}</span>
                  </div>
                </div>
              </div>

              {/* Zoom, Pan & Background controls for images */}
              {selectedCategory !== 'sound' && (
                <div className="flex items-center gap-3 border-l border-r border-slate-800 px-4 mx-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Bg:</span>
                    <select
                      className="bg-slate-900 text-slate-350 text-[10px] py-1 px-1.5 border border-slate-850 rounded outline-none"
                      value={checkerboard}
                      onChange={(e) => setCheckerboard(e.target.value as any)}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="none">Solid Black</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 w-6 h-6 rounded flex items-center justify-center font-bold"
                    >-</button>
                    <span className="text-xs font-mono text-slate-350 min-w-[42px] text-center">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom(prev => Math.min(8.0, prev + 0.25))}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 w-6 h-6 rounded flex items-center justify-center font-bold"
                    >+</button>
                    <button
                      onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
                      className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-2 py-0.5 rounded font-bold ml-1.5"
                    >Reset</button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigatePreview(-1)}
                  className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Previous"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => navigatePreview(1)}
                  className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Next"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => handleAssetExport(previewModal.asset.id)}
                  className="w-8 h-8 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 flex items-center justify-center transition-colors ml-1"
                  title="Export"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleAssetReplace(previewModal.asset.id)}
                  className="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 flex items-center justify-center transition-colors"
                  title="Replace"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => {
                    useAppStore.getState().insertTextAtCursor(`${previewModal.asset.id}`)
                    show(`Inserted asset ID ${previewModal.asset.id} to editor!`, 'success')
                  }}
                  className="w-8 h-8 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 flex items-center justify-center transition-colors"
                  title="Insert ID to Editor"
                >
                  <Send size={14} />
                </button>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-red-600/30 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors ml-1"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div
              className={`flex-1 p-6 flex items-center justify-center overflow-hidden min-h-[400px] min-w-[500px] relative border border-dashed border-transparent hover:border-indigo-500/40 rounded-b-2xl transition-all ${selectedCategory !== 'sound' && (isPanning ? 'cursor-grabbing' : 'cursor-grab')}`}
              style={{
                backgroundColor: checkerboard === 'light' ? '#e2e8f0' : checkerboard === 'none' ? '#000000' : '#090d16',
                backgroundImage: checkerboard === 'light'
                  ? 'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%)'
                  : checkerboard === 'none'
                  ? 'none'
                  : 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const file = e.dataTransfer.files[0]
                  const id = previewModal.asset.id
                  show(`Loading dropped file: ${file.name}...`, 'info')
                  const isVisual = ['image', 'shape', 'morphshape'].includes(selectedCategory)
                  if (isVisual) {
                    const newDataUrl = await window.electronAPI.readDataUrl((file as any).path)
                    const key = getCacheKey(selectedCategory, id)
                    let oldDataUrl = previewCache.get(key) || ""
                    if (!oldDataUrl) {
                      oldDataUrl = await window.electronAPI.extractImage(activeAssetSourcePath, id, selectedCategory) || ""
                    }
                    if (oldDataUrl && newDataUrl) {
                      setComparisonData({ id, oldDataUrl, newDataUrl, newFilePath: (file as any).path })
                      return
                    }
                  }
                  await confirmAssetReplace(id, (file as any).path)
                }
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {selectedCategory === 'sound' ? (
                <SoundPreviewContainer dataUrl={previewModal.dataUrl} assetName={previewModal.asset.name} />
              ) : (
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                    userSelect: 'none'
                  }}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <img
                    src={previewModal.dataUrl}
                    alt={previewModal.asset.name}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Before/After Visual Comparison Modal */}
      {comparisonData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-[90vw] max-w-[800px] overflow-hidden flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/40">
              <h3 className="font-bold text-white text-sm">Visual Comparison: Replacing Asset ID {comparisonData.id}</h3>
              <button onClick={() => setComparisonData(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="text-xs text-slate-400 text-center">
                Drag the slider handle in the center to compare the <strong>Old Asset (Left)</strong> vs <strong>New Asset (Right)</strong>.
              </div>

              {/* Slider Container */}
              <div
                className="relative w-full h-[50vh] max-h-[400px] rounded-lg border border-slate-800 overflow-hidden select-none bg-slate-900"
                style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px' }}
              >
                {/* Old Image (Left side) */}
                <img
                  src={comparisonData.oldDataUrl}
                  alt="Old Asset"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none p-4"
                />

                {/* New Image Container (Right side, cropped) */}
                <div
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    clipPath: `polygon(${compareRatio * 100}% 0, 100% 0, 100% 100%, ${compareRatio * 100}% 100%)`
                  }}
                >
                  <img
                    src={comparisonData.newDataUrl}
                    alt="New Asset"
                    className="absolute inset-0 w-full h-full object-contain p-4"
                  />
                </div>

                {/* Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-indigo-500 cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${compareRatio * 100}%` }}
                  onMouseDown={handleDividerMouseDown}
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center text-white shadow-lg text-[9px] font-bold">
                    ↔
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-900/30 border-t border-slate-800">
              <button
                className="btn btn-secondary text-xs"
                onClick={() => setComparisonData(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={async () => {
                  const data = comparisonData
                  setComparisonData(null)
                  await confirmAssetReplace(data.id, data.newFilePath)
                }}
              >
                Confirm Replacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Replacement Status Overlay */}
      {batchStatus && (
        <div className="fixed bottom-6 right-6 z-[120] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl w-[320px] overflow-hidden flex flex-col animate-slide-in-up">
          <div className="bg-indigo-950/40 px-4 py-2 border-b border-slate-850 flex items-center justify-between">
            <span className="font-bold text-xs text-white">Batch Swapping in Progress</span>
            <span className="text-[10px] text-indigo-400 font-mono font-bold">
              {batchStatus.current} / {batchStatus.total}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(batchStatus.current / batchStatus.total) * 100}%` }}
              />
            </div>
            {/* Console Log window */}
            <div className="bg-slate-900 border border-slate-850 rounded p-2 h-28 overflow-y-auto font-mono text-[9px] leading-relaxed text-slate-400 space-y-1">
              {batchStatus.logs.map((log, idx) => (
                <div key={idx} className={log.startsWith('[ERROR]') ? 'text-red-400' : ''}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Asset Card Component ──────────────────────────

function AssetCard({
  asset,
  isSelected,
  isPreviewable,
  cachedPreview,
  isLoading,
  isFailed,
  Icon,
  catColor,
  onToggle,
  onLoadPreview,
  onOpenPreview,
  onReplace,
  onExport,
  onDelete,
  onDropFile
}: {
  asset: Asset
  isSelected: boolean
  isPreviewable: boolean
  cachedPreview?: string
  isLoading: boolean
  isFailed: boolean
  Icon: React.FC<{ size?: number; className?: string }>
  catColor: string
  onToggle: () => void
  onLoadPreview: () => void
  onOpenPreview: () => void
  onReplace: () => void
  onExport: () => void
  onDelete: () => void
  onDropFile?: (file: File) => void
}) {
  const hasPreview = !!cachedPreview
  const showPlaceholder = isPreviewable && !hasPreview && !isLoading
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFile?.(e.dataTransfer.files[0])
    }
  }

  return (
    <div
      className={`relative rounded-xl border flex flex-col cursor-pointer transition-all group ${
        isDragOver
          ? 'bg-indigo-650/25 border-indigo-500 scale-[1.02] ring-2 ring-indigo-500/50'
          : isSelected
          ? 'bg-indigo-600/10 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
          : 'bg-slate-950/20 border-slate-900/60 hover:bg-slate-900/40 hover:border-slate-800'
      }`}
      onClick={onToggle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Delete button (absolute on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-slate-950/80 border border-slate-900/40 text-slate-500 hover:text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
        title="Hapus Aset"
      >
        <Trash2 size={12} />
      </button>
      {/* Preview Area */}
      <div
        className="relative aspect-square flex items-center justify-center overflow-hidden rounded-t-xl"
        style={
          hasPreview
            ? {}
            : { background: 'repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px' }
        }
      >
        {hasPreview && (
          <>
            <img
              src={cachedPreview}
              alt={asset.name}
              className="w-full h-full object-contain p-1.5"
              style={{ imageRendering: 'auto' }}
              loading="lazy"
            />
            {/* Zoom overlay on hover */}
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in"
              onClick={(e) => {
                e.stopPropagation()
                onOpenPreview()
              }}
            >
              <ZoomIn size={20} className="text-white/80" />
            </div>
          </>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            <Loader2 size={20} className="text-indigo-400 animate-spin" />
            <span className="text-[9px] text-slate-500 font-mono">Loading...</span>
          </div>
        )}

        {showPlaceholder && !isFailed && (
          <button
            className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full hover:bg-slate-800/40 transition-colors rounded-t-xl"
            onClick={(e) => {
              e.stopPropagation()
              onLoadPreview()
            }}
            title="Click to load preview"
          >
            <div className={`p-2.5 rounded-lg bg-slate-950/60 border border-slate-900/60 ${catColor}`}>
              <Icon size={18} />
            </div>
            <span className="text-[9px] text-slate-500 font-medium">Click to preview</span>
          </button>
        )}

        {isFailed && (
          <div className="flex flex-col items-center justify-center gap-1.5 p-4">
            <ImageOff size={18} className="text-slate-600" />
            <span className="text-[9px] text-slate-600 font-mono">No preview</span>
          </div>
        )}

        {!isPreviewable && !hasPreview && (
          <div className={`p-3 rounded-lg bg-slate-950/60 border border-slate-900/60 ${isSelected ? 'text-indigo-400 border-indigo-500/20' : catColor}`}>
            <Icon size={20} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-900/40">
        <div className="text-[11px] font-bold truncate text-slate-200" title={asset.name}>
          {asset.name}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-indigo-400 font-mono font-bold">ID: {asset.id}</span>
          <span className="text-[10px] text-slate-500 font-mono">{(asset.size / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 justify-center px-2 pb-2">
        {isPreviewable && (
          <button
            className="w-8 h-8 rounded-lg bg-slate-900/85 hover:bg-indigo-600/20 border border-slate-800/40 text-slate-400 hover:text-indigo-400 flex items-center justify-center transition-all cursor-pointer"
            title="Preview"
            onClick={(e) => {
              e.stopPropagation()
              if (cachedPreview) {
                onOpenPreview()
              } else {
                onLoadPreview()
              }
            }}
          >
            <Eye size={12} />
          </button>
        )}
        <button
          className="w-8 h-8 rounded-lg bg-slate-900/85 hover:bg-amber-600/20 border border-slate-800/40 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-all cursor-pointer"
          title="Replace Asset"
          onClick={(e) => {
            e.stopPropagation()
            onReplace()
          }}
        >
          <RefreshCw size={12} />
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-slate-900/85 hover:bg-emerald-600/20 border border-slate-800/40 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
          title="Export Asset"
          onClick={(e) => {
            e.stopPropagation()
            onExport()
          }}
        >
          <Download size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Sound Preview Container Component ──────────────────

function SoundPreviewContainer({ dataUrl, assetName }: { dataUrl: string; assetName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [pitchLock, setPitchLock] = useState(true)

  useEffect(() => {
    if (!canvasRef.current || !dataUrl) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const base64Data = dataUrl.split(',')[1]
    const binaryStr = window.atob(base64Data)
    const len = binaryStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    audioCtx.decodeAudioData(bytes.buffer.slice(0), (buffer) => {
      const data = buffer.getChannelData(0)
      const step = Math.ceil(data.length / canvas.width)
      const amp = canvas.height / 2

      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)'
      ctx.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, amp)
      ctx.lineTo(canvas.width, amp)
      ctx.stroke()

      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, amp)

      for (let i = 0; i < canvas.width; i++) {
        let min = 1.0
        let max = -1.0
        for (let j = 0; j < step; j++) {
          const idx = (i * step) + j
          if (idx < data.length) {
            const datum = data[idx]
            if (datum < min) min = datum
            if (datum > max) max = datum
          }
        }
        ctx.lineTo(i, (1 + min) * amp)
        ctx.lineTo(i, (1 + max) * amp)
      }
      ctx.stroke()
    }).catch(err => {
      console.error('Error decoding audio:', err)
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    })

    return () => {
      audioCtx.close().catch(() => {})
    }
  }, [dataUrl])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
      if ('preservesPitch' in audioRef.current) {
        audioRef.current.preservesPitch = pitchLock
      } else if ('mozPreservesPitch' in audioRef.current) {
        (audioRef.current as any).mozPreservesPitch = pitchLock
      } else if ('webkitPreservesPitch' in audioRef.current) {
        (audioRef.current as any).webkitPreservesPitch = pitchLock
      }
    }
  }, [playbackRate, pitchLock])

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg p-4 bg-slate-900/40 border border-slate-900 rounded-xl select-none">
      <div className="relative w-full h-32 bg-[#090d16] rounded-lg border border-slate-950 overflow-hidden shadow-inner">
        <canvas ref={canvasRef} width="500" height="128" className="w-full h-full object-cover" />
      </div>

      <audio ref={audioRef} src={dataUrl} controls className="w-full h-10 outline-none rounded-lg bg-slate-950/80 border border-slate-800" />

      <div className="flex gap-4 items-center justify-between w-full border-t border-slate-800/80 pt-3 mt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider font-sans">Speed:</span>
          {[0.5, 1.0, 1.5, 2.0].map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                playbackRate === rate
                  ? 'bg-indigo-650/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate.toFixed(1)}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-550 font-semibold uppercase text-[10px] tracking-wider font-sans">Lock Pitch:</span>
          <button
            onClick={() => setPitchLock(!pitchLock)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              pitchLock
                ? 'bg-indigo-650/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {pitchLock ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
