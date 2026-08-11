export interface NormalizedSim {
  canonical10: string
  export9: string
}

export function normalizeVietnameseMobile(rawValue: string): NormalizedSim | null {
  let digits = String(rawValue).trim().replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)

  let canonical10: string
  if (/^0\d{9}$/.test(digits)) {
    canonical10 = digits
  } else if (/^84\d{9}$/.test(digits)) {
    canonical10 = `0${digits.slice(2)}`
  } else if (/^[1-9]\d{8}$/.test(digits)) {
    canonical10 = `0${digits}`
  } else {
    return null
  }

  const export9 = canonical10.slice(1)
  if (!/^[1-9]\d{8}$/.test(export9)) return null
  return { canonical10, export9 }
}

export interface NormalizeCollectionResult {
  values: string[]
  duplicateCount: number
  invalidCount: number
}

export function normalizeAndDedupe(rawValues: string[]): NormalizeCollectionResult {
  const seen = new Set<string>()
  const values: string[] = []
  let duplicateCount = 0
  let invalidCount = 0

  for (const rawValue of rawValues) {
    const normalized = normalizeVietnameseMobile(rawValue)
    if (!normalized) {
      invalidCount += 1
      continue
    }
    if (seen.has(normalized.canonical10)) {
      duplicateCount += 1
      continue
    }
    seen.add(normalized.canonical10)
    values.push(normalized.export9)
  }

  return { values, duplicateCount, invalidCount }
}
