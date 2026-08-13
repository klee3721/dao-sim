import type { SelectionAnalysisModel } from './huyen-so/selection-analysis'

export type AppPlatform = 'darwin' | 'win32' | 'linux'

export type SiteId = 'khosim' | 'simthanglong' | 'viettel' | 'vnpt'

export type Completeness =
  | 'verified_complete'
  | 'returned_set_complete'
  | 'best_effort'
  | 'partial'

export interface SiteDefinition {
  id: SiteId
  name: string
  shortName: string
  homeUrl: string
  color: string
}

export interface BrowserState {
  siteId: SiteId | null
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop' | 'home'

export interface CrawlProgress {
  phase: 'preflight' | 'fetching' | 'validating' | 'retrying'
  message: string
  current?: number
  total?: number
  collected: number
  unique: number
  attempt?: number
}

export interface CrawlSummary {
  siteId: SiteId
  sourceUrl: string
  count: number
  duplicateCount: number
  invalidCount: number
  completeness: Completeness
  completenessLabel: string
  warning?: string
  suggestedFilename: string
  finishedAt: string
  savedFilePath: string
  savedFileName: string
  savedAddedCount: number
  savedTotalCount: number
  includesAnalysis: boolean
}

export type SavedFileFormat = 'csv' | 'xlsx'

export interface SavedFileEntry {
  path: string
  name: string
  format: SavedFileFormat
  size: number
  modifiedAt: string
  isActive: boolean
  includesAnalysis?: boolean
}

export interface FileWorkspaceState {
  directory: string
  includeAnalysis: boolean
  activeFile?: SavedFileEntry
  files: SavedFileEntry[]
}

export type BulkFileFormat = 'csv' | 'xlsx'

export interface BulkCsvOpenResult {
  canceled: boolean
  path?: string
  text?: string
}

export interface BulkFileSaveResult {
  canceled: boolean
  path?: string
}

export interface AppErrorPayload {
  code: string
  message: string
}

export interface SimAppApi {
  platform: AppPlatform
  sites: SiteDefinition[]
  openSite(siteId: SiteId): Promise<void>
  navigate(url: string): Promise<void>
  browserAction(action: BrowserAction): Promise<void>
  setBrowserBounds(bounds: BrowserBounds): void
  setBrowserVisible(visible: boolean): void
  startCrawl(): Promise<CrawlSummary>
  cancelCrawl(): Promise<void>
  getFileWorkspace(): Promise<FileWorkspaceState>
  chooseSaveFolder(): Promise<FileWorkspaceState>
  setCrawlAnalysis(enabled: boolean): Promise<FileWorkspaceState>
  createCrawlFile(): Promise<FileWorkspaceState>
  openBulkCsv(): Promise<BulkCsvOpenResult>
  openSavedBulkCsv(path: string): Promise<BulkCsvOpenResult>
  saveBulkFile(
    data: Uint8Array,
    format: BulkFileFormat,
    sourcePath?: string
  ): Promise<BulkFileSaveResult>
  clearSiteData(siteId: SiteId): Promise<void>
  onBrowserState(callback: (state: BrowserState) => void): () => void
  onHuyenSoResult(callback: (result: SelectionAnalysisModel | null) => void): () => void
  onCrawlProgress(callback: (progress: CrawlProgress) => void): () => void
  onAppError(callback: (error: AppErrorPayload) => void): () => void
}

declare global {
  interface Window {
    simApp: SimAppApi
  }
}
