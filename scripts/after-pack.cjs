const { execFileSync } = require('node:child_process')
const { constants, copyFileSync, existsSync, lstatSync } = require('node:fs')
const { join, resolve } = require('node:path')

const projectRoot = resolve(__dirname, '..')

const UNUSED_PERMISSION_KEYS = [
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription'
]

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const contentsPath = join(context.appOutDir, appName, 'Contents')
  const resourcesPath = join(contentsPath, 'Resources')
  const plistPath = join(contentsPath, 'Info.plist')
  const helperLookupName = context.packager.appInfo.sanitizedProductName.normalize('NFD')
  const transportSecurity = JSON.stringify({
    NSAllowsArbitraryLoads: false,
    NSAllowsLocalNetworking: false
  })

  // electron-builder normalizes macOS helper filenames to NFD, while CFBundleName
  // otherwise retains the NFC spelling from productName. Electron resolves helper
  // bundles from CFBundleName, so both forms must match byte-for-byte.
  execFileSync('/usr/bin/plutil', [
    '-replace',
    'CFBundleName',
    '-string',
    helperLookupName,
    plistPath
  ])

  execFileSync('/usr/bin/plutil', [
    '-replace',
    'NSAppTransportSecurity',
    '-json',
    transportSecurity,
    plistPath
  ])

  for (const key of UNUSED_PERMISSION_KEYS) {
    try {
      execFileSync('/usr/bin/plutil', ['-remove', key, plistPath], { stdio: 'ignore' })
    } catch {
      // Electron's default plist changes over time; a missing unused key is harmless.
    }
  }

  // The Windows Electron distribution keeps these notices beside the executable.
  // A macOS bundle would otherwise drop the sibling files from Electron's archive,
  // so copy them into Resources before code signing and DMG creation.
  const electronNotices = [
    ['LICENSE', 'LICENSE.electron.txt'],
    ['LICENSES.chromium.html', 'LICENSES.chromium.html']
  ]
  for (const [sourceName, destinationName] of electronNotices) {
    const sourcePath = join(projectRoot, 'node_modules', 'electron', 'dist', sourceName)
    const destinationPath = join(resourcesPath, destinationName)
    if (!existsSync(sourcePath)) throw new Error(`Thiếu thông báo giấy phép Electron: ${sourcePath}`)
    const sourceInfo = lstatSync(sourcePath)
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw new Error(`Thông báo giấy phép Electron không phải file thường: ${sourcePath}`)
    }
    copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL)
  }
}
