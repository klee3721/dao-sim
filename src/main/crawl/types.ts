import type { Session, WebContents } from 'electron'
import type { Completeness, CrawlProgress, SiteId } from '../../shared/types'

export interface CapturedRequest {
  url: string
  method: string
  body?: string
  headers?: Record<string, string>
  capturedAt: number
}

export interface AdapterResult {
  rawNumbers: string[]
  completeness: Completeness
  declaredTotal?: number
  warning?: string
}

export interface CrawlContext {
  siteId: SiteId
  sourceUrl: string
  session: Session
  webContents: WebContents
  signal: AbortSignal
  capturedRequest?: CapturedRequest
  report(progress: Omit<CrawlProgress, 'collected' | 'unique'> & Partial<Pick<CrawlProgress, 'collected' | 'unique'>>): void
  fetchText(url: string, init?: RequestInit): Promise<string>
  fetchJson(url: string, init?: RequestInit): Promise<unknown>
  delay(ms: number): Promise<void>
}

export interface SiteAdapter {
  readonly siteId: SiteId
  supports(url: URL): boolean
  crawl(context: CrawlContext): Promise<AdapterResult>
}
