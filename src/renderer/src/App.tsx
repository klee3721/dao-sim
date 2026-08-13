import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {
  AppErrorPayload,
  BrowserAction,
  BrowserState,
  Completeness,
  CrawlProgress,
  CrawlSummary,
  FileWorkspaceState,
  SavedFileEntry,
  SiteDefinition,
  SiteId
} from '../../shared/types'
import type { SelectionAnalysisModel } from '../../shared/huyen-so/selection-analysis'
import { BulkPhoneScreen } from './BulkPhoneScreen'
import { HuyenSoPanel } from './HuyenSoPanel'
import { SavedFileList } from './SavedFileList'

type AppTab = 'browser' | 'bulk'
type ToastTone = 'success' | 'error' | 'neutral'

interface ToastState {
  message: string
  tone: ToastTone
  sequence: number
}

const EMPTY_BROWSER_STATE: BrowserState = {
  siteId: null,
  url: '',
  title: '',
  loading: false,
  canGoBack: false,
  canGoForward: false
}

const EMPTY_FILE_WORKSPACE: FileWorkspaceState = {
  directory: '',
  includeAnalysis: false,
  files: []
}

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN')
const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Đã xảy ra lỗi. Vui lòng thử lại.'
}

function normalizeNavigationInput(rawValue: string): string {
  const value = rawValue.trim()
  if (!value) return value
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function Icon({ name, size = 18 }: { name: string; size?: number }): ReactNode {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  switch (name) {
    case 'browser':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
        </svg>
      )
    case 'file':
      return (
        <svg {...common}>
          <path d="M6 2.75h8l4 4V21H6z" />
          <path d="M14 2.75V7h4M8.8 12h6.4M8.8 15.5h6.4" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3.5 6.5h6l2 2h9v10.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
          <path d="M3.5 9h17" />
        </svg>
      )
    case 'batch':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8M8 12h3M14 12h2M8 16h3M14 16h2" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="m14.5 6-6 6 6 6" />
        </svg>
      )
    case 'forward':
      return (
        <svg {...common}>
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      )
    case 'reload':
      return (
        <svg {...common}>
          <path d="M19.5 7.5V3.8m0 0h-3.7m3.7 0-2.15 2.15A8 8 0 1 0 20 12" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m3.5 11 8.5-7 8.5 7" />
          <path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2.5" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="m12 3 .8 2.3L15 6l-2.2.8L12 9l-.8-2.2L9 6l2.2-.7zM18 11l.7 1.8 1.8.7-1.8.7L18 16l-.7-1.8-1.8-.7 1.8-.7zM7 11l1.2 3.3L11.5 16l-3.3 1.2L7 20.5l-1.2-3.3L2.5 16l3.3-1.7z" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 15V4m0 0 4 4m-4-4L8 8M5 20h14" />
        </svg>
      )
    case 'filter':
      return (
        <svg {...common}>
          <path d="M4 5h16l-6.5 7.2v5.3l-3 1.5v-6.8z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      )
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="3" />
          <path d="M10 5h4M11 18.5h2" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4.5 7h15M9 7V4h6v3M7 7l.8 13h8.4L17 7M10 11v5M14 11v5" />
        </svg>
      )
    case 'rotate':
      return (
        <svg {...common}>
          <path d="M5 7v4h4M5.8 10.2a7 7 0 1 1 .9 6.8" />
        </svg>
      )
    default:
      return null
  }
}

function SiteMark({ site, size = 'normal' }: { site: SiteDefinition; size?: 'small' | 'normal' }) {
  return (
    <span
      className={cx('site-mark', size === 'small' && 'site-mark--small')}
      style={{ '--site-color': site.color } as CSSProperties}
      aria-hidden="true"
    >
      {site.shortName}
    </span>
  )
}

function BrowserViewport({ visible }: { visible: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    let frame = 0
    const syncBounds = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = viewport.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return
        window.simApp.setBrowserBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        })
      })
    }

    const observer = new ResizeObserver(syncBounds)
    observer.observe(viewport)
    window.addEventListener('resize', syncBounds)
    window.addEventListener('scroll', syncBounds, true)
    syncBounds()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.removeEventListener('scroll', syncBounds, true)
    }
  }, [])

  useEffect(() => {
    window.simApp.setBrowserVisible(visible)
    if (visible) {
      requestAnimationFrame(() => {
        const rect = viewportRef.current?.getBoundingClientRect()
        if (!rect || rect.width < 1 || rect.height < 1) return
        window.simApp.setBrowserBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        })
      })
    }
  }, [visible])

  useEffect(() => () => window.simApp.setBrowserVisible(false), [])

  return (
    <div className="browser-viewport" ref={viewportRef} aria-label="Khu vực hiển thị website">
      {!visible && (
        <div className="browser-empty-state">
          <span className="browser-empty-icon"><Icon name="browser" size={28} /></span>
          <h2>Chọn một website để bắt đầu</h2>
          <p>Dùng các nút bên trái để mở trang tìm SIM trong ứng dụng.</p>
        </div>
      )}
    </div>
  )
}

