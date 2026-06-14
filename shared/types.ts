export type SwfHeader = {
  version: number
  frameRate: number
  width: number
  height: number
  compressed: boolean
  fileLength?: number
  fileSize: number
  frameCount: number
  backgroundColor: string
  compressionType?: string
}

export type As3Class = {
  name: string
  packageName: string
  fullName: string
  path?: string
}

export type SwfTag = {
  id: number
  characterId?: number
  type: string
  name: string
  size: number
  globalIndex: number
  offset: number
  length?: number
}

export type AssetItem = {
  id: number
  type: string
  category: string
  name?: string
  size?: number
}

export type SwfData = {
  path: string
  header: SwfHeader
  classes: As3Class[]
  tags: SwfTag[]
  assets: AssetItem[]
}