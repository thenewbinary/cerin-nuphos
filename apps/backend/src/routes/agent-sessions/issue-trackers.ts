import { Hono } from 'hono'

import { asanaProxy } from '@/lib/byos/asana'
import { jiraProxy } from '@/lib/byos/jira'
import { linearProxy } from '@/lib/byos/linear'
import { composioProxyBodySchema } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { zv } from '@/lib/validate'
import {
  requireLinearWorkspace,
  requireLinearMemberAccess,
  requireJiraSite,
  requireJiraMemberAccess,
  requireAsanaAccount,
  requireAsanaMemberAccess,
} from '@/middleware/auth'
import { getAgentCredentialAccess } from '@/routes/agent-sessions/shared'

import type { AgentAsanaVars, AgentJiraVars, AgentLinearVars } from '@/routes/agent-sessions/shared'
import type { MiddlewareHandler } from 'hono'

// Each connector exposes one session-scoped proxy instead of a token handout:
// the sandbox names an allow-listed method + relative path, and the backend
// executes it through Composio with the binding's connected account. The
// provider token never leaves Composio.
export const linearScoped = new Hono<{ Variables: AgentLinearVars }>()

linearScoped.use('*', requireLinearWorkspace())
linearScoped.use('*', requireLinearMemberAccess())
linearScoped.use('*', requireSelectedLinearAgentCredential())

linearScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await linearProxy(c.get('linearBinding'), c.req.valid('json')))
})

export const jiraScoped = new Hono<{ Variables: AgentJiraVars }>()

jiraScoped.use('*', requireJiraSite())
jiraScoped.use('*', requireJiraMemberAccess())
jiraScoped.use('*', requireSelectedJiraAgentCredential())

jiraScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await jiraProxy(c.get('jiraBinding'), c.req.valid('json')))
})

export const asanaScoped = new Hono<{ Variables: AgentAsanaVars }>()

asanaScoped.use('*', requireAsanaAccount())
asanaScoped.use('*', requireAsanaMemberAccess())
asanaScoped.use('*', requireSelectedAsanaAgentCredential())

asanaScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await asanaProxy(c.get('asanaBinding'), c.req.valid('json')))
})

function requireSelectedLinearAgentCredential(): MiddlewareHandler<{ Variables: AgentLinearVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedWorkspaceIds = credentialAccess.linearWorkspaceIds

    if (selectedWorkspaceIds.length === 0) {
      throw new AppError(
        403,
        'linear_workspace_agent_access_denied',
        'This agent session has no selected Linear workspaces',
      )
    }

    const bindingId = c.get('linearWorkspaceId')

    if (!selectedWorkspaceIds.includes(bindingId)) {
      throw new AppError(
        403,
        'linear_workspace_agent_access_denied',
        'This Linear workspace is not enabled for this agent session',
      )
    }
    await next()
  }
}

function requireSelectedJiraAgentCredential(): MiddlewareHandler<{ Variables: AgentJiraVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedSiteIds = credentialAccess.jiraSiteIds

    if (selectedSiteIds.length === 0) {
      throw new AppError(
        403,
        'jira_site_agent_access_denied',
        'This agent session has no selected Jira sites',
      )
    }

    const bindingId = c.get('jiraSiteId')

    if (!selectedSiteIds.includes(bindingId)) {
      throw new AppError(
        403,
        'jira_site_agent_access_denied',
        'This Jira site is not enabled for this agent session',
      )
    }
    await next()
  }
}

function requireSelectedAsanaAgentCredential(): MiddlewareHandler<{ Variables: AgentAsanaVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedAccountIds = credentialAccess.asanaAccountIds

    if (selectedAccountIds.length === 0) {
      throw new AppError(
        403,
        'asana_account_agent_access_denied',
        'This agent session has no selected Asana accounts',
      )
    }

    const bindingId = c.get('asanaAccountId')

    if (!selectedAccountIds.includes(bindingId)) {
      throw new AppError(
        403,
        'asana_account_agent_access_denied',
        'This Asana account is not enabled for this agent session',
      )
    }
    await next()
  }
}
