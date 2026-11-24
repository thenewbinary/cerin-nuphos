import { ALLOWED_WEB_HOSTS, WEB_BASE_URL, isAppWebUrl } from './web-base-url.ts'

export type AppOpenDeepLinkPayload = {
  url: string
  path: string
}

const PROTOCOLS = new Set(['cerin:', 'nuphos:'])
const HOST = 'open'

function normalizePath(value: string | null): string | null {
  if (!value) return null
  const path = value.startsWith('/') ? value : `/${value}`

  return path.replace(/\/{2,}/g, '/')
}

function parseAllowedWebUrl(value: string | null): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:' || (!ALLOWED_WEB_HOSTS.has(url.hostname) && !isAppWebUrl(value)))
      return null

    return url
  } catch {
    return null
  }
}

export function isAppOpenUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)

    return PROTOCOLS.has(url.protocol) && url.hostname === HOST
  } catch {
    return false
  }
}

export function parseAppOpenUrl(rawUrl: string): AppOpenDeepLinkPayload | null {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (!PROTOCOLS.has(url.protocol) || url.hostname !== HOST) return null

  const webUrl = parseAllowedWebUrl(url.searchParams.get('url'))
  const rawPath = normalizePath(url.searchParams.get('path'))
  const path = rawPath ?? (webUrl ? `${webUrl.pathname}${webUrl.search}${webUrl.hash}` : null)

  if (!webUrl && !path) return null

  const canonicalUrl = webUrl ?? new URL(path!, WEB_BASE_URL)

  if (rawPath) {
    const [pathnameAndSearch, hash = ''] = rawPath.split('#', 2)
    const [pathname, search = ''] = pathnameAndSearch.split('?', 2)

    canonicalUrl.pathname = pathname
    canonicalUrl.search = search ? `?${search}` : ''
    canonicalUrl.hash = hash ? `#${hash}` : ''
  }

  return {
    url: canonicalUrl.toString(),
    path: `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`,
  }
}
