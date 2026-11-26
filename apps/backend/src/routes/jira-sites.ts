import { Hono } from 'hono'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { JIRA_CONNECTOR } from '@/lib/byos/jira'
import {
  cancelComposioConnectorOAuth,
  deleteComposioAccountBestEffort,
  startComposioConnectorOAuth,
} from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import {
  disconnectBinding,
  requireCanDisconnect,
  requireJiraSite,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'

import type { TeamAuthVariables, JiraSiteVariables } from '@/middleware/auth'
import type { JiraSiteBinding } from '@/models'

export const jiraSitesRoutes = new Hono<{ Variables: TeamAuthVariables }>()

export function publicView(b: JiraSiteBinding) {
  return {
    id: b.id.toHexString(),
    label: b.label,
    cloudId: b.cloudId,
    siteName: b.siteName,
    siteUrl: b.siteUrl,
    accountName: b.accountName,
    createdAt: b.createdAt,
  }
}

jiraSitesRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne({ _id: teamId }, { projection: { jiraSites: 1 } })

  return c.json({
    sites: (doc?.jiraSites ?? []).map(publicView),
  })
})

// A Composio Connect Link: the member approves Composio's managed Atlassian
// app on the hosted page; no JIRA_OAUTH_* app is needed on this server.
jiraSitesRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, JIRA_CONNECTOR, '/jira-app/setup'),
)

jiraSitesRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, JIRA_CONNECTOR),
)

const bindingScoped = new Hono<{ Variables: JiraSiteVariables }>()

bindingScoped.use('*', requireJiraSite())
registerBindingAccessRoutes(bindingScoped, 'jiraSites', (c) => c.get('jiraBinding'))

bindingScoped.get('/', (c) => {
  return c.json(publicView(c.get('jiraBinding')))
})

bindingScoped.delete(
  '/',
  requireTeamRole('ADMINISTRATOR'),
  requireCanDisconnect('jiraAccess'),
  async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('jiraBinding')

    await disconnectBinding(c, teamId, 'jiraSites', { id: binding.id })
    // After the guarded pull, best effort: the binding is already gone, and a
    // failure only leaves an unreferenced Composio account.
    await deleteComposioAccountBestEffort('jira', binding.composioAccountId)

    return c.body(null, 204)
  },
)

jiraSitesRoutes.route('/:bindingId', bindingScoped)
