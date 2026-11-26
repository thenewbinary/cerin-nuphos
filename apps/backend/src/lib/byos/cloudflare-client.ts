import { ComposioConnectorCallbackError, composioProxyExecute } from '@/lib/composio-connect'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { CloudflareAccountBinding } from '@/models'

export const CLOUDFLARE_CONNECTOR: ComposioConnectorSpec = {
  provider: 'cloudflare',
  displayName: 'Cloudflare',
  toolkitSlug: 'cloudflare',
  kind: 'apiKey',
}

export const CLOUDFLARE_PROXY: ComposioProxySpec = {
  ...CLOUDFLARE_CONNECTOR,
  baseUrl: 'https://api.cloudflare.com/client/v4',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}

export type CloudflareAccountHandle = Pick<
  CloudflareAccountBinding,
  'accountId' | 'composioAccountId' | 'composioUserId'
>

type CloudflareError = {
  code?: number
  message?: string
}

type CloudflareResponse<T> = {
  success: boolean
  errors?: CloudflareError[]
  result?: T
  result_info?: {
    page?: number
    per_page?: number
    count?: number
    total_count?: number
    total_pages?: number
  }
}

class CloudflareApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: CloudflareError[],
  ) {
    super(message)
    this.name = 'CloudflareApiError'
  }
}

export function cloudflareProxy(
  connection: Pick<CloudflareAccountBinding, 'composioAccountId' | 'composioUserId'>,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(CLOUDFLARE_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
}

/** The API token entered on Connect Link must identify exactly one account. */
export async function cloudflareIdentity(
  connection: Pick<CloudflareAccountBinding, 'composioAccountId' | 'composioUserId'>,
): Promise<{ accountId: string; accountName: string | null }> {
  const { data } = await cloudflareProxy(connection, {
    method: 'GET',
    path: '/accounts',
    query: { per_page: '50' },
  })
  const payload = data as { success?: unknown; result?: unknown } | null
  const accounts = Array.isArray(payload?.result)
    ? (payload.result as { id?: unknown; name?: unknown }[])
    : []

  if (accounts.length === 0) {
    throw new ComposioConnectorCallbackError(
      'no_cloudflare_account',
      'The Cloudflare API token has no accessible accounts. Use an account-scoped token.',
    )
  }
  if (accounts.length !== 1) {
    throw new ComposioConnectorCallbackError(
      'multiple_cloudflare_accounts',
      'The Cloudflare API token can access multiple accounts. Use a token scoped to exactly one account.',
    )
  }
  const account = accounts[0]!

  if (typeof account.id !== 'string' || !/^[a-f0-9]{32}$/iu.test(account.id)) {
    throw new ComposioConnectorCallbackError(
      'invalid_cloudflare_account',
      'Cloudflare returned an invalid account identity',
    )
  }

  return {
    accountId: account.id.toLowerCase(),
    accountName: typeof account.name === 'string' ? account.name : null,
  }
}

function errorMessage(status: number, errors: CloudflareError[] | undefined): string {
  return (
    errors?.find((error) => error.message)?.message ??
    `Cloudflare API returned HTTP ${String(status)}`
  )
}

function splitPath(path: string): { pathname: string; query?: Record<string, string> } {
  const question = path.indexOf('?')
  const query = Object.fromEntries(
    new URLSearchParams(question === -1 ? '' : path.slice(question + 1)),
  )

  return {
    pathname: question === -1 ? path : path.slice(0, question),
    ...(Object.keys(query).length ? { query } : {}),
  }
}

function requestBody(init: RequestInit): unknown {
  if (init.body === undefined || init.body === null) return undefined
  const contentType = new Headers(init.headers).get('Content-Type') ?? ''

  if (typeof init.body === 'string' && contentType.includes('application/json')) {
    return JSON.parse(init.body) as unknown
  }

  return init.body
}

async function proxyRequest(
  handle: CloudflareAccountHandle,
  path: string,
  init: RequestInit,
): Promise<{ status: number; data: unknown }> {
  const body = requestBody(init)

  const { pathname, query } = splitPath(path)

  return cloudflareProxy(handle, {
    method: init.method ?? 'GET',
    path: pathname,
    ...(query ? { query } : {}),
    ...(body === undefined ? {} : { body }),
  })
}

function payloadOf<T>(data: unknown): CloudflareResponse<T> | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as CloudflareResponse<T>
    } catch {
      return null
    }
  }

  return typeof data === 'object' && data !== null ? (data as CloudflareResponse<T>) : null
}

async function cloudflareRequestPayload<T>(
  handle: CloudflareAccountHandle,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareResponse<T>> {
  const { status, data } = await proxyRequest(handle, path, init)
  const payload = payloadOf<T>(data)

  if (status < 200 || status >= 300 || payload?.success === false) {
    throw new CloudflareApiError(status, errorMessage(status, payload?.errors), payload?.errors)
  }
  if (payload?.result === undefined) {
    throw new Error('Cloudflare API returned an empty response')
  }

  return payload
}

export async function cloudflareRequest<T>(
  handle: CloudflareAccountHandle,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const payload = await cloudflareRequestPayload<T>(handle, path, init)

  return payload.result as T
}

/** Raw KV values arrive as strings; JSON endpoints are re-encoded for callers. */
export async function cloudflareRawRequest(
  handle: CloudflareAccountHandle,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { status, data } = await proxyRequest(handle, path, init)
  const payload = payloadOf<unknown>(data)

  if (status < 200 || status >= 300) {
    throw new CloudflareApiError(status, errorMessage(status, payload?.errors), payload?.errors)
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? null)

  return new Response(status === 204 ? null : text, {
    status,
    headers: {
      'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
    },
  })
}

export async function cloudflarePaginatedRequest<T>(
  handle: CloudflareAccountHandle,
  path: string,
  params: URLSearchParams,
): Promise<T[]> {
  const items: T[] = []
  const pageParams = new URLSearchParams(params)

  pageParams.set('per_page', pageParams.get('per_page') ?? '100')

  let page = Number(pageParams.get('page') ?? '1')

  for (let requests = 0; requests < 100; requests += 1) {
    pageParams.set('page', String(page))
    const payload = await cloudflareRequestPayload<T[]>(handle, `${path}?${String(pageParams)}`)

    items.push(...(payload.result ?? []))

    const totalPages = payload.result_info?.total_pages

    if (totalPages && page >= totalPages) break
    if (!totalPages && (payload.result ?? []).length < Number(pageParams.get('per_page'))) break
    if (requests === 99) throw new Error('Cloudflare pagination exceeded 100 pages')
    page += 1
  }

  return items
}
