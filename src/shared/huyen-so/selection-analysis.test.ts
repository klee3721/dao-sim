import { describe, expect, it } from 'vitest'
import {
  analyzeSelection,
  classifySelection,
  isNumericSelectionCandidate
} from './selection-analysis'

describe('browser selection analysis', () => {
  it('matches the extension candidate rules', () => {
    expect(isNumericSelectionCandidate('0912 345 678')).toBe(true)
    expect(isNumericSelectionCandidate('+84912345678')).toBe(true)
    expect(isNumericSelectionCandidate('SIM 0912345678')).toBe(false)
  })

  it('normalizes exported nine-digit SIM values', () => {
    expect(classifySelection('912345678')).toEqual({
      ok: true,
      value: expect.objectContaining({
        normalizedInput: '0912345678',
        mode: 'phone',
        kind: 'phone'
      })
    })
  })

  it('normalizes a +84 phone selection', () => {
    expect(classifySelection('+84 912 345 678')).toEqual({
      ok: true,
      value: expect.objectContaining({
        normalizedInput: '0912345678',
        mode: 'phone'
      })
    })
  })

  it('returns the same local numerology detail used by bulk analysis', () => {
    const result = analyzeSelection('0912345678')
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.pairs.length).toBeGreaterThan(0)
      expect(result.catCount + result.hungCount).toBeGreaterThan(0)
      expect(result.energies.length).toBeGreaterThan(0)
      expect(result.pairs.some((pair) => pair.strength !== undefined)).toBe(true)
      expect(result.transitions.every((transition) => transition.fromStrength !== undefined)).toBe(true)
    }
  })

  it('propagates the current strength metadata into CCCD fortune cycles', () => {
    const result = analyzeSelection('001234567890')
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.selectionKind).toBe('cccd')
      expect(result.fortuneCycles?.[2].strength).toBe(1)
    }
  })
})
