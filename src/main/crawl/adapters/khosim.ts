import { load } from 'cheerio'
import { AppError } from '../../errors'
import type { AdapterResult, CrawlContext, SiteAdapter } from '../types'

const PAGE_SIZE = 50
const MAX_RESULTS = 5_000
const MAX_ATTEMPTS = 3
const PAGE_DELAY_MS = 400
const RETRY_DELAY_MS = 800

class RetryableAttemptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableAttemptError'
  }
}

interface ParsedPage {
  declaredTotal: number
  numbers: string[]
}

function parseCount(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return null
  const count = Number.parseInt(digits, 10)
  return Number.isSafeInteger(count) && count >= 0 ? count : null
}

function numberFromHref(rawHref: string | undefined): string | null {
  if (!rawHref) return null
  try {
    const pathname = decodeURIComponent(new URL(rawHref, 'https://khosim.com/').pathname)
    return pathname.match(/\/(0\d{9})\/?$/)?.[1] ?? null
  } catch {
    return null
  }
}

function parsePage(html: string): ParsedPage {
  const $ = load(html)
  const declaredTotal = parseCount($('#lb-total-sim').first().text())

  if (declaredTotal === null) {
    throw new AppError(
      'SITE_CHANGED',
      'Không đọc được tổng số SIM trên KhoSim. Website có thể đã thay đổi.'
    )
  }

  const numbers: string[] = []
  $('table.tbl-list-sim')
    .first()
    .find('td.sim')
    .each((_index, cell) => {
      const anchor = $(cell).find('a').first()
      const hrefNumber = numberFromHref(anchor.attr('href'))
      const textDigits = anchor.text().replace(/\D/g, '')
      const textNumber = /^0\d{9}$/.test(textDigits) ? textDigits : null
      const number = hrefNumber ?? textNumber
      if (number) numbers.push(number)
    })

  if (declaredTotal > 0 && numbers.length === 0) {
    throw new AppError(
      'SITE_CHANGED',
      'Không đọc được danh sách SIM trên KhoSim. Website có thể đã thay đổi.'
    )
  }

  return { declaredTotal, numbers }
}

function canonicalSourceUrl(sourceUrl: string): URL {
  const url = new URL(sourceUrl)
  url.pathname = url.pathname.replace(/\/trang-\d+\/?$/i, '') || '/'
  if (!url.searchParams.has('sort')) url.searchParams.set('sort', '3')
  return url
}

function pageUrl(baseUrl: URL, page: number): string {
  const url = new URL(baseUrl)
  if (page > 1) {
    const basePath = url.pathname.replace(/\/+$/, '')
    url.pathname = `${basePath}/trang-${page}`
  }
  return url.toString()
}

function assertNotAborted(context: CrawlContext): void {
  if (!context.signal.aborted) return
  if (context.signal.reason instanceof AppError) throw context.signal.reason
  throw new AppError('CRAWL_CANCELLED', 'Đã dừng quá trình crawl KhoSim.')
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Lỗi không xác định.'
}

