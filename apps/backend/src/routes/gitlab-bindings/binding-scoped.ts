import { z } from 'zod'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { listMergeRequests, listNamespaces, listPipelines, listProjects } from '@/lib/byos/gitlab'
import { deleteComposioAccountBestEffort } from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import { zv } from '@/lib/validate'
import { disconnectBinding, requireCanDisconnect, requireTeamRole } from '@/middleware/auth'
import { handleGitlabError, publicView } from '@/routes/gitlab-bindings/shared'

import type { GitlabBindingVariables } from '@/middleware/auth'
import type { Hono } from 'hono'

const projectsQuerySchema = z.object({
  // Root namespace full path (first path segment), e.g. "my-group" or the
  // username for personal namespaces. Filters membership projects to that
  // top-level namespace.
  namespace: z.string().min(1).max(255).optional(),
})

const projectIdSchema = z.object({
  projectId: z.coerce.number().int().positive(),
})

const mrQuerySchema = z.object({
  state: z.enum(['opened', 'closed', 'merged', 'all']).default('opened'),
  per_page: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
})

const pipelinesQuerySchema = z.object({
  per_page: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
})

/** Disconnecting and the member list are the admin's, so they skip the member gate. */
export function registerGitlabBindingAdminRoutes(
  bindingScoped: Hono<{ Variables: GitlabBindingVariables }>,
) {
  bindingScoped.delete(
    '/',
    requireTeamRole('ADMINISTRATOR'),
    requireCanDisconnect('gitlabBinding'),
    async (c) => {
      const teamId = parseObjectId(c.get('teamId'), 'teamId')
      const binding = c.get('gitlabBinding')

      await disconnectBinding(c, teamId, 'gitlabAccounts', { id: binding.id })
      // After the guarded pull, best effort: the binding is already gone, and a
      // failure only leaves an unreferenced Composio account.
      await deleteComposioAccountBestEffort('gitlab', binding.composioAccountId)

      return c.body(null, 204)
    },
  )

  registerBindingAccessRoutes(bindingScoped, 'gitlabAccounts', (c) => c.get('gitlabBinding'))
}

export function registerGitlabBindingScopedRoutes(
  bindingScoped: Hono<{ Variables: GitlabBindingVariables }>,
) {
  bindingScoped.get('/', (c) => {
    const binding = c.get('gitlabBinding')

    return c.json(publicView(binding))
  })

  bindingScoped.get('/namespaces', async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('gitlabBinding')

    try {
      const namespaces = await listNamespaces(teamId, binding)

      return c.json({ namespaces })
    } catch (e) {
      handleGitlabError(e, 'Failed to list namespaces')
    }
  })

  bindingScoped.get('/projects', zv('query', projectsQuerySchema), async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('gitlabBinding')
    const { namespace } = c.req.valid('query')

    try {
      const projects = await listProjects(teamId, binding, namespace)

      return c.json({ projects })
    } catch (e) {
      handleGitlabError(e, 'Failed to list projects')
    }
  })

  bindingScoped.get(
    '/projects/:projectId/merge-requests',
    zv('param', projectIdSchema),
    zv('query', mrQuerySchema),
    async (c) => {
      const teamId = parseObjectId(c.get('teamId'), 'teamId')
      const binding = c.get('gitlabBinding')
      const { projectId } = c.req.valid('param')
      const { state, per_page, page } = c.req.valid('query')

      try {
        const mergeRequests = await listMergeRequests(
          teamId,
          binding,
          projectId,
          state,
          per_page,
          page,
        )

        return c.json({ mergeRequests })
      } catch (e) {
        handleGitlabError(e, 'Failed to list merge requests')
      }
    },
  )

  bindingScoped.get(
    '/projects/:projectId/pipelines',
    zv('param', projectIdSchema),
    zv('query', pipelinesQuerySchema),
    async (c) => {
      const teamId = parseObjectId(c.get('teamId'), 'teamId')
      const binding = c.get('gitlabBinding')
      const { projectId } = c.req.valid('param')
      const { per_page, page } = c.req.valid('query')

      try {
        const pipelines = await listPipelines(teamId, binding, projectId, per_page, page)

        return c.json({ pipelines })
      } catch (e) {
        handleGitlabError(e, 'Failed to list pipelines')
      }
    },
  )
}
