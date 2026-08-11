import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import { AppError } from './errors'
import { normalizeVietnameseMobile } from './crawl/normalize'

function unquoteCsvCell(input: string): string {
  const cell = input.trim()
  if (cell.startsWith('"') && cell.endsWith('"') && cell.length >= 2) {
    return cell.slice(1, -1).replace(/""/g, '"').trim()
  }
  return cell
}

export function parseSimCsv(text: string): { values: string[]; invalidCount: number } {
  const normalizedText = text.replace(/^\uFEFF/, '')
  const values: string[] = []
  let invalidCount = 0

  for (const line of normalizedText.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cell = unquoteCsvCell(line)
    if (cell.includes(',')) {
      invalidCount += 1
      continue
    }
    const normalized = normalizeVietnameseMobile(cell)
    if (!normalized) {
      invalidCount += 1
      continue
    }
    values.push(normalized.export9)
  }

  return { values, invalidCount }
}

export async function readSimCsv(filePath: string): Promise<{ values: string[]; invalidCount: number }> {
  if (extname(filePath).toLowerCase() !== '.csv') {
    throw new AppError('INVALID_FILE', 'Vui lòng chọn file có đuôi .csv.')
  }
  const text = await readFile(filePath, 'utf8')
  return parseSimCsv(text)
}

export function createCsvText(values: string[]): string {
  for (const value of values) {
    if (!/^[1-9]\d{8}$/.test(value)) {
      throw new AppError('INVALID_SIM', `SIM không hợp lệ: ${value}`)
    }
  }
  return values.length ? `${values.join('\r\n')}\r\n` : ''
}

export async function writeSimCsvAtomic(filePath: string, values: string[]): Promise<void> {
  if (extname(filePath).toLowerCase() !== '.csv') {
    throw new AppError('INVALID_FILE', 'Tên file kết quả phải có đuôi .csv.')
  }
  await mkdir(dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporaryPath, createCsvText(values), 'utf8')
    await rename(temporaryPath, filePath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export function applyContainsFilter(values: string[], tokens: string[]): string[] {
  const cleanTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))]
  if (cleanTokens.some((token) => !/^\d+$/.test(token))) {
    throw new AppError('INVALID_FILTER', 'Chuỗi cần loại chỉ được chứa chữ số.')
  }
  if (cleanTokens.length === 0) return [...values]
  return values.filter((value) => !cleanTokens.some((token) => value.includes(token)))
}
