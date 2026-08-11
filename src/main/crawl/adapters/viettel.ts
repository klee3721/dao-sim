import { AppError } from '../../errors'
import type { CapturedRequest, CrawlContext, SiteAdapter } from '../types'
import { isAllowedCapturedRequest } from '../url-policy'

const VIETTEL_HOSTS = new Set(['viettel.vn', 'www.viettel.vn'])
const PAGE_SIZE = 45
const MAX_BATCHES = 200
const PLATEAU_LIMIT = 3
const RATE_LIMIT_RETRIES = 3

type JsonRecord = Record<string, unknown>

interface ReplayRequest {
  url: string
  init: RequestInit
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNotAborted(context: CrawlContext): void {
  if (context.signal.aborted) {
    throw new AppError('CRAWL_CANCELLED', 'Đã dừng quá trình crawl Viettel.')
  }
}

function isExpectedCapture(request: CapturedRequest | undefined): request is CapturedRequest {
  return Boolean(request && isAllowedCapturedRequest('viettel', request.url, request.method))
}

function requireCapturedRequest(request: CapturedRequest | undefined): CapturedRequest {
  if (!isExpectedCapture(request)) {
    throw new AppError(
      'VIETTEL_SEARCH_NOT_CAPTURED',
      'Chưa ghi nhận được yêu cầu tìm SIM của Viettel. Hãy chọn bộ lọc, bấm tìm kiếm trên trang Viettel rồi thử Crawl lại.'
    )
  }
  return request
}

function copyReplayHeaders(source: Record<string, string> | undefined): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [name, value] of Object.entries(source ?? {})) {
    const normalizedName = name.toLowerCase()
    // Chromium tự tạo lại các header phụ thuộc vào body/session. Giữ chúng có thể
    // làm request sai độ dài hoặc dùng cookie cũ thay vì cookie của session hiện tại.
    if (
      normalizedName === 'content-length' ||
      normalizedName === 'host' ||
      normalizedName === 'connection' ||
      normalizedName === 'cookie' ||
      normalizedName === 'accept-encoding'
    ) {
      continue
    }
    headers[name] = value
  }

  return headers
}

function headerValue(headers: Record<string, string>, wantedName: string): string | undefined {
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === wantedName.toLowerCase()
  )
  return entry?.[1]
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  const existingName = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  )
  headers[existingName ?? name] = value
}

function setCaseInsensitiveParam(
  params: URLSearchParams,
  name: string,
  value: string
): boolean {
  const matchingNames = [...params.keys()].filter(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  )
  for (const matchingName of new Set(matchingNames)) params.set(matchingName, value)
  return matchingNames.length > 0
}

function patchSearchParams(params: URLSearchParams, page: number): boolean {
  const hadPage = [...params.keys()].some((name) => name.toLowerCase() === 'page')
  const hadPageSize = [...params.keys()].some((name) => name.toLowerCase() === 'page_size')
  if (!hadPage && !hadPageSize) return false

  if (!setCaseInsensitiveParam(params, 'page', String(page))) params.set('page', String(page))
  if (!setCaseInsensitiveParam(params, 'page_size', String(PAGE_SIZE))) {
    params.set('page_size', String(PAGE_SIZE))
  }
  return true
}

function patchJsonPagination(value: unknown, page: number): boolean {
  if (!isRecord(value)) return false

  let patchedHere = false
  let pageKey: string | undefined
  let pageSizeKey: string | undefined

  for (const key of Object.keys(value)) {
    if (key.toLowerCase() === 'page') pageKey = key
    if (key.toLowerCase() === 'page_size') pageSizeKey = key
  }

  if (pageKey || pageSizeKey) {
    value[pageKey ?? 'page'] = page
    value[pageSizeKey ?? 'page_size'] = PAGE_SIZE
    patchedHere = true
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        if (patchJsonPagination(item, page)) patchedHere = true
      }
    } else if (patchJsonPagination(child, page)) {
      patchedHere = true
    }
  }

  return patchedHere
}

function looksLikeJson(body: string, contentType: string): boolean {
  const trimmed = body.trim()
  return contentType.includes('application/json') || trimmed.startsWith('{')
}

