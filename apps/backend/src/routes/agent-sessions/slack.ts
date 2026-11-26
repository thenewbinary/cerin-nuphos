import { Hono } from 'hono'

import { canPrincipalsUseAllowList } from '@/lib/byos/access'
import { slackProxy } from '@/lib/byos/slack-connector'
import { composioProxyBodySchema } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { zv } from '@/lib/validate'
import { requireSlackIntegration, requireSlackMemberAccess } from '@/middleware/auth'
import { agentPrincipals, getAgentCredentialAccess } from '@/routes/agent-sessions/shared'

import type { AgentSlackVars } from '@/routes/agent-sessions/shared'

export const slackScoped = new Hono<{ Variables: AgentSlackVars }>()

slackScoped.use('*', requireSlackIntegration())
slackScoped.use('*', requireSlackMemberAccess())
slackScoped.use('*', async (c, next) => {
  const access = await getAgentCredentialAccess(c.get('agent'), c.get('teamId'))

  if (
    !access.slackIntegrationIds.includes(c.get('slackIntegrationId')) ||
    !canPrincipalsUseAllowList(c.get('slackBinding').access?.memberAllowList, agentPrincipals(c))
  ) {
    throw new AppError(
      403,
      'slack_agent_access_denied',
      'This Slack workspace is not selected for this session',
    )
  }
  await next()
})
slackScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await slackProxy(c.get('slackBinding'), c.req.valid('json')))
})
