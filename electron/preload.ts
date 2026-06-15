import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openSwf: () => ipcRenderer.invoke('dialog:openSwf'),
  saveSwf: () => ipcRenderer.invoke('dialog:saveSwf'),
  openAsFile: () => ipcRenderer.invoke('dialog:openAsFile'),
  onSwfOpened: (callback: (path: string) => void) => {
    ipcRenderer.on('swf-opened', (_event, path) => callback(path))
  },
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action))
  },
  invokeFfdec: (command: string, args: string[]) => {
    return ipcRenderer.invoke('ffdec:run', command, args)
  },
  detectProject: (dir?: string) => {
    return ipcRenderer.invoke('project:detect', dir)
  },
  detectProjectFromSwf: (swfPath: string) => {
    return ipcRenderer.invoke('project:detectFromSwf', swfPath)
  },
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  openToolWindow: (toolName: string) => ipcRenderer.invoke('window:openTool', toolName),
  onFfdecProgress: (callback: (text: string) => void) => {
    const subscription = (_event: any, text: string) => callback(text)
    ipcRenderer.on('ffdec:progress', subscription)
    return () => {
      ipcRenderer.removeListener('ffdec:progress', subscription)
    }
  },
  readScript: (swfPath: string, className: string) => ipcRenderer.invoke('script:read', swfPath, className),
  writeScript: (swfPath: string, className: string, codeContent: string) => ipcRenderer.invoke('script:write', swfPath, className, codeContent),
  addClass: (swfPath: string, className: string) => ipcRenderer.invoke('script:addClass', swfPath, className),
  deleteClass: (swfPath: string, className: string) => ipcRenderer.invoke('script:deleteClass', swfPath, className),
  renameClass: (swfPath: string, oldClassName: string, newClassName: string) => ipcRenderer.invoke('script:renameClass', swfPath, oldClassName, newClassName),
  preCacheScripts: (swfPath: string) => ipcRenderer.invoke('script:preCache', swfPath),
  searchScripts: (swfPath: string, query: string, options?: { caseSensitive?: boolean, wholeWord?: boolean, useRegex?: boolean }) => ipcRenderer.invoke('script:search', swfPath, query, options),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDatabase: (projectRoot: string, dbName: string) => ipcRenderer.invoke('db:readJson', projectRoot, dbName),
  writeDatabase: (projectRoot: string, dbName: string, data: any) => ipcRenderer.invoke('db:writeJson', projectRoot, dbName, data),
  extractSound: (swfPath: string, soundId: number) => ipcRenderer.invoke('sound:extract', swfPath, soundId),
  extractImage: (swfPath: string, tagId: number, category: string) => ipcRenderer.invoke('image:extract', swfPath, tagId, category),
  replaceTag: (swfPath: string, tagId: number, filePath: string) => ipcRenderer.invoke('tag:replace', swfPath, tagId, filePath),
  readDataUrl: (filePath: string) => ipcRenderer.invoke('file:readDataUrl', filePath),
  deleteTag: (swfPath: string, tagId: number) => ipcRenderer.invoke('tag:delete', swfPath, tagId),
  exportAsset: (swfPath: string, tagId: number, category: string) => ipcRenderer.invoke('asset:export', swfPath, tagId, category),
  decompressZlib: (buffer: ArrayBuffer) => ipcRenderer.invoke('zlib:decompress', buffer),
  compressZlib: (text: string) => ipcRenderer.invoke('zlib:compress', text),
  getMetadataCache: (swfPath: string) => ipcRenderer.invoke('swf:getMetadataCache', swfPath),
  saveMetadataCache: (swfPath: string, data: any) => ipcRenderer.invoke('swf:saveMetadataCache', swfPath, data),
  preExtractAssets: (swfPath: string) => ipcRenderer.invoke('swf:preExtractAssets', swfPath),
  compileSwf: (projectRoot: string, sdkPath: string, mainFile: string, outputFile: string, additionalArgs: string[]) => {
    return ipcRenderer.invoke('swf:compile', projectRoot, sdkPath, mainFile, outputFile, additionalArgs)
  },
  readWorkspaceSettings: (projectRoot: string) => ipcRenderer.invoke('settings:readWorkspace', projectRoot),
  writeWorkspaceSettings: (projectRoot: string, settings: any) => ipcRenderer.invoke('settings:writeWorkspace', projectRoot, settings),
  saveSpriteSheet: (destDir: string, baseName: string, pngBase64: string, jsonContent: string) => ipcRenderer.invoke('spritesheet:save', destDir, baseName, pngBase64, jsonContent),
  amfGetServices: (projectRoot: string) => ipcRenderer.invoke('amf:getServices', projectRoot),
  amfScaffold: (projectRoot: string, options: any) => ipcRenderer.invoke('amf:scaffold', projectRoot, options),
  runAdl: (swfPath: string, sdkPath?: string) => ipcRenderer.invoke('simulator:runAdl', swfPath, sdkPath),
  killAdl: () => ipcRenderer.invoke('simulator:killAdl'),
  onSimulatorLog: (callback: (text: string) => void) => {
    const subscription = (_event: any, text: string) => callback(text)
    ipcRenderer.on('simulator:log', subscription)
    return () => {
      ipcRenderer.removeListener('simulator:log', subscription)
    }
  },
  createTerminal: (id: string, cwd?: string) => ipcRenderer.invoke('pty:create', id, cwd),
  writeTerminal: (id: string, text: string) => ipcRenderer.invoke('pty:write', id, text),
  resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', id, cols, rows),
  killTerminal: (id: string) => ipcRenderer.invoke('pty:kill', id),
  getTemplates: () => ipcRenderer.invoke('project:getTemplates'),
  createProjectTemplate: (projectRoot: string, projectName: string, templateId?: string) => ipcRenderer.invoke('project:createTemplate', projectRoot, projectName, templateId),
  getToolbarActions: (projectRoot?: string) => ipcRenderer.invoke('config:getToolbarActions', projectRoot),
  saveToolbarActions: (actions: any[], projectRoot?: string) => ipcRenderer.invoke('config:saveToolbarActions', actions, projectRoot),
  getBuildHooks: (projectRoot: string) => ipcRenderer.invoke('config:getBuildHooks', projectRoot),
  saveBuildHooks: (projectRoot: string, hooks: any) => ipcRenderer.invoke('config:saveBuildHooks', projectRoot, hooks),
  runBuildHook: (projectRoot: string, command: string) => ipcRenderer.invoke('config:runBuildHook', projectRoot, command),
  exportConfig: (projectRoot?: string) => ipcRenderer.invoke('config:export', projectRoot),
  importConfig: (projectRoot?: string) => ipcRenderer.invoke('config:import', projectRoot),
  debugStart: (swfPath: string) => ipcRenderer.invoke('debug:start', swfPath),
  debugStop: () => ipcRenderer.invoke('debug:stop'),
  debugPause: () => ipcRenderer.invoke('debug:pause'),
  debugContinue: () => ipcRenderer.invoke('debug:continue'),
  debugStepOver: () => ipcRenderer.invoke('debug:stepOver'),
  debugStepIn: () => ipcRenderer.invoke('debug:stepIn'),
  debugStepOut: () => ipcRenderer.invoke('debug:stepOut'),
  debugSetBreakpoints: (file: string, breakpoints: { line: number; condition?: string }[]) => ipcRenderer.invoke('debug:setBreakpoints', file, breakpoints),
  debugEvaluate: (expression: string) => ipcRenderer.invoke('debug:evaluate', expression),
  debugStackTrace: () => ipcRenderer.invoke('debug:stackTrace'),
  debugVariables: (reference: number) => ipcRenderer.invoke('debug:variables', reference),
  onDebugEvent: (callback: (event: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('debug:event', subscription)
    return () => {
      ipcRenderer.removeListener('debug:event', subscription)
    }
  },
  onDebugResponse: (callback: (response: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('debug:response', subscription)
    return () => {
      ipcRenderer.removeListener('debug:response', subscription)
    }
  },
  readAsconfig: (projectRoot: string) => ipcRenderer.invoke('project:readAsconfig', projectRoot),
  panelsList: (dirPath: string) => ipcRenderer.invoke('panels:list', dirPath),
  panelsWriteCode: (filePath: string, content: string) => ipcRenderer.invoke('panels:writeCode', filePath, content),
  panelsReadCode: (filePath: string) => ipcRenderer.invoke('panels:readCode', filePath),
  onTerminalData: (callback: (id: string, text: string) => void) => {
    const subscription = (_event: any, id: string, text: string) => callback(id, text)
    ipcRenderer.on('pty:data', subscription)
    return () => {
      ipcRenderer.removeListener('pty:data', subscription)
    }
  },
  onTerminalExit: (callback: (id: string, exitCode: number) => void) => {
    const subscription = (_event: any, id: string, exitCode: number) => callback(id, exitCode)
    ipcRenderer.on('pty:exit', subscription)
    return () => {
      ipcRenderer.removeListener('pty:exit', subscription)
    }
  },

  // Filesystem
  fsReadTree: (dirPath: string, maxDepth?: number) => ipcRenderer.invoke('fs:readTree', dirPath, maxDepth),
  fsReadDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  fsReadFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  fsWriteFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  fsCreateDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
  fsDeletePath: (targetPath: string) => ipcRenderer.invoke('fs:deletePath', targetPath),
  fsRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  fsStat: (targetPath: string) => ipcRenderer.invoke('fs:stat', targetPath),
  fsExists: (targetPath: string) => ipcRenderer.invoke('fs:exists', targetPath),
  fsIcon: (name: string) => ipcRenderer.invoke('fs:icon', name),
  fsOpenInExplorer: (targetPath: string) => ipcRenderer.invoke('fs:openInExplorer', targetPath),
  fsWatch: (watchId: string, dirPath: string) => ipcRenderer.invoke('fs:watch', watchId, dirPath),
  fsUnwatch: (watchId: string) => ipcRenderer.invoke('fs:unwatch', watchId),
  fsCopy: (source: string, dest: string) => ipcRenderer.invoke('fs:copy', source, dest),

  // Git
  gitStatus: (dir: string) => ipcRenderer.invoke('git:status', dir),
  gitLog: (dir: string) => ipcRenderer.invoke('git:log', dir),
  gitDiff: (dir: string, file: string) => ipcRenderer.invoke('git:diff', dir, file),
  gitDiffStaged: (dir: string) => ipcRenderer.invoke('git:diffStaged', dir),
  gitAdd: (dir: string, files: string[]) => ipcRenderer.invoke('git:add', dir, files),
  gitUnstage: (dir: string, files: string[]) => ipcRenderer.invoke('git:unstage', dir, files),
  gitCommit: (dir: string, message: string) => ipcRenderer.invoke('git:commit', dir, message),
  gitBranches: (dir: string) => ipcRenderer.invoke('git:branches', dir),
  gitCheckout: (dir: string, branch: string) => ipcRenderer.invoke('git:checkout', dir, branch),
  gitCreateBranch: (dir: string, name: string) => ipcRenderer.invoke('git:createBranch', dir, name),
  gitPush: (dir: string) => ipcRenderer.invoke('git:push', dir),
  gitPull: (dir: string) => ipcRenderer.invoke('git:pull', dir),

  // Database
  dbGetState: (key: string) => ipcRenderer.invoke('db:getState', key),
  dbSetState: (key: string, value: string) => ipcRenderer.invoke('db:setState', key, value),
  dbGetAllState: () => ipcRenderer.invoke('db:getAllState'),
  dbDeleteState: (key: string) => ipcRenderer.invoke('db:deleteState', key),

  // Watcher
  watcherStart: (watchId: string, dirPath: string, patterns?: string[]) => ipcRenderer.invoke('watcher:start', watchId, dirPath, patterns),
  watcherStop: (watchId: string) => ipcRenderer.invoke('watcher:stop', watchId),
  watcherStopAll: () => ipcRenderer.invoke('watcher:stopAll'),
  onWatcherChange: (callback: (watchId: string, type: string, path: string) => void) => {
    const subscription = (_event: any, watchId: string, type: string, path: string) => callback(watchId, type, path)
    ipcRenderer.on('watcher:change', subscription)
    return () => { ipcRenderer.removeListener('watcher:change', subscription) }
  },

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getCurrentVersion: () => ipcRenderer.invoke('updater:version'),
  onUpdateStatus: (callback: (data: { status: string }) => void) => {
    const subscription = (_event: any, data: { status: string }) => callback(data)
    ipcRenderer.on('update:status', subscription)
    return () => { ipcRenderer.removeListener('update:status', subscription) }
  },
  onUpdateAvailable: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update:available', subscription)
    return () => { ipcRenderer.removeListener('update:available', subscription) }
  },
  onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update:progress', subscription)
    return () => { ipcRenderer.removeListener('update:progress', subscription) }
  },
  onUpdateError: (callback: (data: { message: string }) => void) => {
    const subscription = (_event: any, data: { message: string }) => callback(data)
    ipcRenderer.on('update:error', subscription)
    return () => { ipcRenderer.removeListener('update:error', subscription) }
  },
  getSystemInfo: () => ipcRenderer.invoke('system:info')
})

