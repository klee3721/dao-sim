import { constants } from 'node:fs'
import { lstat, open } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { AppError } from './errors'
import { writeFileAtomic } from './atomic-write'
import { isLocalAbsolutePath } from './path-safety'
import type { BulkFileFormat } from '../shared/types'

export const MAX_BULK_CSV_BYTES = 5 * 1024 * 1024
export const MAX_BULK_OUTPUT_BYTES = 64 * 1024 * 1024

const MAX_PATH_CHARACTERS = 4_096
const READ_CHUNK_BYTES = 64 * 1024

function assertLocalAbsolutePath(filePath: unknown, code: string): asserts filePath is string {
  if (
    typeof filePath !== 'string' ||
    filePath.length === 0 ||
    filePath.length > MAX_PATH_CHARACTERS ||
    filePath.includes('\0') ||
    !isLocalAbsolutePath(filePath)
  ) {
    throw new AppError(code, 'Đường dẫn file không hợp lệ.')
  }
}

export function validateBulkFormat(format: unknown): BulkFileFormat {
  if (format !== 'csv' && format !== 'xlsx') {
    throw new AppError('INVALID_BULK_FORMAT', 'Định dạng kết quả chỉ được là CSV hoặc XLSX.')
  }
  return format
}

export function validateBulkSourcePath(sourcePath: unknown): string | undefined {
  if (sourcePath === undefined) return undefined
  assertLocalAbsolutePath(sourcePath, 'INVALID_BULK_SOURCE')
  if (extname(sourcePath).toLowerCase() !== '.csv') {
    throw new AppError('INVALID_BULK_SOURCE', 'File nguồn phải có đuôi .csv.')
  }
  return sourcePath
}

export function validateBulkOutputData(data: unknown): Uint8Array {
  if (!(data instanceof Uint8Array)) {
    throw new AppError('INVALID_BULK_DATA', 'Dữ liệu kết quả không hợp lệ.')
  }
  if (data.byteLength > MAX_BULK_OUTPUT_BYTES) {
    throw new AppError(
      'BULK_OUTPUT_TOO_LARGE',
      `File kết quả không được vượt quá ${MAX_BULK_OUTPUT_BYTES / 1024 / 1024} MiB.`
    )
  }
  return data
}

export function createBulkDefaultPath(
  downloadsDirectory: string,
  formatValue: unknown,
  sourcePathValue?: unknown,
  useProvidedDirectory = false
): string {
  assertLocalAbsolutePath(downloadsDirectory, 'INVALID_BULK_DESTINATION')
  const format = validateBulkFormat(formatValue)
  const sourcePath = validateBulkSourcePath(sourcePathValue)
  const outputDirectory = useProvidedDirectory
    ? downloadsDirectory
    : sourcePath
      ? dirname(sourcePath)
      : downloadsDirectory
  const sourceName = sourcePath ? basename(sourcePath, extname(sourcePath)) : 'danh_sach_sim'
  const shortName = (sourceName || 'sim').slice(0, 28)
  return join(outputDirectory, `${shortName}-ls.${format}`)
}

export function validateBulkDestination(filePath: unknown, formatValue: unknown): string {
  assertLocalAbsolutePath(filePath, 'INVALID_BULK_DESTINATION')
  const format = validateBulkFormat(formatValue)
  const currentExtension = extname(filePath)
  if (!currentExtension) return `${filePath}.${format}`
  if (currentExtension.toLowerCase() !== `.${format}`) {
    throw new AppError(
      'INVALID_BULK_DESTINATION',
      `Tên file kết quả phải có đuôi .${format}.`
    )
  }
  return filePath
}

export async function readBulkCsvText(filePathValue: unknown): Promise<string> {
  assertLocalAbsolutePath(filePathValue, 'INVALID_BULK_SOURCE')
  const filePath = filePathValue
  if (extname(filePath).toLowerCase() !== '.csv') {
    throw new AppError('INVALID_BULK_SOURCE', 'Vui lòng chọn file có đuôi .csv.')
  }

  const pathInfo = await lstat(filePath)
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) {
    throw new AppError('INVALID_BULK_SOURCE', 'File nguồn phải là file CSV cục bộ thông thường.')
  }
  if (pathInfo.size > MAX_BULK_CSV_BYTES) {
    throw new AppError(
      'BULK_SOURCE_TOO_LARGE',
      `File CSV không được vượt quá ${MAX_BULK_CSV_BYTES / 1024 / 1024} MiB.`
    )
  }

  const parentInfo = await lstat(dirname(filePath))
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new AppError(
      'INVALID_BULK_SOURCE',
      'Thư mục chứa file nguồn phải là thư mục cục bộ thông thường.'
    )
  }

  const noFollowFlag = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
  const handle = await open(filePath, constants.O_RDONLY | noFollowFlag)
  try {
    const openedInfo = await handle.stat()
    if (!openedInfo.isFile()) {
      throw new AppError('INVALID_BULK_SOURCE', 'File nguồn phải là file CSV cục bộ thông thường.')
    }
    if (openedInfo.size > MAX_BULK_CSV_BYTES) {
      throw new AppError(
        'BULK_SOURCE_TOO_LARGE',
        `File CSV không được vượt quá ${MAX_BULK_CSV_BYTES / 1024 / 1024} MiB.`
      )
    }

    const chunks: Buffer[] = []
    let totalBytes = 0
    while (totalBytes <= MAX_BULK_CSV_BYTES) {
      const remaining = MAX_BULK_CSV_BYTES + 1 - totalBytes
      const chunk = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, remaining))
      const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null)
      if (bytesRead === 0) break
      chunks.push(chunk.subarray(0, bytesRead))
      totalBytes += bytesRead
    }

    if (totalBytes > MAX_BULK_CSV_BYTES) {
      throw new AppError(
        'BULK_SOURCE_TOO_LARGE',
        `File CSV không được vượt quá ${MAX_BULK_CSV_BYTES / 1024 / 1024} MiB.`
      )
    }
    return Buffer.concat(chunks, totalBytes).toString('utf8')
  } finally {
    await handle.close()
  }
}

export async function writeBulkFileAtomic(
  filePathValue: unknown,
  dataValue: unknown,
  formatValue: unknown
): Promise<void> {
  const format = validateBulkFormat(formatValue)
  const filePath = validateBulkDestination(filePathValue, format)
  const data = validateBulkOutputData(dataValue)
  await writeFileAtomic(filePath, data, { invalidPathCode: 'INVALID_BULK_DESTINATION' })
}
