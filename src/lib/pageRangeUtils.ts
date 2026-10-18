/**
 * Parses a page range string (e.g., "1-3,5") into a Set of individual page numbers.
 */
export function parsePageRangeToSet(rangeStr: string, totalPages: number): Set<number> {
  const pages = new Set<number>()
  const safeTotal = Math.max(1, totalPages || 1)

  if (!rangeStr || rangeStr.toLowerCase().trim() === 'all') {
    for (let i = 1; i <= safeTotal; i++) {
      pages.add(i)
    }
    return pages
  }

  const parts = rangeStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (trimmed.includes('-')) {
      const [sStr, eStr] = trimmed.split('-')
      let start = parseInt(sStr?.trim() || '', 10)
      let end = parseInt(eStr?.trim() || '', 10)
      if (!isNaN(start) && !isNaN(end)) {
        // Auto-swap if inverted (e.g., "5-2" => 2 to 5)
        if (start > end) {
          const temp = start
          start = end
          end = temp
        }
        // Clamp strictly between 1 and safeTotal
        const clampedStart = Math.max(1, Math.min(start, safeTotal))
        const clampedEnd = Math.max(1, Math.min(end, safeTotal))
        for (let i = clampedStart; i <= clampedEnd; i++) {
          pages.add(i)
        }
      }
    } else {
      const p = parseInt(trimmed, 10)
      if (!isNaN(p) && p >= 1 && p <= safeTotal) {
        pages.add(p)
      }
    }
  }

  // Fallback if parsing produced no valid pages within bounds
  if (pages.size === 0) {
    for (let i = 1; i <= safeTotal; i++) {
      pages.add(i)
    }
  }

  return pages
}

/**
 * Normalizes an arbitrary page range string into a sanitized, deduplicated format.
 */
export function sanitizePageRangeString(rangeStr: string, totalPages: number): string {
  const safeTotal = Math.max(1, totalPages || 1)
  const set = parsePageRangeToSet(rangeStr, safeTotal)
  return formatSetToPageRange(set, safeTotal)
}

/**
 * Formats a Set of page numbers back into a compacted string (e.g., "1-3,5").
 */
export function formatSetToPageRange(pages: Set<number>, totalPages: number): string {
  if (pages.size === 0) return ''
  if (pages.size === totalPages) return 'All'

  const sorted = Array.from(pages).sort((a, b) => a - b)
  const ranges: string[] = []
  
  let start = sorted[0]
  let prev = start

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i]
    if (current === prev + 1) {
      prev = current
    } else {
      if (start === prev) {
        ranges.push(`${start}`)
      } else {
        ranges.push(`${start}-${prev}`)
      }
      start = current
      prev = current
    }
  }

  return ranges.join(',')
}
