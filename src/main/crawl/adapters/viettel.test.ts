import { describe, expect, it, vi } from 'vitest'
import type { CrawlContext } from '../types'
import { viettelAdapter } from './viettel'

function contextFor(fetchJson: CrawlContext['fetchJson'], body?: string): CrawlContext {
  return {
    siteId: 'viettel',
    sourceUrl: 'https://viettel.vn/vx/di-dong/sim-so/',
    session: {} as CrawlContext['session'],
    webContents: {} as CrawlContext['webContents'],
    signal: new AbortController().signal,
    capturedRequest: {
      url: 'https://apigami.viettel.vn/mvt-api/myviettel.php/omiSearchSimV2',
      method: 'POST',
      body: body ?? JSON.stringify({ filter: '6868', page: 99, page_size: 6 }),
      headers: { 'Content-Type': 'application/json', 'Content-Length': '999' },
      capturedAt: Date.now()
    },
    report: vi.fn(),
    fetchText: vi.fn(),
    fetchJson,
    delay: vi.fn(async () => undefined)
  }
}

describe('viettelAdapter', () => {
  it('replays JSON pagination in 45-item batches and deduplicates recursively found isdn values', async () => {
    const firstBatch = Array.from({ length: 45 }, (_value, index) => ({
      isdn: `3${String(index).padStart(8, '0')}`
    }))
    const finalNumber = '999999999'
    const fetchJson = vi
      .fn<CrawlContext['fetchJson']>()
      .mockResolvedValueOnce({ errorCode: 0, request_captcha: 0, data: firstBatch })
      .mockResolvedValueOnce({
        errorCode: '0',
        request_captcha: '0',
        data: [{ nested: { isdn: firstBatch[0].isdn } }, { isdn: finalNumber }]
      })
    const context = contextFor(fetchJson)

    const result = await viettelAdapter.crawl(context)

    expect(result.completeness).toBe('best_effort')
    expect(result.rawNumbers).toHaveLength(46)
    expect(result.rawNumbers.at(-1)).toBe(finalNumber)
    expect(fetchJson).toHaveBeenCalledTimes(2)

    const firstInit = fetchJson.mock.calls[0][1]
    const secondInit = fetchJson.mock.calls[1][1]
    expect(JSON.parse(String(firstInit?.body))).toMatchObject({ page: 1, page_size: 45 })
    expect(JSON.parse(String(secondInit?.body))).toMatchObject({ page: 2, page_size: 45 })
    expect(new Headers(firstInit?.headers).has('content-length')).toBe(false)
  })

  it('stops instead of replaying a response that requests captcha', async () => {
    const fetchJson = vi.fn<CrawlContext['fetchJson']>().mockResolvedValue({
      errorCode: 0,
      request_captcha: 2,
      data: []
    })

    await expect(viettelAdapter.crawl(contextFor(fetchJson))).rejects.toMatchObject({
      code: 'VIETTEL_CAPTCHA_REQUIRED'
    })
  })

  it('backs off when Viettel reports that requests are too fast', async () => {
    const fetchJson = vi
      .fn<CrawlContext['fetchJson']>()
      .mockResolvedValueOnce({ errorCode: 1, message: 'Thao tác quá nhanh, xin vui lòng chờ' })
      .mockResolvedValueOnce({ errorCode: 0, request_captcha: 0, data: [{ isdn: '912345678' }] })
    const context = contextFor(fetchJson)

    const result = await viettelAdapter.crawl(context)

    expect(result.rawNumbers).toEqual(['912345678'])
    expect(fetchJson).toHaveBeenCalledTimes(2)
    expect(context.delay).toHaveBeenCalledWith(1_500)
  })

  it('requires a captured search request', async () => {
    const context = contextFor(vi.fn())
    context.capturedRequest = undefined

    await expect(viettelAdapter.crawl(context)).rejects.toMatchObject({
      code: 'VIETTEL_SEARCH_NOT_CAPTURED'
    })
  })

  it('rejects a lookalike captured endpoint on another host', async () => {
    const context = contextFor(vi.fn())
    context.capturedRequest = {
      ...context.capturedRequest!,
      url: 'https://evil.example/mvt-api/myviettel.php/omiSearchSimV2'
    }

    await expect(viettelAdapter.crawl(context)).rejects.toMatchObject({
      code: 'VIETTEL_SEARCH_NOT_CAPTURED'
    })
  })
})
