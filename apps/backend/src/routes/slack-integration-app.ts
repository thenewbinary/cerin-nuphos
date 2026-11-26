import { Hono } from 'hono'

import { SLACK_CONNECTOR, slackIdentity } from '@/lib/byos/slack-connector'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'

import type { BindingAccess, SlackIntegrationBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const slackIntegrationAppRoutes = new Hono()

slackIntegrationAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: SLACK_CONNECTOR,
    deepLink: 'cerin://slack-integration-callback',
    identity: async (pending, composioUserId) => ({
      ...(await slackIdentity({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })),
      composioAccountId: pending.composioAccountId,
      composioUserId,
      authorizedBy: pending.requesterUserId,
    }),
    persist: persistSlackIntegration,
  }),
)

type Draft = Omit<SlackIntegrationBinding, 'id' | 'label' | 'createdAt' | 'access'>

export async function persistSlackIntegration(
  teamId: ObjectId,
  draft: Draft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  return persistComposioConnectorBinding<SlackIntegrationBinding>({
    spec: SLACK_CONNECTOR,
    field: 'slackIntegrations',
    teamId,
    draft,
    access,
    matches: (existing) =>
      existing.slackTeamId === draft.slackTeamId &&
      existing.slackUserId === draft.slackUserId &&
      existing.authorizedBy === draft.authorizedBy,
    label: draft.slackTeamName,
    result: { account_name: draft.slackTeamName },
  })
}