function ProgressBar({ progress }: { progress: CrawlProgress }) {
  const determinate = Boolean(progress.total && progress.total > 0 && progress.current !== undefined)
  const percentage = determinate
    ? Math.max(0, Math.min(100, ((progress.current ?? 0) / (progress.total ?? 1)) * 100))
    : 0

  return (
    <div
      className={cx('progress-track', !determinate && 'progress-track--indeterminate')}
      role="progressbar"
      aria-label="Tiến độ crawl"
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(percentage) : undefined}
    >
      <span className="progress-value" style={determinate ? { width: `${percentage}%` } : undefined} />
    </div>
  )
}

function completenessTone(completeness: Completeness): 'green' | 'blue' | 'amber' | 'red' {
  switch (completeness) {
    case 'verified_complete':
      return 'green'
    case 'returned_set_complete':
      return 'blue'
    case 'best_effort':
      return 'amber'
    case 'partial':
      return 'red'
    default:
      return 'red'
  }
}

interface CrawlPanelProps {
  activeSite?: SiteDefinition
  canCrawl: boolean
  isCrawling: boolean
  isCanceling: boolean
  progress: CrawlProgress | null
  summary: CrawlSummary | null
  fileWorkspace: FileWorkspaceState
  changingFiles: boolean
  huyenSoResult: SelectionAnalysisModel | null
  onChooseFolder: () => void
  onToggleAnalysis: (enabled: boolean) => void
  onCreateFile: () => void
  onCloseHuyenSo: () => void
}

