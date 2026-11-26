import { Hono } from 'hono'

import { ASANA_CONNECTOR, asanaIdentity } from '@/lib/byos/asana'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'

import type { AsanaAccountBinding, BindingAccess } from '@/models'
import type { ObjectId } from 'mongodb'

export const asanaAppRoutes = new Hono()

// The Electron deep-link target: same cerin:// scheme as the other connectors,
// a distinct hostname so the desktop can route by it.
asanaAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: ASANA_CONNECTOR,
    deepLink: 'cerin://asana-callback',
    identity: async (pending, composioUserId) => ({
      ...(await asanaIdentity({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })),
      composioAccountId: pending.composioAccountId,
      composioUserId,
    }),
    persist: persistAsanaBinding,
  }),
)

type AsanaBindingDraft = Omit<AsanaAccountBinding, 'id' | 'label' | 'createdAt' | 'access'>

// Re-binding the same Asana account replaces the existing binding's connection
// instead of accumulating duplicates. The original binding id is preserved.
export async function persistAsanaBinding(
  teamId: ObjectId,
  draft: AsanaBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  const accountLabel = draft.accountName ?? draft.accountEmail ?? `Asana user ${draft.accountGid}`

  return persistComposioConnectorBinding<AsanaAccountBinding>({
    spec: ASANA_CONNECTOR,
    field: 'asanaAccounts',
    teamId,
    draft,
    access,
    matches: (existing) => existing.accountGid === draft.accountGid,
    label: accountLabel,
    result: { account_name: accountLabel },
  })
}
