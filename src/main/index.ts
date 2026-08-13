import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BrowserManager } from './browser-manager'
import { CrawlService } from './crawl/service'
import { SavedFilesService } from './saved-files'
import { toAppError } from './errors'
import {
  createBulkDefaultPath,
  readBulkCsvText,
  validateBulkDestination,
  validateBulkFormat,
  validateBulkOutputData,
  validateBulkSourcePath,
  writeBulkFileAtomic
} from './bulk-files'
import type { BrowserAction, BrowserBounds, SiteId } from '../shared/types'

const APP_ID = 'vn.daosim.desktop'

let mainWindow: BrowserWindow | null = null
let browserManager: BrowserManager | null = null
let crawlService: CrawlService | null = null
let savedFilesService: SavedFilesService | null = null
let trustedRendererUrl: URL | null = null

if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

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
  ipcMain.handle('files:get-workspace', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!savedFilesService) throw new Error('Kho file chưa sẵn sàng.')
      return await savedFilesService.getState()
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('files:choose-folder', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!mainWindow || !savedFilesService) throw new Error('Kho file chưa sẵn sàng.')
      if (crawlService?.isRunning()) {
        throw new Error('Hãy chờ crawl hoàn tất trước khi đổi thư mục lưu.')
      }
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: 'Chọn thư mục lưu file Đào Sim',
        defaultPath: await savedFilesService.getDirectory(),
        properties: ['openDirectory', 'createDirectory']
      })
      if (selected.canceled || selected.filePaths.length === 0) {
        return await savedFilesService.getState()
      }
      return await savedFilesService.setDirectory(selected.filePaths[0])
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('files:set-analysis', async (event, enabled: unknown) => {
    try {
      assertTrustedSender(event.sender)
      if (!savedFilesService) throw new Error('Kho file chưa sẵn sàng.')
      if (crawlService?.isRunning()) {
        throw new Error('Không thể đổi chế độ luận giải khi đang crawl.')
      }
      return await savedFilesService.setIncludeAnalysis(enabled)
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('files:create', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!savedFilesService) throw new Error('Kho file chưa sẵn sàng.')
      if (crawlService?.isRunning()) {
        throw new Error('Hãy chờ crawl hoàn tất trước khi tạo file mới.')
      }
      return await savedFilesService.createNewFile()
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
  ipcMain.handle('bulk:open-csv', async (event) => {
    try {
      assertTrustedSender(event.sender)
      if (!mainWindow) throw new Error('Cửa sổ chưa sẵn sàng.')
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: 'Mở file CSV để luận số',
        defaultPath: await savedFilesService?.getDirectory(),
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (selected.canceled || selected.filePaths.length === 0) return { canceled: true }
      const filePath = selected.filePaths[0]
      const text = await readBulkCsvText(filePath)
      return { canceled: false, path: filePath, text }
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle('bulk:open-saved-csv', async (event, filePath: unknown) => {
    try {
      assertTrustedSender(event.sender)
      if (!savedFilesService) throw new Error('Kho file chưa sẵn sàng.')
      const result = await savedFilesService.readSavedCsv(filePath)
      return {
        canceled: false,
        path: result.path,
        text: result.values.length ? `${result.values.join('\r\n')}\r\n` : ''
      }
    } catch (error) {
      emitError(error)
    }
  })
  ipcMain.handle(
    'bulk:save-file',
    async (event, dataValue: unknown, formatValue: unknown, sourcePathValue?: unknown) => {
      try {
        assertTrustedSender(event.sender)
        if (!mainWindow) throw new Error('Cửa sổ chưa sẵn sàng.')
        const data = validateBulkOutputData(dataValue)
        const format = validateBulkFormat(formatValue)
        const sourcePath = validateBulkSourcePath(sourcePathValue)
        const selected = await dialog.showSaveDialog(mainWindow, {
          title: format === 'csv' ? 'Lưu kết quả luận số CSV' : 'Lưu kết quả luận số Excel',
          defaultPath: createBulkDefaultPath(
            savedFilesService ? await savedFilesService.getDirectory() : app.getPath('downloads'),
            format,
            sourcePath,
            Boolean(savedFilesService)
          ),
          filters: [
            format === 'csv'
              ? { name: 'CSV', extensions: ['csv'] }
              : { name: 'Excel', extensions: ['xlsx'] }
          ]
        })
        if (selected.canceled || !selected.filePath) return { canceled: true }
        const filePath = validateBulkDestination(selected.filePath, format)
        await writeBulkFileAtomic(filePath, data, format)
        return { canceled: false, path: filePath }
      } catch (error) {
        emitError(error)
      }
    }
  )
}

async function createWindow(): Promise<void> {
  const rendererFile = join(__dirname, '../renderer/index.html')
  const localDevRendererUrl = devRendererUrl()
  const isMac = process.platform === 'darwin'
  trustedRendererUrl = localDevRendererUrl ?? new URL(pathToFileURL(rendererFile).toString())

  const windowInstance = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: 'Đào Sim',
    autoHideMenuBar: process.platform === 'win32',
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 18 }
        }
      : {}),
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
  savedFilesService ??= new SavedFilesService(
    join(app.getPath('userData'), 'file-workspace.json'),
    join(app.getPath('downloads'), 'DaoSim')
  )
  const service = new CrawlService(windowInstance, manager, savedFilesService)
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
