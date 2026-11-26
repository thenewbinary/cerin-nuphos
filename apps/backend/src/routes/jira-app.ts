import { Hono } from 'hono'

import { JIRA_CONNECTOR, jiraIdentity } from '@/lib/byos/jira'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'

import type { BindingAccess, JiraSiteBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const jiraAppRoutes = new Hono()

// The Electron deep-link target: same cerin:// scheme as the other connectors,
// a distinct hostname so the desktop can route by it.
jiraAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: JIRA_CONNECTOR,
    deepLink: 'cerin://jira-callback',
    identity: async (pending, composioUserId) => {
      const identity = await jiraIdentity({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })

      return {
        cloudId: identity.site.id,
        siteName: identity.site.name,
        siteUrl: identity.site.url,
        accountId: identity.accountId,
        accountName: identity.accountName,
        composioAccountId: pending.composioAccountId,
        composioUserId,
      }
    },
    persist: persistJiraBinding,
  }),
)

type JiraBindingDraft = Omit<JiraSiteBinding, 'id' | 'label' | 'createdAt' | 'access'>

// Re-binding the same site replaces the existing binding's connection instead
// of accumulating duplicates. The original binding id is preserved.
export async function persistJiraBinding(
  teamId: ObjectId,
  draft: JiraBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  return persistComposioConnectorBinding<JiraSiteBinding>({
    spec: JIRA_CONNECTOR,
    field: 'jiraSites',
    teamId,
    draft,
    access,
    matches: (existing) => existing.cloudId === draft.cloudId,
    label: draft.siteName,
    result: { site_name: draft.siteName },
  })
}
