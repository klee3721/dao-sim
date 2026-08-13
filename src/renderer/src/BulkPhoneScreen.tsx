import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildBulkCsvText } from '../../shared/huyen-so/bulk-csv'
import {
  EMPTY_BULK_PHONE_FILTER,
  filterBulkPhoneRows,
  parseBulkNumberTokens
} from '../../shared/huyen-so/bulk-filter'
import {
  BULK_PREVIEW_ROWS,
  getBulkPhoneStats,
  type BulkPhoneRow
} from '../../shared/huyen-so/bulk-phone'
import {
  ENERGIES,
  ENERGY_ORDER,
  type EnergyId
} from '../../shared/huyen-so/numerology'
import { createBulkXlsxBytes } from './bulk-export'
import type { BulkCsvOpenResult, SavedFileEntry } from '../../shared/types'
import { SavedFileList } from './SavedFileList'

type BulkStatus = 'idle' | 'processing' | 'ready' | 'error' | 'cancelled'
type SaveFormat = 'csv' | 'xlsx'
type NoticeTone = 'success' | 'error' | 'neutral'

type BulkWorkerResponse =
  | {
      type: 'progress'
      requestId: number
      processed: number
      total: number
    }
  | {
      type: 'complete'
      requestId: number
      rows: BulkPhoneRow[]
    }
  | {
      type: 'error'
      requestId: number
      message: string
    }

interface BulkPhoneScreenProps {
  visible: boolean
  savedDirectory: string
  savedFiles: SavedFileEntry[]
  onFilesChanged: () => void
  onNotify: (message: string, tone?: NoticeTone) => void
}

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN')
const MAX_FILTER_THRESHOLD = 99

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Đã xảy ra lỗi. Vui lòng thử lại.'
}

function parseFilterThreshold(input: string, label: string): { value?: number; error?: string } {
  const trimmed = input.trim()
  if (!trimmed) return {}
  if (!/^\d+$/.test(trimmed)) {
    return { error: `${label} phải là số nguyên từ 1 đến ${MAX_FILTER_THRESHOLD}.` }
  }

  const value = Number(trimmed)
  if (value < 1 || value > MAX_FILTER_THRESHOLD) {
    return { error: `${label} phải từ 1 đến ${MAX_FILTER_THRESHOLD}.` }
  }

  return { value }
}

function BulkIcon({ name, size = 18 }: { name: string; size?: number }): ReactNode {
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
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 15V4m0 0 4 4m-4-4L8 8M5 20h14" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
        </svg>
      )
    case 'reset':
      return (
        <svg {...common}>
          <path d="M5 7v4h4M5.8 10.2a7 7 0 1 1 .9 6.8" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      )
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M6 2.75h8l4 4V21H6z" />
          <path d="M14 2.75V7h4M8.8 12h6.4M8.8 15.5h6.4" />
        </svg>
      )
  }
}

