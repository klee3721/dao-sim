const {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} = require('node:fs')
const { basename, join, resolve } = require('node:path')

const projectRoot = resolve(__dirname, '..')
const outputPath = join(projectRoot, 'assets', 'icon.ico')
const iconSources = [
  ['assets/AppIcon.iconset/icon_16x16.png', 16],
  ['assets/AppIcon.iconset/icon_16x16@2x.png', 32],
  ['assets/AppIcon.iconset/icon_32x32@2x.png', 64],
  ['assets/AppIcon.iconset/icon_128x128.png', 128],
  ['assets/AppIcon.iconset/icon_128x128@2x.png', 256]
]

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readPng(relativePath, expectedSize) {
  const sourcePath = join(projectRoot, relativePath)
  const sourceInfo = lstatSync(sourcePath)
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error(`Nguồn icon không phải file thường: ${sourcePath}`)
  }

  const png = readFileSync(sourcePath)
  if (png.length < 24 || !png.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Nguồn icon không phải PNG hợp lệ: ${sourcePath}`)
  }

  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(
      `Sai kích thước ${basename(sourcePath)}: ${width}x${height}, cần ${expectedSize}x${expectedSize}`
    )
  }
  return { png, size: expectedSize }
}

function createIco(entries) {
  const directorySize = 6 + entries.length * 16
  const totalSize = directorySize + entries.reduce((sum, entry) => sum + entry.png.length, 0)
  const ico = Buffer.alloc(totalSize)

  ico.writeUInt16LE(0, 0)
  ico.writeUInt16LE(1, 2)
  ico.writeUInt16LE(entries.length, 4)

  let imageOffset = directorySize
  entries.forEach((entry, index) => {
    const directoryOffset = 6 + index * 16
    const encodedSize = entry.size === 256 ? 0 : entry.size
    ico.writeUInt8(encodedSize, directoryOffset)
    ico.writeUInt8(encodedSize, directoryOffset + 1)
    ico.writeUInt8(0, directoryOffset + 2)
    ico.writeUInt8(0, directoryOffset + 3)
    ico.writeUInt16LE(1, directoryOffset + 4)
    ico.writeUInt16LE(32, directoryOffset + 6)
    ico.writeUInt32LE(entry.png.length, directoryOffset + 8)
    ico.writeUInt32LE(imageOffset, directoryOffset + 12)
    entry.png.copy(ico, imageOffset)
    imageOffset += entry.png.length
  })

  return ico
}

const ico = createIco(iconSources.map(([sourcePath, size]) => readPng(sourcePath, size)))
if (existsSync(outputPath)) {
  const existing = lstatSync(outputPath)
  if (!existing.isFile() || existing.isSymbolicLink()) {
    throw new Error(`Từ chối ghi đè đường dẫn icon không phải file thường: ${outputPath}`)
  }
  if (readFileSync(outputPath).equals(ico)) {
    console.log(`Icon Windows đã đúng: ${outputPath}`)
    process.exit(0)
  }
}

const temporaryPath = `${outputPath}.${process.pid}.tmp`
try {
  writeFileSync(temporaryPath, ico, { flag: 'wx' })
  renameSync(temporaryPath, outputPath)
} finally {
  if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
}

console.log(`Đã tạo icon Windows ${iconSources.length} kích thước: ${outputPath}`)
