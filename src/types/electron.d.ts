/// <reference types="vite/client" />

interface ElectronAPI {
  openSwf: () => Promise<string | null>
  saveSwf: () => Promise<string | null>
  openAsFile: () => Promise<string | null>
  onSwfOpened: (callback: (path: string) => void) => void
  onMenuAction: (callback: (action: string) => void) => void
  invokeFfdec: (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>
  detectProject: (dir?: string) => Promise<{ root: string; hasClient: boolean; hasDatabases: boolean; hasJsonData: boolean; hasSwfpanels: boolean } | null>
  detectProjectFromSwf: (swfPath: string) => Promise<{ root: string; hasClient: boolean; hasDatabases: boolean; hasJsonData: boolean; hasSwfpanels: boolean } | null>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  openToolWindow: (toolName: string) => Promise<void>
  onFfdecProgress: (callback: (text: string) => void) => () => void
  readScript: (swfPath: string, className: string) => Promise<string>
  writeScript: (swfPath: string, className: string, codeContent: string) => Promise<boolean>
  addClass: (swfPath: string, className: string) => Promise<boolean>
  deleteClass: (swfPath: string, className: string) => Promise<boolean>
  renameClass: (swfPath: string, oldClassName: string, newClassName: string) => Promise<boolean>
  preCacheScripts: (swfPath: string) => Promise<boolean>
  searchScripts: (swfPath: string, query: string, options?: { caseSensitive?: boolean, wholeWord?: boolean, useRegex?: boolean }) => Promise<{ className: string; lineNumber: number; lineContent: string }[]>
  openDirectory: () => Promise<string | null>
  readDatabase: (projectRoot: string, dbName: string) => Promise<any>
  writeDatabase: (projectRoot: string, dbName: string, data: any) => Promise<boolean>
  extractSound: (swfPath: string, soundId: number) => Promise<string | null>
  extractImage: (swfPath: string, tagId: number, category: string) => Promise<string | null>
  replaceTag: (swfPath: string, tagId: number, filePath: string) => Promise<boolean>
  readDataUrl: (filePath: string) => Promise<string | null>
  deleteTag: (swfPath: string, tagId: number) => Promise<boolean>
  exportAsset: (swfPath: string, tagId: number, category: string) => Promise<boolean>
  decompressZlib: (buffer: ArrayBuffer) => Promise<string | null>
  compressZlib: (text: string) => Promise<Uint8Array | null>
  getMetadataCache: (swfPath: string) => Promise<any>
  saveMetadataCache: (swfPath: string, data: any) => Promise<boolean>
  preExtractAssets: (swfPath: string) => Promise<boolean>
  compileSwf: (projectRoot: string, sdkPath: string, mainFile: string, outputFile: string, additionalArgs: string[]) => Promise<{ success: boolean; log: string }>
  readWorkspaceSettings: (projectRoot: string) => Promise<any>
  writeWorkspaceSettings: (projectRoot: string, settings: any) => Promise<boolean>
  saveSpriteSheet: (destDir: string, baseName: string, pngBase64: string, jsonContent: string) => Promise<boolean>
  amfGetServices: (projectRoot: string) => Promise<{ migrated: any; audit: any }>
  amfScaffold: (projectRoot: string, options: { domain: string; action: string; wraps?: string; legacyKey?: string; client?: string; phase?: number; apply: boolean }) => Promise<{ code: number; stdout: string; stderr: string }>
  runAdl: (swfPath: string, sdkPath?: string) => Promise<{ success: boolean; log: string }>
  killAdl: () => Promise<boolean>
  onSimulatorLog: (callback: (text: string) => void) => () => void
  createTerminal: (id: string, cwd?: string) => Promise<boolean>
  writeTerminal: (id: string, text: string) => Promise<boolean>
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<boolean>
  killTerminal: (id: string) => Promise<boolean>
  onTerminalData: (callback: (id: string, text: string) => void) => () => void
  onTerminalExit: (callback: (id: string, exitCode: number) => void) => () => void
  checkForUpdates: () => Promise<boolean>
  downloadUpdate: () => Promise<boolean>
  installUpdate: () => Promise<void>
  getCurrentVersion: () => Promise<string>
  onUpdateStatus: (callback: (data: { status: string }) => void) => () => void
  onUpdateAvailable: (callback: (data: any) => void) => () => void
  onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void
  onUpdateError: (callback: (data: { message: string }) => void) => () => void
  getSystemInfo: () => Promise<{
    appVersion: string
    electronVersion: string
    chromeVersion: string
    nodeVersion: string
    v8Version: string
    osPlatform: string
    osRelease: string
    osType: string
    osArch: string
    cpuCores: number
    totalMemory: string
    flexSdkPath: string
    ffdecPath: string
  }>
  fsReadTree: (dirPath: string, maxDepth?: number) => Promise<{ id: string; name: string; path: string; isDirectory: boolean; children?: any[]; size?: number; mtime?: number }[]>
  fsReadDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean }[]>
  fsReadFile: (filePath: string) => Promise<string | null>
  fsWriteFile: (filePath: string, content: string) => Promise<boolean>
  fsCreateDir: (dirPath: string) => Promise<boolean>
  fsDeletePath: (targetPath: string) => Promise<boolean>
  fsRename: (oldPath: string, newPath: string) => Promise<boolean>
  fsStat: (targetPath: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number; mtime: number } | null>
  fsExists: (targetPath: string) => Promise<boolean>
  fsIcon: (name: string) => Promise<string>
  fsOpenInExplorer: (targetPath: string) => Promise<boolean>
  fsWatch: (watchId: string, dirPath: string) => Promise<boolean>
  fsUnwatch: (watchId: string) => Promise<boolean>
  fsCopy: (source: string, dest: string) => Promise<boolean>
  dbGetState: (key: string) => Promise<string | null>
  dbSetState: (key: string, value: string) => Promise<boolean>
  dbGetAllState: () => Promise<Record<string, string>>
  dbDeleteState: (key: string) => Promise<boolean>
  watcherStart: (watchId: string, dirPath: string, patterns?: string[]) => Promise<boolean>
  watcherStop: (watchId: string) => Promise<boolean>
  watcherStopAll: () => Promise<boolean>
  onWatcherChange: (callback: (watchId: string, type: string, path: string) => void) => () => void
  getTemplates: () => Promise<{ id: string; name: string; description: string }[]>
  createProjectTemplate: (projectRoot: string, projectName: string, templateId?: string) => Promise<boolean>
  getToolbarActions: (projectRoot?: string) => Promise<{ id: string; label: string; icon: string; type: string; payload: string; position?: number }[]>
  saveToolbarActions: (actions: { id: string; label: string; icon: string; type: string; payload: string; position?: number }[], projectRoot?: string) => Promise<boolean>
  getBuildHooks: (projectRoot: string) => Promise<{ preBuild: string[]; postBuild: string[] }>
  saveBuildHooks: (projectRoot: string, hooks: { preBuild: string[]; postBuild: string[] }) => Promise<boolean>
  runBuildHook: (projectRoot: string, command: string) => Promise<{ success: boolean; output: string }>
  exportConfig: (projectRoot?: string) => Promise<boolean>
  importConfig: (projectRoot?: string) => Promise<boolean>
  debugStart: (swfPath: string) => Promise<{ success: boolean; error?: string }>
  debugStop: () => Promise<{ success: boolean }>
  debugPause: () => Promise<{ success: boolean }>
  debugContinue: () => Promise<{ success: boolean }>
  debugStepOver: () => Promise<{ success: boolean }>
  debugStepIn: () => Promise<{ success: boolean }>
  debugStepOut: () => Promise<{ success: boolean }>
  debugSetBreakpoints: (file: string, breakpoints: { line: number; condition?: string }[]) => Promise<{ breakpoints: { id: number; verified: boolean; line: number }[] }>
  debugEvaluate: (expression: string) => Promise<{ result: string; type: string }>
  debugStackTrace: () => Promise<{ frames: any[] }>
  debugVariables: (reference: number) => Promise<{ variables: any[] }>
  onDebugEvent: (callback: (event: any) => void) => () => void
  onDebugResponse: (callback: (response: any) => void) => () => void
  readAsconfig: (projectRoot: string) => Promise<any>
  panelsList: (dirPath: string) => Promise<{ name: string; path: string; size: number; mtime: number }[]>
  panelsWriteCode: (filePath: string, content: string) => Promise<boolean>
  panelsReadCode: (filePath: string) => Promise<string>
  gitStatus: (dir: string) => Promise<{ branch: string; staged: string[]; modified: string[]; deleted: string[]; untracked: string[]; ahead: number; behind: number; isRepo: boolean }>
  gitLog: (dir: string) => Promise<{ hash: string; message: string; author: string; date: string }[]>
  gitDiff: (dir: string, file: string) => Promise<string>
  gitDiffStaged: (dir: string) => Promise<string>
  gitAdd: (dir: string, files: string[]) => Promise<boolean>
  gitUnstage: (dir: string, files: string[]) => Promise<boolean>
  gitCommit: (dir: string, message: string) => Promise<boolean>
  gitBranches: (dir: string) => Promise<{ name: string; current: boolean }[]>
  gitCheckout: (dir: string, branch: string) => Promise<boolean>
  gitCreateBranch: (dir: string, name: string) => Promise<boolean>
  gitPush: (dir: string) => Promise<{ success: boolean; message: string }>
  gitPull: (dir: string) => Promise<{ success: boolean; message: string }>

  // License
  getLicenseStatus: () => Promise<{
    isValid: boolean
    isActivated: boolean
    licenseId: string | null
    licenseType: string | null
    features: string[]
    activatedAt: number | null
    error: string | null
  }>
  activateLicense: (licenseKey: string) => Promise<{ success: boolean; error: string | null; licenseId?: string }>
  deactivateLicense: () => Promise<boolean>
  getLicenseInfo: () => Promise<{
    licenseId: string | null
    type: string | null
    features: string[]
    activatedAt: number | null
    deviceBound: boolean
  }>
  isLicenseActivated: () => Promise<boolean>
  getDeviceFingerprint: () => Promise<string>
  getDeviceId: () => Promise<string>
}

interface Window {
  electronAPI: ElectronAPI
}
