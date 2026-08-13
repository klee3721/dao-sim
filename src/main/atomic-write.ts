import { randomBytes } from 'node:crypto'
import { lstat, open, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { AppError } from './errors'

const LOCK_OR_PERMISSION_ERROR_CODES = new Set(['EACCES', 'EBUSY', 'EPERM', 'ETXTBSY'])

interface NodeErrorLike {
  code?: unknown
}

export interface AtomicWriteOptions {
  invalidPathCode?: string
}

function isMissingPathError(error: unknown): boolean {
  return (error as NodeErrorLike | undefined)?.code === 'ENOENT'
}

function toAtomicWriteError(error: unknown): unknown {
  if (error instanceof AppError) return error
  const code = (error as NodeErrorLike | undefined)?.code
  if (typeof code === 'string' && LOCK_OR_PERMISSION_ERROR_CODES.has(code)) {
    return new AppError(
      'FILE_IN_USE',
      'Không thể cập nhật file. Hãy đóng file trong Excel hoặc kiểm tra quyền ghi rồi thử lại.',
      { cause: error }
    )
  }
  return error
}

async function assertSafeDestination(filePath: string, invalidPathCode: string): Promise<void> {
  const parentInfo = await lstat(dirname(filePath))
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new AppError(
      invalidPathCode,
      'Thư mục đích phải là thư mục cục bộ thông thường, không phải liên kết.'
    )
  }

  try {
    const destinationInfo = await lstat(filePath)
    if (!destinationInfo.isFile() || destinationInfo.isSymbolicLink()) {
      throw new AppError(
        invalidPathCode,
        'File đích phải là file cục bộ thông thường, không phải liên kết.'
      )
    }
    return
  } catch (error) {
    if (isMissingPathError(error)) return
    throw error
  }
}

export async function writeFileAtomic(
  filePath: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const invalidPathCode = options.invalidPathCode ?? 'INVALID_FILE'
  const token = `${process.pid}-${randomBytes(8).toString('hex')}`
  const temporaryPath = join(dirname(filePath), `.dao-sim-${token}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | undefined

  try {
    await assertSafeDestination(filePath, invalidPathCode)
    handle = await open(temporaryPath, 'wx', 0o600)
    await handle.writeFile(typeof data === 'string' ? Buffer.from(data, 'utf8') : data)
    await handle.sync()
    await handle.close()
    handle = undefined
    // Node/libuv rename uses replacement semantics on Windows too. Keeping the
    // original name in place until this single operation avoids a crash window;
    // an Excel lock fails here and leaves the destination untouched.
    await rename(temporaryPath, filePath)
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await unlink(temporaryPath).catch(() => undefined)
    throw toAtomicWriteError(error)
  }
}
