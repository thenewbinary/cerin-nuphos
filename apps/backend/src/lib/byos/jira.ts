// Jira through Composio: the managed Atlassian OAuth app holds the grant and
// Cerin calls api.atlassian.com through Composio Proxy Execute. Every binding
// call stays under that binding's cloudId; no Atlassian token is stored.
import { composioProxyExecute, ComposioConnectorCallbackError } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { JiraSiteBinding } from '@/models'

export const JIRA_CONNECTOR: ComposioConnectorSpec = {
  provider: 'jira',
  displayName: 'Jira',
  toolkitSlug: 'jira',
}

export type JiraConnection = Pick<JiraSiteBinding, 'composioAccountId' | 'composioUserId'>

export const JIRA_API_BASE = 'https://api.atlassian.com'

function proxySpec(allowPath: (path: string) => boolean): ComposioProxySpec {
  return {
    ...JIRA_CONNECTOR,
    baseUrl: JIRA_API_BASE,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowPath,
  }
}

/** Every request a binding makes is scoped to its own Atlassian site. */
export function jiraProxySpec(cloudId: string): ComposioProxySpec {
  if (!/^[A-Za-z0-9-]{1,128}$/u.test(cloudId))
    throw new AppError(500, 'jira_invalid_binding', 'Jira binding has an invalid cloudId')

  return proxySpec((path) => path.startsWith(`/ex/jira/${cloudId}/`))
}

export function jiraProxy(
  binding: Pick<JiraSiteBinding, 'cloudId' | 'composioAccountId' | 'composioUserId'>,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(jiraProxySpec(binding.cloudId), {
    accountId: binding.composioAccountId,
    userId: binding.composioUserId,
    ...args,
  })
}

export type AtlassianSite = { id: string; name: string; url: string }

/**
 * The site and account a fresh grant can reach. The grant must span exactly
 * one Jira site — picking arbitrarily among several could bind the wrong
 * tenant, so the member narrows the grant on Atlassian's consent screen.
 */
export async function jiraIdentity(connection: JiraConnection): Promise<{
  site: AtlassianSite
  accountId: string
  accountName: string | null
}> {
  const call = (path: string, allowPath: (p: string) => boolean) =>
    composioProxyExecute(proxySpec(allowPath), {
      accountId: connection.composioAccountId,
      userId: connection.composioUserId,
      method: 'GET',
      path,
    })
  const resources = await call(
    '/oauth/token/accessible-resources',
    (p) => p === '/oauth/token/accessible-resources',
  )
  const sites = (Array.isArray(resources.data) ? resources.data : []) as AtlassianSite[]
  const site = sites[0]

  if (!site || typeof site.id !== 'string' || !site.id) {
    throw new ComposioConnectorCallbackError(
      'no_jira_site',
      'The Atlassian grant has no accessible Jira sites',
    )
  }
  if (sites.length > 1) {
    throw new ComposioConnectorCallbackError(
      'multiple_jira_sites',
      `This Atlassian grant spans ${String(sites.length)} Jira sites. Re-authorize and grant access to a single site.`,
    )
  }
  if (typeof site.name !== 'string' || !site.name || typeof site.url !== 'string' || !site.url) {
    throw new AppError(502, 'jira_invalid_profile', 'Jira site details are unavailable')
  }
  const myself = await composioProxyExecute(jiraProxySpec(site.id), {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    method: 'GET',
    path: `/ex/jira/${site.id}/rest/api/3/myself`,
  })
  const account = myself.data as { accountId?: unknown; displayName?: unknown } | null

  if (typeof account?.accountId !== 'string' || !account.accountId) {
    throw new AppError(502, 'jira_invalid_profile', 'Jira profile is unavailable')
  }

  return {
    site: { id: site.id, name: site.name, url: site.url },
    accountId: account.accountId,
    accountName: typeof account.displayName === 'string' ? account.displayName : null,
  }
}
