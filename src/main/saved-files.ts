import { constants } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath
} from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import Papa from 'papaparse'
import { AppError } from './errors'
import { createCsvText } from './csv'
import { writeFileAtomic } from './atomic-write'
import { arePathsEquivalent, hasDirectParent, isLocalAbsolutePath } from './path-safety'
import { normalizeVietnameseMobile } from './crawl/normalize'
import { analyzeBulkPhoneValue } from '../shared/huyen-so/bulk-phone'
import { buildBulkCsvText } from '../shared/huyen-so/bulk-csv'
import type { FileWorkspaceState, SavedFileEntry } from '../shared/types'

const SETTINGS_VERSION = 1
const MAX_SAVED_FILE_BYTES = 64 * 1024 * 1024
const MAX_LISTED_FILES = 100

interface PersistedSettings {
  version: number
  directory: string
  includeAnalysis: boolean
  activeFilePath?: string
  activeIncludesAnalysis?: boolean
}

export interface ManagedCrawlSaveResult {
  path: string
  name: string
  addedCount: number
  totalCount: number
  includesAnalysis: boolean
}

function validDirectoryValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    isLocalAbsolutePath(value)
  )
}

function stripFormulaPrefix(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value
}

export function parseManagedCsvValues(text: string): {
  values: string[]
  invalidCount: number
} {
  const normalizedText = text.replace(/^\uFEFF/, '')
  if (!normalizedText.trim()) return { values: [], invalidCount: 0 }

  const parsed = Papa.parse<string[]>(normalizedText, {
    dynamicTyping: false,
    skipEmptyLines: true
  })
  const fatalError = parsed.errors.find((error) => error.code !== 'UndetectableDelimiter')
  if (fatalError) {
    throw new AppError(
      'INVALID_FILE',
      `Không thể đọc CSV tại dòng ${(fatalError.row ?? 0) + 1}: ${fatalError.message}`
    )
  }

  const values: string[] = []
  let invalidCount = 0
  parsed.data.forEach((row) => {
    const firstCell = stripFormulaPrefix(String(row[0] ?? '').trim())
    if (!firstCell) return
    const normalized = normalizeVietnameseMobile(firstCell)
    if (!normalized) {
      invalidCount += 1
      return
    }
    values.push(normalized.export9)
  })
  return { values, invalidCount }
}

function mergeUnique(existing: string[], incoming: string[]): {
  values: string[]
  addedCount: number
} {
  const seen = new Set(existing)
  const values = [...existing]
  let addedCount = 0

  incoming.forEach((value) => {
    if (!/^[1-9]\d{8}$/.test(value)) {
      throw new AppError('INVALID_SIM', `SIM không hợp lệ: ${value}`)
    }
    if (seen.has(value)) return
    seen.add(value)
    values.push(value)
    addedCount += 1
  })

  return { values, addedCount }
}

export function createManagedCrawlCsvText(values: string[], includeAnalysis: boolean): string {
  if (!includeAnalysis) return createCsvText(values)
  return buildBulkCsvText(
    values.map((value, index) => analyzeBulkPhoneValue(value, index + 1))
  )
}

async function writeTextAtomic(filePath: string, text: string): Promise<void> {
  await writeFileAtomic(filePath, text, { invalidPathCode: 'INVALID_SAVED_FILE' })
}

async function readManagedText(filePath: string): Promise<string> {
  const noFollowFlag = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
  const handle = await open(filePath, constants.O_RDONLY | noFollowFlag)
  try {
    const openedInfo = await handle.stat()
    if (!openedInfo.isFile() || openedInfo.size > MAX_SAVED_FILE_BYTES) {
      throw new AppError('INVALID_SAVED_FILE', 'File đã lưu không còn là file hợp lệ.')
    }
    const data = await handle.readFile()
    if (data.byteLength > MAX_SAVED_FILE_BYTES) {
      throw new AppError('SAVED_FILE_TOO_LARGE', 'File đã lưu vượt giới hạn 64 MB.')
    }
    return data.toString('utf8')
  } finally {
    await handle.close()
  }
}

