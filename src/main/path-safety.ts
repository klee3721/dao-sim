import { posix, win32 } from 'node:path'

export type SupportedPathPlatform = 'win32' | 'posix'

function pathPlatform(platform: NodeJS.Platform | SupportedPathPlatform): SupportedPathPlatform {
  return platform === 'win32' ? 'win32' : 'posix'
}

function pathApi(platform: NodeJS.Platform | SupportedPathPlatform) {
  return pathPlatform(platform) === 'win32' ? win32 : posix
}

/**
 * Accept only fully-qualified local paths. On Windows this deliberately rejects
 * UNC shares, device paths and drive-relative paths; the app's file boundary is
 * limited to ordinary files on a locally mounted drive.
 */
export function isLocalAbsolutePath(
  value: unknown,
  platform: NodeJS.Platform | SupportedPathPlatform = process.platform
): value is string {
  if (typeof value !== 'string' || !pathApi(platform).isAbsolute(value)) return false
  if (pathPlatform(platform) !== 'win32') return true

  const root = win32.parse(win32.normalize(value)).root
  return /^[a-z]:\\$/i.test(root)
}

export function pathComparisonKey(
  value: string,
  platform: NodeJS.Platform | SupportedPathPlatform = process.platform
): string {
  const normalized = pathApi(platform).resolve(value)
  return pathPlatform(platform) === 'win32' ? normalized.toLowerCase() : normalized
}

export function arePathsEquivalent(
  left: string,
  right: string,
  platform: NodeJS.Platform | SupportedPathPlatform = process.platform
): boolean {
  return pathComparisonKey(left, platform) === pathComparisonKey(right, platform)
}

export function hasDirectParent(
  filePath: string,
  directory: string,
  platform: NodeJS.Platform | SupportedPathPlatform = process.platform
): boolean {
  const api = pathApi(platform)
  return arePathsEquivalent(api.dirname(api.resolve(filePath)), api.resolve(directory), platform)
}