function CrawlPanel({
  activeSite,
  canCrawl,
  isCrawling,
  isCanceling,
  progress,
  summary,
  fileWorkspace,
  changingFiles,
  huyenSoResult,
  onChooseFolder,
  onToggleAnalysis,
  onCreateFile,
  onCloseHuyenSo
}: CrawlPanelProps) {
  return (
    <aside className="inspector" aria-label="Trạng thái crawl">
      <div className="inspector-crawl-content">
        <div className="inspector-heading">
        <span className="section-icon"><Icon name="sparkles" /></span>
        <div>
          <p className="eyebrow">THU THẬP SIM</p>
          <h2>{isCrawling ? 'Đang crawl dữ liệu' : summary ? 'Đã hoàn thành' : 'Sẵn sàng'}</h2>
        </div>
        </div>

      {activeSite ? (
        <div className="active-site-card">
          <SiteMark site={activeSite} size="small" />
          <div>
            <strong>{activeSite.name}</strong>
            <span>Website được hỗ trợ</span>
          </div>
          <span className="status-dot status-dot--online" title="Sẵn sàng" />
        </div>
      ) : (
        <div className="hint-card">
          <Icon name="info" />
          <p>Hãy mở một website và chọn bộ lọc trước khi bấm Crawl.</p>
        </div>
      )}

      <section className="crawl-file-settings" aria-label="Cài đặt file đang lưu">
        <div className="crawl-file-settings-heading">
          <div>
            <p className="eyebrow">FILE ĐANG LƯU</p>
            <strong title={fileWorkspace.activeFile?.path}>
              {fileWorkspace.activeFile?.name ?? 'Sẽ tự tạo khi crawl'}
            </strong>
          </div>
          <button
            className="secondary-button compact-button"
            onClick={onCreateFile}
            disabled={isCrawling || changingFiles}
          >
            <Icon name="file" size={15} />
            Tạo file mới
          </button>
        </div>

        <button
          className="crawl-folder-button"
          onClick={onChooseFolder}
          disabled={isCrawling || changingFiles}
          title={fileWorkspace.directory}
        >
          <Icon name="folder" size={15} />
          <span>
            <small>Thư mục lưu</small>
            <strong>{fileWorkspace.directory ? fileNameFromPath(fileWorkspace.directory) : 'Đang tải…'}</strong>
          </span>
          <em>Đổi</em>
        </button>

        <label className="crawl-analysis-toggle">
          <span>
            <strong>Kèm luận giải</strong>
            <small>Thêm kết quả luận số vào các cột sau cột A.</small>
          </span>
          <input
            type="checkbox"
            checked={fileWorkspace.includeAnalysis}
            onChange={(event) => onToggleAnalysis(event.target.checked)}
            disabled={isCrawling || changingFiles}
          />
          <i aria-hidden="true" />
        </label>
      </section>

      {isCrawling && progress && (
        <section className="progress-section" aria-live="polite">
          <div className="progress-label-row">
            <strong>{progress.message}</strong>
            {progress.current !== undefined && progress.total !== undefined && (
              <span>{NUMBER_FORMAT.format(progress.current)}/{NUMBER_FORMAT.format(progress.total)}</span>
            )}
          </div>
          <ProgressBar progress={progress} />
          <div className="metric-grid metric-grid--compact">
            <div>
              <span>Đã nhận</span>
              <strong>{NUMBER_FORMAT.format(progress.collected)}</strong>
            </div>
            <div>
              <span>SIM duy nhất</span>
              <strong>{NUMBER_FORMAT.format(progress.unique)}</strong>
            </div>
          </div>
          {progress.attempt && progress.attempt > 1 && (
            <p className="retry-note">Đang thử lại lần {progress.attempt}</p>
          )}
          {isCanceling && <p className="retry-note">Đang dừng an toàn…</p>}
        </section>
      )}

      {!isCrawling && summary && (
        <section className="summary-section" aria-live="polite">
          <div className={cx('completion-badge', `completion-badge--${completenessTone(summary.completeness)}`)}>
            <Icon name={summary.completeness === 'partial' ? 'info' : 'check'} />
            <span>{summary.completenessLabel}</span>
          </div>

          <div className="summary-total">
            <strong>{NUMBER_FORMAT.format(summary.count)}</strong>
            <span>SIM sẵn sàng xuất</span>
          </div>

          <dl className="summary-list">
            <div>
              <dt>Trùng đã bỏ</dt>
              <dd>{NUMBER_FORMAT.format(summary.duplicateCount)}</dd>
            </div>
            <div>
              <dt>Không hợp lệ</dt>
              <dd>{NUMBER_FORMAT.format(summary.invalidCount)}</dd>
            </div>
            <div>
              <dt>Hoàn thành</dt>
              <dd>{DATE_FORMAT.format(new Date(summary.finishedAt))}</dd>
            </div>
          </dl>

          {summary.warning && (
            <div className="warning-card">
              <Icon name="info" />
              <p>{summary.warning}</p>
            </div>
          )}

          <div className="crawl-auto-saved">
            <Icon name="check" size={17} />
            <div>
              <strong>Đã tự lưu vào {summary.savedFileName}</strong>
              <span>
                Thêm {NUMBER_FORMAT.format(summary.savedAddedCount)} SIM · file đang có {NUMBER_FORMAT.format(summary.savedTotalCount)} SIM
              </span>
              <small>{summary.includesAnalysis ? 'Có kèm luận giải' : 'CSV một cột, không luận giải'}</small>
            </div>
          </div>
        </section>
      )}

      {!isCrawling && !summary && (
        <div className="inspector-idle">
          <div className="step-row">
            <span>1</span><p>Mở website và chọn bộ lọc SIM.</p>
          </div>
          <div className="step-row">
            <span>2</span><p>Bấm <strong>Crawl toàn bộ</strong> trên thanh công cụ.</p>
          </div>
          <div className="step-row">
            <span>3</span><p>Kết quả tự nối vào file đang lưu, không có số 0 đầu.</p>
          </div>
          {!canCrawl && <p className="support-note">Chỉ bốn website trong danh sách bên trái được hỗ trợ.</p>}
        </div>
      )}
      </div>

      <HuyenSoPanel result={huyenSoResult} onClose={onCloseHuyenSo} />
    </aside>
  )
}

interface BrowserScreenProps {
  browserState: BrowserState
  sites: SiteDefinition[]
  address: string
  setAddress: (value: string) => void
  setAddressFocused: (focused: boolean) => void
  onNavigate: (event: FormEvent<HTMLFormElement>) => void
  onBrowserAction: (action: BrowserAction) => void
  onOpenSite: (siteId: SiteId) => void
  isCrawling: boolean
  isCanceling: boolean
  progress: CrawlProgress | null
  summary: CrawlSummary | null
  fileWorkspace: FileWorkspaceState
  changingFiles: boolean
  huyenSoResult: SelectionAnalysisModel | null
  onStartCrawl: () => void
  onCancelCrawl: () => void
  onChooseFolder: () => void
  onToggleAnalysis: (enabled: boolean) => void
  onCreateFile: () => void
  onCloseHuyenSo: () => void
}

