import { describe, expect, it } from 'vitest'
import {
  arePathsEquivalent,
  hasDirectParent,
  isLocalAbsolutePath,
  pathComparisonKey
} from './path-safety'

describe('cross-platform path safety', () => {
  it('accepts drive-qualified Windows paths and rejects relative, UNC, and device paths', () => {
    expect(isLocalAbsolutePath('C:\\Users\\Klee\\DaoSim\\sim.csv', 'win32')).toBe(true)
    expect(isLocalAbsolutePath('d:/Dữ liệu Đào Sim/sim.csv', 'win32')).toBe(true)
    expect(isLocalAbsolutePath('C:sim.csv', 'win32')).toBe(false)
    expect(isLocalAbsolutePath('\\sim.csv', 'win32')).toBe(false)
    expect(isLocalAbsolutePath('\\\\server\\share\\sim.csv', 'win32')).toBe(false)
    expect(isLocalAbsolutePath('\\\\?\\C:\\DaoSim\\sim.csv', 'win32')).toBe(false)
  })

  it('compares Windows paths case-insensitively after normalization', () => {
    expect(
      arePathsEquivalent(
        'C:\\Users\\Klee\\DaoSim\\SIM-01.CSV',
        'c:/users/klee/daosim/./sim-01.csv',
        'win32'
      )
    ).toBe(true)
    expect(pathComparisonKey('C:\\A\\..\\B\\', 'win32')).toBe('c:\\b')
  })

  it('requires a saved file to be an immediate child rather than a prefix or nested path', () => {
    expect(hasDirectParent('C:\\Data\\DaoSim\\sim.csv', 'c:\\data\\daosim', 'win32')).toBe(true)
    expect(hasDirectParent('C:\\Data\\DaoSim-old\\sim.csv', 'C:\\Data\\DaoSim', 'win32')).toBe(
      false
    )
    expect(hasDirectParent('C:\\Data\\DaoSim\\nested\\sim.csv', 'C:\\Data\\DaoSim', 'win32')).toBe(
      false
    )
  })
})
