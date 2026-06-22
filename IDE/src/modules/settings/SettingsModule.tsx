import { useState, useEffect } from 'react'
import { Settings, Search, Sliders, Monitor, Code, Cpu, Save, RotateCcw, FileCode, AlertCircle, AlertTriangle, Keyboard, Edit3, Download, Upload, Info, RefreshCw, ShieldCheck, ShieldOff, Loader2, Key } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useToast } from '../../hooks/useToast'
import { useAppStore } from '../../stores/app-store'

type SettingKey = 
  | 'editor.fontSize'
  | 'editor.fontFamily'
  | 'editor.tabSize'
  | 'editor.minimap.enabled'
  | 'editor.stickyScroll.enabled'
  | 'editor.cursorBlinking'
  | 'editor.renderLineHighlight'
  | 'editor.autoSave'
  | 'editor.formatOnSave'
  | 'compiler.sdkPath'
  | 'compiler.defaultMain'
  | 'compiler.defaultOutput'
  | 'compiler.additionalArgs'
  | 'decompiler.parallelExports'
  | 'decompiler.cacheMetadata'
  | 'workspace.assetSwfPaths'
  | 'appearance.theme'

const DEFAULT_SETTINGS: Record<SettingKey, any> = {
  'editor.fontSize': 14,
  'editor.fontFamily': "'Fira Code', Consolas, Monaco, monospace",
  'editor.tabSize': 4,
  'editor.minimap.enabled': true,
  'editor.stickyScroll.enabled': true,
  'editor.cursorBlinking': 'smooth',
  'editor.renderLineHighlight': 'all',
  'editor.autoSave': false,
  'editor.formatOnSave': false,
  'compiler.sdkPath': '',
  'compiler.defaultMain': './src/Main.as',
  'compiler.defaultOutput': './build/script.swf',
  'compiler.additionalArgs': '-static-link-runtime-shared-libraries=true',
  'decompiler.parallelExports': 4,
  'decompiler.cacheMetadata': true,
  'workspace.assetSwfPaths': 'client/assets/assets.swf',
  'appearance.theme': 'slate'
}