function shortDate(date: Date): string {
  return [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
}

export class SavedFilesService {
  private readonly settingsPath: string
  private readonly defaultDirectory: string
  private settings?: PersistedSettings

  constructor(settingsPath: string, defaultDirectory: string) {
    this.settingsPath = settingsPath
    this.defaultDirectory = defaultDirectory
  }

  private async initialize(): Promise<PersistedSettings> {
    if (this.settings) return this.settings
    let parsed: Partial<PersistedSettings> = {}
    try {
      parsed = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Partial<PersistedSettings>
    } catch {
      // Lần chạy đầu hoặc file cài đặt hỏng sẽ quay về thư mục mặc định an toàn.
    }

    const requestedDirectory = validDirectoryValue(parsed.directory)
      ? parsed.directory
      : this.defaultDirectory
    await mkdir(requestedDirectory, { recursive: true })
    const directory = await this.validateDirectory(requestedDirectory)
    this.settings = {
      version: SETTINGS_VERSION,
      directory,
      includeAnalysis: parsed.includeAnalysis === true,
      activeFilePath:
        validDirectoryValue(parsed.activeFilePath) &&
        hasDirectParent(parsed.activeFilePath, directory)
          ? resolve(parsed.activeFilePath)
          : undefined,
      activeIncludesAnalysis: parsed.activeIncludesAnalysis === true
    }
    await this.persist()
    return this.settings
  }

  private async persist(): Promise<void> {
    if (!this.settings) return
    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeTextAtomic(this.settingsPath, `${JSON.stringify(this.settings, null, 2)}\n`)
  }

  private async validateDirectory(directoryValue: unknown): Promise<string> {
    if (!validDirectoryValue(directoryValue)) {
      throw new AppError('INVALID_SAVE_FOLDER', 'Thư mục lưu file không hợp lệ.')
    }
    const requestedInfo = await lstat(directoryValue)
    if (!requestedInfo.isDirectory() || requestedInfo.isSymbolicLink()) {
      throw new AppError('INVALID_SAVE_FOLDER', 'Vui lòng chọn một thư mục cục bộ thông thường.')
    }
    const resolved = await realpath(directoryValue)
    const info = await lstat(resolved)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new AppError('INVALID_SAVE_FOLDER', 'Vui lòng chọn một thư mục cục bộ thông thường.')
    }
    return resolved
  }

  private async validateSavedPath(filePathValue: unknown): Promise<string> {
    const settings = await this.initialize()
    if (!validDirectoryValue(filePathValue)) {
      throw new AppError('INVALID_SAVED_FILE', 'Đường dẫn file đã lưu không hợp lệ.')
    }
    const filePath = resolve(filePathValue)
    if (!hasDirectParent(filePath, settings.directory)) {
      throw new AppError('INVALID_SAVED_FILE', 'File phải nằm trong thư mục lưu đã cài đặt.')
    }
    if (!['.csv', '.xlsx'].includes(extname(filePath).toLowerCase())) {
      throw new AppError('INVALID_SAVED_FILE', 'Chỉ hỗ trợ file CSV hoặc XLSX đã lưu.')
    }
    const info = await lstat(filePath)
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new AppError('INVALID_SAVED_FILE', 'File đã lưu phải là file cục bộ thông thường.')
    }
    if (info.size > MAX_SAVED_FILE_BYTES) {
      throw new AppError('SAVED_FILE_TOO_LARGE', 'File đã lưu vượt giới hạn 64 MB.')
    }
    const canonicalParent = await realpath(dirname(filePath))
    if (!arePathsEquivalent(canonicalParent, settings.directory)) {
      throw new AppError('INVALID_SAVED_FILE', 'File phải nằm trực tiếp trong thư mục lưu.')
    }
    return filePath
  }

  private async detectAnalysis(filePath: string): Promise<boolean> {
    if (extname(filePath).toLowerCase() === '.xlsx') return true
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      const noFollowFlag = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
      handle = await open(filePath, constants.O_RDONLY | noFollowFlag)
      const buffer = Buffer.allocUnsafe(4_096)
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
      const sample = buffer.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '')
      const firstLine = sample.split(/\r?\n/, 1)[0] ?? ''
      return /^"?[1-9]\d{8}"?,/.test(firstLine)
    } catch {
      return false
    } finally {
      await handle?.close().catch(() => undefined)
    }
  }

  private async listFiles(): Promise<SavedFileEntry[]> {
    const settings = await this.initialize()
    const names = await readdir(settings.directory)
    const files = await Promise.all(
      names.map(async (name): Promise<SavedFileEntry | undefined> => {
        const format = extname(name).toLowerCase().slice(1)
        if (format !== 'csv' && format !== 'xlsx') return undefined
        const path = join(settings.directory, name)
        try {
          const info = await lstat(path)
          if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SAVED_FILE_BYTES) {
            return undefined
          }
          return {
            path,
            name,
            format,
            size: info.size,
            modifiedAt: info.mtime.toISOString(),
            isActive:
              settings.activeFilePath !== undefined &&
              arePathsEquivalent(path, settings.activeFilePath),
            includesAnalysis:
              settings.activeFilePath !== undefined &&
              arePathsEquivalent(path, settings.activeFilePath) &&
              settings.activeIncludesAnalysis !== undefined
                ? settings.activeIncludesAnalysis
                : await this.detectAnalysis(path)
          }
        } catch {
          return undefined
        }
      })
    )
    return files
      .filter((file): file is SavedFileEntry => Boolean(file))
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
      .slice(0, MAX_LISTED_FILES)
  }

  async getDirectory(): Promise<string> {
    return (await this.initialize()).directory
  }

  async getState(): Promise<FileWorkspaceState> {
    const settings = await this.initialize()
    let files = await this.listFiles()
    let activeFile = files.find((file) => file.isActive)
    if (settings.activeFilePath && !activeFile) {
      settings.activeFilePath = undefined
      settings.activeIncludesAnalysis = undefined
      await this.persist()
      files = files.map((file) => ({ ...file, isActive: false }))
    }
    activeFile = files.find((file) => file.isActive)
    return {
      directory: settings.directory,
      includeAnalysis: settings.includeAnalysis,
      activeFile,
      files
    }
  }

  async setDirectory(directory: string): Promise<FileWorkspaceState> {
    const settings = await this.initialize()
    const nextDirectory = await this.validateDirectory(directory)
    if (!arePathsEquivalent(nextDirectory, settings.directory)) {
      settings.directory = nextDirectory
      settings.activeFilePath = undefined
      settings.activeIncludesAnalysis = undefined
      await this.persist()
    }
    return this.getState()
  }

  async setIncludeAnalysis(enabledValue: unknown): Promise<FileWorkspaceState> {
    if (typeof enabledValue !== 'boolean') {
      throw new AppError('INVALID_ANALYSIS_SETTING', 'Cài đặt luận giải không hợp lệ.')
    }
    const settings = await this.initialize()
    settings.includeAnalysis = enabledValue
    await this.persist()
    return this.getState()
  }

  private async nextFilePath(now = new Date()): Promise<string> {
    const settings = await this.initialize()
    const prefix = `sim-${shortDate(now)}-`
    const names = await readdir(settings.directory)
    const used = new Set(
      names
        .map((name) => new RegExp(`^${prefix}(\\d+)\\.csv$`, 'i').exec(name)?.[1])
        .filter((value): value is string => Boolean(value))
        .map(Number)
    )
    let sequence = 1
    while (used.has(sequence)) sequence += 1
    return join(settings.directory, `${prefix}${String(sequence).padStart(2, '0')}.csv`)
  }

  async createNewFile(): Promise<FileWorkspaceState> {
    const settings = await this.initialize()
    const filePath = await this.nextFilePath()
    const handle = await open(filePath, 'wx', 0o600)
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
    settings.activeFilePath = filePath
    settings.activeIncludesAnalysis = settings.includeAnalysis
    await this.persist()
    return this.getState()
  }

  private async ensureActiveFile(): Promise<string> {
    const settings = await this.initialize()
    if (settings.activeFilePath) {
      try {
        return await this.validateSavedPath(settings.activeFilePath)
      } catch {
        settings.activeFilePath = undefined
        settings.activeIncludesAnalysis = undefined
      }
    }
    await this.createNewFile()
    if (!settings.activeFilePath) {
      throw new AppError('CREATE_FILE_FAILED', 'Không thể tạo file lưu SIM mới.')
    }
    return settings.activeFilePath
  }

  async appendCrawl(values: string[]): Promise<ManagedCrawlSaveResult> {
    const settings = await this.initialize()
    const filePath = await this.ensureActiveFile()
    const info = await lstat(filePath)
    if (info.size > MAX_SAVED_FILE_BYTES) {
      throw new AppError('SAVED_FILE_TOO_LARGE', 'File đang lưu vượt giới hạn 64 MB.')
    }
    const existing = parseManagedCsvValues(await readManagedText(filePath)).values
    const merged = mergeUnique(existing, values)
    await writeTextAtomic(
      filePath,
      createManagedCrawlCsvText(merged.values, settings.includeAnalysis)
    )
    settings.activeIncludesAnalysis = settings.includeAnalysis
    await this.persist()
    return {
      path: filePath,
      name: basename(filePath),
      addedCount: merged.addedCount,
      totalCount: merged.values.length,
      includesAnalysis: settings.includeAnalysis
    }
  }

  async readSavedCsv(filePathValue: unknown): Promise<{
    path: string
    values: string[]
    invalidCount: number
  }> {
    const filePath = await this.validateSavedPath(filePathValue)
    if (extname(filePath).toLowerCase() !== '.csv') {
      throw new AppError('INVALID_SAVED_FILE', 'Chức năng này chỉ mở được file CSV.')
    }
    const result = parseManagedCsvValues(await readManagedText(filePath))
    return { path: filePath, ...result }
  }
}
