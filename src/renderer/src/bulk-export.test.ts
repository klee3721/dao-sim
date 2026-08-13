import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { analyzeBulkPhoneValue } from '../../shared/huyen-so/bulk-phone'
import { buildBulkWorkbookSheets, createBulkXlsxBytes } from './bulk-export'

describe('bulk XLSX export', () => {
  it('keeps the original phone in column A and adds result and legend sheets', () => {
    const rows = [
      analyzeBulkPhoneValue('911046786', 1),
      analyzeBulkPhoneValue('091234567', 2)
    ]
    const sheets = buildBulkWorkbookSheets(rows)

    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Kết quả', 'Chú giải'])
    expect(sheets[0].data[0][0]).toMatchObject({ value: '911046786', type: String })
    expect(sheets[0].data[0][1]).toMatchObject({
      value: '91 - DN 1',
      backgroundColor: '#EDF7F1'
    })
    expect(sheets[0].data[0][4]).toMatchObject({
      value: '46 - HH 3',
      backgroundColor: '#FAEDF1'
    })
    expect(sheets[0].data[1][1]).toMatchObject({ backgroundColor: '#FDECEC' })
    const legendConvention = sheets[1].data.at(-1)?.[1] as { value?: unknown } | null
    expect(String(legendConvention?.value)).toContain('TY 4 = Thiên Y bậc 4')
  })

  it('creates a valid XLSX byte sequence', async () => {
    const bytes = await createBulkXlsxBytes([analyzeBulkPhoneValue('911046786', 1)])

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b])
  })

  it('allows the local and Blob workers used by bulk analysis and large XLSX compression', () => {
    const html = readFileSync('src/renderer/index.html', 'utf8')

    expect(html).toContain("worker-src 'self' blob:")
  })
})
