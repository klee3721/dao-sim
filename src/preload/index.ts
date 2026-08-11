import { contextBridge, ipcRenderer } from 'electron'
import { SITES } from '../shared/sites'
import type {
  AppErrorPayload,
  BrowserAction,
  BrowserBounds,
  BrowserState,
  CrawlProgress,
  CrawlSummary,
  CsvOpenResult,
  CsvSaveResult,
  SimAppApi,
  SiteId
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: SimAppApi = {
  sites: SITES,
  openSite: (siteId: SiteId) => ipcRenderer.invoke('site:open', siteId),
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserAction: (action: BrowserAction) => ipcRenderer.invoke('browser:action', action),
  setBrowserBounds: (bounds: BrowserBounds) => ipcRenderer.send('browser:set-bounds', bounds),
  setBrowserVisible: (visible: boolean) => ipcRenderer.send('browser:set-visible', visible),
  startCrawl: () => ipcRenderer.invoke('crawl:start') as Promise<CrawlSummary>,
  cancelCrawl: () => ipcRenderer.invoke('crawl:cancel'),
  saveLastCrawl: () => ipcRenderer.invoke('crawl:save') as Promise<CsvSaveResult>,
  openCsv: () => ipcRenderer.invoke('csv:open') as Promise<CsvOpenResult>,
  saveCsv: (values: string[], sourcePath?: string) =>
    ipcRenderer.invoke('csv:save', values, sourcePath) as Promise<CsvSaveResult>,
  clearSiteData: (siteId: SiteId) => ipcRenderer.invoke('site:clear-data', siteId),
  onBrowserState: (callback: (state: BrowserState) => void) => subscribe('browser:state', callback),
  onCrawlProgress: (callback: (progress: CrawlProgress) => void) => subscribe('crawl:progress', callback),
  onAppError: (callback: (error: AppErrorPayload) => void) => subscribe('app:error', callback)
}

contextBridge.exposeInMainWorld('simApp', api)
