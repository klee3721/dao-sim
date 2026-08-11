import { describe, expect, it, vi } from 'vitest'
import type { SiteId } from '../../../shared/types'
import type { CrawlContext } from '../types'
import { khoSimAdapter } from './khosim'

function simNumber(index: number): string {
  return `08${String(index).padStart(8, '0')}`
}

function html(total: number, numbers: string[]): string {
  return `
    <html><body>
      <span id="lb-total-sim">${total.toLocaleString('en-US')}</span>
      <table class="tbl-list-sim"><tbody>
        ${numbers
          .map(
            (number) => `
              <tr><td class="sim">
                <a href="https://khosim.com/${number}">
                  <strong>${number.slice(0, 4)}.<i>${number.slice(4)}</i></strong>
                </a>
              </td></tr>`
          )
          .join('')}
      </tbody></table>
    </body></html>
  `
}

function mockContext(
  siteId: SiteId,
  sourceUrl: string,
  fetchText: CrawlContext['fetchText']
): CrawlContext {
  return {
    siteId,
    sourceUrl,
    session: {} as CrawlContext['session'],
    webContents: {} as CrawlContext['webContents'],
    signal: new AbortController().signal,
    report: vi.fn(),
    fetchText,
    fetchJson: vi.fn(),
    delay: vi.fn(async () => undefined)
  }
}

describe('khoSimAdapter', () => {
  it('uses /trang-N, preserves filters, adds sort=3, and verifies the exact total', async () => {
    const numbers = Array.from({ length: 51 }, (_value, index) => simNumber(index))
    const requestedUrls: URL[] = []
    const fetchText = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl)
      requestedUrls.push(url)
      return url.pathname.endsWith('/trang-2')
        ? html(51, numbers.slice(50))
        : html(51, numbers.slice(0, 50))
    })
    const context = mockContext(
      'khosim',
      'https://khosim.com/sim-duoi-123/trang-7?p=500-1000&av=0%2C5',
      fetchText
    )

    const result = await khoSimAdapter.crawl(context)

    expect(result).toMatchObject({
      completeness: 'verified_complete',
      declaredTotal: 51,
      rawNumbers: numbers
    })
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls[0].pathname).toBe('/sim-duoi-123')
    expect(requestedUrls[0].searchParams.get('p')).toBe('500-1000')
    expect(requestedUrls[0].searchParams.get('sort')).toBe('3')
    expect(requestedUrls[1].pathname).toBe('/sim-duoi-123/trang-2')
    expect(requestedUrls[2].pathname).toBe('/sim-duoi-123')
  })

  it('stops before pagination when the declared total exceeds 5,000', async () => {
    const fetchText = vi.fn(async () => html(5_001, [simNumber(1)]))
    const context = mockContext('khosim', 'https://khosim.com/sim-gia-re', fetchText)

    await expect(khoSimAdapter.crawl(context)).rejects.toMatchObject({ code: 'RESULT_LIMIT' })
    expect(fetchText).toHaveBeenCalledTimes(1)
  })

  it('detects a repeated page and retries the complete crawl', async () => {
    const firstFifty = Array.from({ length: 50 }, (_value, index) => simNumber(index))
    const fetchText = vi.fn(async () => html(100, firstFifty))
    const context = mockContext('khosim', 'https://khosim.com/sim-gia-re?sort=3', fetchText)

    await expect(khoSimAdapter.crawl(context)).rejects.toMatchObject({
      code: 'CRAWL_INCOMPLETE'
    })
    expect(fetchText).toHaveBeenCalledTimes(6)
  })
})
