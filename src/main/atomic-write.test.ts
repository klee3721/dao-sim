import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileAtomic } from './atomic-write'

const temporaryDirectories: string[] = []

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dao-sim-atomic-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('atomic file replacement', () => {
  it('atomically replaces an existing destination and leaves no temporary file', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = join(directory, 'kết quả.csv')
    await writeFile(filePath, 'dữ liệu cũ\r\n', 'utf8')

    await writeFileAtomic(filePath, 'dữ liệu mới\r\n')

    expect(await readFile(filePath, 'utf8')).toBe('dữ liệu mới\r\n')
    expect(await readdir(directory)).toEqual(['kết quả.csv'])
  })

  it('does not overwrite a non-regular destination', async () => {
    const directory = await makeTemporaryDirectory()
    const destination = join(directory, 'result.csv')
    await writeFile(destination, 'old\r\n', 'utf8')
    await rm(destination)
    await mkdir(destination)

    await expect(writeFileAtomic(destination, 'new\r\n')).rejects.toMatchObject({
      code: 'INVALID_FILE'
    })
  })
})
