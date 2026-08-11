import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BrowserManager } from './browser-manager'
import { CrawlService } from './crawl/service'
import { readSimCsv, writeSimCsvAtomic } from './csv'
import { toAppError } from './errors'
import type { BrowserAction, BrowserBounds, SiteId } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let browserManager: BrowserManager | null = null
let crawlService: CrawlService | null = null
let trustedRendererUrl: URL | null = null

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function devRendererUrl(): URL | null {
  const rawUrl = process.env.ELECTRON_RENDERER_URL
  if (app.isPackaged || !rawUrl) return null

  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol) || !isLoopbackHostname(url.hostname)) {
    throw new Error('ELECTRON_RENDERER_URL chỉ được phép trỏ tới máy cục bộ khi phát triển.')
  }
  return url
}

function isTrustedRendererLocation(rawUrl: string): boolean {
  if (!trustedRendererUrl) return false

  try {
    const candidate = new URL(rawUrl)
    if (trustedRendererUrl.protocol === 'file:') {
      return (
        candidate.protocol === 'file:' &&
        resolve(fileURLToPath(candidate)).normalize('NFC') ===
          resolve(fileURLToPath(trustedRendererUrl)).normalize('NFC')
      )
    }
    return candidate.origin === trustedRendererUrl.origin
  } catch {
    return false
  }
}

function emitError(error: unknown): never {
  const appError = toAppError(error)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:error', { code: appError.code, message: appError.message })
  }
  throw appError
}

function assertTrustedSender(sender: Electron.WebContents): void {
  if (
    !mainWindow ||
    sender !== mainWindow.webContents ||
    !isTrustedRendererLocation(sender.getURL())
  ) {
    throw new Error('IPC sender không hợp lệ.')
  }
}

function registerIpc(): void {
  ipcMain.handle('site:open', async (event, siteId: SiteId) => {
    try {
      assertTrustedSender(event.sender)
      await browserManager?.openSite(siteId)
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('browser:navigate', async (event, url: string) => {
    try {
      assertTrustedSender(event.sender)
      await browserManager?.navigate(url)
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('browser:action', async (event, action: BrowserAction) => {
    try {
      assertTrustedSender(event.sender)
      await browserManager?.action(action)
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.on('browser:set-bounds', (event, bounds: BrowserBounds) => {
    assertTrustedSender(event.sender)
    browserManager?.setBounds(bounds)
  })
  ipcMain.on('browser:set-visible', (event, visible: boolean) => {
    assertTrustedSender(event.sender)
    browserManager?.setVisible(visible)
  })
  ipcMain.handle('crawl:start', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!crawlService) throw new Error('Crawler chưa sẵn sàng.')
      return await crawlService.start()
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('crawl:cancel', (event) => {
    assertTrustedSender(event.sender)
    crawlService?.cancel()
  })
  ipcMain.handle('crawl:save', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!crawlService) throw new Error('Crawler chưa sẵn sàng.')
      return await crawlService.saveLastResult()
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('site:clear-data', async (event, siteId: SiteId) => {
    try {
      assertTrustedSender(event.sender)
      await browserManager?.clearSiteData(siteId)
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('csv:open', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!mainWindow) throw new Error('Cửa sổ chưa sẵn sàng.')
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: 'Mở danh sách SIM',
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (selected.canceled || selected.filePaths.length === 0) return { canceled: true }
      const filePath = selected.filePaths[0]
      const result = await readSimCsv(filePath)
      return { canceled: false, path: filePath, ...result }
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('csv:save', async (event, values: string[], sourcePath?: string) => {
    try {
      assertTrustedSender(event.sender)
      if (!mainWindow) throw new Error('Cửa sổ chưa sẵn sàng.')
      const sourceDirectory = sourcePath ? dirname(sourcePath) : app.getPath('downloads')
      const sourceName = sourcePath ? basename(sourcePath, extname(sourcePath)) : 'danh_sach_sim'
      const selected = await dialog.showSaveDialog(mainWindow, {
        title: 'Lưu danh sách đã lọc',
        defaultPath: join(sourceDirectory, `${sourceName}_filtered.csv`),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (selected.canceled || !selected.filePath) return { canceled: true }
      await writeSimCsvAtomic(selected.filePath, values)
      return { canceled: false, path: selected.filePath, count: values.length }
    } catch (error) {
      emitError(error)
    }
  })
}

async function createWindow(): Promise<void> {
  const rendererFile = join(__dirname, '../renderer/index.html')
  const localDevRendererUrl = devRendererUrl()
  trustedRendererUrl = localDevRendererUrl ?? new URL(pathToFileURL(rendererFile).toString())

  const windowInstance = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: 'Đào Sim',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })
  mainWindow = windowInstance
  windowInstance.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  windowInstance.webContents.on('will-attach-webview', (event) => event.preventDefault())
  const guardRendererNavigation = (event: Electron.Event, url: string): void => {
    if (!isTrustedRendererLocation(url)) event.preventDefault()
  }
  windowInstance.webContents.on('will-navigate', guardRendererNavigation)
  windowInstance.webContents.on('will-redirect', guardRendererNavigation)
  windowInstance.webContents.session.setPermissionCheckHandler(() => false)
  windowInstance.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  const manager = new BrowserManager(windowInstance)
  const service = new CrawlService(windowInstance, manager)
  browserManager = manager
  crawlService = service

  windowInstance.on('close', () => {
    service.cancel()
    manager.dispose()
  })
  windowInstance.on('closed', () => {
    service.cancel()
    manager.dispose()
    if (crawlService === service) crawlService = null
    if (browserManager === manager) browserManager = null
    if (mainWindow === windowInstance) {
      mainWindow = null
      trustedRendererUrl = null
    }
  })
  windowInstance.once('ready-to-show', () => {
    if (!windowInstance.isDestroyed()) windowInstance.show()
  })

  if (localDevRendererUrl) {
    await windowInstance.loadURL(localDevRendererUrl.toString())
  } else {
    await windowInstance.loadFile(rendererFile)
  }
}

app.whenReady().then(async () => {
  registerIpc()
  await createWindow()
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