export function BulkPhoneScreen({
  visible,
  savedDirectory,
  savedFiles,
  onFilesChanged,
  onNotify
}: BulkPhoneScreenProps) {
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState<BulkStatus>('idle')
  const [sourcePath, setSourcePath] = useState<string>()
  const [sourceText, setSourceText] = useState<string>()
  const [rows, setRows] = useState<BulkPhoneRow[]>([])
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [message, setMessage] = useState('')
  const [opening, setOpening] = useState(false)
  const [savingFormat, setSavingFormat] = useState<SaveFormat>()
  const [minHungCellsInput, setMinHungCellsInput] = useState('')
  const [minHungStreakInput, setMinHungStreakInput] = useState('')
  const [excludedEnergyIds, setExcludedEnergyIds] = useState<EnergyId[]>([])
  const [requiredEnergyIds, setRequiredEnergyIds] = useState<EnergyId[]>([])
  const [numberFilterInput, setNumberFilterInput] = useState('')

  const stats = useMemo(() => getBulkPhoneStats(rows), [rows])
  const minHungCells = useMemo(
    () => parseFilterThreshold(minHungCellsInput, 'Số lượng ô màu đỏ'),
    [minHungCellsInput]
  )
  const minHungStreak = useMemo(
    () => parseFilterThreshold(minHungStreakInput, 'Số ô màu đỏ liên tiếp'),
    [minHungStreakInput]
  )
  const numberTokens = useMemo(
    () => parseBulkNumberTokens(numberFilterInput),
    [numberFilterInput]
  )
  const filterError =
    minHungCells.error ??
    minHungStreak.error ??
    (numberTokens.invalidTokens.length > 0
      ? `Chỉ nhập chữ số, dấu phẩy hoặc xuống dòng. Giá trị không hợp lệ: ${numberTokens.invalidTokens.join(', ')}`
      : undefined)
  const filterResult = useMemo(
    () => filterBulkPhoneRows(rows, {
      ...EMPTY_BULK_PHONE_FILTER,
      minHungCells: minHungCells.value,
      minConsecutiveHungCells: minHungStreak.value,
      excludedEnergyIds,
      requiredEnergyIds,
      numberTokens: numberTokens.tokens
    }),
    [excludedEnergyIds, minHungCells.value, minHungStreak.value, numberTokens.tokens, requiredEnergyIds, rows]
  )
  const filteredRows = filterResult.keptRows
  const hasActiveFilters =
    minHungCells.value !== undefined ||
    minHungStreak.value !== undefined ||
    excludedEnergyIds.length > 0 ||
    requiredEnergyIds.length > 0 ||
    numberTokens.tokens.length > 0
  const previewRows = filteredRows.slice(0, BULK_PREVIEW_ROWS)
  const previewResultColumns = Math.max(1, ...previewRows.map((row) => row.cells.length))
  const progressPercent =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
  const isProcessing = status === 'processing'
  const isBusy = isProcessing || opening || Boolean(savingFormat)

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const clearFilters = useCallback(() => {
    setMinHungCellsInput('')
    setMinHungStreakInput('')
    setExcludedEnergyIds([])
    setRequiredEnergyIds([])
    setNumberFilterInput('')
  }, [])

  const processText = useCallback(
    (text: string) => {
      stopWorker()
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setRows([])
      setMessage('')
      setProgress({ processed: 0, total: 0 })
      setStatus('processing')

      let worker: Worker
      try {
        worker = new Worker(new URL('./bulk-phone.worker.ts', import.meta.url), {
          type: 'module'
        })
      } catch (error) {
        const failure = errorMessage(error)
        setStatus('error')
        setMessage(failure)
        onNotify(failure, 'error')
        return
      }

      workerRef.current = worker

      const closeWorker = () => {
        worker.terminate()
        if (workerRef.current === worker) workerRef.current = null
      }

      worker.onmessage = (event: MessageEvent<BulkWorkerResponse>) => {
        const response = event.data
        if (
          response.requestId !== requestId ||
          requestId !== requestIdRef.current
        ) {
          return
        }

        if (response.type === 'progress') {
          setProgress({ processed: response.processed, total: response.total })
          return
        }

        closeWorker()

        if (response.type === 'error') {
          setStatus('error')
          setMessage(response.message)
          onNotify(response.message, 'error')
          return
        }

        setRows(response.rows)
        setProgress({ processed: response.rows.length, total: response.rows.length })
        setStatus('ready')
        setMessage('Đã phân tích xong. Bạn có thể xuất Excel có màu hoặc CSV không màu.')
        onNotify(`Đã phân tích ${NUMBER_FORMAT.format(response.rows.length)} dòng.`, 'success')
      }

      worker.onerror = (event) => {
        if (requestId !== requestIdRef.current) return
        event.preventDefault()
        closeWorker()
        const failure = 'Không thể chạy bộ xử lý nền. Vui lòng mở lại file và thử lại.'
        setStatus('error')
        setMessage(failure)
        onNotify(failure, 'error')
      }

      worker.postMessage({ type: 'analyze', requestId, text })
    },
    [onNotify, stopWorker]
  )

  const loadOpenedFile = useCallback((result: BulkCsvOpenResult) => {
    if (result.canceled) return false
    if (!result.path || result.text === undefined) {
      throw new Error('Không nhận được nội dung file CSV đã chọn.')
    }
    setSourcePath(result.path)
    setSourceText(result.text)
    clearFilters()
    processText(result.text)
    return true
  }, [clearFilters, processText])

  useEffect(
    () => () => {
      requestIdRef.current += 1
      stopWorker()
    },
    [stopWorker]
  )

  const openFile = useCallback(async () => {
    if (isBusy) return
    setOpening(true)
    try {
      const result = await window.simApp.openBulkCsv()
      loadOpenedFile(result)
    } catch (error) {
      const failure = errorMessage(error)
      onNotify(failure, 'error')
    } finally {
      setOpening(false)
    }
  }, [isBusy, loadOpenedFile, onNotify])

  const openSavedFile = useCallback(async (path: string) => {
    if (isBusy) return
    setOpening(true)
    try {
      loadOpenedFile(await window.simApp.openSavedBulkCsv(path))
    } catch (error) {
      onNotify(errorMessage(error), 'error')
    } finally {
      setOpening(false)
    }
  }, [isBusy, loadOpenedFile, onNotify])

  const cancelProcessing = useCallback(() => {
    if (!isProcessing) return
    requestIdRef.current += 1
    stopWorker()
    setRows([])
    setProgress({ processed: 0, total: 0 })
    setStatus('cancelled')
    setMessage('Đã hủy phân tích. File vẫn đang mở và có thể xử lý lại.')
    onNotify('Đã hủy phân tích file.', 'neutral')
  }, [isProcessing, onNotify, stopWorker])

  const reset = useCallback(() => {
    requestIdRef.current += 1
    stopWorker()
    setStatus('idle')
    setSourcePath(undefined)
    setSourceText(undefined)
    setRows([])
    setProgress({ processed: 0, total: 0 })
    setMessage('')
    setSavingFormat(undefined)
    clearFilters()
  }, [clearFilters, stopWorker])

  const retry = useCallback(() => {
    if (sourceText === undefined || isBusy) return
    processText(sourceText)
  }, [isBusy, processText, sourceText])

  const save = useCallback(
    async (format: SaveFormat) => {
      if (!sourcePath || filteredRows.length === 0 || savingFormat || filterError) return
      setSavingFormat(format)
      try {
        const data =
          format === 'xlsx'
            ? await createBulkXlsxBytes(filteredRows)
            : new TextEncoder().encode(buildBulkCsvText(filteredRows))
        const result = await window.simApp.saveBulkFile(data, format, sourcePath)
        if (!result.canceled && result.path) {
          onNotify(`Đã lưu ${fileNameFromPath(result.path)}.`, 'success')
          onFilesChanged()
        }
      } catch (error) {
        const failure = errorMessage(error)
        setMessage(failure)
        onNotify(failure, 'error')
      } finally {
        setSavingFormat(undefined)
      }
    },
    [filterError, filteredRows, onFilesChanged, onNotify, savingFormat, sourcePath]
  )

  const toggleEnergyFilter = useCallback((energyId: EnergyId) => {
    setExcludedEnergyIds((current) =>
      current.includes(energyId)
        ? current.filter((item) => item !== energyId)
        : [...current, energyId]
    )
  }, [])

  const toggleRequiredEnergyFilter = useCallback((energyId: EnergyId) => {
    setRequiredEnergyIds((current) =>
      current.includes(energyId)
        ? current.filter((item) => item !== energyId)
        : [...current, energyId]
    )
  }, [])

  return (
    <section
      className="screen bulk-phone-screen"
      aria-label="Luận số điện thoại hàng loạt"
      hidden={!visible}
    >
      <div className="bulk-phone-header">
        <div>
          <p className="eyebrow">PHÂN TÍCH HUYỀN SỐ</p>
          <h1>Luận SĐT hàng loạt</h1>
          <p>
            Chọn CSV một cột. Mỗi dòng là SĐT 9 chữ số đã bỏ số 0 đầu; số 10
            chữ số và định dạng +84 vẫn được hỗ trợ. Kết quả dùng mã rút gọn,
            ví dụ TY 4 là Thiên Y bậc 4.
          </p>
        </div>
        <div className="bulk-phone-header-actions">
          {sourcePath && (
            <button className="secondary-button" onClick={reset} disabled={isBusy}>
              <BulkIcon name="reset" />
              Đặt lại
            </button>
          )}
          <button className="primary-button" onClick={() => void openFile()} disabled={isBusy}>
            <BulkIcon name="upload" />
            {opening ? 'Đang mở…' : sourcePath ? 'Mở file khác' : 'Mở file CSV'}
          </button>
        </div>
      </div>

      <SavedFileList
        directory={savedDirectory}
        files={savedFiles}
        activePath={sourcePath}
        busy={isBusy}
        onOpen={(path) => void openSavedFile(path)}
      />

      {!sourcePath ? (
        <button className="bulk-phone-empty" onClick={() => void openFile()} disabled={opening}>
          <span className="bulk-phone-empty-icon"><BulkIcon name="file" size={30} /></span>
          <strong>Chọn danh sách SĐT để phân tích</strong>
          <span>CSV không có tiêu đề · Chỉ dùng cột A · Tối đa 5 MB và 10.000 dòng</span>
          <em><BulkIcon name="upload" size={16} /> {opening ? 'Đang mở…' : 'Chọn file CSV'}</em>
          <small><BulkIcon name="info" size={14} /> File được xử lý trên máy, không tải lên máy chủ.</small>
        </button>
      ) : (
        <div className="bulk-phone-workspace">
          <div className="bulk-phone-file-banner">
            <span className="file-type-icon">CSV</span>
            <div className="file-meta">
              <strong title={sourcePath}>{fileNameFromPath(sourcePath)}</strong>
              <span>
                {status === 'ready'
                  ? `${NUMBER_FORMAT.format(stats.totalRows)} dòng đã đọc · giữ nguyên thứ tự, dòng trùng và dòng trống`
                  : 'Đang dùng dữ liệu cột A và giữ nguyên giá trị gốc khi xuất file'}
              </span>
            </div>
            <span className={`bulk-phone-file-state bulk-phone-file-state--${status}`}>
              {status === 'processing'
                ? 'Đang xử lý'
                : status === 'ready'
                  ? 'Hoàn thành'
                  : status === 'error'
                    ? 'Có lỗi'
                    : status === 'cancelled'
                      ? 'Đã hủy'
                      : 'Sẵn sàng'}
            </span>
          </div>

          {isProcessing && (
            <section className="bulk-phone-progress" aria-live="polite">
              <div className="bulk-phone-progress-copy">
                <div>
                  <span className="bulk-phone-processing-mark" aria-hidden="true" />
                  <div>
                    <strong>
                      {progress.total > 0
                        ? `Đang phân tích ${NUMBER_FORMAT.format(progress.processed)}/${NUMBER_FORMAT.format(progress.total)} dòng`
                        : 'Đang kiểm tra cấu trúc file…'}
                    </strong>
                    <small>Mỗi số được đọc bằng cùng bộ quy tắc Huyền Số.</small>
                  </div>
                </div>
                <span>{progress.total > 0 ? `${progressPercent}%` : '…'}</span>
              </div>
              <div
                className={`bulk-phone-progress-track ${progress.total === 0 ? 'is-indeterminate' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.total > 0 ? progressPercent : undefined}
              >
                <span style={progress.total > 0 ? { width: `${progressPercent}%` } : undefined} />
              </div>
              <button className="danger-button" onClick={cancelProcessing}>
                <BulkIcon name="stop" />
                Hủy xử lý
              </button>
            </section>
          )}

          {!isProcessing && (status === 'error' || status === 'cancelled') && (
            <div className={`bulk-phone-message bulk-phone-message--${status}`} role={status === 'error' ? 'alert' : 'status'}>
              <span><BulkIcon name="info" size={17} /></span>
              <div>
                <strong>{status === 'error' ? 'Không thể phân tích file' : 'Đã dừng xử lý'}</strong>
                <p>{message}</p>
              </div>
              {sourceText !== undefined && (
                <button className="secondary-button" onClick={retry}>Xử lý lại</button>
              )}
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="bulk-phone-stats" aria-label="Thống kê phân tích">
                <article>
                  <span>Tổng số dòng</span>
                  <strong>{NUMBER_FORMAT.format(stats.totalRows)}</strong>
                </article>
                <article className="is-valid">
                  <span>Hợp lệ</span>
                  <strong>{NUMBER_FORMAT.format(stats.validRows)}</strong>
                </article>
                <article className="is-invalid">
                  <span>Có lỗi</span>
                  <strong>{NUMBER_FORMAT.format(stats.invalidRows)}</strong>
                </article>
                <article>
                  <span>Dòng trống</span>
                  <strong>{NUMBER_FORMAT.format(stats.blankRows)}</strong>
                </article>
              </div>

              <section className="bulk-phone-filters panel-card" aria-labelledby="bulk-filter-title">
                <div className="bulk-phone-filter-heading">
                  <div>
                    <h2 id="bulk-filter-title">Lọc kết quả trước khi xuất file</h2>
                    <p>Các điều kiện kết hợp theo “HOẶC”; dữ liệu gốc không thay đổi.</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters && !filterError}
                  >
                    <BulkIcon name="reset" size={16} />
                    Xóa bộ lọc
                  </button>
                </div>

                <div className="bulk-phone-filter-grid">
                  <label className="bulk-phone-filter-field">
                    <span><i className="filter-red-dot" /> Tổng ô đỏ ≥</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_FILTER_THRESHOLD}
                      step={1}
                      inputMode="numeric"
                      value={minHungCellsInput}
                      onChange={(event) => setMinHungCellsInput(event.target.value)}
                      placeholder="Ví dụ: 2"
                      aria-invalid={Boolean(minHungCells.error)}
                    />
                  </label>

                  <label className="bulk-phone-filter-field">
                    <span><i className="filter-red-dot" /> Đỏ liên tiếp ≥</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_FILTER_THRESHOLD}
                      step={1}
                      inputMode="numeric"
                      value={minHungStreakInput}
                      onChange={(event) => setMinHungStreakInput(event.target.value)}
                      placeholder="Ví dụ: 2"
                      aria-invalid={Boolean(minHungStreak.error)}
                    />
                  </label>

                  <label className="bulk-phone-filter-field bulk-phone-filter-field--numbers">
                    <span>Chứa số</span>
                    <input
                      type="text"
                      value={numberFilterInput}
                      onChange={(event) => setNumberFilterInput(event.target.value)}
                      placeholder="0, 5, 68"
                      spellCheck={false}
                      aria-invalid={numberTokens.invalidTokens.length > 0}
                    />
                  </label>

                  <fieldset className="bulk-phone-energy-filter bulk-phone-energy-filter--exclude">
                    <legend>Có ô — loại dòng chứa mã</legend>
                    <div>
                      {ENERGY_ORDER.map((energyId) => {
                        const energy = ENERGIES[energyId]
                        const checked = excludedEnergyIds.includes(energyId)
                        return (
                          <label
                            key={energyId}
                            className={`bulk-phone-energy-option is-${energy.polarity} ${checked ? 'is-selected' : ''}`}
                            title={energy.name}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEnergyFilter(energyId)}
                              aria-label={`Loại dòng có ${energy.name}`}
                            />
                            <i aria-hidden="true" />
                            <span>{energyId}</span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="bulk-phone-energy-filter bulk-phone-energy-filter--required">
                    <legend>Không có ô — loại dòng thiếu mã</legend>
                    <div>
                      {ENERGY_ORDER.map((energyId) => {
                        const energy = ENERGIES[energyId]
                        const checked = requiredEnergyIds.includes(energyId)
                        return (
                          <label
                            key={energyId}
                            className={`bulk-phone-energy-option is-${energy.polarity} ${checked ? 'is-selected' : ''}`}
                            title={energy.name}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRequiredEnergyFilter(energyId)}
                              aria-label={`Loại dòng không có ${energy.name}`}
                            />
                            <i aria-hidden="true" />
                            <span>{energyId}</span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                </div>

                {filterError && (
                  <p className="bulk-phone-filter-error" role="alert">
                    <BulkIcon name="info" size={15} /> {filterError}
                  </p>
                )}

                <div className="bulk-phone-filter-summary" aria-live="polite">
                  <span>
                    Đã loại <strong>{NUMBER_FORMAT.format(filterResult.removedRows.length)}</strong> dòng
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    Còn lại <strong>{NUMBER_FORMAT.format(filteredRows.length)}</strong>/{NUMBER_FORMAT.format(rows.length)} dòng để xuất
                  </span>
                  {!hasActiveFilters && !filterError && <em>Chưa bật điều kiện lọc</em>}
                </div>
              </section>

              <section className="bulk-phone-results panel-card">
                <div className="bulk-phone-results-heading">
                  <div>
                    <p className="eyebrow">XEM TRƯỚC KẾT QUẢ</p>
                    <h2>
                      {filteredRows.length > BULK_PREVIEW_ROWS
                        ? `${BULK_PREVIEW_ROWS} dòng đầu tiên`
                        : hasActiveFilters
                          ? `${NUMBER_FORMAT.format(filteredRows.length)} dòng còn lại`
                          : `${NUMBER_FORMAT.format(filteredRows.length)} dòng trong file`}
                    </h2>
                    <p className="bulk-phone-code-note">
                      TY 4 = Thiên Y bậc 4 · S5 = cặp số 5 đặc biệt · “ẩn” và “kích” là quy tắc bổ sung.
                    </p>
                  </div>
                  <div className="bulk-phone-legend" aria-label="Chú giải màu">
                    <span className="is-cat"><i /> Cát tinh</span>
                    <span className="is-hung"><i /> Hung tinh</span>
                    <span className="is-special"><i /> Đặc biệt</span>
                    <span className="is-error"><i /> Lỗi</span>
                  </div>
                </div>

                {filteredRows.length > 0 ? (
                  <div className="bulk-phone-table-scroll">
                    <table className="bulk-phone-table">
                    <colgroup>
                      <col className="bulk-phone-line-column" />
                      <col className="bulk-phone-number-column" />
                      {Array.from({ length: previewResultColumns }, (_, index) => (
                        <col className="bulk-phone-result-column" key={index} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Cột A · Số điện thoại</th>
                        {Array.from({ length: previewResultColumns }, (_, index) => (
                          <th className="bulk-phone-result-column" key={index}>Kết quả {index + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.rowNumber} className={`is-${row.status}`}>
                          <td>{NUMBER_FORMAT.format(row.rowNumber)}</td>
                          <td>
                            <strong>{row.original || 'Dòng trống'}</strong>
                            {row.status === 'valid' && row.normalized !== row.original && (
                              <small>Luận như {row.normalized}</small>
                            )}
                          </td>
                          {Array.from({ length: previewResultColumns }, (_, cellIndex) => {
                            const cell = row.cells[cellIndex]
                            return (
                              <td className="bulk-phone-result-column" key={cellIndex}>
                                {cell ? (
                                  <span
                                    className={`bulk-result-cell is-${cell.tone} ${cell.accented ? 'is-accented' : ''}`}
                                    title={cell.text}
                                  >
                                    {cell.text}
                                  </span>
                                ) : (
                                  <span className="bulk-result-cell is-empty">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bulk-phone-filter-empty">
                    <BulkIcon name="info" size={20} />
                    <strong>Không còn dòng nào sau khi lọc</strong>
                    <span>Hãy giảm điều kiện hoặc bấm “Xóa bộ lọc” để xem lại toàn bộ dữ liệu.</span>
                  </div>
                )}
                {filteredRows.length > BULK_PREVIEW_ROWS && (
                  <div className="bulk-phone-preview-more">
                    Chỉ hiển thị {BULK_PREVIEW_ROWS} dòng đầu · File xuất sẽ có đủ {NUMBER_FORMAT.format(filteredRows.length)} dòng còn lại
                  </div>
                )}
              </section>

              <section className="bulk-phone-download-panel">
                <span className="bulk-phone-download-icon"><BulkIcon name="check" size={20} /></span>
                <div>
                  <p className="eyebrow">FILE ĐÃ SẴN SÀNG</p>
                  <h2>Xuất kết quả về máy</h2>
                  <p>
                    {hasActiveFilters
                      ? `File chỉ gồm ${NUMBER_FORMAT.format(filteredRows.length)} dòng còn lại sau khi lọc; kết quả dùng mã và bậc rút gọn.`
                      : 'Excel có màu, mã bậc và trang chú giải. CSV giữ cùng nội dung chữ nhưng không có màu ô; bảng hàng loạt không kèm gợi ý chuyển hóa.'}
                  </p>
                </div>
                <div className="bulk-phone-download-actions">
                  <button
                    className="primary-button"
                    onClick={() => void save('xlsx')}
                    disabled={Boolean(savingFormat) || Boolean(filterError) || filteredRows.length === 0}
                  >
                    <BulkIcon name="download" />
                    {savingFormat === 'xlsx' ? 'Đang tạo Excel…' : 'Lưu Excel có màu'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void save('csv')}
                    disabled={Boolean(savingFormat) || Boolean(filterError) || filteredRows.length === 0}
                  >
                    <BulkIcon name="download" />
                    {savingFormat === 'csv' ? 'Đang tạo CSV…' : 'Lưu CSV không màu'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </section>
  )
}
