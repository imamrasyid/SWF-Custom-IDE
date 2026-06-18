import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { FolderOpen, History, Terminal, Sparkles, PlusCircle, BookOpen, Github, Search, Code2, FileCode, Package } from 'lucide-react'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'

type Template = {
  id: string
  name: string
  description: string
}

export default function WelcomePage() {
  const recentFiles = useAppStore((s) => s.recentFiles)
  const { show } = useToast()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [projectName, setProjectName] = useState('MyNinjaSageMod')
  const [projectPath, setProjectPath] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('basic')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const result = await window.electronAPI.getTemplates()
      setTemplates(result)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  const handleOpenSwf = async () => {
    const path = await window.electronAPI.openSwf()
    if (path) {
      useAppStore.getState().loadSwf(path)
    }
  }

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openDirectory()
    if (path) {
      const detected = await window.electronAPI.detectProject(path)
      if (detected) {
        useAppStore.getState().setProject(detected.root)
        show('Project workspace loaded successfully', 'success')
      } else {
        useAppStore.getState().setProject(path)
        show('Folder opened as raw workspace', 'info')
      }
    }
  }

  const handleSelectTemplateFolder = async () => {
    const path = await window.electronAPI.openDirectory()
    if (path) {
      setProjectPath(path)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim() || !projectPath.trim()) {
      show('Please specify both project name and folder location.', 'warning')
      return
    }

    show('Creating project template...', 'info')
    const success = await window.electronAPI.createProjectTemplate(projectPath, projectName.trim(), selectedTemplate)
    if (success) {
      show('Project created successfully!', 'success')
      setIsTemplateModalOpen(false)
      useAppStore.getState().setProject(projectPath)
      
      // Try to load Main.as if it exists
      const mainPath = `${projectPath}/src/Main.as`
      show('Opening Main.as inside your new workspace', 'info')
      // Set active tab to explorer
      useAppStore.getState().setActivityTab('explorer')
    } else {
      show('Failed to create project template.', 'error')
    }
  }

  const filteredRecents = recentFiles.filter(file => 
    file.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full w-full bg-[#060911] text-slate-100 font-sans select-none overflow-hidden relative">
      
      {/* Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="flex-1 flex max-w-5xl mx-auto items-stretch my-auto h-[560px] border border-slate-900/60 rounded-2xl bg-[#080d16]/80 backdrop-blur-xl shadow-2xl overflow-hidden z-10 self-center">
        
        {/* Left Column - Branding & Primary Actions */}
        <div className="w-[45%] border-r border-slate-900/60 p-10 flex flex-col justify-between bg-[#090f1a]/40">
          
          {/* Logo & Title */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                <Terminal size={24} className="text-indigo-400" />
                <Sparkles size={12} className="absolute -top-0.5 -right-0.5 text-pink-500" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white uppercase">NinjaSage</h1>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Modding Toolkit</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mt-2">
              Sebuah ekosistem modular terpadu untuk mengekstrak, menyunting, merakit, dan mensimulasikan berkas SWF Flash game secara instan.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-3 my-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start</h3>
            
            <Button variant="primary" size="lg" className="w-full justify-start text-left" onClick={handleOpenSwf}>
              <FolderOpen size={16} />
              <div className="flex flex-col items-start leading-tight">
                <span>Open SWF File</span>
                <span className="text-[9px] text-indigo-200 font-normal">Extract and modify compiled SWFs</span>
              </div>
            </Button>

            <Button variant="secondary" size="lg" className="w-full justify-start text-left" onClick={handleOpenFolder}>
              <FolderOpen size={16} className="text-indigo-400" />
              <div className="flex flex-col items-start leading-tight">
                <span>Open Project Folder</span>
                <span className="text-[9px] text-slate-500 font-normal">Load existing mod workspace</span>
              </div>
            </Button>

            <Button variant="secondary" size="lg" className="w-full justify-start text-left" onClick={() => setIsTemplateModalOpen(true)}>
              <PlusCircle size={16} className="text-pink-500" />
              <div className="flex flex-col items-start leading-tight">
                <span>New Project from Template</span>
                <span className="text-[9px] text-slate-500 font-normal">Create blank ActionScript 3 project</span>
              </div>
            </Button>
          </div>

          {/* Footer Branding Links */}
          <div className="flex items-center gap-4 text-slate-500 text-[10px] font-semibold border-t border-slate-900/60 pt-4">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-300 transition-colors">
              <Github size={12} />
              <span>GitHub</span>
            </a>
            <span className="text-slate-800">|</span>
            <div className="flex items-center gap-1">
              <BookOpen size={12} />
              <span>Docs</span>
            </div>
            <span className="text-slate-800">|</span>
            <Badge variant="info">v1.0.0 Stable</Badge>
          </div>

        </div>

        {/* Right Column - Recents & Templates */}
        <div className="flex-1 p-10 flex flex-col justify-between">
          
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Bar Header */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-900/60 pb-4 shrink-0">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Recently Opened</h2>
              <div className="relative w-48 flex items-center">
                <Search size={11} className="absolute left-2.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Filter recents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-slate-950/40 border border-slate-900 focus:border-indigo-500/30 rounded-md text-[10px] text-slate-300 placeholder-slate-650 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Recents list */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 custom-scrollbar gap-2 flex flex-col">
              {filteredRecents.length > 0 ? (
                filteredRecents.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => useAppStore.getState().loadSwf(file)}
                    className="flex flex-col gap-0.5 p-3 rounded-lg border border-slate-900 bg-slate-950/25 hover:bg-indigo-950/10 hover:border-indigo-500/20 cursor-pointer transition-all duration-150 group"
                  >
                    <span className="text-xs font-bold text-slate-350 group-hover:text-white truncate">
                      {file.split(/[\/\\]/).pop()}
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono truncate max-w-md">
                      {file}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-600 italic text-xs">
                  <History size={24} className="text-slate-700 mb-2" />
                  <span>No recent files found</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tools shortcuts */}
          <div className="border-t border-slate-900/60 pt-6 mt-6 shrink-0 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Utility Panel</h4>
              <p className="text-[9px] text-slate-600">Run standalone tools outside project context</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.electronAPI.openToolWindow('game-data-editor')}>
              <Code2 size={12} className="text-indigo-400" />
              <span>Standalone Data Editor</span>
            </Button>
          </div>

        </div>

      </div>

      {/* New Project Template Creation Modal */}
      {isTemplateModalOpen && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateProject}
            className="w-full max-w-lg bg-[#090e18] border border-slate-900 rounded-xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <PlusCircle size={16} className="text-pink-500" />
                Create New Project
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Select a template and configure your new ActionScript 3 project.
              </p>
            </div>

            {/* Template Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedTemplate === tmpl.id
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {tmpl.id === 'basic' && <FileCode size={14} />}
                      {tmpl.id === 'ninjasage' && <Package size={14} />}
                      {tmpl.id === 'empty' && <Terminal size={14} />}
                      <span className="text-xs font-bold">{tmpl.name}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">{tmpl.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Project Name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="MyNinjaSageMod"
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Project Location</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="Choose empty directory"
                  required
                />
                <Button type="button" onClick={handleSelectTemplateFolder} className="shrink-0">
                  Browse...
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-900/60 pt-4 mt-2">
              <Button type="button" variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create & Open
              </Button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
