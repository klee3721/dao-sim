import { app, dialog, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { BrowserManager } from '../browser-manager'
import { writeSimCsvAtomic } from '../csv'
import { AppError, toAppError } from '../errors'
import { normalizeAndDedupe } from './normalize'
import type { AdapterResult, CrawlContext, SiteAdapter } from './types'
import { fetchWithAllowedRedirects } from './url-policy'
import type { Completeness, CrawlProgress, CrawlSummary } from '../../shared/types'
import { khoSimAdapter } from './adapters/khosim'
import { simThangLongAdapter } from './adapters/simthanglong'
import { viettelAdapter } from './adapters/viettel'
import { vnptAdapter } from './adapters/vnpt'

const ADAPTERS: SiteAdapter[] = [khoSimAdapter, simThangLongAdapter, viettelAdapter, vnptAdapter]

const COMPLETENESS_LABELS: Record<Completeness, string> = {
  verified_complete: 'Đã kiểm chứng đầy đủ',
  returned_set_complete: 'Đủ tập website cung cấp',
  best_effort: 'Tốt nhất có thể',
  partial: 'Không hoàn tất'
}

interface StoredResult {
  summary: CrawlSummary
  values: string[]
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Đã hủy', 'AbortError'))
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(signal.reason ?? new DOMException('Đã hủy', 'AbortError'))
      },
      { once: true }
    )
  })
}

function safeFilenameSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
}

export class CrawlService {
  private readonly window: BrowserWindow
  private readonly browser: BrowserManager
  private controller: AbortController | null = null
  private lastResult: StoredResult | null = null

  constructor(window: BrowserWindow, browser: BrowserManager) {
    this.window = window
    this.browser = browser
  }

  async start(): Promise<CrawlSummary> {
    if (this.controller) throw new AppError('CRAWL_RUNNING', 'Một job crawl đang chạy.')
    const target = this.browser.getCrawlTarget()
    const sourceUrl = new URL(target.url)
    const adapter = ADAPTERS.find((candidate) => candidate.siteId === target.siteId && candidate.supports(sourceUrl))
    if (!adapter) {
      throw new AppError('NOT_RESULTS_PAGE', 'Trang hiện tại chưa phải trang kết quả có thể crawl.')
    }

    this.controller = new AbortController()
    this.lastResult = null
    const signal = this.controller.signal
    let collected = 0
    let unique = 0

    const report: CrawlContext['report'] = (progress) => {
      collected = progress.collected ?? collected
      unique = progress.unique ?? unique
      const payload: CrawlProgress = { ...progress, collected, unique }
      if (!this.window.isDestroyed()) this.window.webContents.send('crawl:progress', payload)
    }

    const fetchWithRetry = async (url: string, init: RequestInit = {}): Promise<Response> => {
      let lastError: unknown
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (signal.aborted) throw signal.reason
        try {
          const requestInit: RequestInit = {
            ...init,
            credentials: 'include',
            signal,
            headers: {
              accept: '*/*',
              'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8',
              ...Object.fromEntries(new Headers(init.headers).entries())
            }
          }
          const response = await fetchWithAllowedRedirects(
            target.siteId,
            url,
            requestInit,
            (allowedUrl, allowedInit) => target.session.fetch(allowedUrl, allowedInit)
          )
          if (response.ok) return response
          if (response.status === 401 || response.status === 403) {
            throw new AppError('ACCESS_DENIED', 'Website yêu cầu xác thực hoặc đang chặn yêu cầu.')
          }
          if (response.status !== 429 && response.status < 500) {
            throw new AppError('HTTP_ERROR', `Website trả lỗi HTTP ${response.status}.`)
          }
          lastError = new AppError('RETRYABLE_HTTP', `Website trả lỗi HTTP ${response.status}.`)
        } catch (error) {
          if (error instanceof AppError && error.code !== 'RETRYABLE_HTTP') throw error
          lastError = error
        }
        if (attempt < 3) await abortableDelay(500 * 2 ** (attempt - 1), signal)
      }
      throw toAppError(lastError)
    }

    const context: CrawlContext = {
      siteId: target.siteId,
      sourceUrl: target.url,
      session: target.session,
      webContents: target.webContents,
      signal,
      capturedRequest: target.capturedRequest,
      report,
      fetchText: async (url, init) => (await fetchWithRetry(url, init)).text(),
      fetchJson: async (url, init) => {
        const response = await fetchWithRetry(url, init)
        const text = await response.text()
        try {
          return JSON.parse(text) as unknown
        } catch {
          throw new AppError('SITE_CHANGED', 'Website không còn trả dữ liệu đúng định dạng mong đợi.')
        }
      },
      delay: (ms) => abortableDelay(ms, signal)
    }

    try {
      report({ phase: 'preflight', message: 'Đang kiểm tra bộ lọc và số lượng kết quả…' })
      const adapterResult: AdapterResult = await adapter.crawl(context)
      if (adapterResult.completeness === 'partial') {
        throw new AppError('INCOMPLETE', adapterResult.warning ?? 'Job crawl chưa hoàn tất.')
      }
      report({ phase: 'validating', message: 'Đang chuẩn hóa và kiểm tra kết quả…' })
      const normalized = normalizeAndDedupe(adapterResult.rawNumbers)
      if (normalized.invalidCount > 0) {
        throw new AppError(
          'INVALID_RESULTS',
          `Website trả ${normalized.invalidCount} số không hợp lệ; không xuất file để tránh dữ liệu sai.`
        )
      }
      if (
        adapterResult.completeness === 'verified_complete' &&
        adapterResult.declaredTotal !== undefined &&
        normalized.values.length !== adapterResult.declaredTotal
      ) {
        throw new AppError(
          'INCOMPLETE',
          `Website công bố ${adapterResult.declaredTotal} SIM nhưng chỉ xác minh được ${normalized.values.length}.`
        )
      }

      const now = new Date()
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '_',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
      ].join('')
      const pathHint = safeFilenameSegment(decodeURIComponent(sourceUrl.pathname)) || 'ket_qua'
      const summary: CrawlSummary = {
        siteId: target.siteId,
        sourceUrl: target.url,
        count: normalized.values.length,
        duplicateCount: normalized.duplicateCount,
        invalidCount: normalized.invalidCount,
        completeness: adapterResult.completeness,
        completenessLabel: COMPLETENESS_LABELS[adapterResult.completeness],
        warning: adapterResult.warning,
        suggestedFilename: `sim_${target.siteId}_${pathHint}_${stamp}.csv`,
        finishedAt: now.toISOString()
      }
      this.lastResult = { summary, values: normalized.values }
      return summary
    } catch (error) {
      if (signal.aborted) throw new AppError('CANCELLED', 'Đã dừng job crawl.')
      throw toAppError(error)
    } finally {
      this.controller = null
    }
  }

  cancel(): void {
    this.controller?.abort(new DOMException('Đã hủy', 'AbortError'))
  }

  async saveLastResult(): Promise<{ canceled: boolean; path?: string; count?: number }> {
    if (!this.lastResult) throw new AppError('NO_RESULT', 'Chưa có kết quả crawl để lưu.')
    const selected = await dialog.showSaveDialog(this.window, {
      title: 'Lưu danh sách SIM',
      defaultPath: join(app.getPath('downloads'), this.lastResult.summary.suggestedFilename),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (selected.canceled || !selected.filePath) return { canceled: true }
    await writeSimCsvAtomic(selected.filePath, this.lastResult.values)
    return { canceled: false, path: selected.filePath, count: this.lastResult.values.length }
  }
}
