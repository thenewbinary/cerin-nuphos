import { Hono } from 'hono'

import { canPrincipalsUseAllowList } from '@/lib/byos/access'
import { gitlabProxy } from '@/lib/byos/gitlab'
import { composioProxyBodySchema } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { zv } from '@/lib/validate'
import { requireGitlabBinding, requireGitlabMemberAccess } from '@/middleware/auth'
import { agentPrincipals, getAgentCredentialAccess } from '@/routes/agent-sessions/shared'

import type { AgentVars } from '@/routes/agent-sessions/shared'
import type { GitlabBindingVariables } from '@/middleware/auth'
import type { MiddlewareHandler } from 'hono'

type AgentGitlabVars = AgentVars & GitlabBindingVariables

export const gitlabScoped = new Hono<{ Variables: AgentGitlabVars }>()

gitlabScoped.use('*', requireGitlabBinding())
gitlabScoped.use('*', requireGitlabMemberAccess())
gitlabScoped.use('*', requireSelectedGitlabAgentCredential())

gitlabScoped.post('/proxy', zv('json', composioProxyBodySchema), async (c) => {
  c.header('Cache-Control', 'no-store, private')

  return c.json(await gitlabProxy(c.get('gitlabBinding'), c.req.valid('json')))
})

function requireSelectedGitlabAgentCredential(): MiddlewareHandler<{
  Variables: AgentGitlabVars
}> {
  return async (c, next) => {
    const credentialAccess = await getAgentCredentialAccess(c.get('agent'), c.get('teamId'))
    const selectedBindingIds = credentialAccess.gitlabBindingIds

    if (!selectedBindingIds.includes(c.get('gitlabBindingId'))) {
      throw denied()
    }
    if (
      !canPrincipalsUseAllowList(c.get('gitlabBinding').access?.memberAllowList, agentPrincipals(c))
    ) {
      throw denied()
    }
    await next()
  }
}

function denied() {
  return new AppError(
    403,
    'gitlab_binding_agent_access_denied',
    'This GitLab binding is not enabled for this agent session',
  )
}
