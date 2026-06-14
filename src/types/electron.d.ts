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
  destroyTerminal: (id: string) => Promise<boolean>
  onTerminalData: (callback: (id: string, text: string) => void) => () => void
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
}

interface Window {
  electronAPI: ElectronAPI
}
