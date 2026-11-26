import { CLOUDFLARE_CONNECTOR } from '@/lib/byos/cloudflare'
import { cancelComposioConnectorOAuth, startComposioConnectorOAuth } from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import { requireTeamRole } from '@/middleware/auth'
import { teamByosBindings } from '@/models'

import type { TeamAuthVariables } from '@/middleware/auth'
import type { CloudflareAccountBinding } from '@/models'
import type { Hono } from 'hono'

export function publicView(binding: CloudflareAccountBinding) {
  return {
    id: binding.id.toHexString(),
    accountId: binding.accountId,
    accountName: binding.accountName,
    createdAt: binding.createdAt,
  }
}

export function registerCloudflareBindRoutes(routes: Hono<{ Variables: TeamAuthVariables }>): void {
  routes.get('/', async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const doc = await teamByosBindings().findOne(
      { _id: teamId },
      { projection: { cloudflareAccounts: 1 } },
    )

    return c.json({ accounts: (doc?.cloudflareAccounts ?? []).map(publicView) })
  })

  // Cloudflare has no Composio-managed OAuth app. The hosted Connect Link page
  // collects the user's account-scoped API token against our custom API_KEY
  // auth config; Cerin never receives or stores that token.
  routes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
    startComposioConnectorOAuth(c, CLOUDFLARE_CONNECTOR, '/cloudflare-app/setup'),
  )

  routes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
    cancelComposioConnectorOAuth(c, CLOUDFLARE_CONNECTOR),
  )
}
