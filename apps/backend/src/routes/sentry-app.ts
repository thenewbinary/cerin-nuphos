import { Hono } from 'hono'

import { SENTRY_CONNECTOR, sentryIdentity } from '@/lib/byos/sentry'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'

import type { BindingAccess, SentryAccountBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const sentryAppRoutes = new Hono()

// The Electron deep-link target: same cerin:// scheme as the other connectors,
// a distinct hostname so the desktop can route by it.
sentryAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: SENTRY_CONNECTOR,
    deepLink: 'cerin://sentry-callback',
    identity: async (pending, composioUserId) => ({
      ...(await sentryIdentity({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })),
      composioAccountId: pending.composioAccountId,
      composioUserId,
    }),
    persist: persistSentryBinding,
  }),
)

type SentryBindingDraft = Omit<SentryAccountBinding, 'id' | 'label' | 'createdAt' | 'access'>

// Re-binding the same set of Sentry organizations replaces the existing
// binding's connection instead of accumulating duplicates. The original
// binding id is preserved.
export async function persistSentryBinding(
  teamId: ObjectId,
  draft: SentryBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  const key = draft.organizationSlugs.join(',')
  const accountLabel = draft.organizationName ?? `Sentry (${key})`

  return persistComposioConnectorBinding<SentryAccountBinding>({
    spec: SENTRY_CONNECTOR,
    field: 'sentryAccounts',
    teamId,
    draft,
    access,
    matches: (existing) => existing.organizationSlugs.join(',') === key,
    label: accountLabel,
    result: { account_name: accountLabel },
  })
}
