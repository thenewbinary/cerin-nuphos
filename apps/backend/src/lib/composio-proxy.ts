import { z } from 'zod'

import { composioRequest } from '@/lib/composio'
import { verifyComposioConnection } from '@/lib/composio-connect-core'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec } from '@/lib/composio-connect-core'

export type ComposioProxySpec = ComposioConnectorSpec & {
  /** Pinned provider API origin; the endpoint is always baseUrl + validated path. */
  baseUrl: string
  methods: readonly string[]
  /** Extra provider gate, e.g. Jira's cloudId prefix or Slack's method/path pairs. */
  allowPath?: (path: string, method: string) => boolean
}

export const composioProxyBodySchema = z
  .object({
    method: z.string().max(10),
    path: z.string().min(1).max(2048),
    body: z.unknown().optional(),
    query: z.record(z.string(), z.string().max(8192)).optional(),
  })
  .strict()

export type ComposioProxyBody = z.infer<typeof composioProxyBodySchema>

/**
 * Only a relative path under the pinned base URL: no scheme/host, no query
 * (parameters go through `query`), no traversal — including percent-encoded
 * traversal, which would be decoded again downstream.
 */
export function composioProxyPathAllowed(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  if (/[\\?#]/u.test(path)) return false
  for (const segment of path.split('/')) {
    let decoded: string

    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return false
    }
    if (decoded === '.' || decoded === '..') return false
    if (/[\\/?#]/u.test(decoded)) return false
    for (let i = 0; i < decoded.length; i += 1) {
      const code = decoded.charCodeAt(i)

      if (code <= 0x1f || code === 0x7f) return false
    }
  }

  return true
}

export function assertComposioProxyPath(
  spec: ComposioProxySpec,
  path: string,
  method: string,
): void {
  if (!composioProxyPathAllowed(path) || (spec.allowPath && !spec.allowPath(path, method))) {
    throw new AppError(
      400,
      `${spec.provider}_path_not_allowed`,
      `Unsupported ${spec.displayName} API path`,
    )
  }
}

function composioProxyStatusError(spec: ComposioProxySpec, status: number): AppError | undefined {
  if (status === 401 || status === 403) {
    return new AppError(
      403,
      `${spec.provider}_reconnect_required`,
      `${spec.displayName} needs to be reconnected`,
    )
  }
  if (status === 429) {
    return new AppError(
      429,
      `${spec.provider}_rate_limited`,
      `${spec.displayName} rate limited this request. Do not retry; try again later.`,
    )
  }

  return undefined
}

/**
 * One provider API call through Composio Proxy Execute, on the verified
 * connected account. Never retried here: a write must not be replayed. A
 * refused/inactive account is a single reconnect error; a provider 429 is a
 * terminal rate-limited error, not something to poll through.
 */
export async function composioProxyExecute(
  spec: ComposioProxySpec,
  args: {
    accountId: string
    userId: string
    method: string
    path: string
    body?: unknown
    query?: Record<string, string>
  },
): Promise<{ status: number; data: unknown }> {
  const method = args.method.toUpperCase()

  if (!spec.methods.includes(method))
    throw new AppError(
      400,
      `${spec.provider}_method_not_allowed`,
      `Unsupported ${spec.displayName} API method`,
    )
  assertComposioProxyPath(spec, args.path, method)
  const query = Object.entries(args.query ?? {})

  if (
    query.length > 50 ||
    query.some(([name]) => !name || name.length > 128 || /[&#=]/u.test(name))
  )
    throw new AppError(400, `${spec.provider}_path_not_allowed`, 'Invalid query parameters')

  try {
    await verifyComposioConnection(spec, args.accountId, args.userId)
    const result = await composioRequest<{ data?: unknown; status?: number }>(
      'POST',
      '/tools/execute/proxy',
      {
        connected_account_id: args.accountId,
        user_id: args.userId,
        endpoint: `${spec.baseUrl}${args.path}`,
        method,
        ...(args.body === undefined ? {} : { body: args.body }),
        ...(query.length
          ? { parameters: query.map(([name, value]) => ({ name, value, in: 'query' })) }
          : {}),
      },
    )
    const status = typeof result.status === 'number' ? result.status : 200
    const failure = composioProxyStatusError(spec, status)

    if (failure) throw failure

    return { status, data: result.data }
  } catch (error) {
    if (error instanceof AppError && error.code.startsWith(`${spec.provider}_`)) throw error
    const upstreamStatus =
      error instanceof AppError &&
      typeof error.details === 'object' &&
      error.details !== null &&
      'upstreamStatus' in error.details
        ? error.details.upstreamStatus
        : undefined
    const failure =
      typeof upstreamStatus === 'number'
        ? composioProxyStatusError(spec, upstreamStatus)
        : undefined

    throw failure ?? error
  }
}
