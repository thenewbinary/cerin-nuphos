import { Hono } from 'hono'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { LINEAR_CONNECTOR } from '@/lib/byos/linear'
import {
  cancelComposioConnectorOAuth,
  deleteComposioAccountBestEffort,
  startComposioConnectorOAuth,
} from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import {
  disconnectBinding,
  requireCanDisconnect,
  requireLinearWorkspace,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'
import { registerLinearBrowseRoutes } from '@/routes/linear-workspaces/browse'
import { registerLinearIssueDetailRoute } from '@/routes/linear-workspaces/issue-detail'

import type { TeamAuthVariables, LinearWorkspaceVariables } from '@/middleware/auth'
import type { LinearWorkspaceBinding } from '@/models'

export const linearWorkspacesRoutes = new Hono<{ Variables: TeamAuthVariables }>()

export function publicView(b: LinearWorkspaceBinding) {
  return {
    id: b.id.toHexString(),
    label: b.label,
    workspaceId: b.workspaceId,
    workspaceName: b.workspaceName,
    organizationUrlKey: b.organizationUrlKey,
    accountName: b.accountName,
    createdAt: b.createdAt,
  }
}

linearWorkspacesRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { linearWorkspaces: 1 } },
  )

  return c.json({
    workspaces: (doc?.linearWorkspaces ?? []).map(publicView),
  })
})

// A Composio Connect Link: the member approves Composio's managed Linear app
// on the hosted page; no LINEAR_OAUTH_* app is needed on this server.
linearWorkspacesRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, LINEAR_CONNECTOR, '/linear-app/setup'),
)

linearWorkspacesRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, LINEAR_CONNECTOR),
)

const bindingScoped = new Hono<{ Variables: LinearWorkspaceVariables }>()

bindingScoped.use('*', requireLinearWorkspace())
registerBindingAccessRoutes(bindingScoped, 'linearWorkspaces', (c) => c.get('linearBinding'))

bindingScoped.get('/', (c) => {
  return c.json(publicView(c.get('linearBinding')))
})

bindingScoped.delete(
  '/',
  requireTeamRole('ADMINISTRATOR'),
  requireCanDisconnect('linearAccess'),
  async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('linearBinding')

    await disconnectBinding(c, teamId, 'linearWorkspaces', { id: binding.id })
    // After the guarded pull, best effort: the binding is already gone, and a
    // failure only leaves an unreferenced Composio account.
    await deleteComposioAccountBestEffort('linear', binding.composioAccountId)

    return c.body(null, 204)
  },
)

registerLinearIssueDetailRoute(bindingScoped)
registerLinearBrowseRoutes(bindingScoped)

linearWorkspacesRoutes.route('/:bindingId', bindingScoped)
