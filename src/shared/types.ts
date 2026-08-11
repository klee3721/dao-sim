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
}

export interface CsvOpenResult {
  canceled: boolean
  path?: string
  values?: string[]
  invalidCount?: number
}

export interface CsvSaveResult {
  canceled: boolean
  path?: string
  count?: number
}

export interface AppErrorPayload {
  code: string
  message: string
}

export interface SimAppApi {
  sites: SiteDefinition[]
  openSite(siteId: SiteId): Promise<void>
  navigate(url: string): Promise<void>
  browserAction(action: BrowserAction): Promise<void>
  setBrowserBounds(bounds: BrowserBounds): void
  setBrowserVisible(visible: boolean): void
  startCrawl(): Promise<CrawlSummary>
  cancelCrawl(): Promise<void>
  saveLastCrawl(): Promise<CsvSaveResult>
  openCsv(): Promise<CsvOpenResult>
  saveCsv(values: string[], sourcePath?: string): Promise<CsvSaveResult>
  clearSiteData(siteId: SiteId): Promise<void>
  onBrowserState(callback: (state: BrowserState) => void): () => void
  onCrawlProgress(callback: (progress: CrawlProgress) => void): () => void
  onAppError(callback: (error: AppErrorPayload) => void): () => void
}

declare global {
  interface Window {
    simApp: SimAppApi
  }
}