export default function SettingsModule() {
  const { show } = useToast()
  const projectRoot = useAppStore((s) => s.projectRoot)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'common' | 'editor' | 'compiler' | 'decompiler'>('common')
  const [activeTab, setActiveTab] = useState<'user' | 'workspace' | 'keybindings' | 'license'>('user')
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseActivating, setLicenseActivating] = useState(false)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  const licenseStatus = useAppStore((s) => s.licenseStatus)
  const licenseInfo = useAppStore((s) => s.licenseInfo)
  const activateLicenseKey = useAppStore((s) => s.activateLicenseKey)
  const deactivateLicenseKey = useAppStore((s) => s.deactivateLicenseKey)
  const refreshLicenseStatus = useAppStore((s) => s.refreshLicenseStatus)
  const [isJsonMode, setIsJsonMode] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  const [recordingActionId, setRecordingActionId] = useState<string | null>(null)

  // Listen to keydown when recording keybinding
  useEffect(() => {
    if (!recordingActionId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      if (e.key === 'Escape') {
        setRecordingActionId(null)
        return
      }

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')

      const key = e.key.toLowerCase()
      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        if (key === ' ') {
          parts.push('space')
        } else {
          parts.push(key)
        }
        
        const newKeybinding = parts.join('+')
        localStorage.setItem(`keybinding:${recordingActionId}`, newKeybinding)
        show(`Shortcut updated to: ${newKeybinding.toUpperCase()}`, 'success')
        setRecordingActionId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingActionId])

  const renderKeybindingsEditor = () => {
    const DEFAULT_KEYBINDINGS = [
      { id: 'saveFile', label: 'Save Active File', defaultKey: 'ctrl+s' },
      { id: 'find', label: 'Find in File', defaultKey: 'ctrl+f' },
      { id: 'replace', label: 'Replace in File', defaultKey: 'ctrl+h' },
      { id: 'gotoLine', label: 'Go to Line...', defaultKey: 'ctrl+g' },
      { id: 'toggleSidebar', label: 'Toggle Sidebar Panel', defaultKey: 'ctrl+b' },
      { id: 'toggleTerminal', label: 'Toggle Bottom Terminal Panel', defaultKey: 'ctrl+`' },
      { id: 'commandPaletteFile', label: 'Go to File / Search Files', defaultKey: 'ctrl+p' },
      { id: 'commandPaletteCommand', label: 'Open Command Palette', defaultKey: 'ctrl+shift+p' },
      { id: 'formatDocument', label: 'Format ActionScript Document', defaultKey: 'shift+alt+f' }
    ]

    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none bg-[#080b13] animate-in fade-in duration-200">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-900 pb-3">
          <Keyboard size={18} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-200">Keyboard Shortcuts Customizer</h3>
        </div>

        <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-950/20 backdrop-blur-xl">
          <div className="grid grid-cols-3 bg-slate-950/60 px-4 py-2 border-b border-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div>Command Action</div>
            <div>Key Combination</div>
            <div className="text-right">Source / Action</div>
          </div>
          <div className="divide-y divide-slate-900/60">
            {DEFAULT_KEYBINDINGS.map((kb) => {
              const currentVal = localStorage.getItem(`keybinding:${kb.id}`) || kb.defaultKey
              const isRecording = recordingActionId === kb.id
              return (
                <div key={kb.id} className="grid grid-cols-3 px-4 py-3 items-center text-xs text-slate-350 hover:bg-slate-900/10">
                  <div className="font-medium text-slate-200">{kb.label}</div>
                  <div className="flex items-center gap-1">
                    {isRecording ? (
                      <span className="text-[10px] text-indigo-400 font-semibold animate-pulse bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
                        Press key combination... (Esc to cancel)
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 font-mono">
                        {currentVal.split('+').map((key, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-900/80 border border-slate-800 rounded text-[10px] text-slate-400 font-bold uppercase shadow-sm">
                            {key}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => setRecordingActionId(kb.id)}
                      className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={10} />
                      <span>{isRecording ? 'Recording' : 'Change'}</span>
                    </button>
                    {localStorage.getItem(`keybinding:${kb.id}`) && (
                      <button
                        onClick={() => {
                          localStorage.removeItem(`keybinding:${kb.id}`)
                          show(`Reset ${kb.label} to default`, 'info')
                          // Force update
                          setRecordingActionId(null)
                        }}
                        className="text-[10px] text-slate-650 hover:text-slate-450 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // State to hold settings currently being edited
  const [settings, setSettings] = useState<Record<SettingKey, any>>({ ...DEFAULT_SETTINGS })
  
  // Track workspace specific settings (read from disk)
  const [workspaceSettings, setWorkspaceSettings] = useState<Record<string, any>>({})

  // Helper to load User settings from localStorage
  const loadUserSettings = (): Record<SettingKey, any> => {
    return {
      'editor.fontSize': Number(localStorage.getItem('setting:editor.fontSize') || '14'),
      'editor.fontFamily': localStorage.getItem('setting:editor.fontFamily') || "'Fira Code', Consolas, Monaco, monospace",
      'editor.tabSize': Number(localStorage.getItem('setting:editor.tabSize') || '4'),
      'editor.minimap.enabled': localStorage.getItem('setting:editor.minimap.enabled') !== 'false',
      'editor.stickyScroll.enabled': localStorage.getItem('setting:editor.stickyScroll.enabled') !== 'false',
      'editor.cursorBlinking': localStorage.getItem('setting:editor.cursorBlinking') || 'smooth',
      'editor.renderLineHighlight': localStorage.getItem('setting:editor.renderLineHighlight') || 'all',
      'editor.autoSave': localStorage.getItem('setting:editor.autoSave') === 'true',
      'editor.formatOnSave': localStorage.getItem('setting:editor.formatOnSave') === 'true',
      'compiler.sdkPath': localStorage.getItem('setting:compiler.sdkPath') || localStorage.getItem('swf-builder:sdkPath') || '',
      'compiler.defaultMain': localStorage.getItem('setting:compiler.defaultMain') || localStorage.getItem('swf-builder:mainFile') || './src/Main.as',
      'compiler.defaultOutput': localStorage.getItem('setting:compiler.defaultOutput') || localStorage.getItem('swf-builder:outputPath') || './build/script.swf',
      'compiler.additionalArgs': localStorage.getItem('setting:compiler.additionalArgs') || localStorage.getItem('swf-builder:additionalArgs') || '-static-link-runtime-shared-libraries=true',
      'decompiler.parallelExports': Number(localStorage.getItem('setting:decompiler.parallelExports') || '4'),
      'decompiler.cacheMetadata': localStorage.getItem('setting:decompiler.cacheMetadata') !== 'false',
      'workspace.assetSwfPaths': localStorage.getItem('setting:workspace.assetSwfPaths') || 'client/assets/assets.swf',
      'appearance.theme': localStorage.getItem('setting:appearance.theme') || 'slate'
    }
  }

  // Load Settings on Tab switch or Project change
  useEffect(() => {
    const fetchSettings = async () => {
      if (activeTab === 'user') {
        setSettings(loadUserSettings())
      } else {
        // Workspace settings mode
        if (projectRoot) {
          try {
            const diskSettings = await window.electronAPI.readWorkspaceSettings(projectRoot)
            if (diskSettings && typeof diskSettings === 'object') {
              setWorkspaceSettings(diskSettings)
              // Fill with fallbacks from User settings for missing keys
              const userDefaults = loadUserSettings()
              const merged = { ...userDefaults, ...diskSettings }
              setSettings(merged)
            } else {
              setWorkspaceSettings({})
              // Fallback to User settings as initial template for Workspace
              setSettings(loadUserSettings())
            }
          } catch (err) {
            console.error('Failed to load workspace settings:', err)
            show('Failed to read workspace settings from file.', 'error')
          }
        }
      }
    }

    fetchSettings()
  }, [activeTab, projectRoot])

  // Sync JSON string content when switching to JSON mode
  useEffect(() => {
    if (isJsonMode) {
      if (activeTab === 'user') {
        setJsonContent(JSON.stringify(settings, null, 2))
      } else {
        // Show ONLY the explicitly configured workspace keys in JSON mode, like VS Code does!
        setJsonContent(JSON.stringify(workspaceSettings, null, 2))
      }
    }
  }, [isJsonMode, settings, activeTab, workspaceSettings])

  const updateSetting = (key: SettingKey, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    if (activeTab === 'workspace') {
      setWorkspaceSettings(prev => ({ ...prev, [key]: value }))
    }
  }

  const resetSetting = (key: SettingKey) => {
    if (activeTab === 'user') {
      updateSetting(key, DEFAULT_SETTINGS[key])
    } else {
      // For workspace, reset means deleting the key from workspace config (so it inherits from User)
      const updatedWorkspace = { ...workspaceSettings }
      delete updatedWorkspace[key]
      setWorkspaceSettings(updatedWorkspace)
      
      // Inherit from user settings
      const userSettings = loadUserSettings()
      updateSetting(key, userSettings[key])
    }
    show(`Reset ${key} configuration.`, 'info')
  }

  const handleSave = async (customSettings = settings) => {
    if (activeTab === 'user') {
      // Save all User settings to localStorage
      Object.entries(customSettings).forEach(([key, value]) => {
        localStorage.setItem(`setting:${key}`, String(value))
        
        // Sync with swf-builder settings
        if (key === 'compiler.sdkPath') localStorage.setItem('swf-builder:sdkPath', String(value))
        if (key === 'compiler.defaultMain') localStorage.setItem('swf-builder:mainFile', String(value))
        if (key === 'compiler.defaultOutput') localStorage.setItem('swf-builder:outputPath', String(value))
        if (key === 'compiler.additionalArgs') localStorage.setItem('swf-builder:additionalArgs', String(value))
      })
      show('User configurations applied globally!', 'success')
    } else {
      // Save Workspace settings to file (.wayangide/settings.json)
      if (!projectRoot) return
      try {
        const success = await window.electronAPI.writeWorkspaceSettings(projectRoot, workspaceSettings)
        if (success) {
          // If we edited compilation settings, sync them with swf-builder runtime storage as well
          Object.entries(workspaceSettings).forEach(([key, value]) => {
            if (key === 'compiler.sdkPath') localStorage.setItem('swf-builder:sdkPath', String(value))
            if (key === 'compiler.defaultMain') localStorage.setItem('swf-builder:mainFile', String(value))
            if (key === 'compiler.defaultOutput') localStorage.setItem('swf-builder:outputPath', String(value))
            if (key === 'compiler.additionalArgs') localStorage.setItem('swf-builder:additionalArgs', String(value))
          })
          show('Workspace configurations written to .wayangide/settings.json!', 'success')
        } else {
          show('Failed to save Workspace settings.', 'error')
        }
      } catch (err: any) {
        show(`Error saving workspace settings: ${err.message || err}`, 'error')
      }
    }
  }

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonContent)
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON must be an object')
      }

      if (activeTab === 'user') {
        const validated: Record<string, any> = {}
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
          if (key in parsed) {
            let val = parsed[key]
            if (typeof DEFAULT_SETTINGS[key as SettingKey] === 'number') val = Number(val)
            else if (typeof DEFAULT_SETTINGS[key as SettingKey] === 'boolean') val = Boolean(val)
            validated[key] = val
          } else {
            validated[key] = settings[key as SettingKey]
          }
        })
        setSettings(validated as Record<SettingKey, any>)
        handleSave(validated)
      } else {
        // Workspace JSON saving
        setWorkspaceSettings(parsed)
        // Merge with User settings for live GUI view
        const userDefaults = loadUserSettings()
        const merged = { ...userDefaults, ...parsed }
        setSettings(merged)
        
        // Write to disk
        if (projectRoot) {
          window.electronAPI.writeWorkspaceSettings(projectRoot, parsed)
            .then(success => {
              if (success) show('Workspace settings.json applied successfully!', 'success')
              else show('Failed to save workspace settings.json', 'error')
            }).catch(e => show(`Error: ${e.message || e}`, 'error'))
        }
      }
      setIsJsonMode(false)
    } catch (err: any) {
      show(`Failed to parse JSON: ${err.message || err}`, 'error')
    }
  }

  const handleExport = async () => {
    try {
      const success = await window.electronAPI.exportConfig(activeTab === 'workspace' && projectRoot ? projectRoot : undefined)
      if (success) {
        show('Configuration exported successfully!', 'success')
      }
    } catch (err: any) {
      show(`Export failed: ${err.message || err}`, 'error')
    }
  }

  const handleImport = async () => {
    try {
      const success = await window.electronAPI.importConfig(activeTab === 'workspace' && projectRoot ? projectRoot : undefined)
      if (success) {
        show('Configuration imported successfully! Reloading...', 'success')
        // Reload current settings
        if (activeTab === 'user') {
          setSettings(loadUserSettings())
        } else if (projectRoot) {
          const diskSettings = await window.electronAPI.readWorkspaceSettings(projectRoot)
          if (diskSettings) {
            setWorkspaceSettings(diskSettings)
            const userDefaults = loadUserSettings()
            setSettings({ ...userDefaults, ...diskSettings })
          }
        }
      }
    } catch (err: any) {
      show(`Import failed: ${err.message || err}`, 'error')
    }
  }

  const allSettingsList = [
    {
      key: 'editor.fontSize' as SettingKey,
      category: 'editor',
      label: 'Editor: Font Size',
      desc: 'Controls the font size in pixels inside the ActionScript code editor.',
      type: 'number'
    },
    {
      key: 'editor.fontFamily' as SettingKey,
      category: 'editor',
      label: 'Editor: Font Family',
      desc: 'Controls the font family inside the code editor.',
      type: 'text'
    },
    {
      key: 'editor.tabSize' as SettingKey,
      category: 'editor',
      label: 'Editor: Tab Size',
      desc: 'The number of spaces equal to a tab in the editor.',
      type: 'number'
    },
    {
      key: 'editor.minimap.enabled' as SettingKey,
      category: 'editor',
      label: 'Editor: Minimap',
      desc: 'Controls whether the Monaco editor minimap is displayed.',
      type: 'boolean'
    },
    {
      key: 'editor.stickyScroll.enabled' as SettingKey,
      category: 'editor',
      label: 'Editor: Sticky Scroll',
      desc: 'Controls whether the Monaco editor sticky scroll is enabled, showing parent class/function scopes at the top.',
      type: 'boolean'
    },
    {
      key: 'editor.cursorBlinking' as SettingKey,
      category: 'editor',
      label: 'Editor: Cursor Blinking Style',
      desc: 'Controls the cursor blinking animation style.',
      type: 'select',
      options: ['smooth', 'blink', 'solid', 'expand']
    },
    {
      key: 'editor.renderLineHighlight' as SettingKey,
      category: 'editor',
      label: 'Editor: Line Highlight',
      desc: 'Controls how the editor should render the current line highlight.',
      type: 'select',
      options: ['all', 'none', 'gutter', 'line']
    },
    {
      key: 'editor.autoSave' as SettingKey,
      category: 'editor',
      label: 'Editor: Auto Save',
      desc: 'Automatically save files after a short delay when typing stops.',
      type: 'toggle'
    },
    {
      key: 'editor.formatOnSave' as SettingKey,
      category: 'editor',
      label: 'Editor: Format on Save',
      desc: 'Automatically format code when saving files.',
      type: 'toggle'
    },
    {
      key: 'compiler.sdkPath' as SettingKey,
      category: 'compiler',
      label: 'Compiler: Flex SDK Cwd / Path',
      desc: 'Direct path to the Flex SDK root containing bin/mxmlc.',
      type: 'text'
    },
    {
      key: 'compiler.defaultMain' as SettingKey,
      category: 'compiler',
      label: 'Compiler: Default Main ActionScript file',
      desc: 'Entry class file for building the SWF compilation.',
      type: 'text'
    },
    {
      key: 'compiler.defaultOutput' as SettingKey,
      category: 'compiler',
      label: 'Compiler: Default Compiled SWF destination',
      desc: 'Destination file path for compiler output.',
      type: 'text'
    },
    {
      key: 'compiler.additionalArgs' as SettingKey,
      category: 'compiler',
      label: 'Compiler: Additional Commandline Args',
      desc: 'Custom arguments passed to mxmlc during build.',
      type: 'text'
    },
    {
      key: 'decompiler.parallelExports' as SettingKey,
      category: 'decompiler',
      label: 'Decompiler: Max Parallel Exporters',
      desc: 'Specifies the maximum threads to utilize for asset deconstruction.',
      type: 'number'
    },
    {
      key: 'decompiler.cacheMetadata' as SettingKey,
      category: 'decompiler',
      label: 'Decompiler: Cache Metadata to RAM',
      desc: 'Saves parse cache to accelerate subsequent project file loads.',
      type: 'boolean'
    },
    {
      key: 'workspace.assetSwfPaths' as SettingKey,
      category: 'decompiler',
      label: 'Workspace: Asset SWF Paths',
      desc: 'Relative paths to secondary asset SWF files (comma-separated if multiple). Resolved against the project root.',
      type: 'text'
    },
    {
      key: 'appearance.theme' as SettingKey,
      category: 'common',
      label: 'Appearance: Visual Theme',
      desc: 'Customize the visual accent and background theme of the IDE workspace.',
      type: 'select',
      options: ['slate', 'purple', 'cyberpunk', 'obsidian']
    }
  ]

  const commonKeys = ['editor.fontSize', 'editor.tabSize', 'editor.autoSave', 'compiler.sdkPath', 'decompiler.parallelExports', 'appearance.theme']

  const filteredSettings = allSettingsList.filter(s => {
    if (searchQuery.trim() !== '') {
      return s.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
             s.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
             s.key.toLowerCase().includes(searchQuery.toLowerCase())
    }
    if (activeCategory === 'common') {
      return commonKeys.includes(s.key)
    }
    return s.category === activeCategory
  })

  // Calculate count for badges
  const getCategoryCount = (category: 'common' | 'editor' | 'compiler' | 'decompiler') => {
    if (category === 'common') {
      return commonKeys.length
    }
    return allSettingsList.filter(s => s.category === category).length
  }

  // Ctrl+S inside JSON Monaco Editor
  useEffect(() => {
    if (!isJsonMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveJson()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isJsonMode, jsonContent])

  return (
    <div className="module flex flex-col h-full overflow-hidden p-0 w-full bg-[#070a13]">
      {/* Header with search & Open JSON toggler */}
      <div className="px-6 py-4 border-b border-slate-900/60 bg-slate-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2 select-none">
            <Settings className="text-indigo-400 animate-spin-slow" size={20} />
            <span>Settings</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 select-none">Customize editor, compiler, and decompiler workspaces.</p>
        </div>

        <div className="flex items-center gap-3">
          {!isJsonMode && activeTab === 'user' && (
            <div className="relative w-full md:w-72">
              <Search size={13} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search Settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/40 border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition-all"
              />
            </div>
          )}

          {/* Export/Import Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-semibold cursor-pointer transition-all"
              title="Export Configuration"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-semibold cursor-pointer transition-all"
              title="Import Configuration"
            >
              <Upload size={13} />
              <span>Import</span>
            </button>
          </div>

          {!(activeTab === 'workspace' && !projectRoot) && (
            <button
              onClick={() => setIsJsonMode(!isJsonMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                isJsonMode 
                  ? 'bg-indigo-650/25 border-indigo-500/40 text-indigo-300 hover:bg-indigo-650/40' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={isJsonMode ? "Switch to Graphical GUI Settings" : "Open settings.json"}
            >
              <FileCode size={13} />
              <span>{isJsonMode ? "Open GUI Settings" : "Open Settings (JSON)"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Scope Tab Switcher */}
      {!isJsonMode && (
        <div className="flex border-b border-slate-900/65 bg-slate-950/10 px-6 shrink-0 select-none">
          <button
            onClick={() => setActiveTab('user')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-wider transition-all uppercase cursor-pointer ${
              activeTab === 'user' 
                ? 'text-indigo-400 border-indigo-500 font-bold' 
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            User Settings
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-wider transition-all uppercase cursor-pointer ${
              activeTab === 'workspace' 
                ? 'text-indigo-400 border-indigo-500 font-bold' 
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Workspace Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('keybindings')
              setIsJsonMode(false)
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-wider transition-all uppercase cursor-pointer ${
              activeTab === 'keybindings' 
                ? 'text-indigo-400 border-indigo-500 font-bold' 
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Keyboard Shortcuts
          </button>
          <button
            onClick={() => {
              setActiveTab('license')
              setIsJsonMode(false)
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-wider transition-all uppercase cursor-pointer ${
              activeTab === 'license' 
                ? 'text-indigo-400 border-indigo-500 font-bold' 
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            License
          </button>
        </div>
      )}

      {/* Main Settings Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {activeTab === 'keybindings' ? (
          renderKeybindingsEditor()
        ) : activeTab === 'license' ? (
          /* LICENSE MANAGEMENT TAB */
          <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none bg-[#080b13] animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-900 pb-3">
              <ShieldCheck size={18} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-200">License Management</h3>
            </div>

            {/* Current License Status */}
            <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Current Status</span>
                <button
                  onClick={refreshLicenseStatus}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw size={10} />
                  Refresh
                </button>
              </div>

              {licenseStatus.isValid ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">Licensed</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500">License ID:</span>
                      <span className="ml-2 text-slate-300 font-mono">{licenseInfo.licenseId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Type:</span>
                      <span className="ml-2 text-slate-300 capitalize">{licenseInfo.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Features:</span>
                      <span className="ml-2 text-slate-300">{licenseInfo.features.join(', ') || 'all'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Activated:</span>
                      <span className="ml-2 text-slate-300">
                        {licenseInfo.activatedAt ? new Date(licenseInfo.activatedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to deactivate this license? The app will restart.')) {
                        await deactivateLicenseKey()
                        window.location.reload()
                      }
                    }}
                    className="mt-2 px-3 py-1.5 text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-950/60 border border-rose-900/30 text-rose-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Deactivate License
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldOff size={14} className="text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">No License Activated</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter your license key below to activate WayangIDE.
                  </p>
                </div>
              )}
            </div>

            {/* Activate License */}
            {!licenseStatus.isValid && (
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Activate License</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => {
                      setLicenseKey(e.target.value.replace(/[^A-Za-z0-9._-]/g, ''))
                      setLicenseError(null)
                    }}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                    disabled={licenseActivating}
                    className="flex-1 px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                  <button
                    onClick={async () => {
                      if (!licenseKey.trim()) {
                        setLicenseError('Please enter a license key')
                        return
                      }
                      setLicenseActivating(true)
                      setLicenseError(null)
                      try {
                        const result = await activateLicenseKey(licenseKey.trim())
                        if (result.success) {
                          setLicenseKey('')
                          show('License activated successfully!', 'success')
                          refreshLicenseStatus()
                        } else {
                          setLicenseError(result.error || 'Activation failed')
                        }
                      } catch {
                        setLicenseError('An unexpected error occurred')
                      } finally {
                        setLicenseActivating(false)
                      }
                    }}
                    disabled={licenseActivating || !licenseKey.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {licenseActivating ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Activating...
                      </>
                    ) : (
                      'Activate'
                    )}
                  </button>
                </div>
                {licenseError && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-rose-950/30 border border-rose-900/30 rounded-lg">
                    <AlertCircle size={12} className="text-rose-400 shrink-0" />
                    <span className="text-[10px] text-rose-300">{licenseError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'workspace' && !projectRoot ? (
          /* NO WORKSPACE FOLDER WARNING */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none max-w-lg mx-auto gap-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-full text-rose-400">
              <AlertTriangle size={36} />
            </div>
            <h3 className="text-sm font-bold text-slate-200">No Workspace Root Folder Detected</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Workspace Settings let you override configurations specifically for the current project. 
              Please load a SWF file that is part of a WayangIDE project first to generate and modify 
              workspace settings inside <code className="bg-slate-950 px-1 py-0.5 rounded text-[10px] text-slate-300">.wayangide/settings.json</code>.
            </p>
          </div>
        ) : isJsonMode ? (
          /* JSON MONACO EDITOR MODE */
          <div className="flex-1 flex flex-col h-full bg-slate-950">
            <div className="px-6 py-2 bg-[#090d16] border-b border-slate-900/80 flex items-center justify-between select-none">
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-500" />
                <span>
                  {activeTab === 'user' 
                    ? "Editing global user settings.json. Saved to localStorage."
                    : `Editing project workspace settings.json. Saved to: ${projectRoot}/.wayangide/settings.json`}
                </span>
              </span>
              <button
                onClick={handleSaveJson}
                className="btn btn-primary flex items-center gap-1.5 py-1 px-3.5 text-[11px]"
              >
                <Save size={12} />
                <span>Apply JSON Configurations</span>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={jsonContent}
                onChange={(val) => setJsonContent(val || '')}
                options={{
                  fontSize: 13,
                  fontFamily: "'Fira Code', Consolas, monospace",
                  minimap: { enabled: false },
                  automaticLayout: true,
                  formatOnType: true,
                  tabSize: 2
                }}
              />
            </div>
          </div>
        ) : (
          /* GUI SETTINGS MODE */
          <>
            {/* Sidebar Left Categories */}
            {searchQuery.trim() === '' && (
              <div className="w-52 border-r border-slate-900/60 py-4 px-2.5 flex flex-col gap-1.5 shrink-0 select-none bg-slate-950/15">
                <button
                  onClick={() => setActiveCategory('common')}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                    activeCategory === 'common' ? 'bg-indigo-650/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sliders size={13} />
                    <span>Commonly Used</span>
                  </span>
                  <span className="text-[9px] bg-slate-900/80 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">
                    {getCategoryCount('common')}
                  </span>
                </button>
                <button
                  onClick={() => setActiveCategory('editor')}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                    activeCategory === 'editor' ? 'bg-indigo-650/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Code size={13} />
                    <span>Text Editor</span>
                  </span>
                  <span className="text-[9px] bg-slate-900/80 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">
                    {getCategoryCount('editor')}
                  </span>
                </button>
                <button
                  onClick={() => setActiveCategory('compiler')}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                    activeCategory === 'compiler' ? 'bg-indigo-650/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Cpu size={13} />
                    <span>Compiler</span>
                  </span>
                  <span className="text-[9px] bg-slate-900/80 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">
                    {getCategoryCount('compiler')}
                  </span>
                </button>
                <button
                  onClick={() => setActiveCategory('decompiler')}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                    activeCategory === 'decompiler' ? 'bg-indigo-650/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Monitor size={13} />
                    <span>Decompiler</span>
                  </span>
                  <span className="text-[9px] bg-slate-900/80 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">
                    {getCategoryCount('decompiler')}
                  </span>
                </button>
              </div>
            )}

            {/* Config Fields list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#060a11]/40">
              {filteredSettings.length > 0 ? (
                <div className="space-y-6 w-full max-w-full">
                  {filteredSettings.map((item) => {
                    const value = settings[item.key]
                    
                    // Determine if modified. 
                    // User mode: compare value to DEFAULT_SETTINGS.
                    // Workspace mode: check if key is defined inside workspaceSettings.
                    const isModified = activeTab === 'user'
                      ? String(value) !== String(DEFAULT_SETTINGS[item.key])
                      : item.key in workspaceSettings

                    return (
                      <div 
                        key={item.key} 
                        className={`relative flex flex-col gap-1.5 border-b border-slate-900/20 pb-5 pl-4 transition-all duration-300 ${
                          isModified ? 'border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">{item.label}</label>
                            <span className="text-[10px] text-slate-600 font-mono ml-2 select-all">{item.key}</span>
                          </div>
                          {isModified && (
                            <button
                              onClick={() => resetSetting(item.key)}
                              className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/25 transition-all cursor-pointer"
                              title={activeTab === 'user' ? "Reset Setting to Default" : "Delete key from Workspace (inherit from User)"}
                            >
                              <RotateCcw size={10} />
                              <span>{activeTab === 'user' ? "Modified (Reset)" : "Overridden (Clear)"}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal max-w-xl">{item.desc}</p>
                        
                        <div className="mt-2.5 max-w-md">
                          {item.type === 'text' && (
                            <input
                              type="text"
                              value={value as string}
                              onChange={(e) => updateSetting(item.key, e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-950/85 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60"
                            />
                          )}
                          
                          {item.type === 'number' && (
                            <input
                              type="number"
                              value={value as number}
                              onChange={(e) => updateSetting(item.key, Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-slate-950/85 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60"
                            />
                          )}

                          {item.type === 'boolean' && (
                            <label className="relative inline-flex items-center cursor-pointer mt-1">
                              <input
                                type="checkbox"
                                checked={value as boolean}
                                onChange={(e) => updateSetting(item.key, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-950/80 peer-focus:outline-none border border-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650 peer-checked:after:bg-indigo-300"></div>
                            </label>
                          )}

                          {item.type === 'select' && (
                            <select
                              value={value as string}
                              onChange={(e) => updateSetting(item.key, e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-950/85 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                            >
                              {item.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      onClick={() => handleSave()}
                      className="btn btn-primary flex items-center gap-1.5 px-4 py-2 cursor-pointer"
                    >
                      <Save size={13} />
                      <span>{activeTab === 'user' ? "Apply Configurations" : "Save Workspace Settings"}</span>
                    </button>
                  </div>

                  {/* About & Updates Section */}
                  {activeTab === 'user' && (
                    <div className="mt-8 border-t border-slate-900/60 pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Info size={15} className="text-indigo-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">About & Updates</h3>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs text-slate-400">WayangIDE</p>
                            <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                              Version {useAppStore.getState().currentVersion || '1.0.0'}
                            </p>
                          </div>
                          <button
                            onClick={() => useAppStore.getState().checkForUpdates()}
                            disabled={useAppStore.getState().updateStatus === 'checking'}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={11} className={useAppStore.getState().updateStatus === 'checking' ? 'animate-spin' : ''} />
                            Check for Updates
                          </button>
                        </div>
                        {useAppStore.getState().updateStatus === 'downloaded' && (
                          <div className="flex items-center justify-between mt-2 p-2 bg-emerald-950/30 border border-emerald-900/30 rounded-lg">
                            <span className="text-[11px] text-emerald-400">Update downloaded and ready to install</span>
                            <button
                              onClick={() => useAppStore.getState().installUpdate()}
                              className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                            >
                              Restart Now
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-600 text-xs select-none">
                  No matching settings found.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
