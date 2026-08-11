import { describe, expect, it } from 'vitest'
import { normalizeAndDedupe, normalizeVietnameseMobile } from './normalize'

describe('normalizeVietnameseMobile', () => {
  it.each([
    ['0912345678', '912345678'],
    ['84 912 345 678', '912345678'],
    ['+84912345678', '912345678'],
    ['912345678', '912345678'],
    ['0325.736.173', '325736173']
  ])('chuẩn hóa %s', (input, expected) => {
    expect(normalizeVietnameseMobile(input)?.export9).toBe(expected)
  })

  it.each(['123', '0012345678', '849123', 'abcdefgh'])('từ chối %s', (input) => {
    expect(normalizeVietnameseMobile(input)).toBeNull()
  })

  it('loại trùng theo số nội địa', () => {
    expect(normalizeAndDedupe(['0912345678', '+84912345678', '0987654321'])).toEqual({
      values: ['912345678', '987654321'],
      duplicateCount: 1,
      invalidCount: 0
    })
  })
})
