import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { Share2, ZoomIn, ZoomOut, Maximize2, Play, Pause, Sliders, X, Network } from 'lucide-react'

type Node = {
  id: string
  label: string
  type: 'root' | 'package' | 'class' | 'swf'
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

type Edge = {
  source: string
  target: string
}

export default function DependencyModule() {
  const swfData = useAppStore((s) => s.swfData)
  const assetSwfsData = useAppStore((s) => s.assetSwfsData)
  const openFileForEditing = useAppStore((s) => s.openFileForEditing)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showCrossSwf, setShowCrossSwf] = useState(true)

  // Configurable Physics Parameters
  const [repulsion, setRepulsion] = useState(150) // Repulsion force strength
  const [attraction, setAttraction] = useState(0.005) // Edge attraction factor
  const [gravity, setGravity] = useState(0.004) // Pull to center force

  // Dummy state to force a re-heat trigger
  const [heatToken, setHeatToken] = useState(0)

  const dragNodeRef = useRef<Node | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  // Build Graph Data from swfData.classes
  useEffect(() => {
    if (!swfData || !swfData.classes) return

    const nodes: Node[] = []
    const edges: Edge[] = []
    const nodeMap = new Map<string, Node>()

    // 1. Add root SWF node
    const rootNode: Node = {
      id: 'root',
      label: swfData.path.split(/[\\/]/).pop() || 'SWF',
      type: 'root',
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 18,
      color: '#6366f1' // Indigo
    }
    nodes.push(rootNode)
    nodeMap.set('root', rootNode)

    const addedPackages = new Set<string>()

    swfData.classes.forEach((cls) => {
      const parts = cls.fullName.split('.')
      
      // Process package folders hierarchy
      let parentId = 'root'
      for (let i = 0; i < parts.length - 1; i++) {
        const pkgPath = parts.slice(0, i + 1).join('.')
        if (!addedPackages.has(pkgPath)) {
          addedPackages.add(pkgPath)
          const pkgNode: Node = {
            id: pkgPath,
            label: parts[i],
            type: 'package',
            x: 400 + (Math.random() - 0.5) * 200,
            y: 300 + (Math.random() - 0.5) * 200,
            vx: 0,
            vy: 0,
            radius: 12,
            color: '#f59e0b' // Amber
          }
          nodes.push(pkgNode)
          nodeMap.set(pkgPath, pkgNode)
          edges.push({ source: parentId, target: pkgPath })
        }
        parentId = pkgPath
      }

      // Add Class Node
      const classNode: Node = {
        id: cls.fullName,
        label: parts[parts.length - 1],
        type: 'class',
        x: 400 + (Math.random() - 0.5) * 400,
        y: 300 + (Math.random() - 0.5) * 400,
        vx: 0,
        vy: 0,
        radius: 8,
        color: '#10b981' // Emerald
      }
      nodes.push(classNode)
      nodeMap.set(cls.fullName, classNode)
      edges.push({ source: parentId, target: cls.fullName })
    })

    // 2. Add Cross-SWF Linkages if enabled
    if (showCrossSwf && assetSwfsData) {
      Object.entries(assetSwfsData).forEach(([filePath, data]) => {
        if (!data) return
        const filename = filePath.split(/[\\/]/).pop() || 'Asset SWF'
        const swfNodeId = `swf:${filePath}`
        
        // Add SWF file node
        const swfNode: Node = {
          id: swfNodeId,
          label: filename,
          type: 'swf',
          x: 400 + (Math.random() - 0.5) * 350,
          y: 300 + (Math.random() - 0.5) * 350,
          vx: 0,
          vy: 0,
          radius: 14,
          color: '#ec4899' // Pink/Rose for External Asset SWF files
        }
        nodes.push(swfNode)
        nodeMap.set(swfNodeId, swfNode)
        edges.push({ source: 'root', target: swfNodeId })

        // Check if any class in main SWF references symbol class links inside this asset SWF
        if (data.tags) {
          data.tags.forEach(tag => {
            const tagName = String(tag.name || '').toLowerCase()
            swfData.classes.forEach(c => {
              if (tagName.includes(c.fullName.toLowerCase()) || tagName.includes(c.name.toLowerCase())) {
                // Draw link between class and the asset SWF
                edges.push({ source: c.fullName, target: swfNodeId })
              }
            })
          })
        }
      })
    }

    nodesRef.current = nodes
    edgesRef.current = edges
    
    // Trigger simulation re-heat when loading new SWF
    setHeatToken(prev => prev + 1)
  }, [swfData, showCrossSwf, assetSwfsData])

  // Physics simulation
  useEffect(() => {
    let animFrameId: number
    let alpha = 1.0 // Simulated annealing temperature (1.0 = Hot, 0.0 = Frozen)

    const updatePhysics = () => {
      const nodes = nodesRef.current
      const edges = edgesRef.current
      if (nodes.length === 0) return

      const canvas = canvasRef.current
      const width = canvas ? canvas.width : 800
      const height = canvas ? canvas.height : 600

      // If manually paused, just render and return
      if (isPaused) {
        drawGraph()
        return
      }

      const kAttract = attraction * alpha
      const kRepel = repulsion * alpha
      const centerStrength = gravity * alpha
      const friction = 0.82

      // 1. Repel forces between nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j]
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const distSqr = dx * dx + dy * dy + 0.1
          const dist = Math.sqrt(distSqr)
          
          if (dist < 180) {
            const force = kRepel / distSqr
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            if (n1 !== dragNodeRef.current) {
              n1.vx -= fx
              n1.vy -= fy
            }
            if (n2 !== dragNodeRef.current) {
              n2.vx += fx
              n2.vy += fy
            }
          }
        }
      }

      // 2. Attract forces along edges
      edges.forEach((edge) => {
        const n1 = nodes.find(n => n.id === edge.source)
        const n2 = nodes.find(n => n.id === edge.target)
        if (!n1 || !n2) return

        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
        const desiredDist = n1.type === 'root' ? 120 : 60
        const force = (dist - desiredDist) * kAttract

        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (n1 !== dragNodeRef.current) {
          n1.vx += fx
          n1.vy += fy
        }
        if (n2 !== dragNodeRef.current) {
          n2.vx -= fx
          n2.vy -= fy
        }
      })

      // 3. Center gravity & integrate positions
      nodes.forEach((n) => {
        if (n === dragNodeRef.current) {
          n.vx = 0
          n.vy = 0
          return
        }
        
        // Pull towards graph center (400, 300)
        n.vx += (400 - n.x) * centerStrength
        n.vy += (300 - n.y) * centerStrength

        // Apply friction
        n.vx *= friction
        n.vy *= friction

        // Move
        n.x += n.vx
        n.y += n.vy

        // Hard Boundaries (keep nodes inside canvas area)
        n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x))
        n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y))
      })

      // Draw Graph
      drawGraph()

      // Cool down the temperature
      if (!dragNodeRef.current) {
        alpha = Math.max(0, alpha - 0.005)
      } else {
        // Re-heat simulation if dragging a node
        alpha = Math.min(1.0, alpha + 0.08)
      }

      // Continue animating if we still have energy/heat or if a drag is active
      if (alpha > 0.002 || dragNodeRef.current) {
        animFrameId = requestAnimationFrame(updatePhysics)
      }
    }

    const drawGraph = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear Canvas
      ctx.fillStyle = '#070a13'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      
      // Pan and Zoom Matrix Transform
      ctx.translate(pan.x, pan.y)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

      const nodes = nodesRef.current
      const edges = edgesRef.current

      // Draw edges
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      edges.forEach((edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        if (sourceNode && targetNode) {
          ctx.beginPath()
          ctx.moveTo(sourceNode.x, sourceNode.y)
          ctx.lineTo(targetNode.x, targetNode.y)
          ctx.stroke()
        }
      })

      // Draw nodes
      nodes.forEach((node) => {
        const isHovered = hoveredNode?.id === node.id
        const isSelected = selectedNode?.id === node.id

        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, Math.PI * 2)
        ctx.fill()

        // Selection / Hover Highlight Outer Rings
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Draw node titles (always show for root & packages, show on hover for classes)
        if (node.type !== 'class' || isHovered || isSelected) {
          ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8'
          ctx.font = node.type === 'root' ? 'bold 11px sans-serif' : '10px sans-serif'
          ctx.textAlign = 'center'
          
          // Draw subtle outline behind text for visibility
          ctx.strokeStyle = '#070a13'
          ctx.lineWidth = 3
          ctx.strokeText(node.label, node.x, node.y + node.radius + 13)
          
          ctx.fillText(node.label, node.x, node.y + node.radius + 13)
        }
      })

      ctx.restore()
    }

    animFrameId = requestAnimationFrame(updatePhysics)
    return () => cancelAnimationFrame(animFrameId)
  }, [zoom, pan, hoveredNode, selectedNode, isDragging, isPaused, repulsion, attraction, gravity, heatToken])

  // Trigger re-heat (e.g. on adjustments)
  const reheatSimulation = () => {
    setHeatToken(prev => prev + 1)
  }

  // Mouse drag handler
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    // Calculate click location relative to scale & offset matrix
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const worldX = ((clickX - pan.x - canvas.width / 2) / zoom) + canvas.width / 2
    const worldY = ((clickY - pan.y - canvas.height / 2) / zoom) + canvas.height / 2

    // Check if clicked node
    const clickedNode = nodesRef.current.find((n) => {
      const dx = n.x - worldX
      const dy = n.y - worldY
      return dx * dx + dy * dy < (n.radius + 6) * (n.radius + 6)
    })

    if (clickedNode) {
      dragNodeRef.current = clickedNode
      setSelectedNode(clickedNode)
      dragStartRef.current = { x: clickedNode.x, y: clickedNode.y }
    } else {
      setIsDragging(true)
      panStartRef.current = { x: clickX - pan.x, y: clickY - pan.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (dragNodeRef.current) {
      const worldX = ((mouseX - pan.x - canvas.width / 2) / zoom) + canvas.width / 2
      const worldY = ((mouseY - pan.y - canvas.height / 2) / zoom) + canvas.height / 2
      dragNodeRef.current.x = worldX
      dragNodeRef.current.y = worldY
      dragNodeRef.current.vx = 0
      dragNodeRef.current.vy = 0
      reheatSimulation()
    } else if (isDragging) {
      setPan({
        x: mouseX - panStartRef.current.x,
        y: mouseY - panStartRef.current.y
      })
    } else {
      // Find hovered node
      const worldX = ((mouseX - pan.x - canvas.width / 2) / zoom) + canvas.width / 2
      const worldY = ((mouseY - pan.y - canvas.height / 2) / zoom) + canvas.height / 2

      const node = nodesRef.current.find((n) => {
        const dx = n.x - worldX
        const dy = n.y - worldY
        return dx * dx + dy * dy < (n.radius + 6) * (n.radius + 6)
      })
      setHoveredNode(node || null)
    }
  }

  const handleMouseUp = () => {
    dragNodeRef.current = null
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (selectedNode && selectedNode.type === 'class') {
      openFileForEditing(selectedNode.id)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const scaleFactor = 1.08
    if (e.deltaY < 0) {
      setZoom(z => Math.min(3.5, z * scaleFactor))
    } else {
      setZoom(z => Math.max(0.2, z / scaleFactor))
    }
  }

  if (!swfData) {
    return (
      <div className="module-empty flex flex-col items-center justify-center p-8 text-slate-500 h-full bg-[#070b13]">
        <Share2 size={48} className="mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">No SWF loaded</p>
        <p className="text-xs text-slate-600 mt-1">Load a SWF to visualize the class package network map.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden w-full select-none bg-[#070a13] relative">
      
      {/* Module Title Header Bar */}
      <div className="px-6 py-4 border-b border-slate-900/60 bg-slate-950/20 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            <Network className="text-indigo-400" size={18} />
            <span>Interactive Class Dependency Graph</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Visualize ActionScript package layers. Drag nodes to inspect relationships. Double-click class nodes to open source code.
          </p>
        </div>

        {/* Graph Controls Toolbar */}
        <div className="flex items-center gap-2">
          {/* Pause / Play Simulation Control */}
          <button
            onClick={() => {
              setIsPaused(!isPaused)
              if (isPaused) reheatSimulation()
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
              isPaused 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                : 'bg-slate-900 border-slate-800 text-emerald-400 hover:text-emerald-350 hover:bg-slate-850'
            }`}
            title={isPaused ? "Play Simulation" : "Freeze Simulation"}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>

          {/* Physics Config Panel Trigger */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
              showConfig 
                ? 'bg-indigo-650/20 border-indigo-500/40 text-indigo-300' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Physics Settings"
          >
            <Sliders size={14} />
          </button>

          <div className="w-[1px] h-6 bg-slate-900/80 mx-0.5" />

          {/* Zoom controls */}
          <button onClick={() => setZoom(z => Math.min(3.5, z * 1.25))} className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer" title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))} className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer" title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }) }} className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer" title="Reset View">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative bg-[#070a13] flex">
        {/* Draw Canvas */}
        <canvas
          ref={canvasRef}
          width="900"
          height="600"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* ⚙️ Physics Parameter Sliders Panel */}
        {showConfig && (
          <div className="absolute top-4 left-4 bg-slate-950/95 border border-slate-900 rounded-xl p-4 shadow-2xl z-30 w-72 backdrop-blur-xl animate-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={10} className="text-indigo-400" />
                <span>Simulation Parameters</span>
              </span>
              <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-slate-300">
                <X size={12} />
              </button>
            </div>

            {/* Slider 1: Repulsion */}
            <div className="mb-3.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                <span>Repulsion Force</span>
                <span className="font-mono text-indigo-400">{repulsion} px</span>
              </div>
              <input
                type="range"
                min="50"
                max="300"
                value={repulsion}
                onChange={(e) => {
                  setRepulsion(Number(e.target.value))
                  reheatSimulation()
                }}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Slider 2: Attraction */}
            <div className="mb-3.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                <span>Attraction Edge Strength</span>
                <span className="font-mono text-indigo-400">{(attraction * 1000).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={attraction * 1000}
                onChange={(e) => {
                  setAttraction(Number(e.target.value) / 1000)
                  reheatSimulation()
                }}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Slider 3: Gravity Pull to Center */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                <span>Center Gravity Strength</span>
                <span className="font-mono text-indigo-400">{(gravity * 1000).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={gravity * 1000}
                onChange={(e) => {
                  setGravity(Number(e.target.value) / 1000)
                  reheatSimulation()
                }}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            
            {/* Checkbox: Show Cross-SWF Linkages */}
            <div className="mt-3 pt-3 border-t border-slate-900/60 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">Show Cross-SWF Linkages</span>
              <input
                type="checkbox"
                checked={showCrossSwf}
                onChange={(e) => {
                  setShowCrossSwf(e.target.checked)
                  reheatSimulation()
                }}
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-800 rounded focus:ring-indigo-550 accent-indigo-500 cursor-pointer"
              />
            </div>
            
            <p className="text-[9px] text-slate-650 mt-3 border-t border-slate-900/60 pt-2 font-medium">
              Adjusting sliders automatically wakes up the simulation physics to recalculate layout.
            </p>
          </div>
        )}

        {/* ℹ️ Sidebar Node Inspector */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bg-slate-950/90 border border-slate-900 rounded-xl p-3 shadow-2xl z-20 w-64 backdrop-blur-xl animate-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Node Inspector</span>
              <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-350">
                <X size={12} />
              </button>
            </div>
            <div className="text-xs font-bold text-slate-200 break-all">{selectedNode.label}</div>
            <div className="text-[10px] text-slate-450 mt-1 font-mono break-all">{selectedNode.id}</div>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: selectedNode.color }} />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{selectedNode.type}</span>
            </div>

            {selectedNode.type === 'class' && (
              <button
                onClick={() => openFileForEditing(selectedNode.id)}
                className="w-full mt-3 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
              >
                Open Class File
              </button>
            )}

            {selectedNode.type === 'swf' && (
              <button
                onClick={() => {
                  const path = selectedNode.id.replace('swf:', '')
                  useAppStore.getState().setActiveAssetSourcePath(path)
                  useAppStore.getState().setActiveModule('asset-forge')
                }}
                className="w-full mt-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-lg shadow-rose-600/10"
              >
                Open in Asset Forge
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
