import { Hono } from 'hono'

import { cancelComposioConnectorOAuth, startComposioConnectorOAuth } from '@/lib/composio-connect'
import { GITLAB_CONNECTOR, listNamespaces } from '@/lib/byos/gitlab'
import { parseObjectId } from '@/lib/objectid'
import {
  canRequestUseBinding,
  requireGitlabMemberAccess,
  requireGitlabBinding,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'
import {
  registerGitlabBindingAdminRoutes,
  registerGitlabBindingScopedRoutes,
} from '@/routes/gitlab-bindings/binding-scoped'
import { publicView } from '@/routes/gitlab-bindings/shared'

import type { TeamAuthVariables, GitlabBindingVariables } from '@/middleware/auth'

export { publicView } from '@/routes/gitlab-bindings/shared'

export const gitlabBindingsRoutes = new Hono<{ Variables: TeamAuthVariables }>()

gitlabBindingsRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { gitlabAccounts: 1 } },
  )

  return c.json({
    bindings: (doc?.gitlabAccounts ?? []).map(publicView),
  })
})

// A Composio Connect Link against Composio's managed gitlab.com app. No
// GITLAB_OAUTH_* app, no per-binding client override and no scope picker:
// Composio owns the app's scopes. Self-managed GitLab is not supported.
gitlabBindingsRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, GITLAB_CONNECTOR, '/gitlab-app/setup'),
)

gitlabBindingsRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, GITLAB_CONNECTOR),
)

const bindingScoped = new Hono<{ Variables: GitlabBindingVariables }>()

bindingScoped.use('*', requireGitlabBinding())
registerGitlabBindingAdminRoutes(bindingScoped)
// Registered after the admin routes, so it guards only the routes below,
// which all act with the binding's connection.
bindingScoped.use('*', requireGitlabMemberAccess())
registerGitlabBindingScopedRoutes(bindingScoped)

// Flat view across every binding — one call for the sidebar to render all
// groups/personal namespaces, mirroring how GitHub installations flatten.
// Registered before the /:bindingId mount so the literal path wins.
gitlabBindingsRoutes.get('/namespaces', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { gitlabAccounts: 1 } },
  )
  // The same rule as each binding's own routes, admin exception included.
  const bindings = (doc?.gitlabAccounts ?? []).filter((b) => canRequestUseBinding(c, b.access))
  const results = await Promise.all(
    bindings.map(async (b) => {
      const base = { bindingId: b.id.toHexString(), hostUrl: b.hostUrl, username: b.username }

      try {
        return { ...base, namespaces: await listNamespaces(teamId, b) }
      } catch {
        // A binding with a revoked/expired grant shouldn't blank the whole
        // sidebar — return it empty and let the binding-scoped routes surface
        // the auth error when the user drills in.
        return { ...base, namespaces: [] }
      }
    }),
  )

  return c.json({ bindings: results })
})

gitlabBindingsRoutes.route('/:bindingId', bindingScoped)
