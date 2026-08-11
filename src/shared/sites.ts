import type { SiteDefinition, SiteId } from './types'

export const SITES: SiteDefinition[] = [
  {
    id: 'khosim',
    name: 'KhoSim',
    shortName: 'KS',
    homeUrl: 'https://khosim.com/',
    color: '#e05243'
  },
  {
    id: 'simthanglong',
    name: 'Sim Thăng Long',
    shortName: 'STL',
    homeUrl: 'https://simthanglong.vn/',
    color: '#d69b2d'
  },
  {
    id: 'viettel',
    name: 'Viettel',
    shortName: 'VT',
    homeUrl: 'https://viettel.vn/vx/di-dong/sim-so/',
    color: '#008c87'
  },
  {
    id: 'vnpt',
    name: 'VNPT',
    shortName: 'VN',
    homeUrl: 'https://digishop.vnpt.vn/sim-so',
    color: '#1777c7'
  }
]

const SITE_HOSTS: Record<SiteId, string[]> = {
  khosim: ['khosim.com', 'www.khosim.com'],
  simthanglong: ['simthanglong.vn', 'www.simthanglong.vn'],
  viettel: ['viettel.vn', 'www.viettel.vn'],
  vnpt: ['digishop.vnpt.vn']
}

export function siteById(siteId: SiteId): SiteDefinition {
  const site = SITES.find((candidate) => candidate.id === siteId)
  if (!site) throw new Error(`Website không được hỗ trợ: ${siteId}`)
  return site
}

export function siteIdFromUrl(rawUrl: string): SiteId | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return null
    const hostname = url.hostname.toLowerCase()
    for (const [siteId, hosts] of Object.entries(SITE_HOSTS) as [SiteId, string[]][]) {
      if (hosts.includes(hostname)) return siteId
    }
  } catch {
    return null
  }
  return null
}

export function isAllowedMainFrameUrl(rawUrl: string): boolean {
  return siteIdFromUrl(rawUrl) !== null
}
