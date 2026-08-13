const { createHash } = require('node:crypto')
const {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync
} = require('node:fs')
const { basename, join, relative, resolve } = require('node:path')
const asar = require('@electron/asar')

const projectRoot = resolve(__dirname, '..')
const releaseDirectory = join(projectRoot, 'release')
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const productName = packageJson.build?.productName
const appId = packageJson.build?.appId
const version = packageJson.version
const architecture = process.argv[2] || 'x64'

if (typeof productName !== 'string' || typeof appId !== 'string' || typeof version !== 'string') {
  throw new Error('package.json thiếu productName, appId hoặc version.')
}
if (architecture !== 'x64') throw new Error(`Kiến trúc Windows không được hỗ trợ: ${architecture}`)
if (!existsSync(releaseDirectory) || !lstatSync(releaseDirectory).isDirectory()) {
  throw new Error(`Không tìm thấy thư mục release: ${releaseDirectory}`)
}

const installerName = `${productName}-Setup-${version}-${architecture}.exe`.normalize('NFC')
const zipName = `${productName}-${version}-${architecture}.zip`.normalize('NFC')
const installerPath = join(releaseDirectory, installerName)
const zipPath = join(releaseDirectory, zipName)

function isWithin(parentPath, candidatePath) {
  const pathFromParent = relative(resolve(parentPath), resolve(candidatePath))
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !pathFromParent.startsWith('/')
}

function normalizeExpectedArtifact(expectedName) {
  const matches = readdirSync(releaseDirectory).filter(
    (entryName) => entryName.normalize('NFC') === expectedName.normalize('NFC')
  )
  if (matches.length !== 1) {
    throw new Error(`Cần đúng một artifact ${expectedName}, hiện tìm thấy ${matches.length}.`)
  }
  const sourcePath = join(releaseDirectory, matches[0])
  const targetPath = join(releaseDirectory, expectedName)
  const sourceInfo = lstatSync(sourcePath)
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error(`Artifact không phải file thường: ${sourcePath}`)
  }
  if (sourcePath !== targetPath) renameSync(sourcePath, targetPath)
  return targetPath
}

function removeStaleWindowsOutputs() {
  const removed = []
  const currentNames = new Set([
    installerName,
    zipName,
    'latest.yml',
    `${installerName}.blockmap`,
    `${zipName}.blockmap`,
    'SHA256SUMS-windows.txt'
  ].map((name) => name.normalize('NFC')))

  for (const entry of readdirSync(releaseDirectory, { withFileTypes: true })) {
    const entryName = entry.name.normalize('NFC')
    const entryPath = join(releaseDirectory, entry.name)
    if (!isWithin(releaseDirectory, entryPath) || entry.isSymbolicLink()) {
      throw new Error(`Từ chối dọn đường dẫn Windows không an toàn: ${entryPath}`)
    }

    const isWindowsDirectory =
      entry.isDirectory() &&
      /^(?:win-unpacked|win-(?:x64|ia32|arm64|armv7l|universal)-unpacked)$/i.test(entry.name)
    const isKnownProduct =
      entryName.startsWith(`${productName}-`) || entryName.startsWith('SIM Crawler-')
    const isWindowsArtifact =
      entry.isFile() &&
      isKnownProduct &&
      /(?:\.exe|\.exe\.blockmap|-x64\.zip|-x64\.zip\.blockmap)$/i.test(entryName)

    if (isWindowsDirectory) {
      const executablePath = join(entryPath, `${productName}.exe`)
      const asarPath = join(entryPath, 'resources', 'app.asar')
      if (
        !existsSync(executablePath) ||
        !existsSync(asarPath) ||
        !lstatSync(executablePath).isFile() ||
        !lstatSync(asarPath).isFile() ||
        lstatSync(executablePath).isSymbolicLink() ||
        lstatSync(asarPath).isSymbolicLink()
      ) {
        throw new Error(`Thư mục debug Windows có cấu trúc không mong đợi: ${entryPath}`)
      }
      const packagedMetadata = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'))
      const mainBundle = asar.extractFile(asarPath, 'out/main/index.js').toString('utf8')
      if (
        packagedMetadata.name !== packageJson.name ||
        packagedMetadata.version !== version ||
        !mainBundle.includes(JSON.stringify(appId))
      ) {
        throw new Error(`Thư mục debug Windows không đúng bản ${productName} ${version}: ${entryPath}`)
      }
    }

    if ((isWindowsDirectory || isWindowsArtifact) && !currentNames.has(entryName)) {
      rmSync(entryPath, { recursive: isWindowsDirectory, force: false })
      removed.push(entry.name)
    }
  }
  return removed
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function finalize() {
  normalizeExpectedArtifact(installerName)
  normalizeExpectedArtifact(zipName)

  // The verifier checks the NSIS and app executables' PE headers, the ZIP layout,
  // and package name/version inside resources/app.asar before any cleanup happens.
  await require('./verify-win-release.cjs')

  const removed = removeStaleWindowsOutputs()
  const checksumPath = join(releaseDirectory, 'SHA256SUMS-windows.txt')
  const checksumBody = [
    `${sha256(installerPath)}  ${installerName}`,
    `${sha256(zipPath)}  ${zipName}`,
    ''
  ].join('\n')
  const temporaryChecksumPath = `${checksumPath}.${process.pid}.tmp`
  try {
    writeFileSync(temporaryChecksumPath, checksumBody, { encoding: 'utf8', flag: 'wx' })
    renameSync(temporaryChecksumPath, checksumPath)
  } finally {
    if (existsSync(temporaryChecksumPath)) rmSync(temporaryChecksumPath)
  }

  console.log(`Đã hoàn tất bộ phát hành Windows ${version} ${architecture}.`)
  console.log(`Đã xóa ${removed.length} artifact Windows cũ/debug trong ${releaseDirectory}.`)
  console.log(`Không tự cài trên ${process.platform}; chạy ${installerName} trên Windows để cài.`)
}

finalize().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
