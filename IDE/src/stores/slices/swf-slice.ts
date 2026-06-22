import type { StateCreator } from 'zustand'
import type { AppState, ModuleName } from '../app-store'
import type { SwfData, SwfHeader, As3Class } from '../../../shared/types'
import { parseDumpSwf } from '../../lib/ffdec-parser'
import { safeJsonParse } from '../../lib/utils'

export interface WorkspaceInfo {
  id: string
  name: string
  swfPath: string
  projectRoot: string | null
  isActive: boolean
}

export interface SwfSlice {
  swfPath: string | null
  swfData: SwfData | null
  isLoading: boolean
  loadingStatus: string
  loadingLogs: string[]
  recentFiles: string[]
  projectRoot: string | null
  isWayangIDEProject: boolean
  assetSwfPaths: string[]
  assetSwfsData: Record<string, SwfData>
  activeAssetSourcePath: string | null
  workspaces: WorkspaceInfo[]

  setSwf: (path: string, data: SwfData) => void
  loadSwf: (path: string, force?: boolean) => Promise<void>
  closeSwf: () => void
  loadAssetSwf: (path: string) => Promise<void>
  setActiveAssetSourcePath: (path: string | null) => void
  setProject: (root: string | null) => void
  addWorkspace: (swfPath: string, name: string, projectRoot: string | null) => void
  removeWorkspace: (id: string) => void
  switchWorkspace: (id: string) => void
}

function normalizeSwfPath(p: string): string {
  if (!p) return p
  let normalized = p.replace(/\\/g, '/')
  normalized = normalized.replace(/\/+/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1)
  }
  return normalized
}

function safeNum(val: string | null, fallback: number): number {
  const n = val ? Number(val) : NaN
  return Number.isFinite(n) ? n : fallback
}

function extractValue(lines: string[], key: string): string | null {
  for (const line of lines) {
    const match = line.match(new RegExp(`${key}:?\\s*(.+)`, 'i'))
    if (match) return match[1].trim()
  }
  return null
}

function parseHeader(stdout: string): SwfHeader {
  try {
    const lines = stdout.split('\n').map((l) => l.trim())
    return {
      version: safeNum(extractValue(lines, 'Version'), 0),
      fileSize: safeNum(extractValue(lines, 'FileSize'), 0),
      frameRate: safeNum(extractValue(lines, 'FrameRate'), 0),
      frameCount: safeNum(extractValue(lines, 'FrameCount'), 0),
      width: safeNum(extractValue(lines, 'Width'), 0),
      height: safeNum(extractValue(lines, 'Height'), 0),
      backgroundColor: extractValue(lines, 'BackgroundColor') || '#000000',
      compressed: lines.some((l) => l.toLowerCase().includes('compressed')),
      compressionType: 'zlib' as const
    }
  } catch (err) {
    console.error('Failed to parse SWF header:', err)
    return {
      version: 0,
      fileSize: 0,
      frameRate: 0,
      frameCount: 0,
      width: 0,
      height: 0,
      backgroundColor: '#000000',
      compressed: false,
      compressionType: 'none'
    }
  }
}

function parseClassList(stdout: string): As3Class[] {
  try {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false
        if (line.toLowerCase().includes('usage:')) return false
        if (line.toLowerCase().includes('syntax:')) return false
        if (line.toLowerCase().includes('error')) return false
        if (line.toLowerCase().includes('help')) return false
        if (line.includes('--') || line.includes('ffdec')) return false
        return true
      })
      .map((line) => {
        const withoutIndex = line.replace(/\s+\d+$/, '')
        if (!/^[a-zA-Z0-9._$]+$/.test(withoutIndex)) return null
        
        const dot = withoutIndex.lastIndexOf('.')
        return {
          fullName: withoutIndex,
          packageName: dot > 0 ? withoutIndex.slice(0, dot) : '',
          name: dot > 0 ? withoutIndex.slice(dot + 1) : withoutIndex
        }
      })
      .filter((c): c is As3Class => c !== null)
  } catch (err) {
    console.error('Failed to parse class list:', err)
    return []
  }
}

