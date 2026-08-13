const { execFileSync } = require('node:child_process')
const {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync
} = require('node:fs')
const { homedir, tmpdir } = require('node:os')
const { basename, dirname, extname, join, relative, resolve } = require('node:path')

const projectRoot = resolve(__dirname, '..')
const releaseDirectory = join(projectRoot, 'release')
const applicationsDirectory = '/Applications'
const trashDirectory = join(homedir(), '.Trash')
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const bundleId = packageJson.build?.appId
const productName = packageJson.build?.productName
const version = packageJson.version
const architecture = process.argv[2] || 'arm64'

if (process.platform !== 'darwin') {
  throw new Error('Chỉ có thể cài bản macOS khi chạy trên macOS.')
}
if (typeof bundleId !== 'string' || typeof productName !== 'string' || typeof version !== 'string') {
  throw new Error('package.json thiếu appId, productName hoặc version.')
}
if (!['arm64', 'x64', 'universal'].includes(architecture)) {
  throw new Error(`Kiến trúc không được hỗ trợ: ${architecture}`)
}
if (!lstatSync(applicationsDirectory).isDirectory() || !lstatSync(trashDirectory).isDirectory()) {
  throw new Error('Không tìm thấy Applications hoặc Trash của người dùng.')
}

const diskProductName = productName.normalize('NFD')
const dmgPath = join(releaseDirectory, `${diskProductName}-${version}-${architecture}.dmg`)
if (!existsSync(dmgPath) || !lstatSync(dmgPath).isFile()) {
  throw new Error(`Không tìm thấy DMG vừa build: ${dmgPath}`)
}

function plistValue(appPath, key) {
  return execFileSync(
    '/usr/bin/plutil',
    ['-extract', key, 'raw', '-o', '-', join(appPath, 'Contents', 'Info.plist')],
    { encoding: 'utf8' }
  ).trim()
}

function validateApp(appPath, expectedVersion = undefined) {
  const resolvedApp = resolve(appPath)
  if (!existsSync(resolvedApp) || !lstatSync(resolvedApp).isDirectory()) {
    throw new Error(`App không tồn tại hoặc không phải thư mục: ${resolvedApp}`)
  }
  if (plistValue(resolvedApp, 'CFBundleIdentifier') !== bundleId) {
    throw new Error(`Sai bundle ID tại ${resolvedApp}`)
  }
  const actualVersion = plistValue(resolvedApp, 'CFBundleShortVersionString')
  if (expectedVersion && actualVersion !== expectedVersion) {
    throw new Error(`Sai phiên bản tại ${resolvedApp}: ${actualVersion}`)
  }
  return actualVersion
}

function isWithin(parentPath, candidatePath) {
  const pathFromParent = relative(resolve(parentPath), resolve(candidatePath))
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !pathFromParent.startsWith('/')
}

let trashSequence = 0
function moveToTrash(sourcePath) {
  const resolvedSource = resolve(sourcePath)
  if (
    !isWithin(releaseDirectory, resolvedSource) &&
    !isWithin(applicationsDirectory, resolvedSource)
  ) {
    throw new Error(`Từ chối dọn đường dẫn ngoài phạm vi quản lý: ${resolvedSource}`)
  }
  const sourceInfo = lstatSync(resolvedSource)
  if (sourceInfo.isSymbolicLink()) {
    throw new Error(`Từ chối dọn symbolic link: ${resolvedSource}`)
  }

  const sourceName = basename(resolvedSource)
  const sourceExtension = extname(sourceName)
  const sourceStem = sourceName.slice(0, sourceName.length - sourceExtension.length)
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  let trashPath
  do {
    trashSequence += 1
    trashPath = join(
      trashDirectory,
      `${sourceStem}-removed-${timestamp}-${trashSequence}${sourceExtension}`
    )
  } while (existsSync(trashPath))

  renameSync(resolvedSource, trashPath)
  return { sourcePath: resolvedSource, trashPath }
}

function runningBundlePids() {
  const script = `
tell application "System Events"
  set matches to every application process whose bundle identifier is "${bundleId}"
  set output to ""
  repeat with appProcess in matches
    set output to output & (unix id of appProcess as text) & linefeed
  end repeat
  return output
end tell`
  const output = execFileSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8' })
  return output
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isSafeInteger(value) && value > 1)
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') return false
    throw error
  }
}

function stopRunningApps() {
  const pids = runningBundlePids()
  for (const pid of pids) process.kill(pid, 'SIGTERM')

  const deadline = Date.now() + 5_000
  let remaining = pids.filter(processExists)
  while (remaining.length > 0 && Date.now() < deadline) {
    execFileSync('/bin/sleep', ['0.2'])
    remaining = remaining.filter(processExists)
  }
  if (remaining.length > 0) {
    throw new Error(`Đào Sim chưa thoát hoàn toàn (PID: ${remaining.join(', ')}).`)
  }
  return pids
}

