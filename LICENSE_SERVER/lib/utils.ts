import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<T | null> {
  try {
    const url = `${API_BASE}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`[API] Error ${response.status}:`, error)
      return null
    }

    return await response.json()
  } catch (err: any) {
    console.error('[API] Network error:', err.message)
    return null
  }
}