export const createSwfSlice: StateCreator<AppState, [], [], SwfSlice> = (set, get) => ({
  swfPath: null,
  swfData: null,
  isLoading: false,
  loadingStatus: '',
  loadingLogs: [],
  recentFiles: safeJsonParse('wayangide:recentFiles', []),
  projectRoot: null,
  isWayangIDEProject: false,
  assetSwfPaths: [],
  assetSwfsData: {},
  activeAssetSourcePath: null,
  workspaces: safeJsonParse('wayangide:workspaces', []),

  setSwf: (path, data) =>
    set((state) => {
      const recent = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10)
      localStorage.setItem('wayangide:recentFiles', JSON.stringify(recent))
      return { swfPath: path, swfData: data, activeModule: 'explorer' as ModuleName, recentFiles: recent }
    }),

  setActiveAssetSourcePath: (path) => set({ activeAssetSourcePath: path }),

  setProject: (root) =>
    set({ projectRoot: root, isWayangIDEProject: root !== null }),

  loadSwf: async (rawPath, force = false) => {
    const path = normalizeSwfPath(rawPath)
    const state = get()
    if (state.swfPath === path && !force) return

    set({ isLoading: true, loadingStatus: 'Mendeteksi cache metadata...', loadingLogs: [] })

    try {
      // 1. Coba baca cache terlebih dahulu
      const cache = await window.electronAPI.getMetadataCache(path)
      if (cache && !force) {
        set({ loadingStatus: 'Memuat dari cache metadata...' })
        const project = await window.electronAPI.detectProjectFromSwf(path)
        
        const data: SwfData = {
          path,
          header: cache.header,
          classes: cache.classes,
          tags: cache.tags || [],
          assets: []
        }

        const recent = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10)
        localStorage.setItem('wayangide:recentFiles', JSON.stringify(recent))
        set({
          swfPath: path,
          swfData: data,
          activeModule: 'explorer' as ModuleName,
          recentFiles: recent,
          projectRoot: project?.root ?? null,
          isWayangIDEProject: project !== null,
          isLoading: false
        })
        get().addNotification(`Loaded SWF from cache: ${path.split(/[\\/]/).pop()}`, 'info')

        window.electronAPI.preCacheScripts(path).catch((err) => {
          console.warn('Pre-cache scripts failed:', err)
        })
        window.electronAPI.preExtractAssets(path).catch((err) => {
          console.warn('Pre-extract assets failed:', err)
        })

        if (project?.root) {
          // Read asconfig.json if available to sync compiler settings
          window.electronAPI.readAsconfig(project.root).then((asconfig: any) => {
            if (asconfig && asconfig.compilerOptions) {
              const opts = asconfig.compilerOptions
              if (asconfig.files && asconfig.files.length > 0) {
                localStorage.setItem('setting:compiler.defaultMain', asconfig.files[0])
              }
              if (opts.output) {
                localStorage.setItem('setting:compiler.defaultOutput', opts.output)
              }
              if (opts['static-link-runtime-shared-libraries'] !== undefined) {
                localStorage.setItem('setting:compiler.additionalArgs', `-static-link-runtime-shared-libraries=${opts['static-link-runtime-shared-libraries']}`)
              }
            }
          }).catch(console.error)

          window.electronAPI.readWorkspaceSettings(project.root).then((workspaceSettings: any) => {
            const assetPathsConfig = workspaceSettings?.['workspace.assetSwfPaths'] || localStorage.getItem('setting:workspace.assetSwfPaths') || 'client/assets/assets.swf'
            const paths = assetPathsConfig.split(',').map((p: string) => p.trim()).filter(Boolean)
            
            for (const p of paths) {
              const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
              const assetPath = normalizeSwfPath(isAbsolute ? p : `${project.root}/${p}`)
              get().loadAssetSwf(assetPath).catch(console.error)
            }
          }).catch(() => {
            const assetPathsConfig = localStorage.getItem('setting:workspace.assetSwfPaths') || 'client/assets/assets.swf'
            const paths = assetPathsConfig.split(',').map((p: string) => p.trim()).filter(Boolean)
            for (const p of paths) {
              const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
              const assetPath = normalizeSwfPath(isAbsolute ? p : `${project.root}/${p}`)
              get().loadAssetSwf(assetPath).catch(console.error)
            }
          })
        }
        return
      }

      // 2. Cache Miss
      set({ loadingStatus: 'Membaca daftar kelas & metadata SWF...' })
      const [as3Result, headerResult, project] = await Promise.all([
        window.electronAPI.invokeFfdec('-dumpAS3', [path]),
        window.electronAPI.invokeFfdec('-header', [path]),
        window.electronAPI.detectProjectFromSwf(path)
      ])

      if (as3Result.code !== 0) {
        console.error('-dumpAS3 failed:', as3Result.stderr || as3Result.stdout)
      }
      const classes = parseClassList(as3Result.stdout)
      const header = parseHeader(headerResult.stdout)

      const initialData: SwfData = {
        path,
        header,
        classes,
        tags: [],
        assets: []
      }

      const recent = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10)
      localStorage.setItem('wayangide:recentFiles', JSON.stringify(recent))
      set({
        swfPath: path,
        swfData: initialData,
        activeModule: 'explorer' as ModuleName,
        recentFiles: recent,
        projectRoot: project?.root ?? null,
        isWayangIDEProject: project !== null,
        isLoading: false
      })
      get().addNotification(`Loaded SWF archive: ${path.split(/[\\/]/).pop()}`, 'success')

      await window.electronAPI.saveMetadataCache(path, { header, classes, tags: [] })

      window.electronAPI.preCacheScripts(path).catch((err) => {
        console.warn('Pre-cache scripts failed:', err)
      })
      window.electronAPI.preExtractAssets(path).catch((err) => {
        console.warn('Pre-extract assets failed:', err)
      })

      // 4. Lazy Load Tags
      window.electronAPI.invokeFfdec('-dumpSWF', [path]).then(async (dumpResult) => {
        if (dumpResult.code === 0) {
          try {
            const tags = parseDumpSwf(dumpResult.stdout)
            set((currentState) => {
              if (currentState.swfPath === path && currentState.swfData) {
                const updatedSwfData = { ...currentState.swfData, tags }
                window.electronAPI.saveMetadataCache(path, {
                  header: updatedSwfData.header,
                  classes: updatedSwfData.classes,
                  tags
                }).catch(console.error)
                return { swfData: updatedSwfData }
              }
              return {}
            })
          } catch (err) {
            console.error('Error parsing dump SWF tags:', err)
          }
        } else {
          console.error('-dumpSWF failed in background:', dumpResult.stderr || dumpResult.stdout)
        }
      }).catch(console.error)

      if (project?.root) {
        // Read asconfig.json if available to sync compiler settings
        window.electronAPI.readAsconfig(project.root).then((asconfig: any) => {
          if (asconfig && asconfig.compilerOptions) {
            const opts = asconfig.compilerOptions
            if (asconfig.files && asconfig.files.length > 0) {
              localStorage.setItem('setting:compiler.defaultMain', asconfig.files[0])
            }
            if (opts.output) {
              localStorage.setItem('setting:compiler.defaultOutput', opts.output)
            }
            if (opts['static-link-runtime-shared-libraries'] !== undefined) {
              localStorage.setItem('setting:compiler.additionalArgs', `-static-link-runtime-shared-libraries=${opts['static-link-runtime-shared-libraries']}`)
            }
          }
        }).catch(console.error)

        window.electronAPI.readWorkspaceSettings(project.root).then((workspaceSettings: any) => {
          const assetPathsConfig = workspaceSettings?.['workspace.assetSwfPaths'] || localStorage.getItem('setting:workspace.assetSwfPaths') || 'client/assets/assets.swf'
          const paths = assetPathsConfig.split(',').map((p: string) => p.trim()).filter(Boolean)
          
          for (const p of paths) {
            const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
            const assetPath = normalizeSwfPath(isAbsolute ? p : `${project.root}/${p}`)
            get().loadAssetSwf(assetPath).catch(console.error)
          }
        }).catch(() => {
          const assetPathsConfig = localStorage.getItem('setting:workspace.assetSwfPaths') || 'client/assets/assets.swf'
          const paths = assetPathsConfig.split(',').map((p: string) => p.trim()).filter(Boolean)
          for (const p of paths) {
            const isAbsolute = p.startsWith('/') || p.includes(':/') || p.includes(':\\')
            const assetPath = normalizeSwfPath(isAbsolute ? p : `${project.root}/${p}`)
            get().loadAssetSwf(assetPath).catch(console.error)
          }
        })
      }

    } catch (err: any) {
      console.error('Error loading SWF:', err)
      const msg = err?.message || String(err)
      get().addNotification(`Failed to load SWF: ${msg}`, 'error')
      set({ isLoading: false })
    }
  },

  closeSwf: () =>
    set({
      swfPath: null,
      swfData: null,
      activeModule: null,
      editingFile: null,
      editingFileRight: null,
      openTabs: [],
      rightOpenTabs: [],
      compilerOutput: [],
      localHistory: {},
      assetSwfPaths: [],
      assetSwfsData: {},
      activeAssetSourcePath: null
    }),

  loadAssetSwf: async (rawPath: string) => {
    const path = normalizeSwfPath(rawPath)
    const mainSwfPath = get().swfPath ? normalizeSwfPath(get().swfPath!) : null
    if (path === mainSwfPath) return

    try {
      const cache = await window.electronAPI.getMetadataCache(path)
      if (cache) {
        const data: SwfData = {
          path,
          header: cache.header,
          classes: cache.classes,
          tags: cache.tags || [],
          assets: []
        }
        set((state) => {
          const normalizedPaths = [...state.assetSwfPaths, path].map(normalizeSwfPath)
          const uniquePaths = [...new Set(normalizedPaths)]
          return {
            assetSwfPaths: uniquePaths,
            assetSwfsData: { ...state.assetSwfsData, [path]: data },
            activeAssetSourcePath: state.activeAssetSourcePath || state.swfPath || path
          }
        })
        return
      }

      const [headerResult, dumpResult] = await Promise.all([
        window.electronAPI.invokeFfdec('-header', [path]),
        window.electronAPI.invokeFfdec('-dumpSWF', [path])
      ])

      if (headerResult.code !== 0 || dumpResult.code !== 0) {
        console.error('Failed to load asset SWF via FFDEC:', headerResult.stderr || dumpResult.stderr)
        return
      }

      const header = parseHeader(headerResult.stdout)
      const tags = parseDumpSwf(dumpResult.stdout)

      const data: SwfData = {
        path,
        header,
        classes: [],
        tags,
        assets: []
      }

      set((state) => {
        const normalizedPaths = [...state.assetSwfPaths, path].map(normalizeSwfPath)
        const uniquePaths = [...new Set(normalizedPaths)]
        return {
          assetSwfPaths: uniquePaths,
          assetSwfsData: { ...state.assetSwfsData, [path]: data },
          activeAssetSourcePath: state.activeAssetSourcePath || state.swfPath || path
        }
      })

      await window.electronAPI.saveMetadataCache(path, { header, classes: [], tags })
    } catch (err: any) {
      console.error('Error loading asset SWF:', err)
      // Don't spam user for asset SWF load failures - they're background operations
    }
  },

  addWorkspace: (swfPath, name, projectRoot) => {
    const id = `ws-${Date.now()}`
    const workspace: WorkspaceInfo = {
      id,
      name,
      swfPath,
      projectRoot,
      isActive: true
    }
    set((state) => {
      const workspaces = [...state.workspaces.map(w => ({ ...w, isActive: false })), workspace]
      localStorage.setItem('wayangide:workspaces', JSON.stringify(workspaces))
      return { workspaces }
    })
  },

  removeWorkspace: (id) => {
    set((state) => {
      const workspaces = state.workspaces.filter(w => w.id !== id)
      localStorage.setItem('wayangide:workspaces', JSON.stringify(workspaces))
      return { workspaces }
    })
  },

  switchWorkspace: (id) => {
    const state = get()
    const activeWs = state.workspaces.find(w => w.id === id)
    if (!activeWs) return

    const workspaces = state.workspaces.map(w => ({
      ...w,
      isActive: w.id === id
    }))
    localStorage.setItem('wayangide:workspaces', JSON.stringify(workspaces))
    set({ workspaces, projectRoot: activeWs.projectRoot })

    if (activeWs.swfPath && activeWs.swfPath !== state.swfPath) {
      get().loadSwf(activeWs.swfPath)
    }
  }
})
