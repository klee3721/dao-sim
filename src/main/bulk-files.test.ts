import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  MAX_BULK_CSV_BYTES,
  MAX_BULK_OUTPUT_BYTES,
  createBulkDefaultPath,
  readBulkCsvText,
  validateBulkDestination,
  validateBulkFormat,
  validateBulkOutputData,
  validateBulkSourcePath,
  writeBulkFileAtomic
} from './bulk-files'

const temporaryDirectories: string[] = []

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dao-sim-bulk-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('bulk file boundary', () => {
  it('reads a regular local CSV as text', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = join(directory, 'sims.csv')
    await writeFile(filePath, '0912345678\r\n0987654321\r\n', 'utf8')

    await expect(readBulkCsvText(filePath)).resolves.toBe('0912345678\r\n0987654321\r\n')
  })

  it('rejects a non-CSV path, a symbolic link, and a CSV over 5 MiB', async () => {
    const directory = await makeTemporaryDirectory()
    const textPath = join(directory, 'sims.txt')
    const csvPath = join(directory, 'sims.csv')
    const linkPath = join(directory, 'linked.csv')
    const largePath = join(directory, 'large.csv')
    await writeFile(textPath, '0912345678\n', 'utf8')
    await writeFile(csvPath, '0912345678\n', 'utf8')
    await symlink(csvPath, linkPath)
    await writeFile(largePath, Buffer.alloc(MAX_BULK_CSV_BYTES + 1))

    await expect(readBulkCsvText(textPath)).rejects.toMatchObject({ code: 'INVALID_BULK_SOURCE' })
    await expect(readBulkCsvText(linkPath)).rejects.toMatchObject({ code: 'INVALID_BULK_SOURCE' })
    await expect(readBulkCsvText(largePath)).rejects.toMatchObject({
      code: 'BULK_SOURCE_TOO_LARGE'
    })
  })

  it('validates renderer-controlled format, bytes, source path, and destination extension', () => {
    const sourcePath = join(tmpdir(), 'source.csv')
    const csvDestination = join(tmpdir(), 'result.csv')
    const destinationWithoutExtension = join(tmpdir(), 'result')
    const wrongDestination = join(tmpdir(), 'result.xlsx')

    expect(validateBulkFormat('xlsx')).toBe('xlsx')
    expect(validateBulkOutputData(new Uint8Array([1, 2]))).toEqual(new Uint8Array([1, 2]))
    expect(validateBulkSourcePath(sourcePath)).toBe(sourcePath)
    expect(validateBulkDestination(csvDestination, 'csv')).toBe(csvDestination)
    expect(validateBulkDestination(destinationWithoutExtension, 'xlsx')).toBe(
      `${destinationWithoutExtension}.xlsx`
    )

    expect(() => validateBulkFormat('pdf')).toThrowError(expect.objectContaining({ code: 'INVALID_BULK_FORMAT' }))
    expect(() => validateBulkOutputData([1, 2])).toThrowError(
      expect.objectContaining({ code: 'INVALID_BULK_DATA' })
    )
    expect(() => validateBulkOutputData(new Uint8Array(MAX_BULK_OUTPUT_BYTES + 1))).toThrowError(
      expect.objectContaining({ code: 'BULK_OUTPUT_TOO_LARGE' })
    )
    expect(() => validateBulkSourcePath('../source.csv')).toThrowError(
      expect.objectContaining({ code: 'INVALID_BULK_SOURCE' })
    )
    expect(() => validateBulkDestination(wrongDestination, 'csv')).toThrowError(
      expect.objectContaining({ code: 'INVALID_BULK_DESTINATION' })
    )
  })

  it('builds the requested default result name beside its CSV source', () => {
    const downloadsDirectory = join(tmpdir(), 'Downloads')
    const managedDirectory = join(tmpdir(), 'DaoSim')
    const sourcePath = join(tmpdir(), 'danh sach.csv')

    expect(createBulkDefaultPath(downloadsDirectory, 'xlsx', sourcePath)).toBe(
      join(tmpdir(), 'danh sach-ls.xlsx')
    )
    expect(createBulkDefaultPath(downloadsDirectory, 'csv')).toBe(
      join(downloadsDirectory, 'danh_sach_sim-ls.csv')
    )
    expect(createBulkDefaultPath(managedDirectory, 'xlsx', sourcePath, true)).toBe(
      join(managedDirectory, 'danh sach-ls.xlsx')
    )
  })

  it('writes output atomically with the selected format', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = join(directory, 'result.xlsx')
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])

    await writeBulkFileAtomic(filePath, bytes, 'xlsx')

    expect(await readFile(filePath)).toEqual(Buffer.from(bytes))
  })

  it('preserves UTF-8 Vietnamese text and CRLF bytes in a CSV export', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = join(directory, 'kết quả.csv')
    const text = '\uFEFF"SIM","Luận giải"\r\n"911046786","Thiên Y"\r\n'

    await writeBulkFileAtomic(filePath, new TextEncoder().encode(text), 'csv')

    expect(await readFile(filePath, 'utf8')).toBe(text)
  })

  it('rejects an output directory reached through a symlink or Windows junction', async () => {
    const directory = await makeTemporaryDirectory()
    const target = join(directory, 'target')
    const linked = join(directory, 'linked')
    await mkdir(target)
    await symlink(target, linked, process.platform === 'win32' ? 'junction' : 'dir')

    await expect(
      writeBulkFileAtomic(join(linked, 'result.csv'), new TextEncoder().encode('1\r\n'), 'csv')
    ).rejects.toMatchObject({ code: 'INVALID_BULK_DESTINATION' })
  })
})