function looksLikeUrlEncoded(body: string, contentType: string): boolean {
  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    /^[^=&\s]+=[\s\S]*$/.test(body.trim())
  )
}

function buildPagedReplay(request: CapturedRequest, page: number, signal: AbortSignal): ReplayRequest {
  const url = new URL(request.url)
  const method = (request.method || 'GET').toUpperCase()
  const headers = copyReplayHeaders(request.headers)
  const contentType = (headerValue(headers, 'content-type') ?? '').toLowerCase()
  let body = request.body
  let patchedUrl = patchSearchParams(url.searchParams, page)
  let patchedBody = false

  if (typeof body === 'string' && body.length > 0 && looksLikeJson(body, contentType)) {
    try {
      const parsed: unknown = JSON.parse(body)
      if (isRecord(parsed)) {
        patchedBody = patchJsonPagination(parsed, page)
        if (!patchedUrl && !patchedBody) {
          parsed.page = page
          parsed.page_size = PAGE_SIZE
          patchedBody = true
        }
        body = JSON.stringify(parsed)
        setHeader(headers, 'content-type', 'application/json')
      }
    } catch {
      // Một body không phải JSON hợp lệ có thể vẫn là kiểu dữ liệu riêng của trang.
      // Trong trường hợp đó đặt phân trang ở URL và giữ nguyên body.
    }
  } else if (
    typeof body === 'string' &&
    body.length > 0 &&
    looksLikeUrlEncoded(body, contentType)
  ) {
    const params = new URLSearchParams(body)
    patchedBody = patchSearchParams(params, page)
    if (!patchedUrl && !patchedBody) {
      params.set('page', String(page))
      params.set('page_size', String(PAGE_SIZE))
      patchedBody = true
    }
    body = params.toString()
    setHeader(headers, 'content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
  }

  if (!patchedUrl && !patchedBody) {
    url.searchParams.set('page', String(page))
    url.searchParams.set('page_size', String(PAGE_SIZE))
    patchedUrl = true
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    signal
  }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') init.body = body

  return { url: url.toString(), init }
}

function collectNamedValues(
  root: unknown,
  wantedName: string,
  values: unknown[] = [],
  visited: WeakSet<object> = new WeakSet()
): unknown[] {
  if (typeof root !== 'object' || root === null) return values
  if (visited.has(root)) return values
  visited.add(root)

  if (Array.isArray(root)) {
    for (const item of root) collectNamedValues(item, wantedName, values, visited)
    return values
  }

  for (const [name, value] of Object.entries(root)) {
    if (name.toLowerCase() === wantedName.toLowerCase()) values.push(value)
    collectNamedValues(value, wantedName, values, visited)
  }
  return values
}

function collectIsdnValues(payload: unknown): string[] {
  return collectNamedValues(payload, 'isdn')
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number => {
      return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    })
    .map((value) => String(value).trim())
    .filter(Boolean)
}

function isTruthyCaptchaFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'false' || normalized === 'no') return false
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized) !== 0
  return ['true', 'yes', 'y'].includes(normalized)
}

function isSuccessErrorCode(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true
  if (typeof value === 'number') return value === 0
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '' || /^0+$/.test(normalized) || normalized === 'success'
}

function isRateLimited(payload: unknown): boolean {
  return collectNamedValues(payload, 'message').some((value) => {
    if (typeof value !== 'string') return false
    const message = value.toLocaleLowerCase('vi-VN')
    return message.includes('quá nhanh') || message.includes('qua nhanh') || message.includes('too fast')
  })
}

function assertRemoteResponseAllowed(payload: unknown): void {
  const captchaValues = collectNamedValues(payload, 'request_captcha')
  if (captchaValues.some(isTruthyCaptchaFlag)) {
    throw new AppError(
      'VIETTEL_CAPTCHA_REQUIRED',
      'Viettel yêu cầu xác minh CAPTCHA. Hãy hoàn tất xác minh trong trình duyệt rồi Crawl lại.'
    )
  }

  const errorCodes = collectNamedValues(payload, 'errorCode')
  const failedCode = errorCodes.find((value) => !isSuccessErrorCode(value))
  if (failedCode !== undefined) {
    throw new AppError(
      'VIETTEL_REMOTE_ERROR',
      `Viettel từ chối yêu cầu tìm SIM (mã lỗi: ${String(failedCode)}).`
    )
  }
}

