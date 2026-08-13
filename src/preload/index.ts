import { contextBridge, ipcRenderer } from 'electron'
import { SITES } from '../shared/sites'
import type { SelectionAnalysisModel } from '../shared/huyen-so/selection-analysis'
import type {
  AppErrorPayload,
  AppPlatform,
  BulkCsvOpenResult,
  BulkFileFormat,
  BulkFileSaveResult,
  BrowserAction,
  BrowserBounds,
  BrowserState,
  CrawlProgress,
  CrawlSummary,
  FileWorkspaceState,
  SimAppApi,
  SiteId
} from '../shared/types'

function currentPlatform(): AppPlatform {
  if (process.platform === 'darwin' || process.platform === 'win32') return process.platform
  return 'linux'
}

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: SimAppApi = {
  platform: currentPlatform(),
  sites: SITES,
  openSite: (siteId: SiteId) => ipcRenderer.invoke('site:open', siteId),
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserAction: (action: BrowserAction) => ipcRenderer.invoke('browser:action', action),
  setBrowserBounds: (bounds: BrowserBounds) => ipcRenderer.send('browser:set-bounds', bounds),
  setBrowserVisible: (visible: boolean) => ipcRenderer.send('browser:set-visible', visible),
  startCrawl: () => ipcRenderer.invoke('crawl:start') as Promise<CrawlSummary>,
  cancelCrawl: () => ipcRenderer.invoke('crawl:cancel'),
  getFileWorkspace: () => ipcRenderer.invoke('files:get-workspace') as Promise<FileWorkspaceState>,
  chooseSaveFolder: () => ipcRenderer.invoke('files:choose-folder') as Promise<FileWorkspaceState>,
  setCrawlAnalysis: (enabled: boolean) =>
    ipcRenderer.invoke('files:set-analysis', enabled) as Promise<FileWorkspaceState>,
  createCrawlFile: () => ipcRenderer.invoke('files:create') as Promise<FileWorkspaceState>,
  openBulkCsv: () => ipcRenderer.invoke('bulk:open-csv') as Promise<BulkCsvOpenResult>,
  openSavedBulkCsv: (path: string) =>
    ipcRenderer.invoke('bulk:open-saved-csv', path) as Promise<BulkCsvOpenResult>,
  saveBulkFile: (data: Uint8Array, format: BulkFileFormat, sourcePath?: string) =>
    ipcRenderer.invoke('bulk:save-file', data, format, sourcePath) as Promise<BulkFileSaveResult>,
  clearSiteData: (siteId: SiteId) => ipcRenderer.invoke('site:clear-data', siteId),
  onBrowserState: (callback: (state: BrowserState) => void) => subscribe('browser:state', callback),
  onHuyenSoResult: (callback: (result: SelectionAnalysisModel | null) => void) =>
    subscribe('huyen-so:result', callback),
  onCrawlProgress: (callback: (progress: CrawlProgress) => void) => subscribe('crawl:progress', callback),
  onAppError: (callback: (error: AppErrorPayload) => void) => subscribe('app:error', callback)
}

contextBridge.exposeInMainWorld('simApp', api)
