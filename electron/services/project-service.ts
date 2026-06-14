import fs from 'fs'
import path from 'path'

export type ProjectInfo = {
  root: string
  hasClient: boolean
  hasDatabases: boolean
  hasJsonData: boolean
  hasSwfpanels: boolean
}

export function detectNinjasageProject(dir: string): ProjectInfo | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const names = entries.map(e => e.name)

  const isProject = names.includes('client') &&
    names.includes('databases') &&
    names.includes('server.js')

  if (!isProject) return null

  return {
    root: dir,
    hasClient: names.includes('client'),
    hasDatabases: names.includes('databases'),
    hasJsonData: fs.existsSync(path.join(dir, 'databases', 'json')),
    hasSwfpanels: fs.existsSync(path.join(dir, 'databases', 'swfpanels'))
  }
}
