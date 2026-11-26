import { Hono } from 'hono'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { SLACK_CONNECTOR } from '@/lib/byos/slack-connector'
import {
  cancelComposioConnectorOAuth,
  deleteComposioAccountBestEffort,
  startComposioConnectorOAuth,
} from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import {
  disconnectBinding,
  requireCanDisconnect,
  requireSlackIntegration,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'

import type { SlackIntegrationVariables, TeamAuthVariables } from '@/middleware/auth'
import type { SlackIntegrationBinding } from '@/models'

export const slackIntegrationsRoutes = new Hono<{ Variables: TeamAuthVariables }>()

export function publicView(binding: SlackIntegrationBinding) {
  return {
    id: binding.id.toHexString(),
    label: binding.label,
    slackTeamId: binding.slackTeamId,
    slackTeamName: binding.slackTeamName,
    slackUserId: binding.slackUserId,
    slackUserName: binding.slackUserName,
    authorizedBy: binding.authorizedBy,
    createdAt: binding.createdAt,
  }
}

slackIntegrationsRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { slackIntegrations: 1 } },
  )

  return c.json({ integrations: (doc?.slackIntegrations ?? []).map(publicView) })
})

slackIntegrationsRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, SLACK_CONNECTOR, '/slack-integration-app/setup'),
)

slackIntegrationsRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, SLACK_CONNECTOR),
)

const integrationScoped = new Hono<{ Variables: SlackIntegrationVariables }>()

integrationScoped.use('*', requireSlackIntegration())
registerBindingAccessRoutes(integrationScoped, 'slackIntegrations', (c) => c.get('slackBinding'))
integrationScoped.get('/', (c) => c.json(publicView(c.get('slackBinding'))))
integrationScoped.delete(
  '/',
  requireTeamRole('ADMINISTRATOR'),
  requireCanDisconnect('slackAccess'),
  async (c) => {
    const binding = c.get('slackBinding')

    await disconnectBinding(c, parseObjectId(c.get('teamId'), 'teamId'), 'slackIntegrations', {
      id: binding.id,
    })
    await deleteComposioAccountBestEffort('slack', binding.composioAccountId)

    return c.body(null, 204)
  },
)
slackIntegrationsRoutes.route('/:integrationId', integrationScoped)
