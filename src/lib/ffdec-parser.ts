export function parseDumpSwf(stdout: string): { id: number; type: string; name: string; size: number; globalIndex: number; offset: number }[] {
  const tags: { id: number; type: string; name: string; size: number; globalIndex: number; offset: number }[] = []
  const lines = stdout.split('\n')
  let globalIndex = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    const match = trimmed.match(/^([a-fA-F0-9]+):\s+(\d+)\.\s+([\w\d]+)(?:\s+\((.+?)\))?\s+tagId=\s*(\d+)\s+len=\s*(\d+)/)
    if (match) {
      const tagIndex = parseInt(match[2], 10)
      const type = match[3]
      const desc = match[4] || ''
      const tagId = parseInt(match[5], 10)
      const len = parseInt(match[6], 10)
      
      let characterId = tagIndex
      if (desc) {
        const idMatch = desc.match(/(?:chid|fid|cid|tid):\s*(\d+)/i)
        if (idMatch) {
          characterId = parseInt(idMatch[1], 10)
        }
      }
      
      tags.push({
        id: characterId,
        type: type,
        name: desc ? `${type} (${desc})` : type,
        size: len,
        globalIndex: globalIndex++,
        offset: 0
      })
    }
  }
  return tags
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