function batchFingerprint(values: string[]): string {
  return values.join('\u001f')
}

export const viettelAdapter: SiteAdapter = {
  siteId: 'viettel',

  supports(url): boolean {
    return url.protocol === 'https:' && VIETTEL_HOSTS.has(url.hostname.toLowerCase())
  },

  async crawl(context) {
    const capturedRequest = requireCapturedRequest(context.capturedRequest)
    const collected: string[] = []
    const seenNumbers = new Set<string>()
    const seenBatches = new Set<string>()
    let plateauCount = 0
    let stopReason = `đã đạt giới hạn an toàn ${MAX_BATCHES} lô`

    context.report({
      phase: 'preflight',
      message: 'Đã ghi nhận bộ lọc Viettel. Đang chuẩn bị tải các lô SIM…',
      collected: 0,
      unique: 0
    })

    for (let page = 1; page <= MAX_BATCHES; page += 1) {
      assertNotAborted(context)
      context.report({
        phase: 'fetching',
        message: `Đang tải lô Viettel ${page}…`,
        current: page,
        collected: collected.length,
        unique: seenNumbers.size
      })

      const replay = buildPagedReplay(capturedRequest, page, context.signal)
      let payload: unknown
      for (let retry = 1; retry <= RATE_LIMIT_RETRIES; retry += 1) {
        payload = await context.fetchJson(replay.url, replay.init)
        if (!isRateLimited(payload)) break
        if (retry === RATE_LIMIT_RETRIES) {
          throw new AppError(
            'VIETTEL_RATE_LIMITED',
            'Viettel đang giới hạn tốc độ. Hãy chờ một phút rồi thử Crawl lại.'
          )
        }
        context.report({
          phase: 'retrying',
          message: `Viettel yêu cầu chờ. Đang thử lại lô ${page}…`,
          current: page,
          collected: collected.length,
          unique: seenNumbers.size
        })
        await context.delay(1_500 * 2 ** (retry - 1))
      }
      assertRemoteResponseAllowed(payload)

      const batch = collectIsdnValues(payload)
      if (batch.length === 0) {
        stopReason = 'website trả về lô trống'
        break
      }

      const fingerprint = batchFingerprint(batch)
      if (seenBatches.has(fingerprint)) {
        stopReason = 'website bắt đầu trả lại một lô đã nhận'
        break
      }
      seenBatches.add(fingerprint)

      let newCount = 0
      for (const number of batch) {
        if (seenNumbers.has(number)) continue
        seenNumbers.add(number)
        collected.push(number)
        newCount += 1
      }

      plateauCount = newCount === 0 ? plateauCount + 1 : 0
      context.report({
        phase: 'fetching',
        message: `Đã nhận ${collected.length} SIM duy nhất từ Viettel.`,
        current: page,
        collected: collected.length,
        unique: seenNumbers.size
      })

      if (batch.length < PAGE_SIZE) {
        stopReason = `website trả về lô cuối gồm ${batch.length}/${PAGE_SIZE} SIM`
        break
      }
      if (plateauCount >= PLATEAU_LIMIT) {
        stopReason = `không có SIM mới trong ${PLATEAU_LIMIT} lô liên tiếp`
        break
      }

      await context.delay(1_000)
    }

    context.report({
      phase: 'validating',
      message: 'Đang kiểm tra và loại SIM Viettel bị trùng…',
      collected: collected.length,
      unique: seenNumbers.size
    })

    return {
      rawNumbers: collected,
      completeness: 'best_effort',
      warning:
        `Viettel không công bố tổng kết quả đáng tin cậy; ứng dụng đã lấy dữ liệu đến khi ${stopReason}. ` +
        'Kết quả này là tốt nhất có thể và không được xem là toàn bộ kho SIM Viettel.'
    }
  }
}

export default viettelAdapter
