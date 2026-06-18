import { useAppStore } from '../stores/app-store'
import type { SwfData, SwfTag } from '../../shared/types'

export interface AssetLink {
  swfPath: string
  tagId: number
  category: string
  tagName: string
}

// Helpers to get category from tag type
export const getCategoryFromTagType = (type: string): string => {
  const t = type.toLowerCase()
  if (t.startsWith('defineshape')) return 'shape'
  if (t.startsWith('definemorphshape')) return 'morphshape'
  if (t.startsWith('definesprite')) return 'sprite'
  if (t.startsWith('definetext') || t.includes('edittext')) return 'text'
  if (t.startsWith('definebits') || t.includes('lossless')) return 'image'
  if (t.startsWith('definesound')) return 'sound'
  if (t.startsWith('definebutton')) return 'button'
  if (t.startsWith('definefont')) return 'font'
  if (t === 'showframe') return 'frame'
  if (t.includes('scene')) return 'scene'
  return 'others'
}

/**
 * Scan all loaded SWFs (main and assets) to find if a class name is linked to an asset symbol
 */
export function findAssetLinkByClassName(className: string): AssetLink | null {
  const state = useAppStore.getState()
  const swfList: SwfData[] = []

  // Add main SWF if available
  if (state.swfData) {
    swfList.push(state.swfData)
  }

  // Add all loaded asset SWFs
  if (state.assetSwfsData) {
    Object.values(state.assetSwfsData).forEach(data => {
      if (data) swfList.push(data)
    })
  }

  for (const swf of swfList) {
    if (!swf.tags) continue

    for (const tag of swf.tags) {
      const nameStr = String(tag.name || '').toLowerCase()
      const typeStr = String(tag.type || '').toLowerCase()
      const queryLower = className.toLowerCase()

      // Check if tag name contains the exact class name or if class name matches the tag's symbol linkage
      if (nameStr.includes(queryLower) || typeStr.includes(queryLower)) {
        const category = getCategoryFromTagType(tag.type)
        return {
          swfPath: swf.path,
          tagId: tag.id,
          category,
          tagName: tag.name
        }
      }
    }
  }

  return null
}
