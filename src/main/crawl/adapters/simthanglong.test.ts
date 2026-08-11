import { describe, expect, it, vi } from 'vitest'
import type { SiteId } from '../../../shared/types'
import type { CrawlContext } from '../types'
import { simThangLongAdapter } from './simthanglong'

function simNumber(index: number): string {
  return `09${String(index).padStart(8, '0')}`
}

function html(total: number, numbers: string[]): string {
  return `
    <html><body>
      <span class="count-number">Số lượng: ${total.toLocaleString('en-US')}</span>
      <table class="tbl-category-pc"><tbody>
        ${numbers
          .map(
            (number) =>
              `<tr><td class="simso"><a title="SIM ${number} - viettel">${number}</a></td></tr>`
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

describe('simThangLongAdapter', () => {
  it('crawls every page, forces a stable sort, and verifies the exact total', async () => {
    const numbers = Array.from({ length: 52 }, (_value, index) => simNumber(index))
    const requestedUrls: URL[] = []
    const fetchText = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl)
      requestedUrls.push(url)
      return url.searchParams.get('p') === '2'
        ? html(52, numbers.slice(50))
        : html(52, numbers.slice(0, 50))
    })
    const context = mockContext(
      'simthanglong',
      'https://simthanglong.vn/tim-sim/123.html?t=1&p=7',
      fetchText
    )

    const result = await simThangLongAdapter.crawl(context)

    expect(result).toMatchObject({
      completeness: 'verified_complete',
      declaredTotal: 52,
      rawNumbers: numbers
    })
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls[0].searchParams.get('d')).toBe('-1')
    expect(requestedUrls[0].searchParams.has('p')).toBe(false)
    expect(requestedUrls[1].searchParams.get('p')).toBe('2')
    expect(requestedUrls[2].searchParams.has('p')).toBe(false)
  })

  it('restarts the whole attempt and refuses duplicate results', async () => {
    const duplicatePage = html(2, [simNumber(1), simNumber(1)])
    const fetchText = vi.fn(async () => duplicatePage)
    const context = mockContext(
      'simthanglong',
      'https://simthanglong.vn/tim-sim/1.html?d=-1',
      fetchText
    )

    await expect(simThangLongAdapter.crawl(context)).rejects.toMatchObject({
      code: 'CRAWL_INCOMPLETE'
    })
    expect(fetchText).toHaveBeenCalledTimes(3)
  })
})
