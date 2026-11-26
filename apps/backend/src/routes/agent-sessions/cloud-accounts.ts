import { Hono } from 'hono'

import { agentSubjectId } from '@/lib/agents/identity'
import { canPrincipalsUseAllowList } from '@/lib/byos/access'
import { cloudflareProxy } from '@/lib/byos/cloudflare'
import { decryptLinodeToken, decryptHetznerToken } from '@/lib/byos/secrets'
import { composioProxyBodySchema } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { zv } from '@/lib/validate'
import {
  canRequestUseBinding,
  requireCloudflareAccount,
  requireCloudflareMemberAccess,
  requireHetznerAccount,
  requireLinodeAccount,
} from '@/middleware/auth'
import { agentPrincipals, getAgentCredentialAccess } from '@/routes/agent-sessions/shared'

import type { CloudflareAccountVariables } from '@/middleware/auth'
import type { AgentHetznerVars, AgentLinodeVars, AgentVars } from '@/routes/agent-sessions/shared'
import type { MiddlewareHandler } from 'hono'

export const cloudflareScoped = new Hono<{ Variables: AgentVars & CloudflareAccountVariables }>()

cloudflareScoped.use('*', requireCloudflareAccount())
cloudflareScoped.use('*', requireCloudflareMemberAccess())
cloudflareScoped.use('*', requireSelectedCloudflareAgentCredential())

cloudflareScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await cloudflareProxy(c.get('cloudflareBinding'), c.req.valid('json')))
})

export const linodeScoped = new Hono<{ Variables: AgentLinodeVars }>()

linodeScoped.use('*', requireLinodeAccount())
linodeScoped.use('*', requireSelectedLinodeAgentCredential())

linodeScoped.get('/credentials', (c) => {
  const agent = c.get('agent')

  c.header('X-Atlas-Agent', agentSubjectId(agent))

  return c.json({
    accountId: c.get('linodeAccountId'),
    label: c.get('linodeAccountLabel'),
    token: decryptLinodeToken(c.get('linodeEncryptedToken')),
    authType: 'personal_access_token',
  })
})

export const hetznerScoped = new Hono<{ Variables: AgentHetznerVars }>()

hetznerScoped.use('*', requireHetznerAccount())
hetznerScoped.use('*', requireSelectedHetznerAgentCredential())

hetznerScoped.get('/credentials', (c) => {
  const agent = c.get('agent')

  c.header('X-Atlas-Agent', agentSubjectId(agent))

  return c.json({
    accountId: c.get('hetznerAccountId'),
    label: c.get('hetznerAccountLabel'),
    token: decryptHetznerToken(c.get('hetznerEncryptedToken')),
    authType: 'api_token',
  })
})

function requireSelectedCloudflareAgentCredential(): MiddlewareHandler<{
  Variables: AgentVars & CloudflareAccountVariables
}> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedAccountIds = credentialAccess.cloudflareAccountIds

    if (!selectedAccountIds.includes(c.get('cloudflareAccountId'))) {
      throw new AppError(
        403,
        'cloudflare_account_agent_access_denied',
        'This Cloudflare account is not enabled for this agent session',
      )
    }
    const allowList = c.get('cloudflareBinding').access?.memberAllowList

    if (!canPrincipalsUseAllowList(allowList, agentPrincipals(c))) {
      throw new AppError(
        403,
        'cloudflare_account_agent_access_denied',
        'This Cloudflare account is not enabled for this agent session',
      )
    }
    await next()
  }
}

function requireSelectedLinodeAgentCredential(): MiddlewareHandler<{ Variables: AgentLinodeVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedAccountIds = credentialAccess.linodeAccountIds

    if (selectedAccountIds.length === 0) {
      throw new AppError(
        403,
        'linode_account_agent_access_denied',
        'This agent session has no selected Linode accounts',
      )
    }

    const accountId = c.get('linodeAccountId')

    if (!selectedAccountIds.includes(accountId)) {
      throw new AppError(
        403,
        'linode_account_agent_access_denied',
        'This Linode account is not enabled for this agent session',
      )
    }
    if (!canRequestUseBinding(c, c.get('linodeAccess'))) {
      throw new AppError(
        403,
        'linode_account_agent_access_denied',
        'This Linode account is not enabled for this agent session',
      )
    }
    await next()
  }
}

function requireSelectedHetznerAgentCredential(): MiddlewareHandler<{
  Variables: AgentHetznerVars
}> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedAccountIds = credentialAccess.hetznerAccountIds

    if (selectedAccountIds.length === 0) {
      throw new AppError(
        403,
        'hetzner_account_agent_access_denied',
        'This agent session has no selected Hetzner accounts',
      )
    }

    const accountId = c.get('hetznerAccountId')

    if (!selectedAccountIds.includes(accountId)) {
      throw new AppError(
        403,
        'hetzner_account_agent_access_denied',
        'This Hetzner account is not enabled for this agent session',
      )
    }
    if (!canRequestUseBinding(c, c.get('hetznerAccess'))) {
      throw new AppError(
        403,
        'hetzner_account_agent_access_denied',
        'This Hetzner account is not enabled for this agent session',
      )
    }
    await next()
  }
}
