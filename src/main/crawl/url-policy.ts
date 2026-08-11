import type { SiteId } from '../../shared/types'
import { AppError } from '../errors'

const SITE_PAGE_HOSTS: Partial<Record<SiteId, ReadonlySet<string>>> = {
  khosim: new Set(['khosim.com', 'www.khosim.com']),
  simthanglong: new Set(['simthanglong.vn', 'www.simthanglong.vn'])
}

interface EndpointRule {
  hostname: string
  pathname: string
  method: 'GET' | 'POST'
  webRequestPattern: string
}

const CAPTURE_ENDPOINTS: Partial<Record<SiteId, EndpointRule>> = {
  viettel: {
    hostname: 'apigami.viettel.vn',
    pathname: '/mvt-api/myviettel.php/omiSearchSimV2',
    method: 'POST',
    webRequestPattern: 'https://apigami.viettel.vn/mvt-api/myviettel.php/omiSearchSimV2*'
  },
  vnpt: {
    hostname: 'digishop.vnpt.vn',
    pathname: '/apiprod/v2/simso/num_search',
    method: 'GET',
    webRequestPattern: 'https://digishop.vnpt.vn/apiprod/v2/simso/num_search*'
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

type SafeFetch = (url: string, init: RequestInit) => Promise<Response>

function parsedHttpsUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== ''
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

function matchesEndpoint(siteId: SiteId, url: URL): boolean {
  const rule = CAPTURE_ENDPOINTS[siteId]
  return Boolean(
    rule &&
      url.hostname.toLowerCase() === rule.hostname &&
      url.pathname === rule.pathname
  )
}

export function captureWebRequestPatterns(siteId: SiteId): string[] {
  const pattern = CAPTURE_ENDPOINTS[siteId]?.webRequestPattern
  return pattern ? [pattern] : []
}

export function isAllowedCapturedRequest(
  siteId: SiteId,
  rawUrl: string,
  method: string
): boolean {
  const url = parsedHttpsUrl(rawUrl)
  const rule = CAPTURE_ENDPOINTS[siteId]
  return Boolean(url && rule && method.toUpperCase() === rule.method && matchesEndpoint(siteId, url))
}

export function isAllowedCrawlUrl(siteId: SiteId, rawUrl: string): boolean {
  const url = parsedHttpsUrl(rawUrl)
  if (!url) return false

  const pageHosts = SITE_PAGE_HOSTS[siteId]
  if (pageHosts) return pageHosts.has(url.hostname.toLowerCase())
  return matchesEndpoint(siteId, url)
}

function assertAllowedCrawlUrl(siteId: SiteId, rawUrl: string, redirect: boolean): void {
  if (isAllowedCrawlUrl(siteId, rawUrl)) return
  throw new AppError(
    redirect ? 'UNSAFE_CRAWL_REDIRECT' : 'UNSAFE_CRAWL_URL',
    redirect
      ? 'Website chuyển hướng yêu cầu crawl ra ngoài endpoint được phép. Ứng dụng đã chặn yêu cầu.'
      : 'Ứng dụng đã chặn yêu cầu crawl tới endpoint không được phép.'
  )
}

function redirectedInit(status: number, init: RequestInit): RequestInit {
  const method = (init.method ?? 'GET').toUpperCase()
  const switchToGet = status === 303 || ((status === 301 || status === 302) && method === 'POST')
  if (!switchToGet || method === 'HEAD') return init

  const headers = new Headers(init.headers)
  headers.delete('content-length')
  headers.delete('content-type')
  headers.delete('transfer-encoding')
  return { ...init, method: 'GET', body: undefined, headers }
}

export async function fetchWithAllowedRedirects(
  siteId: SiteId,
  rawUrl: string,
  init: RequestInit,
  fetcher: SafeFetch
): Promise<Response> {
  let currentUrl = rawUrl
  let currentInit = { ...init, redirect: 'manual' as const }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertAllowedCrawlUrl(siteId, currentUrl, redirectCount > 0)
    const response = await fetcher(currentUrl, currentInit)
    const responseUrl = response.url || currentUrl
    assertAllowedCrawlUrl(siteId, responseUrl, responseUrl !== rawUrl)

    if (!REDIRECT_STATUSES.has(response.status)) return response

    const location = response.headers.get('location')
    if (!location) {
      throw new AppError(
        'INVALID_CRAWL_REDIRECT',
        'Website trả về chuyển hướng không có địa chỉ đích. Ứng dụng đã dừng crawl.'
      )
    }
    if (redirectCount === MAX_REDIRECTS) {
      throw new AppError(
        'TOO_MANY_CRAWL_REDIRECTS',
        `Website chuyển hướng quá ${MAX_REDIRECTS} lần. Ứng dụng đã dừng crawl.`
      )
    }

    let nextUrl: string
    try {
      nextUrl = new URL(location, responseUrl).toString()
    } catch {
      throw new AppError(
        'INVALID_CRAWL_REDIRECT',
        'Website trả về địa chỉ chuyển hướng không hợp lệ. Ứng dụng đã dừng crawl.'
      )
    }
    assertAllowedCrawlUrl(siteId, nextUrl, true)
    currentUrl = nextUrl
    currentInit = { ...redirectedInit(response.status, currentInit), redirect: 'manual' }
  }

  throw new AppError('TOO_MANY_CRAWL_REDIRECTS', 'Website chuyển hướng quá nhiều lần.')
}
