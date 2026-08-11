const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

const UNUSED_PERMISSION_KEYS = [
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription'
]

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const plistPath = join(context.appOutDir, appName, 'Contents', 'Info.plist')
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
}