async function crawlAttempt(
  context: CrawlContext,
  baseUrl: URL,
  attempt: number
): Promise<AdapterResult> {
  assertNotAborted(context)
  context.report({
    phase: 'preflight',
    message: 'Đang đọc tổng số SIM trên KhoSim…',
    collected: 0,
    unique: 0,
    attempt
  })

  const firstPage = parsePage(await context.fetchText(pageUrl(baseUrl, 1)))
  const declaredTotal = firstPage.declaredTotal

  if (declaredTotal > MAX_RESULTS) {
    throw new AppError(
      'RESULT_LIMIT',
      `KhoSim có ${declaredTotal.toLocaleString('vi-VN')} kết quả. ` +
        `Bản hiện tại chỉ crawl tối đa ${MAX_RESULTS.toLocaleString('vi-VN')} kết quả; ` +
        'vui lòng lọc hẹp hơn.'
    )
  }

  const pageCount = Math.max(1, Math.ceil(declaredTotal / PAGE_SIZE))
  const rawNumbers = [...firstPage.numbers]
  const uniqueNumbers = new Set(firstPage.numbers)
  const fingerprints = new Set<string>()

  if (firstPage.numbers.length > 0) {
    fingerprints.add(firstPage.numbers.join('|'))
  }

  context.report({
    phase: 'fetching',
    message: `Đã tải trang 1/${pageCount}.`,
    current: 1,
    total: pageCount,
    collected: rawNumbers.length,
    unique: uniqueNumbers.size,
    attempt
  })

  for (let page = 2; page <= pageCount; page += 1) {
    assertNotAborted(context)
    await context.delay(PAGE_DELAY_MS)
    assertNotAborted(context)

    const parsed = parsePage(await context.fetchText(pageUrl(baseUrl, page)))
    if (parsed.declaredTotal !== declaredTotal) {
      throw new RetryableAttemptError(
        `Tổng số SIM thay đổi từ ${declaredTotal} thành ${parsed.declaredTotal} trong lúc crawl.`
      )
    }

    const fingerprint = parsed.numbers.join('|')
    if (fingerprint && fingerprints.has(fingerprint)) {
      throw new RetryableAttemptError(`KhoSim trả lại nội dung trang đã tải ở trang ${page}.`)
    }
    if (fingerprint) fingerprints.add(fingerprint)

    rawNumbers.push(...parsed.numbers)
    for (const number of parsed.numbers) uniqueNumbers.add(number)

    context.report({
      phase: 'fetching',
      message: `Đã tải trang ${page}/${pageCount}.`,
      current: page,
      total: pageCount,
      collected: rawNumbers.length,
      unique: uniqueNumbers.size,
      attempt
    })
  }

  context.report({
    phase: 'validating',
    message: 'Đang đối chiếu số lượng, độ ổn định và kiểm tra trang lặp…',
    current: pageCount,
    total: pageCount,
    collected: rawNumbers.length,
    unique: uniqueNumbers.size,
    attempt
  })

  if (pageCount > 1) {
    await context.delay(PAGE_DELAY_MS)
    assertNotAborted(context)
    const finalFirstPage = parsePage(await context.fetchText(pageUrl(baseUrl, 1)))
    if (
      finalFirstPage.declaredTotal !== declaredTotal ||
      finalFirstPage.numbers.join('|') !== firstPage.numbers.join('|')
    ) {
      throw new RetryableAttemptError(
        'Trang đầu hoặc tổng số SIM đã thay đổi trong lúc crawl.'
      )
    }
  }

  if (rawNumbers.length !== declaredTotal || uniqueNumbers.size !== declaredTotal) {
    throw new RetryableAttemptError(
      `Website công bố ${declaredTotal} SIM nhưng chỉ đọc được ${rawNumbers.length} dòng, ` +
        `${uniqueNumbers.size} SIM duy nhất.`
    )
  }

  return {
    rawNumbers,
    completeness: 'verified_complete',
    declaredTotal
  }
}

export const khoSimAdapter: SiteAdapter = {
  siteId: 'khosim',

  supports(url: URL): boolean {
    const hostname = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (hostname === 'khosim.com' || hostname === 'www.khosim.com')
  },

  async crawl(context: CrawlContext): Promise<AdapterResult> {
    const baseUrl = canonicalSourceUrl(context.sourceUrl)
    let lastFailure = 'Không thể kiểm chứng đầy đủ kết quả.'

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await crawlAttempt(context, baseUrl, attempt)
      } catch (error) {
        assertNotAborted(context)
        if (
          error instanceof AppError &&
          (error.code === 'SITE_CHANGED' || error.code === 'RESULT_LIMIT')
        ) {
          throw error
        }

        lastFailure = messageFrom(error)
        if (attempt === MAX_ATTEMPTS) break

        context.report({
          phase: 'retrying',
          message: `Kết quả chưa ổn định. Đang chạy lại toàn bộ lần ${attempt + 1}/${MAX_ATTEMPTS}…`,
          collected: 0,
          unique: 0,
          attempt: attempt + 1
        })
        await context.delay(RETRY_DELAY_MS * attempt)
      }
    }

    throw new AppError(
      'CRAWL_INCOMPLETE',
      `Không thể kiểm chứng đầy đủ danh sách KhoSim sau ${MAX_ATTEMPTS} lần. ${lastFailure}`
    )
  }
}

export default khoSimAdapter
