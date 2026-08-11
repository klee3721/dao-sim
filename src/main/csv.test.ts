import { describe, expect, it } from 'vitest'
import { applyContainsFilter, createCsvText, parseSimCsv } from './csv'

describe('CSV SIM', () => {
  it('đọc một cột có hoặc không có dấu nháy', () => {
    expect(parseSimCsv('\uFEFF"0912345678"\r\n987654321\r\n')).toEqual({
      values: ['912345678', '987654321'],
      invalidCount: 0
    })
  })

  it('ghi CSV không tiêu đề và không số 0 đầu', () => {
    expect(createCsvText(['912345678', '987654321'])).toBe('912345678\r\n987654321\r\n')
  })

  it('loại số chứa bất kỳ chuỗi nào', () => {
    expect(applyContainsFilter(['912345678', '987654321', '812660412'], ['66', '987'])).toEqual([
      '912345678'
    ])
  })
})