function BrowserScreen({
  browserState,
  sites,
  address,
  setAddress,
  setAddressFocused,
  onNavigate,
  onBrowserAction,
  onOpenSite,
  isCrawling,
  isCanceling,
  progress,
  summary,
  fileWorkspace,
  changingFiles,
  huyenSoResult,
  onStartCrawl,
  onCancelCrawl,
  onChooseFolder,
  onToggleAnalysis,
  onCreateFile,
  onCloseHuyenSo
}: BrowserScreenProps) {
  const activeSite = sites.find((site) => site.id === browserState.siteId)
  const browserVisible = Boolean(browserState.url)

  return (
    <section className="screen browser-screen" aria-label="Trình duyệt SIM">
      <div className="browser-toolbar">
        <div className="navigation-buttons" aria-label="Điều hướng trình duyệt">
          <button
            className="icon-button"
            aria-label="Quay lại"
            title="Quay lại"
            disabled={!browserState.canGoBack}
            onClick={() => onBrowserAction('back')}
          >
            <Icon name="back" />
          </button>
          <button
            className="icon-button"
            aria-label="Tiến tới"
            title="Tiến tới"
            disabled={!browserState.canGoForward}
            onClick={() => onBrowserAction('forward')}
          >
            <Icon name="forward" />
          </button>
          <button
            className="icon-button"
            aria-label={browserState.loading ? 'Dừng tải trang' : 'Tải lại'}
            title={browserState.loading ? 'Dừng tải trang' : 'Tải lại'}
            disabled={!browserState.url}
            onClick={() => onBrowserAction(browserState.loading ? 'stop' : 'reload')}
          >
            <Icon name={browserState.loading ? 'stop' : 'reload'} />
          </button>
          <button
            className="icon-button"
            aria-label="Trang chủ website"
            title="Trang chủ website"
            disabled={!browserState.siteId}
            onClick={() => onBrowserAction('home')}
          >
            <Icon name="home" />
          </button>
        </div>

        <form className="address-form" onSubmit={onNavigate}>
          <span className="address-lock"><Icon name="lock" size={15} /></span>
          <label className="sr-only" htmlFor="address-input">Địa chỉ website</label>
          <input
            id="address-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onFocus={() => setAddressFocused(true)}
            onBlur={() => setAddressFocused(false)}
            placeholder="Nhập địa chỉ website SIM…"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {browserState.loading && <span className="address-spinner" aria-label="Đang tải" />}
        </form>

        <div
          className="huyen-so-auto-badge"
          title="Bôi đen một dãy số trên website để tự động xem luận giải"
          aria-label="Huyền Số đang ở chế độ tự động"
        >
          <Icon name="sparkles" size={14} />
          <span>Huyền Số</span>
          <strong>AUTO</strong>
        </div>

        {isCrawling ? (
          <button className="danger-button toolbar-action" onClick={onCancelCrawl} disabled={isCanceling}>
            <Icon name="stop" />
            <span>{isCanceling ? 'Đang dừng…' : 'Dừng crawl'}</span>
          </button>
        ) : (
          <button
            className="primary-button toolbar-action"
            onClick={onStartCrawl}
            disabled={!browserState.siteId || !browserState.url}
          >
            <Icon name="sparkles" />
            <span>Crawl toàn bộ</span>
          </button>
        )}
      </div>

      <div className="quick-sites-mobile" aria-label="Mở nhanh website">
        {sites.map((site) => (
          <button
            key={site.id}
            className={cx('site-chip', browserState.siteId === site.id && 'site-chip--active')}
            onClick={() => onOpenSite(site.id)}
          >
            <SiteMark site={site} size="small" />
            <span>{site.name}</span>
          </button>
        ))}
      </div>

      <div className="browser-workspace">
        <div className="browser-frame">
          <BrowserViewport visible={browserVisible} />
          <div className="browser-statusbar">
            <span className={cx('status-dot', browserState.loading && 'status-dot--loading', !browserState.loading && browserVisible && 'status-dot--online')} />
            <span className="browser-status-title">
              {browserState.loading ? 'Đang tải trang…' : browserState.title || 'Chưa mở website'}
            </span>
            {activeSite && <span className="browser-site-label">{activeSite.name}</span>}
          </div>
        </div>

        <CrawlPanel
          activeSite={activeSite}
          canCrawl={Boolean(browserState.siteId && browserState.url)}
          isCrawling={isCrawling}
          isCanceling={isCanceling}
          progress={progress}
          summary={summary}
          fileWorkspace={fileWorkspace}
          changingFiles={changingFiles}
          huyenSoResult={huyenSoResult}
          onChooseFolder={onChooseFolder}
          onToggleAnalysis={onToggleAnalysis}
          onCreateFile={onCreateFile}
          onCloseHuyenSo={onCloseHuyenSo}
        />
      </div>
    </section>
  )
}

