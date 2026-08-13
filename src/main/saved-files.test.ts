import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  SavedFilesService,
  createManagedCrawlCsvText,
  parseManagedCsvValues
} from './saved-files'

const temporaryDirectories: string[] = []

async function makeService(): Promise<{ service: SavedFilesService; output: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dao-sim-saved-test-'))
  temporaryDirectories.push(root)
  const output = join(root, 'output')
  const service = new SavedFilesService(join(root, 'settings.json'), output)
  return { service, output }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('saved crawl workspace', () => {
  it('uses short sequential names and keeps one active file', async () => {
    const { service } = await makeService()
    const first = await service.createNewFile()
    const second = await service.createNewFile()

    expect(first.activeFile?.name).toMatch(/^sim-\d{6}-01\.csv$/)
    expect(second.activeFile?.name).toMatch(/^sim-\d{6}-02\.csv$/)
    expect(second.files.filter((file) => file.isActive)).toHaveLength(1)
  })

  it('appends to the active file and deduplicates across crawl jobs', async () => {
    const { service } = await makeService()
    const first = await service.appendCrawl(['911046786', '978918612'])
    const second = await service.appendCrawl(['978918612', '912345678'])

    expect(first.addedCount).toBe(2)
    expect(second.addedCount).toBe(1)
    expect(second.totalCount).toBe(3)
    expect(parseManagedCsvValues(await readFile(second.path, 'utf8')).values).toEqual([
      '911046786',
      '978918612',
      '912345678'
    ])
  })

  it('rewrites the same active CSV with interpretation columns when enabled', async () => {
    const { service } = await makeService()
    const plain = await service.appendCrawl(['911046786'])
    await service.setIncludeAnalysis(true)
    const analyzed = await service.appendCrawl(['978918612'])
    const text = await readFile(analyzed.path, 'utf8')

    expect(analyzed.path).toBe(plain.path)
    expect(analyzed.includesAnalysis).toBe(true)
    expect(text).toContain('91 - DN 1')
    expect(parseManagedCsvValues(text).values).toEqual(['911046786', '978918612'])
  })

  it('switching folders closes the previous active file', async () => {
    const { service, output } = await makeService()
    await service.appendCrawl(['911046786'])
    const nextFolder = join(dirname(output), 'next')
    await mkdir(nextFolder)

    const state = await service.setDirectory(nextFolder)

    expect(state.directory).toBe(await realpath(nextFolder))
    expect(state.activeFile).toBeUndefined()
  })

  it('reads column A from both plain and interpreted managed CSV files', () => {
    const analyzed = createManagedCrawlCsvText(['911046786'], true)

    expect(parseManagedCsvValues('911046786\r\n978918612\r\n').values).toEqual([
      '911046786',
      '978918612'
    ])
    expect(parseManagedCsvValues(analyzed).values).toEqual(['911046786'])
  })

  it('emits UTF-8 analysis CSV with Windows CRLF line endings', () => {
    const analyzed = createManagedCrawlCsvText(['911046786', '978918612'], true)

    expect(analyzed.startsWith('\uFEFF')).toBe(true)
    expect(analyzed).toContain('\r\n')
    expect(analyzed.replaceAll('\r\n', '')).not.toContain('\n')
    expect(Buffer.from(analyzed, 'utf8').toString('utf8')).toBe(analyzed)
  })

  it('rejects a selected save directory that is a symlink or Windows junction', async () => {
    const { service, output } = await makeService()
    await service.getState()
    const target = join(dirname(output), 'target-folder')
    const linked = join(dirname(output), 'linked-folder')
    await mkdir(target)
    await symlink(target, linked, process.platform === 'win32' ? 'junction' : 'dir')

    await expect(service.setDirectory(linked)).rejects.toMatchObject({
      code: 'INVALID_SAVE_FOLDER'
    })
  })
})
