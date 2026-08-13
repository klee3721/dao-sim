const { createHash } = require('node:crypto')
const {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, join, resolve } = require('node:path')
const asar = require('@electron/asar')
const unzipper = require('unzipper')

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

const installerPath = join(
  releaseDirectory,
  `${productName}-Setup-${version}-${architecture}.exe`.normalize('NFC')
)
const zipPath = join(
  releaseDirectory,
  `${productName}-${version}-${architecture}.zip`.normalize('NFC')
)

function validateRegularFile(filePath, minimumBytes) {
  if (!existsSync(filePath)) throw new Error(`Không tìm thấy artifact: ${filePath}`)
  const fileInfo = lstatSync(filePath)
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
    throw new Error(`Artifact không phải file thường: ${filePath}`)
  }
  if (fileInfo.size < minimumBytes) throw new Error(`Artifact quá nhỏ: ${filePath}`)
}

function validatePe(filePath, label, allowedMachines) {
  const data = readFileSync(filePath)
  if (data.length < 512 || data.toString('ascii', 0, 2) !== 'MZ') {
    throw new Error(`${label} không có DOS/PE MZ header: ${filePath}`)
  }
  const peOffset = data.readUInt32LE(0x3c)
  if (peOffset < 0x40 || peOffset + 24 > data.length) {
    throw new Error(`${label} có PE offset không hợp lệ: ${filePath}`)
  }
  if (!data.subarray(peOffset, peOffset + 4).equals(Buffer.from([0x50, 0x45, 0, 0]))) {
    throw new Error(`${label} thiếu PE signature: ${filePath}`)
  }
  const machine = data.readUInt16LE(peOffset + 4)
  if (!allowedMachines.includes(machine)) {
    throw new Error(`${label} có PE machine không hợp lệ (0x${machine.toString(16)}): ${filePath}`)
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function validateSafeZipEntries(entries) {
  if (entries.length === 0) throw new Error('ZIP Windows trống.')
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/')
    if (
      normalized.startsWith('/') ||
      /^[A-Za-z]:/.test(normalized) ||
      normalized.split('/').includes('..')
    ) {
      throw new Error(`ZIP chứa đường dẫn không an toàn: ${entry}`)
    }
  }
}

function assertPeContainsMetadata(filePath) {
  const executable = readFileSync(filePath)
  const utf16Strings = [productName, version]
  for (const expected of utf16Strings) {
    if (!executable.includes(Buffer.from(expected, 'utf16le'))) {
      throw new Error(`Ứng dụng Windows thiếu PE metadata ${JSON.stringify(expected)}: ${filePath}`)
    }
  }
}

function assertAsarMetadata(archivePath) {
  const archiveFiles = asar.listPackage(archivePath).map((entry) => entry.replace(/^\//, ''))
  if (!archiveFiles.includes('package.json')) {
    throw new Error(`app.asar không chứa package.json: ${archivePath}`)
  }
  if (!archiveFiles.includes('out/main/index.js')) {
    throw new Error(`app.asar không chứa out/main/index.js: ${archivePath}`)
  }

  const packagedMetadata = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8'))
  if (packagedMetadata.name !== packageJson.name) {
    throw new Error(`Sai package name trong app.asar: ${packagedMetadata.name}`)
  }
  if (packagedMetadata.version !== version) {
    throw new Error(`Sai phiên bản trong app.asar: ${packagedMetadata.version}`)
  }

  const mainBundle = asar.extractFile(archivePath, 'out/main/index.js').toString('utf8')
  if (!mainBundle.includes(JSON.stringify(appId))) {
    throw new Error(`Main bundle không chứa appId ${appId}: ${archivePath}`)
  }
}

async function verify() {
  validateRegularFile(installerPath, 1024 * 1024)
  validateRegularFile(zipPath, 1024 * 1024)
  // NSIS can use either an i386 (0x14c) or x64 (0x8664) launcher even when
  // its packaged application payload is strictly x64.
  validatePe(installerPath, 'NSIS installer', [0x14c, 0x8664])

  const directory = await unzipper.Open.file(zipPath)
  const fileEntries = directory.files.filter((entry) => entry.type === 'File')
  const entries = directory.files.map((entry) => entry.path)
  validateSafeZipEntries(entries)
  const executableEntries = fileEntries.filter(
    (entry) => basename(entry.path).normalize('NFC') === `${productName}.exe`.normalize('NFC')
  )
  const asarEntries = fileEntries.filter((entry) =>
    /(?:^|\/)resources\/app\.asar$/.test(entry.path.replaceAll('\\', '/'))
  )
  if (executableEntries.length !== 1) {
    throw new Error(`ZIP phải chứa đúng một ${productName}.exe, hiện có ${executableEntries.length}.`)
  }
  if (asarEntries.length !== 1) {
    throw new Error(`ZIP phải chứa đúng một resources/app.asar, hiện có ${asarEntries.length}.`)
  }

  const extractionDirectory = mkdtempSync(join(tmpdir(), 'dao-sim-win-verify-'))
  try {
    const executablePath = join(extractionDirectory, `${productName}.exe`)
    const archivePath = join(extractionDirectory, 'app.asar')
    writeFileSync(executablePath, await executableEntries[0].buffer(), { flag: 'wx' })
    writeFileSync(archivePath, await asarEntries[0].buffer(), { flag: 'wx' })
    validateRegularFile(executablePath, 1024 * 1024)
    validateRegularFile(archivePath, 1024)
    validatePe(executablePath, 'Ứng dụng Windows', [0x8664])
    assertPeContainsMetadata(executablePath)
    assertAsarMetadata(archivePath)
  } finally {
    rmSync(extractionDirectory, { recursive: true, force: true })
  }

  const installerHash = sha256(installerPath)
  const zipHash = sha256(zipPath)
  console.log(`Đã xác minh Windows ${version} ${architecture}:`)
  console.log(`  ${basename(installerPath)}  SHA-256 ${installerHash}`)
  console.log(`  ${basename(zipPath)}  SHA-256 ${zipHash}`)
  console.log(`  appId cấu hình=${appId}; executable=${productName}.exe; package name/version hợp lệ.`)
  return { installerHash, zipHash }
}

const verification = verify()
if (require.main === module) {
  verification.catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
module.exports = verification