interface CsvScreenProps {
  sourcePath: string | undefined
  invalidCount: number
  originalValues: string[]
  workingValues: string[]
  tokensInput: string
  setTokensInput: (value: string) => void
  opening: boolean
  saving: boolean
  savedDirectory: string
  savedFiles: SavedFileEntry[]
  onOpen: () => void
  onOpenSaved: (path: string) => void
  onApply: () => void
  onReset: () => void
  onSave: () => void
}

function CsvScreen({
  sourcePath,
  invalidCount,
  originalValues,
  workingValues,
  tokensInput,
  setTokensInput,
  opening,
  saving,
  savedDirectory,
  savedFiles,
  onOpen,
  onOpenSaved,
  onApply,
  onReset,
  onSave
}: CsvScreenProps) {
  const rawTokens = useMemo(
    () => tokensInput.split(/[,\n]+/).map((token) => token.trim()).filter(Boolean),
    [tokensInput]
  )
  const invalidTokens = useMemo(() => rawTokens.filter((token) => !/^\d+$/.test(token)), [rawTokens])
  const tokens = useMemo(
    () => [...new Set(rawTokens.filter((token) => /^\d+$/.test(token)))],
    [rawTokens]
  )
  const removedValues = useMemo(() => {
    if (invalidTokens.length || !tokens.length) return []
    return workingValues.filter((value) => tokens.some((token) => value.includes(token)))
  }, [invalidTokens.length, tokens, workingValues])
  const previewValues = useMemo(() => {
    if (invalidTokens.length || !tokens.length) return workingValues
    return workingValues.filter((value) => !tokens.some((token) => value.includes(token)))
  }, [invalidTokens.length, tokens, workingValues])
  const hasFile = Boolean(sourcePath)
  const hasPendingRule = tokens.length > 0 && invalidTokens.length === 0
  const appliedRemoved = originalValues.length - workingValues.length

  return (
    <section className="screen csv-screen" aria-label="Chỉnh sửa file CSV">
      <div className="csv-header">
        <div>
          <p className="eyebrow">XỬ LÝ FILE CSV</p>
          <h1>Loại SIM theo chuỗi số</h1>
          <p>Giữ nguyên thứ tự và các dòng trùng của file gốc.</p>
        </div>
        <div className="csv-header-actions">
          <button className="secondary-button" onClick={onOpen} disabled={opening || saving}>
            <Icon name="upload" />
            {opening ? 'Đang mở…' : hasFile ? 'Mở file khác' : 'Mở file CSV'}
          </button>
          <button
            className="primary-button"
            onClick={onSave}
            disabled={!hasFile || saving || hasPendingRule || invalidTokens.length > 0}
            title={hasPendingRule ? 'Hãy áp dụng bộ lọc trước khi lưu' : undefined}
          >
            <Icon name="download" />
            {saving ? 'Đang lưu…' : 'Lưu thành file mới'}
          </button>
        </div>
      </div>

      <SavedFileList
        directory={savedDirectory}
        files={savedFiles}
        activePath={sourcePath}
        busy={opening || saving}
        onOpen={onOpenSaved}
      />

      {!hasFile ? (
        <button className="csv-empty-state" onClick={onOpen} disabled={opening}>
          <span className="csv-empty-icon"><Icon name="file" size={30} /></span>
          <strong>Chọn file CSV một cột</strong>
          <span>Mỗi dòng là một số điện thoại. File gốc sẽ không bị ghi đè.</span>
          <em><Icon name="upload" size={16} /> {opening ? 'Đang mở…' : 'Chọn file'}</em>
        </button>
      ) : (
        <div className="csv-workspace">
          <div className="csv-file-banner">
            <span className="file-type-icon">CSV</span>
            <div className="file-meta">
              <strong title={sourcePath}>{fileNameFromPath(sourcePath ?? '')}</strong>
              <span>
                {NUMBER_FORMAT.format(originalValues.length)} dòng hợp lệ
                {invalidCount > 0 && <> · {NUMBER_FORMAT.format(invalidCount)} dòng lỗi đã bỏ qua khi đọc</>}
              </span>
            </div>
            <div className="file-current-count">
              <span>Đang có</span>
              <strong>{NUMBER_FORMAT.format(workingValues.length)}</strong>
            </div>
          </div>

          <div className="csv-grid">
            <div className="filter-card panel-card">
              <div className="panel-heading">
                <span className="section-icon"><Icon name="filter" /></span>
                <div>
                  <p className="eyebrow">QUY TẮC</p>
                  <h2>Loại nếu có chứa</h2>
                </div>
              </div>

              <label htmlFor="filter-tokens">Chuỗi số cần loại</label>
              <textarea
                id="filter-tokens"
                value={tokensInput}
                onChange={(event) => setTokensInput(event.target.value)}
                placeholder={'Ví dụ: 00, 49, 777\nCó thể nhập nhiều dòng'}
                spellCheck={false}
                inputMode="numeric"
                rows={5}
              />
              <p className="input-help">Phân cách bằng dấu phẩy hoặc xuống dòng. SIM chứa một trong các chuỗi sẽ bị loại.</p>
              {invalidTokens.length > 0 && (
                <div className="field-error" role="alert">
                  <Icon name="info" size={16} />
                  Chỉ được nhập chữ số. Không hợp lệ: {invalidTokens.slice(0, 3).join(', ')}
                </div>
              )}

              <div className="filter-stats" aria-live="polite">
                <div>
                  <span>Trước khi lọc</span>
                  <strong>{NUMBER_FORMAT.format(workingValues.length)}</strong>
                </div>
                <div className="filter-stats--removed">
                  <span>Sẽ loại</span>
                  <strong>−{NUMBER_FORMAT.format(removedValues.length)}</strong>
                </div>
                <div className="filter-stats--remaining">
                  <span>Còn lại</span>
                  <strong>{NUMBER_FORMAT.format(previewValues.length)}</strong>
                </div>
              </div>

              <div className="filter-actions">
                <button
                  className="primary-button"
                  onClick={onApply}
                  disabled={!hasPendingRule || removedValues.length === 0}
                >
                  <Icon name="check" />
                  Áp dụng bộ lọc
                </button>
                <button
                  className="secondary-button"
                  onClick={onReset}
                  disabled={appliedRemoved === 0 && !tokensInput}
                >
                  <Icon name="rotate" />
                  Đặt lại
                </button>
              </div>
              {appliedRemoved > 0 && (
                <p className="applied-note">Đã loại {NUMBER_FORMAT.format(appliedRemoved)} dòng so với file gốc.</p>
              )}
            </div>

            <div className="preview-card panel-card">
              <div className="preview-heading">
                <div>
                  <p className="eyebrow">XEM TRƯỚC</p>
                  <h2>Kết quả sau bộ lọc</h2>
                </div>
                <span>{NUMBER_FORMAT.format(previewValues.length)} dòng</span>
              </div>

              <div className="preview-table" role="table" aria-label="Danh sách SIM xem trước">
                <div className="preview-table-head" role="row">
                  <span role="columnheader">STT</span>
                  <span role="columnheader">Số điện thoại xuất ra</span>
                  <span role="columnheader">Trạng thái</span>
                </div>
                <div className="preview-table-body">
                  {previewValues.slice(0, 50).map((value, index) => (
                    <div className="preview-table-row" role="row" key={`${index}-${value}`}>
                      <span role="cell">{NUMBER_FORMAT.format(index + 1)}</span>
                      <strong role="cell">{value}</strong>
                      <span role="cell" className="kept-label"><Icon name="check" size={14} /> Giữ lại</span>
                    </div>
                  ))}
                  {previewValues.length === 0 && (
                    <div className="table-empty">
                      <Icon name="info" />
                      <span>Không còn SIM nào sau bộ lọc hiện tại.</span>
                    </div>
                  )}
                </div>
                {previewValues.length > 50 && (
                  <div className="preview-more">Đang hiển thị 50 dòng đầu · File lưu vẫn có đủ {NUMBER_FORMAT.format(previewValues.length)} dòng</div>
                )}
              </div>

              {removedValues.length > 0 && (
                <div className="removed-preview">
                  <span>Sắp loại:</span>
                  <div>
                    {removedValues.slice(0, 6).map((value, index) => <code key={`${index}-${value}`}>{value}</code>)}
                    {removedValues.length > 6 && <em>+{NUMBER_FORMAT.format(removedValues.length - 6)}</em>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function App() {
  const api = window.simApp
  const sites = api.sites
  const platformLabel = api.platform === 'win32' ? 'Windows' : api.platform === 'darwin' ? 'macOS' : 'Linux'
  const [activeTab, setActiveTab] = useState<AppTab>('browser')
  const [browserState, setBrowserState] = useState<BrowserState>(EMPTY_BROWSER_STATE)
  const [address, setAddress] = useState('')
  const [addressFocused, setAddressFocused] = useState(false)
  const [isCrawling, setIsCrawling] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [summary, setSummary] = useState<CrawlSummary | null>(null)
  const [fileWorkspace, setFileWorkspace] = useState<FileWorkspaceState>(EMPTY_FILE_WORKSPACE)
  const [changingFiles, setChangingFiles] = useState(false)
  const [huyenSoResult, setHuyenSoResult] = useState<SelectionAnalysisModel | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const cancelRequestedRef = useRef(false)
  const toastSequenceRef = useRef(0)

  const showToast = useCallback((message: string, tone: ToastTone = 'neutral') => {
    toastSequenceRef.current += 1
    setToast({ message, tone, sequence: toastSequenceRef.current })
  }, [])

  const refreshFileWorkspace = useCallback(async () => {
    const state = await api.getFileWorkspace()
    setFileWorkspace(state)
    return state
  }, [api])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const removeBrowserListener = api.onBrowserState((state) => setBrowserState(state))
    const removeHuyenSoListener = api.onHuyenSoResult((result) => setHuyenSoResult(result))
    const removeProgressListener = api.onCrawlProgress((nextProgress) => {
      setProgress(nextProgress)
      setIsCrawling(true)
    })
    const removeErrorListener = api.onAppError((error: AppErrorPayload) => showToast(error.message, 'error'))
    return () => {
      removeBrowserListener()
      removeHuyenSoListener()
      removeProgressListener()
      removeErrorListener()
    }
  }, [api, showToast])

  useEffect(() => {
    void refreshFileWorkspace().catch((error) => showToast(errorMessage(error), 'error'))
  }, [activeTab, refreshFileWorkspace, showToast])

  useEffect(() => {
    if (!addressFocused) setAddress(browserState.url)
  }, [addressFocused, browserState.url])

  useEffect(() => {
    api.setBrowserVisible(activeTab === 'browser' && Boolean(browserState.url))
  }, [activeTab, api, browserState.url])

  const invoke = useCallback(async (operation: () => Promise<void>) => {
    try {
      await operation()
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }, [showToast])

  const openSite = useCallback((siteId: SiteId) => {
    setActiveTab('browser')
    void invoke(() => api.openSite(siteId))
  }, [api, invoke])

  const navigate = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const destination = normalizeNavigationInput(address)
    if (!destination) return
    setAddress(destination)
    setAddressFocused(false)
    void invoke(() => api.navigate(destination))
  }, [address, api, invoke])

  const browserAction = useCallback((action: BrowserAction) => {
    void invoke(() => api.browserAction(action))
  }, [api, invoke])

  const startCrawl = useCallback(async () => {
    if (!browserState.siteId || !browserState.url || isCrawling) return
    cancelRequestedRef.current = false
    setIsCrawling(true)
    setIsCanceling(false)
    setSummary(null)
    setProgress({
      phase: 'preflight',
      message: 'Đang kiểm tra trang kết quả…',
      collected: 0,
      unique: 0
    })
    try {
      const result = await api.startCrawl()
      setSummary(result)
      await refreshFileWorkspace()
      showToast(
        `Đã thêm ${NUMBER_FORMAT.format(result.savedAddedCount)} SIM vào ${result.savedFileName}.`,
        'success'
      )
    } catch (error) {
      if (!cancelRequestedRef.current) showToast(errorMessage(error), 'error')
      else showToast('Đã dừng crawl. Không có file nào được tạo.', 'neutral')
    } finally {
      setIsCrawling(false)
      setIsCanceling(false)
      setProgress(null)
      cancelRequestedRef.current = false
    }
  }, [api, browserState.siteId, browserState.url, isCrawling, refreshFileWorkspace, showToast])

  const cancelCrawl = useCallback(async () => {
    if (!isCrawling || isCanceling) return
    cancelRequestedRef.current = true
    setIsCanceling(true)
    try {
      await api.cancelCrawl()
    } catch (error) {
      showToast(errorMessage(error), 'error')
      setIsCanceling(false)
    }
  }, [api, isCanceling, isCrawling, showToast])

  const chooseSaveFolder = useCallback(async () => {
    if (changingFiles || isCrawling) return
    setChangingFiles(true)
    try {
      const state = await api.chooseSaveFolder()
      setFileWorkspace(state)
      setSummary(null)
      showToast(`Đang lưu file tại ${fileNameFromPath(state.directory)}.`, 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setChangingFiles(false)
    }
  }, [api, changingFiles, isCrawling, showToast])

  const toggleCrawlAnalysis = useCallback(async (enabled: boolean) => {
    if (changingFiles || isCrawling) return
    setChangingFiles(true)
    try {
      const state = await api.setCrawlAnalysis(enabled)
      setFileWorkspace(state)
      showToast(
        enabled
          ? 'Lượt lưu tiếp theo sẽ thêm các cột luận giải.'
          : 'Lượt lưu tiếp theo sẽ trở về CSV một cột.',
        'neutral'
      )
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setChangingFiles(false)
    }
  }, [api, changingFiles, isCrawling, showToast])

  const createCrawlFile = useCallback(async () => {
    if (changingFiles || isCrawling) return
    setChangingFiles(true)
    try {
      const state = await api.createCrawlFile()
      setFileWorkspace(state)
      setSummary(null)
      showToast(`Đã chuyển sang ${state.activeFile?.name ?? 'file mới'}.`, 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setChangingFiles(false)
    }
  }, [api, changingFiles, isCrawling, showToast])

  const activeSite = sites.find((site) => site.id === browserState.siteId)

  return (
    <div className={cx('app-shell', `app-shell--${api.platform}`)}>
      <aside className="sidebar">
        <div className="sidebar-drag-area" />
        <div className="brand">
          <span className="brand-icon"><Icon name="phone" size={21} /></span>
          <div className="brand-copy">
            <strong>Đào Sim</strong>
            <span>{platformLabel}</span>
          </div>
        </div>

        <nav className="main-navigation" aria-label="Chức năng">
          <button
            className={cx('navigation-item', activeTab === 'browser' && 'navigation-item--active')}
            onClick={() => setActiveTab('browser')}
            aria-current={activeTab === 'browser' ? 'page' : undefined}
          >
            <Icon name="browser" />
            <span>Trình duyệt</span>
          </button>
          <button
            className={cx('navigation-item', activeTab === 'bulk' && 'navigation-item--active')}
            onClick={() => setActiveTab('bulk')}
            aria-current={activeTab === 'bulk' ? 'page' : undefined}
          >
            <Icon name="batch" />
            <span>Luận hàng loạt</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">MỞ NHANH</p>
          <div className="site-list">
            {sites.map((site) => (
              <button
                key={site.id}
                className={cx('site-button', browserState.siteId === site.id && activeTab === 'browser' && 'site-button--active')}
                onClick={() => openSite(site.id)}
                title={`Mở ${site.name}`}
              >
                <SiteMark site={site} />
                <span>{site.name}</span>
                {browserState.siteId === site.id && activeTab === 'browser' && <span className="site-active-dot" />}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="shield-mark"><Icon name="lock" size={15} /></span>
          <p><strong>Dữ liệu cục bộ</strong><span>Không tải CSV lên máy chủ</span></p>
        </div>
      </aside>

      <main className="main-content">
        <header className="app-topbar">
          <div>
            <span className="topbar-title">
              {activeTab === 'browser' ? 'Trình duyệt SIM' : 'Luận SĐT hàng loạt'}
            </span>
            {activeTab === 'browser' && activeSite && <span className="topbar-context">/ {activeSite.name}</span>}
          </div>
          <div className="topbar-status">
            <span className="topbar-status-dot" />
            Chỉ chạy trên máy này
          </div>
        </header>

        {activeTab === 'browser' ? (
          <BrowserScreen
            browserState={browserState}
            sites={sites}
            address={address}
            setAddress={setAddress}
            setAddressFocused={setAddressFocused}
            onNavigate={navigate}
            onBrowserAction={browserAction}
            onOpenSite={openSite}
            isCrawling={isCrawling}
            isCanceling={isCanceling}
            progress={progress}
            summary={summary}
            fileWorkspace={fileWorkspace}
            changingFiles={changingFiles}
            huyenSoResult={huyenSoResult}
            onStartCrawl={startCrawl}
            onCancelCrawl={cancelCrawl}
            onChooseFolder={() => void chooseSaveFolder()}
            onToggleAnalysis={(enabled) => void toggleCrawlAnalysis(enabled)}
            onCreateFile={() => void createCrawlFile()}
            onCloseHuyenSo={() => setHuyenSoResult(null)}
          />
        ) : null}

        <BulkPhoneScreen
          visible={activeTab === 'bulk'}
          savedDirectory={fileWorkspace.directory}
          savedFiles={fileWorkspace.files}
          onFilesChanged={() => void refreshFileWorkspace()}
          onNotify={showToast}
        />
      </main>

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.sequence} className={cx('toast', `toast--${toast.tone}`)}>
            <span className="toast-icon">
              <Icon name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'info' : 'info'} />
            </span>
            <span>{toast.message}</span>
            <button aria-label="Đóng thông báo" onClick={() => setToast(null)}><Icon name="close" size={16} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
