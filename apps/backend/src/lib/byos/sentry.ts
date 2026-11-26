// Sentry through Composio: the managed Sentry OAuth app holds the grant and
// Cerin calls sentry.io/api/0 through Composio Proxy Execute. Read-only, like
// the native connector's scope set — the agent investigates errors, it does
// not mutate them. No Sentry token is stored or handed out.
import { composioProxyExecute, ComposioConnectorCallbackError } from '@/lib/composio-connect'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { SentryAccountBinding } from '@/models'

export const SENTRY_CONNECTOR: ComposioConnectorSpec = {
  provider: 'sentry',
  displayName: 'Sentry',
  toolkitSlug: 'sentry',
}

export const SENTRY_PROXY: ComposioProxySpec = {
  ...SENTRY_CONNECTOR,
  baseUrl: 'https://sentry.io/api/0',
  methods: ['GET'],
}

export type SentryConnection = Pick<SentryAccountBinding, 'composioAccountId' | 'composioUserId'>

export function sentryProxy(
  connection: SentryConnection,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(SENTRY_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
}

/** The organizations a fresh grant can see; the grant must cover at least one. */
export async function sentryIdentity(connection: SentryConnection): Promise<{
  organizationSlugs: string[]
  organizationName: string | null
}> {
  const { data } = await sentryProxy(connection, { method: 'GET', path: '/organizations/' })
  const organizations = (Array.isArray(data) ? data : []) as {
    slug?: unknown
    name?: unknown
  }[]
  const slugs = organizations
    .map((org) => org.slug)
    .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)

  if (slugs.length === 0) {
    throw new ComposioConnectorCallbackError(
      'no_sentry_organization',
      'The Sentry grant has no accessible organizations',
    )
  }

  return {
    organizationSlugs: [...slugs].sort((a, b) => a.localeCompare(b)),
    organizationName:
      organizations.find(
        (org): org is { name: string } => typeof org.name === 'string' && org.name.length > 0,
      )?.name ?? null,
  }
}
