import { AppError } from '../../errors'
import type { CapturedRequest, CrawlContext, SiteAdapter } from '../types'
import { isAllowedCapturedRequest } from '../url-policy'

const VNPT_HOST = 'digishop.vnpt.vn'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNotAborted(context: CrawlContext): void {
  if (context.signal.aborted) {
    throw new AppError('CRAWL_CANCELLED', 'Đã dừng quá trình crawl VNPT.')
  }
}

function isExpectedCapture(request: CapturedRequest | undefined): request is CapturedRequest {
  return Boolean(request && isAllowedCapturedRequest('vnpt', request.url, request.method))
}

function requireCapturedRequest(request: CapturedRequest | undefined): CapturedRequest {
  if (!isExpectedCapture(request)) {
    throw new AppError(
      'VNPT_SEARCH_NOT_CAPTURED',
      'Chưa ghi nhận được yêu cầu tìm SIM của VNPT. Hãy chọn đầu số, bấm tìm kiếm trên trang VNPT rồi thử Crawl lại.'
    )
  }
  return request
}

function copyReplayHeaders(source: Record<string, string> | undefined): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [name, value] of Object.entries(source ?? {})) {
    const normalizedName = name.toLowerCase()
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

function replayInit(request: CapturedRequest, signal: AbortSignal): RequestInit {
  const method = (request.method || 'GET').toUpperCase()
  const init: RequestInit = {
    method,
    headers: copyReplayHeaders(request.headers),
    credentials: 'include',
    signal
  }
  if (request.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = request.body
  }
  return init
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

function collectSoTbValues(payload: unknown): string[] {
  return collectNamedValues(payload, 'so_tb')
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number => {
      return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    })
    .map((value) => String(value).trim())
    .filter(Boolean)
}

function hasValidDataArray(payload: unknown): payload is JsonRecord & { data: unknown[] } {
  return isRecord(payload) && Array.isArray(payload.data)
}

function assertResponseSchema(payload: unknown, numbers: string[]): asserts payload is JsonRecord {
  if (!hasValidDataArray(payload)) {
    throw new AppError(
      'VNPT_SCHEMA_CHANGED',
      'Cấu trúc dữ liệu VNPT đã thay đổi. Ứng dụng đã dừng để tránh xuất file thiếu hoặc sai.'
    )
  }

  if (payload.data.length > 0 && numbers.length === 0) {
    throw new AppError(
      'VNPT_SCHEMA_CHANGED',
      'VNPT đã trả dữ liệu nhưng ứng dụng không còn nhận diện được trường số SIM. Vui lòng cập nhật ứng dụng.'
    )
  }
}

export const vnptAdapter: SiteAdapter = {
  siteId: 'vnpt',

  supports(url): boolean {
    return url.protocol === 'https:' && url.hostname.toLowerCase() === VNPT_HOST
  },

  async crawl(context) {
    const capturedRequest = requireCapturedRequest(context.capturedRequest)
    assertNotAborted(context)

    context.report({
      phase: 'preflight',
      message: 'Đã ghi nhận bộ lọc VNPT. Đang chuẩn bị lấy tập kết quả website cung cấp…',
      collected: 0,
      unique: 0
    })
    context.report({
      phase: 'fetching',
      message: 'Đang tải tập kết quả SIM VNPT…',
      current: 1,
      total: 1,
      collected: 0,
      unique: 0
    })

    const payload = await context.fetchJson(
      capturedRequest.url,
      replayInit(capturedRequest, context.signal)
    )
    assertNotAborted(context)

    const extracted = collectSoTbValues(payload)
    assertResponseSchema(payload, extracted)

    const seen = new Set<string>()
    const numbers: string[] = []
    for (const number of extracted) {
      if (seen.has(number)) continue
      seen.add(number)
      numbers.push(number)
    }

    context.report({
      phase: 'validating',
      message: `Đã nhận toàn bộ ${numbers.length} SIM trong tập kết quả VNPT hiện tại.`,
      current: 1,
      total: 1,
      collected: numbers.length,
      unique: numbers.length
    })

    return {
      rawNumbers: numbers,
      completeness: 'returned_set_complete',
      warning:
        `VNPT hiện chỉ cung cấp tối đa 50 SIM cho mỗi truy vấn. File chứa toàn bộ ${numbers.length} SIM ` +
        'trong tập kết quả website đã trả về, không phải toàn bộ kho SIM VNPT.'
    }
  }
}

export default vnptAdapter
