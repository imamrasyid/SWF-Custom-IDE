export function safeJsonParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function parseIntSafe(value: string, radix: number = 10, fallback: number = 0): number {
  const result = parseInt(value, radix)
  return Number.isFinite(result) ? result : fallback
}

export function parseIntOrNull(value: string, radix: number = 10): number | null {
  const result = parseInt(value, radix)
  return Number.isFinite(result) ? result : null
}
