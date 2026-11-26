import { Hono } from 'hono'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { ASANA_CONNECTOR } from '@/lib/byos/asana'
import {
  cancelComposioConnectorOAuth,
  deleteComposioAccountBestEffort,
  startComposioConnectorOAuth,
} from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import {
  disconnectBinding,
  requireAsanaAccount,
  requireCanDisconnect,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'

import type { TeamAuthVariables, AsanaAccountVariables } from '@/middleware/auth'
import type { AsanaAccountBinding } from '@/models'

export const asanaAccountsRoutes = new Hono<{ Variables: TeamAuthVariables }>()

export function publicView(b: AsanaAccountBinding) {
  return {
    id: b.id.toHexString(),
    label: b.label,
    accountGid: b.accountGid,
    accountName: b.accountName,
    accountEmail: b.accountEmail,
    createdAt: b.createdAt,
  }
}

asanaAccountsRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { asanaAccounts: 1 } },
  )

  return c.json({
    accounts: (doc?.asanaAccounts ?? []).map(publicView),
  })
})

// A Composio Connect Link: the member approves Composio's managed Asana app
// on the hosted page; no ASANA_OAUTH_* app is needed on this server.
asanaAccountsRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, ASANA_CONNECTOR, '/asana-app/setup'),
)

asanaAccountsRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, ASANA_CONNECTOR),
)

const bindingScoped = new Hono<{ Variables: AsanaAccountVariables }>()

bindingScoped.use('*', requireAsanaAccount())
registerBindingAccessRoutes(bindingScoped, 'asanaAccounts', (c) => c.get('asanaBinding'))

bindingScoped.get('/', (c) => {
  return c.json(publicView(c.get('asanaBinding')))
})

bindingScoped.delete(
  '/',
  requireTeamRole('ADMINISTRATOR'),
  requireCanDisconnect('asanaAccess'),
  async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('asanaBinding')

    await disconnectBinding(c, teamId, 'asanaAccounts', { id: binding.id })
    // After the guarded pull, best effort: the binding is already gone, and a
    // failure only leaves an unreferenced Composio account.
    await deleteComposioAccountBestEffort('asana', binding.composioAccountId)

    return c.body(null, 204)
  },
)

asanaAccountsRoutes.route('/:bindingId', bindingScoped)
