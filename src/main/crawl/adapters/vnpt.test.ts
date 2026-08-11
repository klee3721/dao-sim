import { describe, expect, it, vi } from 'vitest'
import type { CrawlContext } from '../types'
import { vnptAdapter } from './vnpt'

function contextFor(fetchJson: CrawlContext['fetchJson']): CrawlContext {
  return {
    siteId: 'vnpt',
    sourceUrl: 'https://digishop.vnpt.vn/sim-so',
    session: {} as CrawlContext['session'],
    webContents: {} as CrawlContext['webContents'],
    signal: new AbortController().signal,
    capturedRequest: {
      url:
        'https://digishop.vnpt.vn/apiprod/v2/simso/num_search?search=*85&prefix=8481&commit=0',
      method: 'GET',
      headers: { Authentication: 'test-authentication-value' },
      capturedAt: Date.now()
    },
    report: vi.fn(),
    fetchText: vi.fn(),
    fetchJson,
    delay: vi.fn(async () => undefined)
  }
}

describe('vnptAdapter', () => {
  it('replays once and returns every unique so_tb in the website-provided set', async () => {
    const fetchJson = vi.fn<CrawlContext['fetchJson']>().mockResolvedValue({
      data: [
        { so_tb: '84812660412' },
        { group: { so_tb: '84912345678' } },
        { so_tb: '84812660412' }
      ]
    })

    const result = await vnptAdapter.crawl(contextFor(fetchJson))

    expect(fetchJson).toHaveBeenCalledTimes(1)
    expect(fetchJson.mock.calls[0][0]).toContain('search=*85&prefix=8481&commit=0')
    expect(result).toMatchObject({
      completeness: 'returned_set_complete',
      rawNumbers: ['84812660412', '84912345678']
    })
    expect(result.warning).toContain('50')
    expect(new Headers(fetchJson.mock.calls[0][1]?.headers).get('authentication')).toBe(
      'test-authentication-value'
    )
  })

  it('rejects schema drift instead of exporting an empty file', async () => {
    const fetchJson = vi.fn<CrawlContext['fetchJson']>().mockResolvedValue({ items: [] })

    await expect(vnptAdapter.crawl(contextFor(fetchJson))).rejects.toMatchObject({
      code: 'VNPT_SCHEMA_CHANGED'
    })
  })

  it('rejects a lookalike captured endpoint on another host', async () => {
    const context = contextFor(vi.fn())
    context.capturedRequest = {
      ...context.capturedRequest!,
      url: 'https://evil.example/apiprod/v2/simso/num_search'
    }

    await expect(vnptAdapter.crawl(context)).rejects.toMatchObject({
      code: 'VNPT_SEARCH_NOT_CAPTURED'
    })
  })
})
