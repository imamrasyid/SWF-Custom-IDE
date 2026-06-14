import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Database, Save, FolderOpen, RefreshCw, Upload, Eye, Table as TableIcon, FileText, Settings, Download, ChevronRight, ChevronDown, Plus, Trash2, ExternalLink } from 'lucide-react'
import Editor from '@monaco-editor/react'

type GameDataEntry = {
  id: string
  data: Record<string, any>
}

type ViewMode = 'visual' | 'interactive' | 'table' | 'raw'

export default function GameDataEditorModule() {
  const { show } = useToast()
  const swfPath = useAppStore((s) => s.swfPath)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const showPrompt = useAppStore((s) => s.showPrompt)
  
  const [dataList, setDataList] = useState<GameDataEntry[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [fileExtension, setFileExtension] = useState<'json' | 'bin'>('json')
  const [viewMode, setViewMode] = useState<ViewMode>('visual')
  
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModified, setIsModified] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Drag & drop file selection
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initializeSelection = (data: GameDataEntry[]) => {
    if (data.length > 0) {
      setSelectedId(data[0].id)
      const itemData = data[0].data !== undefined && data[0].data !== null ? data[0].data : data[0]
      const keys = Object.keys(itemData)
      if (keys.length > 0) {
        const firstKey = keys.find(k => k !== 'id') || keys[0]
        setSelectedKey(firstKey)
      }
    }
  }

  const processFile = async (file: File) => {
    setFileName(file.name)
    const ext = file.name.endsWith('.bin') ? 'bin' : 'json'
    setFileExtension(ext)
    setLoading(true)
    
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          let jsonString = ''
          if (ext === 'bin') {
            const arrayBuffer = e.target?.result as ArrayBuffer
            const decompressed = await window.electronAPI.decompressZlib(arrayBuffer)
            if (!decompressed) {
              show('Failed to decompress BIN file (zlib error)', 'error')
              setLoading(false)
              return
            }
            jsonString = decompressed
          } else {
            jsonString = e.target?.result as string
          }

          const parsed = JSON.parse(jsonString)
          if (Array.isArray(parsed)) {
            setDataList(parsed)
            initializeSelection(parsed)
            show('Game data loaded successfully!', 'success')
            setIsModified(true)
          } else {
            show('Invalid data format: Expected an array of configuration objects.', 'error')
          }
        } catch (err) {
          console.error(err)
          show('Failed to parse file content', 'error')
        } finally {
          setLoading(false)
        }
      }

      if (ext === 'bin') {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    } catch (err) {
      console.error(err)
      show('Error reading file', 'error')
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const updateValue = (valueText: string) => {
    if (!selectedId || !selectedKey) return
    
    setDataList((prev) =>
      prev.map((item) => {
        if (item.id === selectedId) {
          let parsedValue: any = valueText
          if (valueText.trim() === 'true') parsedValue = true
          else if (valueText.trim() === 'false') parsedValue = false
          else if (!isNaN(Number(valueText)) && valueText.trim() !== '') parsedValue = Number(valueText)
          else if (valueText.startsWith('[') || valueText.startsWith('{')) {
            try {
              parsedValue = JSON.parse(valueText)
            } catch {}
          } else if (valueText.includes('\n')) {
            parsedValue = valueText.split('\n').map(s => {
              const trimmed = s.trim()
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                  return JSON.parse(trimmed)
                } catch {
                  return trimmed
                }
              }
              return trimmed
            }).filter(Boolean)
          }

          if (item.data !== undefined && item.data !== null) {
            return {
              ...item,
              data: {
                ...item.data,
                [selectedKey]: parsedValue
              }
            }
          } else {
            return {
              ...item,
              [selectedKey]: parsedValue
            }
          }
        }
        return item
      })
    )
    setIsModified(true)
  }

  const handleExport = async (format: 'json' | 'bin') => {
    if (dataList.length === 0) return
    setLoading(true)
    try {
      const jsonString = JSON.stringify(dataList, null, 2)
      
      let downloadUrl = ''
      if (format === 'bin') {
        const compressed = await window.electronAPI.compressZlib(jsonString)
        if (!compressed) {
          show('Failed to compress data to BIN format', 'error')
          setLoading(false)
          return
        }
        const blob = new Blob([new Uint8Array(compressed)], { type: 'application/octet-stream' })
        downloadUrl = URL.createObjectURL(blob)
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' })
        downloadUrl = URL.createObjectURL(blob)
      }

      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", downloadUrl)
      downloadAnchor.setAttribute("download", `${fileName.split('.')[0]}.${format}`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      
      show(`Data exported successfully as ${format.toUpperCase()}`, 'success')
      setIsModified(false)
    } catch (err) {
      console.error(err)
      show('Error exporting data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveAll = async () => {
    if (!projectRoot) {
      handleExport(fileExtension)
      return
    }
    setLoading(true)
    try {
      const success = await window.electronAPI.writeDatabase(projectRoot, 'gamedata', dataList)
      if (success) {
        show('gamedata.json saved to project directory successfully!', 'success')
        setIsModified(false)
      } else {
        show('Failed to save gamedata.json', 'error')
      }
    } catch (err) {
      console.error(err)
      show('Error saving database', 'error')
    } finally {
      setLoading(false)
    }
  }

  const currentItem = dataList.find((d) => d.id === selectedId)
  const getItemData = (item: any) => {
    if (!item) return {}
    return item.data !== undefined && item.data !== null ? item.data : item
  }
  const currentKeys = currentItem ? Object.keys(getItemData(currentItem)) : []
  const filteredKeys = currentKeys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()) && k !== 'id')
  const currentValue = currentItem && selectedKey ? getItemData(currentItem)[selectedKey] : ''

  const getDisplayValue = (val: any) => {
    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        return val.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n')
      }
      return JSON.stringify(val, null, 2)
    }
    return String(val)
  }

  const updateFieldKey = (oldKey: string, newKey: string) => {
    if (!selectedId || !newKey || oldKey === newKey) return
    setDataList((prev) =>
      prev.map((item) => {
        if (item.id === selectedId) {
          const itemData = item.data !== undefined && item.data !== null ? item.data : item
          const clonedData = { ...(itemData as Record<string, any>) }
          clonedData[newKey] = clonedData[oldKey]
          delete clonedData[oldKey]
          
          if (item.data !== undefined && item.data !== null) {
            return { ...item, data: clonedData }
          } else {
            return { ...item, ...clonedData }
          }
        }
        return item
      })
    )
    if (selectedKey === oldKey) setSelectedKey(newKey)
    setIsModified(true)
  }

  const deleteFieldKey = (keyToDelete: string) => {
    if (!selectedId) return
    setDataList((prev) =>
      prev.map((item) => {
        if (item.id === selectedId) {
          const itemData = item.data !== undefined && item.data !== null ? item.data : item
          const clonedData = { ...(itemData as Record<string, any>) }
          delete clonedData[keyToDelete]
          
          if (item.data !== undefined && item.data !== null) {
            return { ...item, data: clonedData }
          } else {
            return { ...item, ...clonedData }
          }
        }
        return item
      })
    )
    setIsModified(true)
    show(`Property "${keyToDelete}" deleted`, 'success')
  }

  const addFieldKey = async () => {
    if (!selectedId) return

    const currentItem = dataList.find((d) => d.id === selectedId)
    const itemData = currentItem ? ((currentItem.data !== undefined && currentItem.data !== null ? currentItem.data : currentItem) as any) : {}
    
    let defaultKey = 'new_property'
    let counter = 1
    while (itemData[`${defaultKey}_${counter}`] !== undefined) {
      counter++
    }
    const suggestedKey = `${defaultKey}_${counter}`

    const newKey = await showPrompt("New Property Name", "Enter a name for the new property:", suggestedKey)
    if (!newKey) return

    if (itemData[newKey] !== undefined) {
      show("Property already exists", "error")
      return
    }

    setDataList((prev) =>
      prev.map((item) => {
        if (item.id === selectedId) {
          const itemData = (item.data !== undefined && item.data !== null ? item.data : item) as any
          const clonedData = { ...itemData, [newKey]: "" }
          
          if (item.data !== undefined && item.data !== null) {
            return { ...item, data: clonedData }
          } else {
            return { ...item, ...clonedData }
          }
        }
        return item
      })
    )
    setIsModified(true)
    show(`New property "${newKey}" added`, 'success')
  }

  const addDatabaseEntry = async () => {
    let newId = ''
    let templateData: any = {}

    if (dataList.length > 0) {
      const lastEntry = dataList[dataList.length - 1]
      const lastId = lastEntry.id
      const match = String(lastId).match(/^([a-zA-Z_-]+)(\d+)$/)
      if (match) {
        const prefix = match[1]
        const num = parseInt(match[2], 10) + 1
        newId = `${prefix}${num}`
      } else {
        newId = `${lastId}_copy`
      }

      let counter = 1
      let testId = newId
      while (dataList.some(d => d.id === testId)) {
        testId = `${newId}_${counter}`
        counter++
      }
      newId = testId

      const lastRowData = (lastEntry.data !== undefined && lastEntry.data !== null ? lastEntry.data : lastEntry) as any
      Object.keys(lastRowData).forEach(k => {
        if (k === 'id') {
          templateData[k] = Array.isArray(lastRowData[k]) ? [newId] : newId
        } else {
          const val = lastRowData[k]
          if (Array.isArray(val)) templateData[k] = []
          else if (typeof val === 'object' && val !== null) templateData[k] = {}
          else if (typeof val === 'number') templateData[k] = 0
          else if (typeof val === 'boolean') templateData[k] = false
          else templateData[k] = ''
        }
      })
    } else {
      newId = 'entry_1'
      templateData = { id: [newId], name: 'New Entry' }
    }

    const requestedId = await showPrompt("New Entry ID", "Enter an ID for the new entry:", newId)
    if (!requestedId) return

    if (dataList.some(d => d.id === requestedId)) {
      show("Entry ID already exists", "error")
      return
    }

    if (templateData.id !== undefined) {
      templateData.id = Array.isArray(templateData.id) ? [requestedId] : requestedId
    }

    const hasDataProp = dataList.length > 0 && dataList[0].data !== undefined && dataList[0].data !== null
    const newEntry = hasDataProp ? { id: requestedId, data: templateData } : { id: requestedId, ...templateData }

    setDataList((prev) => [...prev, newEntry])
    setSelectedId(requestedId)
    setIsModified(true)
    show(`New database entry ${requestedId} created`, 'success')
  }

  const deleteDatabaseEntry = (idToDelete: string) => {
    setDataList((prev) => prev.filter((item) => item.id !== idToDelete))
    if (selectedId === idToDelete) {
      setSelectedId(dataList.length > 1 ? dataList[0].id : null)
    }
    setIsModified(true)
    show(`Database entry ${idToDelete} deleted`, 'success')
  }

  const updateFieldValue = (keyName: string, value: any) => {
    if (!selectedId) return
    setDataList((prev) =>
      prev.map((item) => {
        if (item.id === selectedId) {
          const itemData = item.data !== undefined && item.data !== null ? item.data : item
          const clonedData = {
            ...itemData,
            [keyName]: value
          }
          if (item.data !== undefined && item.data !== null) {
            return { ...item, data: clonedData }
          } else {
            return { ...item, ...clonedData }
          }
        }
        return item
      })
    )
    setIsModified(true)
  }

  return (
    <div className="module animate-slide-in-right flex flex-col h-full min-h-0">
      <div className="flex justify-between items-center pb-3 border-b border-slate-900/40">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="text-indigo-400" size={24} />
            <span>Game Data Editor</span>
          </h2>
          <p className="module-desc">Edit configuration keys visually, as an interactive tree, tabular grid, or raw Monaco</p>
        </div>
        <div className="flex gap-2 items-center">
          {dataList.length > 0 && (
            <>
              <button className="btn btn-secondary flex items-center gap-1.5 text-xs" onClick={() => handleExport('json')}>
                <Download size={13} />
                <span>Export JSON</span>
              </button>
              <button className="btn btn-secondary flex items-center gap-1.5 text-xs" onClick={() => handleExport('bin')}>
                <Download size={13} />
                <span>Export BIN</span>
              </button>
              <button className="btn btn-primary flex items-center gap-1.5 text-xs" onClick={saveAll} disabled={!isModified || loading}>
                <Save size={13} />
                <span>{projectRoot ? 'Save to Project' : 'Download File'}</span>
              </button>
            </>
          )}
          <button
            className="btn btn-secondary flex items-center gap-1.5 text-xs"
            onClick={() => window.electronAPI.openToolWindow('game-data-editor')}
            title="Detach into Standalone Window"
          >
            <ExternalLink size={13} />
            <span>Detach</span>
          </button>
        </div>
      </div>

      {dataList.length === 0 ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 mt-8 cursor-pointer transition-all ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
              : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-900/40'
          }`}
        >
          <Upload size={48} className={`mb-4 transition-transform ${isDragActive ? 'scale-110 text-indigo-400' : 'text-slate-500'}`} />
          <p className="text-slate-300 font-semibold text-lg">Drag & drop gamedata.json or gamedata.bin here</p>
          <p className="text-sm text-slate-500 mt-1">or click to choose file from your system</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.bin"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 space-y-3 mt-3">
          {/* Tabs header */}
          <div className="flex justify-between items-center bg-slate-950/20 p-2 rounded-xl border border-slate-900/50">
            <div className="flex gap-2">
              <button
                className={`btn btn-secondary flex items-center gap-1.5 text-xs py-1.5 ${viewMode === 'visual' ? 'bg-slate-700 text-white' : ''}`}
                onClick={() => setViewMode('visual')}
              >
                <Settings size={13} />
                <span>Visual Editor</span>
              </button>
              <button
                className={`btn btn-secondary flex items-center gap-1.5 text-xs py-1.5 ${viewMode === 'interactive' ? 'bg-slate-700 text-white' : ''}`}
                onClick={() => setViewMode('interactive')}
              >
                <Eye size={13} />
                <span>Interactive Tree</span>
              </button>
              <button
                className={`btn btn-secondary flex items-center gap-1.5 text-xs py-1.5 ${viewMode === 'table' ? 'bg-slate-700 text-white' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <TableIcon size={13} />
                <span>Table View</span>
              </button>
              <button
                className={`btn btn-secondary flex items-center gap-1.5 text-xs py-1.5 ${viewMode === 'raw' ? 'bg-slate-700 text-white' : ''}`}
                onClick={() => setViewMode('raw')}
              >
                <FileText size={13} />
                <span>Raw Monaco</span>
              </button>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Loaded: <span className="text-indigo-400 font-semibold">{fileName}</span>
            </div>
          </div>

          <div className="card flex-1 min-h-0 flex flex-col">
            {viewMode === 'visual' && (
              <div className="p-2 h-full flex flex-col overflow-hidden">
                {currentItem ? (
                  <div className="grid grid-cols-3 gap-4 h-full min-h-0 flex-1">
                    {/* Left: Entries list */}
                    <div className="col-span-1 border-r border-slate-900/40 pr-3 flex flex-col h-full min-h-0">
                      <div className="flex flex-col h-full min-h-0">
                        <div className="flex justify-between items-center mb-2 pl-2">
                          <span className="text-xs font-extrabold uppercase text-slate-400">Entries ({dataList.length})</span>
                          <button
                            onClick={addDatabaseEntry}
                            className="btn btn-secondary py-1 px-2 text-[10px] flex items-center gap-1 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20"
                          >
                            <Plus size={11} />
                            <span>New Entry</span>
                          </button>
                        </div>
                        <input
                          className="search-input w-full text-xs py-1.5 mb-2"
                          type="text"
                          placeholder="Search entries..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="space-y-1 overflow-y-auto flex-1">
                          {dataList
                            .filter(entry => entry.id.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((entry) => (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  setSelectedId(entry.id)
                                }}
                                className={`p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex justify-between items-center group ${
                                  selectedId === entry.id
                                    ? 'bg-indigo-600/20 border-l-4 border-indigo-500 text-indigo-300'
                                    : 'bg-slate-950/10 border-l-4 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                              >
                                <span className="truncate">{entry.id}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteDatabaseEntry(entry.id)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-350 p-0.5 rounded transition-all ml-2"
                                  title="Delete Entry"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Key-Value editor for the selected entry */}
                    <div className="col-span-2 flex flex-col h-full min-h-0">
                      <div className="flex flex-col h-full min-h-0">
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-xs font-extrabold uppercase text-slate-200">
                            Properties of <span className="text-indigo-400 font-mono">{selectedId}</span>
                          </div>
                          <button
                            onClick={addFieldKey}
                            className="btn btn-secondary py-1 px-2 text-[10px] flex items-center gap-1"
                          >
                            <Plus size={11} />
                            <span>Add Property</span>
                          </button>
                        </div>

                        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                          {Object.keys(getItemData(currentItem)).map((key) => {
                            if (key === 'id') return null // Handle id separately or read-only
                            const val = getItemData(currentItem)[key]
                            return (
                              <div key={key} className="p-3 bg-slate-900/30 border border-slate-900/60 rounded-xl relative group flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  {/* Editable Key Name */}
                                  <input
                                    type="text"
                                    className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 font-semibold text-xs text-indigo-300 w-1/3 py-0.5 px-1 rounded transition-all focus:outline-none"
                                    defaultValue={key}
                                    onBlur={(e) => {
                                      if (e.target.value.trim() && e.target.value !== key) {
                                        updateFieldKey(key, e.target.value.trim())
                                      } else {
                                        e.target.value = key
                                      }
                                    }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-950/40 px-1.5 py-0.5 rounded">
                                      {Array.isArray(val) ? 'Array' : typeof val}
                                    </span>
                                    <button
                                      onClick={() => deleteFieldKey(key)}
                                      className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                                      title="Delete Property"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Interactive Value Fields */}
                                <div className="w-full">
                                  <InteractiveValueEditor
                                    value={val}
                                    onChange={(newVal) => updateFieldValue(key, newVal)}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-500 text-xs">Select a database entry to edit</div>
                )}
              </div>
            )}

            {viewMode === 'interactive' && (
              <div className="p-4 space-y-2 flex-1 overflow-y-auto min-h-0">
                <input
                  type="text"
                  placeholder="Filter values..."
                  className="search-input w-full max-w-sm mb-3 text-xs py-1.5"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="font-mono text-xs">
                  <JsonTreeNode node={dataList} label="Root" filter={searchQuery} />
                </div>
              </div>
            )}

            {viewMode === 'table' && (
              <div className="p-4 flex-1 min-h-0 h-full overflow-hidden">
                <JsonTable data={dataList} onChange={(newData) => { setDataList(newData); setIsModified(true); }} />
              </div>
            )}

            {viewMode === 'raw' && (
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={JSON.stringify(dataList, null, 2)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    wordWrap: 'on'
                  }}
                  onChange={(val) => {
                    try {
                      if (val) {
                        const parsed = JSON.parse(val)
                        setDataList(parsed)
                        setIsModified(true)
                      }
                    } catch {}
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper to check if a node or its children contain the filter string
function doesNodeMatchFilter(node: any, label: string, filterStr: string): boolean {
  if (!filterStr) return true
  const lowerFilter = filterStr.toLowerCase()
  if (label.toLowerCase().includes(lowerFilter)) return true
  
  const isObject = typeof node === 'object' && node !== null
  if (!isObject) {
    return String(node).toLowerCase().includes(lowerFilter)
  }
  
  const keys = Object.keys(node)
  return keys.some(k => doesNodeMatchFilter(node[k], k, filterStr))
}

// Reusable JSON Tree Node component
function JsonTreeNode({ node, label, filter }: { node: any; label: string; filter: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const isObject = typeof node === 'object' && node !== null

  const matches = doesNodeMatchFilter(node, label, filter)
  if (filter && !matches) {
    return null
  }

  // Force open state if filtering is active and children match
  const expanded = filter ? true : isOpen

  if (!isObject) {
    return (
      <div className="pl-6 py-0.5 flex gap-2">
        <span className="text-slate-400 font-bold">{label}:</span>
        <span className={typeof node === 'number' ? 'text-amber-400' : typeof node === 'boolean' ? 'text-pink-400' : 'text-emerald-400'}>
          {typeof node === 'string' ? `"${node}"` : String(node)}
        </span>
      </div>
    )
  }

  const keys = Object.keys(node)
  return (
    <div className="pl-4">
      <div
        className="flex items-center gap-1 cursor-pointer py-0.5 hover:bg-slate-800 rounded px-1 w-max"
        onClick={() => setIsOpen(!isOpen)}
      >
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className="text-indigo-300 font-extrabold">{label}</span>
        <span className="text-xs text-slate-500 font-normal">
          {Array.isArray(node) ? `[${keys.length} items]` : `{${keys.length} keys}`}
        </span>
      </div>
      {expanded && (
        <div className="border-l border-slate-800 ml-2 mt-1 space-y-0.5">
          {keys.map((k) => (
            <JsonTreeNode key={k} node={node[k]} label={k} filter={filter} />
          ))}
        </div>
      )}
    </div>
  )
}

// Reusable JSON Table View component
function JsonTable({ data, onChange }: { data: any[]; onChange: (newData: any[]) => void }) {
  if (data.length === 0) return <div className="text-center text-slate-500 text-sm">Empty data</div>

  const getRowFields = (row: any) => {
    const rowData = row.data !== undefined && row.data !== null ? row.data : row
    return { id: row.id, ...rowData }
  }

  const headers = Array.from(
    new Set(data.flatMap((item) => Object.keys(getRowFields(item))))
  ).filter(h => h !== 'id')

  const allHeaders = ['id', ...headers]

  const handleCellChange = (rowIndex: number, headerKey: string, newValue: string) => {
    let parsedVal: any = newValue

    const originalRow = data[rowIndex]
    const rowData = originalRow.data !== undefined && originalRow.data !== null ? originalRow.data : originalRow
    const originalVal = rowData[headerKey]

    if (Array.isArray(originalVal)) {
      const delimiter = newValue.includes('\n') ? '\n' : ','
      parsedVal = newValue.split(delimiter).map(s => {
        const trimmed = s.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try { return JSON.parse(trimmed) } catch {}
        }
        if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed)
        if (trimmed === 'true') return true
        if (trimmed === 'false') return false
        return trimmed
      }).filter(s => s !== '')
    } else if (newValue.trim() === 'true') parsedVal = true
    else if (newValue.trim() === 'false') parsedVal = false
    else if (!isNaN(Number(newValue)) && newValue.trim() !== '') parsedVal = Number(newValue)
    else if (newValue.startsWith('{') || newValue.startsWith('[')) {
      try { parsedVal = JSON.parse(newValue) } catch {}
    }

    const updated = data.map((row, idx) => {
      if (idx === rowIndex) {
        if (headerKey === 'id') {
          return { ...row, id: newValue }
        }
        const hasDataProp = row.data !== undefined && row.data !== null
        if (hasDataProp) {
          return {
            ...row,
            data: {
              ...row.data,
              [headerKey]: parsedVal
            }
          }
        } else {
          return {
            ...row,
            [headerKey]: parsedVal
          }
        }
      }
      return row
    })
    onChange(updated)
  }

  return (
    <div className="overflow-auto h-full w-full">
      <table className="min-w-full text-slate-350 border-collapse">
        <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-extrabold sticky top-0 z-10">
          <tr>
            {allHeaders.map((h) => (
              <th key={h} className="px-3 py-2 text-left border border-slate-800 bg-slate-900">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-xs bg-slate-950/20">
          {data.map((row, rowIndex) => {
            const fields = getRowFields(row)
            return (
              <tr key={rowIndex} className="hover:bg-slate-900/40 transition-colors">
                {allHeaders.map((h) => {
                  const val = fields[h]
                  const isId = h === 'id'
                  
                  const isSimpleArray = Array.isArray(val) && val.every(item => typeof item !== 'object')
                  const displayVal = isSimpleArray
                    ? val.join(', ')
                    : Array.isArray(val)
                      ? val.map(item => typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)).join('\n')
                      : typeof val === 'object' && val !== null
                        ? JSON.stringify(val)
                        : String(val ?? '')
                  
                  return (
                    <td key={h} className="p-0.5 border border-slate-800 font-mono text-[10px] min-w-[160px] align-top">
                      <textarea
                        disabled={isId}
                        rows={displayVal.includes('\n') ? Math.min(6, displayVal.split('\n').length) : 1}
                        className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-slate-800 focus:border-indigo-500 rounded focus:bg-slate-950/40 text-slate-300 focus:outline-none transition-all resize-y font-mono text-[10px] leading-relaxed block"
                        value={displayVal}
                        onChange={(e) => handleCellChange(rowIndex, h, e.target.value)}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InteractiveValueEditor({
  value,
  onChange
}: {
  value: any
  onChange: (newVal: any) => void
}) {
  const isArray = Array.isArray(value)
  const isObject = typeof value === 'object' && value !== null

  if (isArray) {
    return (
      <div className="space-y-2.5 border-l-2 border-slate-800 pl-3 py-1">
        {value.map((item, index) => (
          <div key={index} className="flex gap-2 items-start bg-slate-900/10 p-2 rounded-lg border border-slate-900/50">
            <div className="flex-1">
              <InteractiveValueEditor
                value={item}
                onChange={(newVal) => {
                  const cloned = [...value]
                  cloned[index] = newVal
                  onChange(cloned)
                }}
              />
            </div>
            <button
              onClick={() => {
                const cloned = value.filter((_, i) => i !== index)
                onChange(cloned)
              }}
              className="text-red-450 hover:text-red-400 p-1 transition-colors"
              title="Delete Element"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            let template: any = ""
            if (value.length > 0) {
              const first = value[0]
              if (Array.isArray(first)) template = []
              else if (typeof first === 'object' && first !== null) {
                template = {}
                Object.keys(first).forEach(k => {
                  template[k] = typeof first[k] === 'number' ? 0 : typeof first[k] === 'boolean' ? false : ""
                })
              } else if (typeof first === 'number') template = 0
              else if (typeof first === 'boolean') template = false
            }
            onChange([...value, template])
          }}
          className="btn btn-secondary py-1 px-2 text-[10px] flex items-center justify-center gap-1 border-dashed border-slate-800 bg-transparent hover:bg-slate-900 w-full"
        >
          <Plus size={10} />
          <span>Add Element</span>
        </button>
      </div>
    )
  }

  if (isObject) {
    return (
      <div className="grid grid-cols-2 gap-2 border-l-2 border-indigo-950 pl-3 py-1 bg-slate-950/20 rounded-lg p-2">
        {Object.keys(value).map((k) => (
          <div key={k} className="flex flex-col gap-0.5 col-span-1">
            <span className="text-[10px] text-slate-400 font-mono font-medium">{k}</span>
            <InteractiveValueEditor
              value={value[k]}
              onChange={(newVal) => {
                onChange({ ...value, [k]: newVal })
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <select
        className="form-input text-xs py-0.5 px-1 bg-slate-900 border-slate-800"
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        className="form-input text-xs py-0.5 px-1 bg-slate-900 border-slate-850"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    )
  }

  return (
    <input
      type="text"
      className="form-input text-xs py-0.5 px-1 bg-slate-900 border-slate-850 font-mono"
      value={typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
      onChange={(e) => {
        let valStr = e.target.value
        if (valStr.startsWith('{') || valStr.startsWith('[')) {
          try {
            onChange(JSON.parse(valStr))
            return
          } catch {}
        }
        onChange(valStr)
      }}
    />
  )
}
