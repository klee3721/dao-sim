import { describe, expect, it, vi } from 'vitest'
import type { SiteId } from '../../shared/types'
import {
  fetchWithAllowedRedirects,
  isAllowedCapturedRequest,
  isAllowedCrawlUrl
} from './url-policy'

function response(status = 200, url = '', location?: string): Response {
  return {
    status,
    url,
    headers: new Headers(location ? { location } : undefined)
  } as Response
}

describe('crawl URL policy', () => {
  it.each<{
    siteId: SiteId
    allowed: string
    blocked: string
  }>([
    {
      siteId: 'khosim',
      allowed: 'https://khosim.com/sim-duoi-6868?sort=3',
      blocked: 'https://khosim.com.evil.example/sim-duoi-6868'
    },
    {
      siteId: 'simthanglong',
      allowed: 'https://www.simthanglong.vn/tim-sim/6868.html?d=-1',
      blocked: 'https://evil.example/tim-sim/6868.html'
    },
    {
      siteId: 'viettel',
      allowed: 'https://apigami.viettel.vn/mvt-api/myviettel.php/omiSearchSimV2?page=1',
      blocked: 'https://apigami.viettel.vn/other/omiSearchSimV2'
    },
    {
      siteId: 'vnpt',
      allowed: 'https://digishop.vnpt.vn/apiprod/v2/simso/num_search',
      blocked: 'https://evil.example/apiprod/v2/simso/num_search'
    }
  ])('allows only the expected $siteId crawl origin and path', ({ siteId, allowed, blocked }) => {
    expect(isAllowedCrawlUrl(siteId, allowed)).toBe(true)
    expect(isAllowedCrawlUrl(siteId, blocked)).toBe(false)
  })

  it('requires each exact dynamic endpoint and its expected HTTP method', () => {
    expect(
      isAllowedCapturedRequest(
        'viettel',
        'https://apigami.viettel.vn/mvt-api/myviettel.php/omiSearchSimV2?filter=6868',
        'POST'
      )
    ).toBe(true)
    expect(
      isAllowedCapturedRequest(
        'viettel',
        'https://evil.example/mvt-api/myviettel.php/omiSearchSimV2',
        'POST'
      )
    ).toBe(false)
    expect(
      isAllowedCapturedRequest(
        'vnpt',
        'https://digishop.vnpt.vn/apiprod/v2/simso/num_search?search=*85&prefix=8481&commit=0',
        'GET'
      )
    ).toBe(true)
    expect(
      isAllowedCapturedRequest(
        'vnpt',
        'https://digishop.vnpt.vn/apiprod/v2/simso/num_search',
        'POST'
      )
    ).toBe(false)
  })

  it('rejects an outside URL before sending a request', async () => {
    const fetcher = vi.fn(async () => response())

    await expect(
      fetchWithAllowedRedirects('khosim', 'https://evil.example/sim', {}, fetcher)
    ).rejects.toMatchObject({ code: 'UNSAFE_CRAWL_URL' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('blocks a redirect outside the site allowlist before following it', async () => {
    const fetcher = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response(302, '', 'https://evil.example/collect'))

    await expect(
      fetchWithAllowedRedirects(
        'simthanglong',
        'https://simthanglong.vn/tim-sim/6868.html',
        {},
        fetcher
      )
    ).rejects.toMatchObject({ code: 'UNSAFE_CRAWL_REDIRECT' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual')
  })

  it.each<{
    siteId: SiteId
    requestUrl: string
  }>([
    { siteId: 'khosim', requestUrl: 'https://khosim.com/sim-gia-re' },
    { siteId: 'simthanglong', requestUrl: 'https://simthanglong.vn/tim-sim/1.html' },
    {
      siteId: 'viettel',
      requestUrl: 'https://apigami.viettel.vn/mvt-api/myviettel.php/omiSearchSimV2'
    },
    {
      siteId: 'vnpt',
      requestUrl: 'https://digishop.vnpt.vn/apiprod/v2/simso/num_search'
    }
  ])('rejects an outside final response URL for $siteId', async ({ siteId, requestUrl }) => {
    const fetcher = vi.fn(async () => response(200, 'https://evil.example/final'))

    await expect(
      fetchWithAllowedRedirects(siteId, requestUrl, {}, fetcher)
    ).rejects.toMatchObject({ code: 'UNSAFE_CRAWL_REDIRECT' })
  })

  it('follows an allowed redirect and applies normal POST-to-GET redirect semantics', async () => {
    const fetcher = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response(302, '', 'https://www.khosim.com/sim-gia-re'))
      .mockResolvedValueOnce(response(200, 'https://www.khosim.com/sim-gia-re'))

    await expect(
      fetchWithAllowedRedirects(
        'khosim',
        'https://khosim.com/sim-gia-re',
        { method: 'POST', body: 'filter=6868', headers: { 'content-type': 'text/plain' } },
        fetcher
      )
    ).resolves.toMatchObject({ status: 200 })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][0]).toBe('https://www.khosim.com/sim-gia-re')
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'GET', body: undefined, redirect: 'manual' })
    expect(new Headers(fetcher.mock.calls[1][1].headers).has('content-type')).toBe(false)
  })
})
