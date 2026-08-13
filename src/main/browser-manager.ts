import { BrowserWindow, WebContentsView, session, type Session } from 'electron'
import { join } from 'node:path'
import { AppError } from './errors'
import type { CapturedRequest } from './crawl/types'
import { captureWebRequestPatterns, isAllowedCapturedRequest } from './crawl/url-policy'
import type { BrowserAction, BrowserBounds, BrowserState, SiteId } from '../shared/types'
import type { SelectionAnalysisModel } from '../shared/huyen-so/selection-analysis'
import { isAllowedMainFrameUrl, siteById, siteIdFromUrl } from '../shared/sites'

function uploadBody(uploadData: Electron.UploadData[] | undefined): string | undefined {
  if (!uploadData?.length) return undefined
  const chunks = uploadData.flatMap((item) => (item.bytes ? [Buffer.from(item.bytes)] : []))
  if (!chunks.length) return undefined
  return Buffer.concat(chunks).toString('utf8')
}

function safeHeaders(
  siteId: SiteId,
  headers: Record<string, string | string[]>
): Record<string, string> {
  const allowed = new Set(['accept', 'content-type', 'x-requested-with', 'x-xsrf-token'])
  if (siteId === 'vnpt') allowed.add('authentication')
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (!allowed.has(name.toLowerCase())) continue
    result[name] = Array.isArray(value) ? value.join(', ') : value
  }
  return result
}

function chromiumUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s(?:dao-sim|Đào Sim|sim-crawler-macos|SIM Crawler)\/[^\s]+/gi, '')
    .replace(/\sElectron\/[^\s]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isDestroyedObjectError(error: unknown): boolean {
  return error instanceof Error && /object has been destroyed/i.test(error.message)
}

function rethrowUnlessDestroyed(error: unknown): void {
  if (!isDestroyedObjectError(error)) throw error
}

function isSelectionAnalysisModel(value: unknown): value is SelectionAnalysisModel {
  if (!value || typeof value !== 'object') return false
  const model = value as Record<string, unknown>
  if (model.kind !== 'success' && model.kind !== 'error') return false
  if (typeof model.originalInput !== 'string' || model.originalInput.length > 500) return false
  if (model.kind === 'error') return typeof model.error === 'string' && model.error.length <= 2_000
  if (
    typeof model.normalizedInput !== 'string' ||
    typeof model.selectionLabel !== 'string' ||
    typeof model.summary !== 'string' ||
    !Array.isArray(model.pairs) ||
    !Array.isArray(model.energies)
  ) {
    return false
  }
  try {
    return JSON.stringify(value).length <= 512_000
  } catch {
    return false
  }
}

export interface CrawlTarget {
  siteId: SiteId
  url: string
  session: Session
  webContents: Electron.WebContents
  capturedRequest?: CapturedRequest
}

export class BrowserManager {
  private readonly window: BrowserWindow
  private activeView: WebContentsView | null = null
  private activeSiteId: SiteId | null = null
  private bounds: BrowserBounds = { x: 0, y: 0, width: 0, height: 0 }
  private visible = true
  private readonly configuredSessions = new Set<SiteId>()
  private readonly capturedRequests = new Map<SiteId, CapturedRequest>()
  private readonly lastUrls = new Map<SiteId, string>()
  private disposed = false
  private navigationRevision = 0

  constructor(window: BrowserWindow) {
    this.window = window
  }

  async openSite(siteId: SiteId): Promise<void> {
    if (this.isUnavailable()) return
    const site = siteById(siteId)
    if (this.activeSiteId === siteId && this.activeView) {
      const currentView = this.activeView
      if (this.isCurrentView(currentView)) {
        try {
          currentView.setVisible(true)
          this.visible = true
          return
        } catch (error) {
          if (!isDestroyedObjectError(error)) throw error
        }
      }
    }

    this.disposeActiveView()
    if (this.isUnavailable()) return
    const partition = `persist:dao-sim-${siteId}`
    const siteSession = session.fromPartition(partition)
    const compatibleUserAgent = chromiumUserAgent(siteSession.getUserAgent())
    siteSession.setUserAgent(compatibleUserAgent, 'vi-VN,vi;q=0.9,en;q=0.8')
    this.configureSession(siteId, siteSession)

    const view = new WebContentsView({
      webPreferences: {
        partition,
        preload: join(__dirname, '../preload/browser-extension.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    })
    this.activeView = view
    this.activeSiteId = siteId
    this.window.contentView.addChildView(view)
    view.webContents.setUserAgent(compatibleUserAgent)
    view.setBounds(this.bounds)
    view.setVisible(this.visible)
    view.setBackgroundColor('#ffffff')
    this.attachViewEvents(view, siteId)
    await this.loadViewUrl(view, this.lastUrls.get(siteId) ?? site.homeUrl)
    if (this.isCurrentView(view)) this.emitState()
  }

  async navigate(rawUrl: string): Promise<void> {
    if (this.isUnavailable()) return
    const candidate = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`
    const siteId = siteIdFromUrl(candidate)
    if (!siteId) {
      throw new AppError('UNSUPPORTED_URL', 'Ứng dụng chỉ mở bốn website SIM đã được hỗ trợ.')
    }
    if (siteId !== this.activeSiteId || !this.activeView) await this.openSite(siteId)
    const view = this.activeView
    if (!view || this.activeSiteId !== siteId) return
    await this.loadViewUrl(view, candidate)
  }

  async action(action: BrowserAction): Promise<void> {
    if (this.isUnavailable()) return
    const view = this.activeView
    if (!view || !this.isCurrentView(view)) return
    const webContents = this.liveWebContents(view)
    if (!webContents) return

    try {
      const navigationHistory = webContents.navigationHistory
      if (action === 'back' && navigationHistory.canGoBack()) navigationHistory.goBack()
      else if (action === 'forward' && navigationHistory.canGoForward()) navigationHistory.goForward()
      else if (action === 'reload') webContents.reload()
      else if (action === 'stop') webContents.stop()
      else if (action === 'home' && this.activeSiteId) {
        await this.loadViewUrl(view, siteById(this.activeSiteId).homeUrl)
      }
    } catch (error) {
      if (!this.shouldIgnoreViewError(view, error)) throw error
    }
    if (this.isCurrentView(view)) this.emitState()
  }

  setBounds(bounds: BrowserBounds): void {
    if (this.isUnavailable()) return
    try {
      const contentBounds = this.window.getContentBounds()
      this.bounds = {
        x: Math.max(0, Math.round(bounds.x)),
        y: Math.max(0, Math.round(bounds.y)),
        width: Math.max(0, Math.min(Math.round(bounds.width), contentBounds.width)),
        height: Math.max(0, Math.min(Math.round(bounds.height), contentBounds.height))
      }
      const view = this.activeView
      if (view && this.isCurrentView(view)) view.setBounds(this.bounds)
    } catch (error) {
      if (!this.isUnavailable() && !isDestroyedObjectError(error)) throw error
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    if (this.isUnavailable()) return
    const view = this.activeView
    if (!view || !this.isCurrentView(view)) return
    try {
      view.setVisible(visible)
    } catch (error) {
      if (!this.shouldIgnoreViewError(view, error)) throw error
    }
  }

  getCrawlTarget(): CrawlTarget {
    if (this.isUnavailable() || !this.activeView || !this.activeSiteId) {
      throw new AppError('NO_SITE', 'Hãy mở một website và chọn bộ lọc trước khi crawl.')
    }
    const webContents = this.liveWebContents(this.activeView)
    if (!webContents) {
      throw new AppError('NO_SITE', 'Trình duyệt đã đóng. Hãy mở lại website trước khi crawl.')
    }
    const url = webContents.getURL()
    if (!isAllowedMainFrameUrl(url)) {
      throw new AppError('UNSUPPORTED_URL', 'Trang hiện tại không thuộc website được hỗ trợ.')
    }
    return {
      siteId: this.activeSiteId,
      url,
      session: webContents.session,
      webContents,
      capturedRequest: this.capturedRequests.get(this.activeSiteId)
    }
  }

  async clearSiteData(siteId: SiteId): Promise<void> {
    const siteSession = session.fromPartition(`persist:dao-sim-${siteId}`)
    await siteSession.clearStorageData()
    await siteSession.clearCache()
    this.capturedRequests.delete(siteId)
    if (this.isUnavailable() || this.activeSiteId !== siteId || !this.activeView) return
    const view = this.activeView
    const webContents = this.liveWebContents(view)
    if (!webContents) return
    try {
      webContents.reload()
    } catch (error) {
      if (!this.shouldIgnoreViewError(view, error)) throw error
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeActiveView()
  }

  private isUnavailable(): boolean {
    if (this.disposed) return true
    try {
      return this.window.isDestroyed()
    } catch (error) {
      if (isDestroyedObjectError(error)) return true
      throw error
    }
  }

  private liveWebContents(view: WebContentsView): Electron.WebContents | null {
    try {
      const webContents = view.webContents
      return webContents.isDestroyed() ? null : webContents
    } catch (error) {
      if (isDestroyedObjectError(error)) return null
      throw error
    }
  }

  private isCurrentView(view: WebContentsView): boolean {
    return !this.isUnavailable() && this.activeView === view && this.liveWebContents(view) !== null
  }

  private shouldIgnoreViewError(view: WebContentsView, error: unknown): boolean {
    return (
      this.isUnavailable() ||
      this.activeView !== view ||
      this.liveWebContents(view) === null ||
      isDestroyedObjectError(error)
    )
  }

  private async loadViewUrl(view: WebContentsView, url: string): Promise<boolean> {
    if (!this.isCurrentView(view)) return false
    const webContents = this.liveWebContents(view)
    if (!webContents) return false
    const revision = ++this.navigationRevision

    try {
      await webContents.loadURL(url)
    } catch (error) {
      if (revision !== this.navigationRevision || this.shouldIgnoreViewError(view, error)) {
        return false
      }
      throw error
    }

    return revision === this.navigationRevision && this.isCurrentView(view)
  }

  private configureSession(siteId: SiteId, siteSession: Session): void {
    if (this.configuredSessions.has(siteId)) return
    this.configuredSessions.add(siteId)
    siteSession.setPermissionCheckHandler(() => false)
    siteSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    siteSession.on('will-download', (event) => event.preventDefault())

    const capturePatterns = captureWebRequestPatterns(siteId)
    if (capturePatterns.length === 0) return
    siteSession.webRequest.onBeforeRequest({ urls: capturePatterns }, (details, callback) => {
      if (isAllowedCapturedRequest(siteId, details.url, details.method)) {
        this.capturedRequests.set(siteId, {
          url: details.url,
          method: details.method,
          body: uploadBody(details.uploadData),
          capturedAt: Date.now()
        })
      }
      callback({})
    })
    siteSession.webRequest.onBeforeSendHeaders({ urls: capturePatterns }, (details, callback) => {
      if (isAllowedCapturedRequest(siteId, details.url, details.method)) {
        const previous = this.capturedRequests.get(siteId)
        if (previous?.url === details.url && previous.method === details.method) {
          this.capturedRequests.set(siteId, {
            ...previous,
            headers: safeHeaders(siteId, details.requestHeaders)
          })
        }
      }
      callback({ requestHeaders: details.requestHeaders })
    })
  }

  private attachViewEvents(view: WebContentsView, siteId: SiteId): void {
    const webContents = view.webContents
    webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    const guardNavigation = (event: Electron.Event, url: string): void => {
      if (siteIdFromUrl(url) !== siteId) {
        event.preventDefault()
        if (this.isCurrentView(view)) {
          this.emitError('UNSUPPORTED_URL', 'Đã chặn điều hướng ra ngoài website đang sử dụng.')
        }
      }
    }
    webContents.on('will-navigate', guardNavigation)
    webContents.on('will-redirect', guardNavigation)
    webContents.on('ipc-message', (_event, channel, ...args) => {
      if (channel !== 'huyen-so:selection-result' || !this.isCurrentView(view)) return
      const result = args[0]
      if (isSelectionAnalysisModel(result)) this.emitHuyenSoResult(result)
    })
    webContents.on('did-start-loading', () => {
      if (this.isCurrentView(view)) this.emitState()
    })
    webContents.on('did-stop-loading', () => {
      if (this.isCurrentView(view)) this.emitState()
    })
    webContents.on('did-navigate', (_event, url) => {
      if (!this.isCurrentView(view)) return
      this.lastUrls.set(siteId, url)
      this.emitHuyenSoResult(null)
      this.emitState()
    })
    webContents.on('did-navigate-in-page', (_event, url) => {
      if (!this.isCurrentView(view)) return
      this.lastUrls.set(siteId, url)
      this.emitState()
    })
    webContents.on('page-title-updated', (event) => {
      event.preventDefault()
      if (this.isCurrentView(view)) this.emitState()
    })
    webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (this.isCurrentView(view) && isMainFrame && errorCode !== -3) {
        this.emitError('PAGE_LOAD_FAILED', errorDescription)
      }
    })
  }

  private emitState(): void {
    if (this.isUnavailable()) return
    const view = this.activeView
    const webContents = view ? this.liveWebContents(view) : null
    try {
      const state: BrowserState = {
        siteId: this.activeSiteId,
        url: webContents?.getURL() ?? '',
        title: webContents?.getTitle() ?? '',
        loading: webContents?.isLoading() ?? false,
        canGoBack: webContents?.navigationHistory.canGoBack() ?? false,
        canGoForward: webContents?.navigationHistory.canGoForward() ?? false
      }
      this.window.webContents.send('browser:state', state)
    } catch (error) {
      if (!this.isUnavailable() && !isDestroyedObjectError(error)) throw error
    }
  }

  private emitError(code: string, message: string): void {
    if (this.isUnavailable()) return
    try {
      this.window.webContents.send('app:error', { code, message })
    } catch (error) {
      if (!this.isUnavailable() && !isDestroyedObjectError(error)) throw error
    }
  }

  private emitHuyenSoResult(result: SelectionAnalysisModel | null): void {
    if (this.isUnavailable()) return
    try {
      this.window.webContents.send('huyen-so:result', result)
    } catch (error) {
      if (!this.isUnavailable() && !isDestroyedObjectError(error)) throw error
    }
  }

  private disposeActiveView(): void {
    if (!this.activeView) return
    const view = this.activeView
    this.activeView = null
    this.activeSiteId = null
    this.navigationRevision += 1

    let windowDestroyed = true
    try {
      windowDestroyed = this.window.isDestroyed()
    } catch (error) {
      rethrowUnlessDestroyed(error)
    }

    if (!windowDestroyed) {
      try {
        this.window.contentView.removeChildView(view)
      } catch (error) {
        rethrowUnlessDestroyed(error)
      }
    }

    try {
      const webContents = view.webContents
      if (!webContents.isDestroyed()) webContents.close()
    } catch (error) {
      rethrowUnlessDestroyed(error)
    }
  }
}