function installedApps() {
  const matches = []
  for (const entry of readdirSync(applicationsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue
    const appPath = join(applicationsDirectory, entry.name)
    try {
      if (plistValue(appPath, 'CFBundleIdentifier') === bundleId) matches.push(appPath)
    } catch {
      // Một app không đọc được Info.plist không thuộc phạm vi dọn tự động.
    }
  }
  return matches
}

function installFromDmg() {
  const mountDirectory = mkdtempSync(join(tmpdir(), 'dao-sim-dmg-'))
  let attached = false
  try {
    execFileSync('/usr/bin/hdiutil', ['verify', dmgPath], { stdio: 'ignore' })
    execFileSync(
      '/usr/bin/hdiutil',
      ['attach', '-readonly', '-nobrowse', '-mountpoint', mountDirectory, dmgPath],
      { stdio: 'ignore' }
    )
    attached = true

    const appEntries = readdirSync(mountDirectory, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && entry.name.endsWith('.app')
    )
    if (appEntries.length !== 1) {
      throw new Error(`DMG phải chứa đúng một app, hiện có ${appEntries.length}.`)
    }

    const sourceApp = join(mountDirectory, appEntries[0].name)
    validateApp(sourceApp, version)
    const targetApp = join(applicationsDirectory, appEntries[0].name)
    const stagingApp = join(
      applicationsDirectory,
      `.dao-sim-install-${process.pid}-${Date.now()}.app`
    )
    if (existsSync(stagingApp)) throw new Error(`Đường dẫn staging đã tồn tại: ${stagingApp}`)

    // Chụp danh sách trước khi tạo staging để bản copy mới không bị nhận nhầm
    // là một app cũ cần chuyển vào Trash.
    const existingApps = installedApps()
    if (existsSync(targetApp) && !existingApps.includes(targetApp)) {
      throw new Error(`Có app khác trùng tên nhưng khác bundle ID: ${targetApp}`)
    }

    execFileSync('/usr/bin/ditto', [sourceApp, stagingApp])
    validateApp(stagingApp, version)

    const priorMoves = []
    try {
      for (const existingApp of existingApps) {
        validateApp(existingApp)
        priorMoves.push(moveToTrash(existingApp))
      }
      renameSync(stagingApp, targetApp)
      validateApp(targetApp, version)
      return { targetApp, priorMoves }
    } catch (error) {
      if (existsSync(stagingApp)) moveToTrash(stagingApp)
      for (const moved of priorMoves.reverse()) {
        if (!existsSync(moved.sourcePath) && existsSync(moved.trashPath)) {
          renameSync(moved.trashPath, moved.sourcePath)
        }
      }
      throw error
    }
  } finally {
    if (attached) execFileSync('/usr/bin/hdiutil', ['detach', mountDirectory], { stdio: 'ignore' })
    if (existsSync(mountDirectory)) rmdirSync(mountDirectory)
  }
}

function cleanOldReleaseOutputs() {
  const moved = []
  const currentPrefix = `${productName}-${version}-`.normalize('NFC')

  for (const entry of readdirSync(releaseDirectory, { withFileTypes: true })) {
    const entryPath = join(releaseDirectory, entry.name)
    const normalizedName = entry.name.normalize('NFC')

    if (entry.isFile()) {
      const isReleaseArtifact = /\.(?:dmg|zip)(?:\.blockmap)?$/i.test(normalizedName)
      const isKnownProduct =
        normalizedName.startsWith(`${productName}-`) || normalizedName.startsWith('SIM Crawler-')
      if (isReleaseArtifact && isKnownProduct && !normalizedName.startsWith(currentPrefix)) {
        moved.push(moveToTrash(entryPath))
      }
      continue
    }

    if (!entry.isDirectory() || !/^mac(?:-|$)/.test(entry.name)) continue
    const containedApps = readdirSync(entryPath, { withFileTypes: true })
      .filter((child) => child.isDirectory() && child.name.endsWith('.app'))
      .map((child) => join(entryPath, child.name))
    if (containedApps.length !== 1) {
      throw new Error(`Thư mục debug có cấu trúc không mong đợi: ${entryPath}`)
    }
    validateApp(containedApps[0], version)
    moved.push(moveToTrash(entryPath))
  }

  return moved
}

const stoppedPids = stopRunningApps()
const installation = installFromDmg()
const cleanedOutputs = cleanOldReleaseOutputs()

console.log(`Đã cài ${productName} ${version} vào ${installation.targetApp}`)
console.log(`Đã đóng ${stoppedPids.length} tiến trình Đào Sim cũ.`)
console.log(
  `Đã chuyển ${installation.priorMoves.length + cleanedOutputs.length} bản cũ/debug vào Trash.`
)
console.log(`Giữ lại DMG/ZIP phiên bản ${version} trong ${releaseDirectory}`)
