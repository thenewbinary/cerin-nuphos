// GitLab through Composio: the managed gitlab.com OAuth app holds the grant
// and Cerin calls gitlab.com/api/v4 through Composio Proxy Execute. Composio's
// managed app covers gitlab.com only — self-managed instances are not
// supported — and no GitLab token is stored or handed out, so git clone/push
// over HTTPS is not available through this connector.
import { composioProxyExecute } from '@/lib/composio-connect'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { GitlabBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const GITLAB_CONNECTOR: ComposioConnectorSpec = {
  provider: 'gitlab',
  displayName: 'GitLab',
  toolkitSlug: 'gitlab',
}

export const GITLAB_HOST_URL = 'https://gitlab.com'

export const GITLAB_PROXY: ComposioProxySpec = {
  ...GITLAB_CONNECTOR,
  baseUrl: `${GITLAB_HOST_URL}/api/v4`,
  // Reads, plus the writes the skill documents (open/update merge requests,
  // comment). Nothing here retries a write.
  methods: ['GET', 'POST', 'PUT'],
}

export class GitlabApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export type GitlabConnection = Pick<GitlabBinding, 'composioAccountId' | 'composioUserId'>

export function gitlabProxy(
  connection: GitlabConnection,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(GITLAB_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
}

type GitlabRequestInit = {
  method?: string
  body?: string
}

/**
 * The single choke point every server-side GitLab call goes through, now on
 * the proxy. `path` is relative to /api/v4 and may carry a query string, as
 * before. Non-2xx answers raise GitlabApiError, like the native client.
 */
export async function apiRequest<T>(
  _teamId: ObjectId,
  binding: GitlabBinding,
  path: string,
  init?: GitlabRequestInit,
): Promise<T> {
  const question = path.indexOf('?')
  const pathname = question === -1 ? path : path.slice(0, question)
  const query = Object.fromEntries(
    new URLSearchParams(question === -1 ? '' : path.slice(question + 1)),
  )
  const { status, data } = await gitlabProxy(binding, {
    method: init?.method ?? 'GET',
    path: pathname,
    ...(init?.body === undefined ? {} : { body: JSON.parse(init.body) as unknown }),
    ...(Object.keys(query).length ? { query } : {}),
  })

  if (status < 200 || status >= 300) {
    throw new GitlabApiError(status, `GitLab API ${pathname} failed: ${String(status)}`)
  }
  if (status === 204) return undefined as T

  return data as T
}
