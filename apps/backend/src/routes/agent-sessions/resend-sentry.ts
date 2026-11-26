import { Hono } from 'hono'

import { agentSubjectId } from '@/lib/agents/identity'
import { apiKeyFromBinding, RESEND_API_BASE_URL } from '@/lib/byos/resend'
import { sentryProxy } from '@/lib/byos/sentry'
import { composioProxyBodySchema } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { zv } from '@/lib/validate'
import {
  requireResendIntegration,
  requireResendMemberAccess,
  requireSentryAccount,
  requireSentryMemberAccess,
} from '@/middleware/auth'
import { getAgentCredentialAccess } from '@/routes/agent-sessions/shared'

import type { AgentResendVars, AgentSentryVars } from '@/routes/agent-sessions/shared'
import type { MiddlewareHandler } from 'hono'

// Resend is the only provider whose raw credential is handed out ONLY here and
// never from the team-scoped route. Sending mail is irreversible, so a binding
// being bound to the team is not enough — it must also be enabled for this
// specific conversation. See requireSelectedResendAgentCredential below and the
// resendIntegrationIds: [] default in agent.ts.
export const resendScoped = new Hono<{ Variables: AgentResendVars }>()

resendScoped.use('*', requireResendIntegration())
resendScoped.use('*', requireResendMemberAccess())
resendScoped.use('*', requireSelectedResendAgentCredential())

resendScoped.get('/credentials', (c) => {
  const agent = c.get('agent')
  const binding = c.get('resendBinding')
  const apiKey = apiKeyFromBinding(binding)

  c.header('X-Atlas-Agent', agentSubjectId(agent))
  // A reusable bearer token over GET must never be cached by intermediaries.
  c.header('Cache-Control', 'no-store, private')
  c.header('Pragma', 'no-cache')

  return c.json({
    bindingId: c.get('resendIntegrationId'),
    label: binding.label,
    permission: binding.permission,
    apiKey,
    apiBaseUrl: RESEND_API_BASE_URL,
    authType: 'resend_bearer',
  })
})

export const sentryScoped = new Hono<{ Variables: AgentSentryVars }>()

sentryScoped.use('*', requireSentryAccount())
sentryScoped.use('*', requireSentryMemberAccess())
sentryScoped.use('*', requireSelectedSentryAgentCredential())

// The sandbox investigates Sentry through this session-scoped proxy, never a
// handed-out token: only read methods on sentry.io/api/0 paths are allowed.
sentryScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await sentryProxy(c.get('sentryBinding'), c.req.valid('json')))
})

function requireSelectedSentryAgentCredential(): MiddlewareHandler<{ Variables: AgentSentryVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedAccountIds = credentialAccess.sentryAccountIds ?? []

    if (selectedAccountIds.length === 0) {
      throw new AppError(
        403,
        'sentry_account_agent_access_denied',
        'This agent session has no selected Sentry accounts',
      )
    }

    const bindingId = c.get('sentryAccountId')

    if (!selectedAccountIds.includes(bindingId)) {
      throw new AppError(
        403,
        'sentry_account_agent_access_denied',
        'This Sentry account is not enabled for this agent session',
      )
    }
    await next()
  }
}

function requireSelectedResendAgentCredential(): MiddlewareHandler<{ Variables: AgentResendVars }> {
  return async (c, next) => {
    const agent = c.get('agent')
    const teamId = c.get('teamId')
    const credentialAccess = await getAgentCredentialAccess(agent, teamId)
    const selectedIntegrationIds = credentialAccess.resendIntegrationIds

    if (selectedIntegrationIds.length === 0) {
      throw new AppError(
        403,
        'resend_integration_agent_access_denied',
        'This agent session has no selected Resend integrations',
      )
    }

    const bindingId = c.get('resendIntegrationId')

    if (!selectedIntegrationIds.includes(bindingId)) {
      throw new AppError(
        403,
        'resend_integration_agent_access_denied',
        'This Resend integration is not enabled for this agent session',
      )
    }
    await next()
  }
}
