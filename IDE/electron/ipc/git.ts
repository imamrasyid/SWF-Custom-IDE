import { ipcMain } from 'electron'
import simpleGit, { type SimpleGit } from 'simple-git'
import fs from 'fs'
import path from 'path'

const gitInstances = new Map<string, SimpleGit>()

function findGitRoot(dir: string): string | null {
  let current = dir
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function getGitInstance(dir: string): SimpleGit | null {
  const root = findGitRoot(dir)
  if (!root) return null
  if (gitInstances.has(root)) return gitInstances.get(root)!
  const git = simpleGit(root)
  gitInstances.set(root, git)
  return git
}

export function registerGitIpc() {
  ipcMain.handle('git:status', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return { branch: '', staged: [], modified: [], deleted: [], untracked: [], ahead: 0, behind: 0, isRepo: false }
      const status = await git.status()
      return {
        branch: status.current || '',
        staged: status.staged,
        modified: status.modified,
        deleted: status.deleted,
        untracked: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
        isRepo: true
      }
    } catch {
      return { branch: '', staged: [], modified: [], deleted: [], untracked: [], ahead: 0, behind: 0, isRepo: false }
    }
  })

  ipcMain.handle('git:log', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return []
      const log = await git.log({ maxCount: 50 })
      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: commit.date
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('git:diff', async (_event, dir: string, file: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return ''
      return await git.diff(['--', file])
    } catch {
      return ''
    }
  })

  ipcMain.handle('git:diffStaged', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return ''
      return await git.diff(['--cached'])
    } catch {
      return ''
    }
  })

  ipcMain.handle('git:add', async (_event, dir: string, files: string[]) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return false
      await git.add(files)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('git:unstage', async (_event, dir: string, files: string[]) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return false
      await git.reset(['HEAD', '--', ...files])
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('git:commit', async (_event, dir: string, message: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return false
      await git.commit(message)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('git:branches', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return []
      const branches = await git.branchLocal()
      return branches.all.map(name => ({
        name,
        current: name === branches.current
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('git:checkout', async (_event, dir: string, branch: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return false
      await git.checkout(branch)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('git:createBranch', async (_event, dir: string, name: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return false
      await git.checkoutLocalBranch(name)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('git:push', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return { success: false, message: 'Not a git repository' }
      await git.push()
      return { success: true, message: 'Pushed successfully' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Push failed' }
    }
  })

  ipcMain.handle('git:pull', async (_event, dir: string) => {
    try {
      const git = getGitInstance(dir)
      if (!git) return { success: false, message: 'Not a git repository' }
      await git.pull()
      return { success: true, message: 'Pulled successfully' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Pull failed' }
    }
  })
}
