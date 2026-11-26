// Asana through Composio: the managed Asana OAuth app holds the grant and
// Cerin calls app.asana.com/api/1.0 through Composio Proxy Execute. No Asana
// token is stored or handed out.
import { composioProxyExecute } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { AsanaAccountBinding } from '@/models'

export const ASANA_CONNECTOR: ComposioConnectorSpec = {
  provider: 'asana',
  displayName: 'Asana',
  toolkitSlug: 'asana',
}

export const ASANA_PROXY: ComposioProxySpec = {
  ...ASANA_CONNECTOR,
  baseUrl: 'https://app.asana.com/api/1.0',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}

export type AsanaConnection = Pick<AsanaAccountBinding, 'composioAccountId' | 'composioUserId'>

export function asanaProxy(
  connection: AsanaConnection,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(ASANA_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
}

/** The authorising Asana account, from GET /users/me at setup. */
export async function asanaIdentity(connection: AsanaConnection): Promise<{
  accountGid: string
  accountName: string | null
  accountEmail: string | null
}> {
  const { data } = await asanaProxy(connection, { method: 'GET', path: '/users/me' })
  const me = (data as { data?: { gid?: unknown; name?: unknown; email?: unknown } } | null)?.data

  if (typeof me?.gid !== 'string' || !me.gid) {
    throw new AppError(502, 'asana_invalid_profile', 'Asana profile is unavailable')
  }

  return {
    accountGid: me.gid,
    accountName: typeof me.name === 'string' ? me.name : null,
    accountEmail: typeof me.email === 'string' ? me.email : null,
  }
}
