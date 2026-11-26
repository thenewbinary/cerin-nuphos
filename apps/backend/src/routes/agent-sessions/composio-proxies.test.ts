import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import { ObjectId } from 'mongodb'

import { config } from '@/config'
import * as composioClient from '@/lib/composio'
import { errorHandler } from '@/lib/errors'
import { useAgentSessionsShared } from '@/lib/test/doubles/agent-sessions-shared'
import { useModels } from '@/lib/test/doubles/models'

import type { TeamAuthVariables } from '@/middleware/auth'
import type { AgentVars } from '@/routes/agent-sessions/shared'

const TEAM = new ObjectId()
const OTHER_TEAM = new ObjectId()
const MEMBER = new ObjectId().toHexString()
const BINDING = new ObjectId()
const ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
const COMPOSIO_USER = `${TEAM.toHexString()}:${MEMBER}`

let selected: string[]
let allowList: string[]
let currentTeam: ObjectId
let remoteStatus: string
let selectionKey: string
let provider: string
let calls: { path: string; body: Record<string, unknown> | null }[]

useModels({
  teamByosBindings: () => ({
    findOne: async (filter: { _id: ObjectId }) => {
      if (!filter._id.equals(TEAM)) return null
      const common = {
        id: BINDING,
        label: 'Cerin fixture',
        composioAccountId: `ca_${provider}`,
        composioUserId: COMPOSIO_USER,
        access: { memberAllowList: allowList, updatedAt: new Date(), updatedBy: MEMBER },
      }

      return {
        linearWorkspaces: [{ ...common, workspaceId: 'workspace-cerin' }],
        jiraSites: [{ ...common, cloudId: 'cloud-cerin' }],
        asanaAccounts: [{ ...common, accountGid: 'asana-user' }],
        sentryAccounts: [{ ...common, organizationSlugs: ['cerin'] }],
        gitlabAccounts: [{ ...common, accountId: 42, hostUrl: 'https://gitlab.com' }],
        cloudflareAccounts: [{ ...common, accountId: ACCOUNT_ID }],
        slackIntegrations: [{ ...common, slackTeamId: 'T-CERIN' }],
      }
    },
  }),
})
useAgentSessionsShared({
  getAgentCredentialAccess: async () => ({ [selectionKey]: selected }) as never,
})

const [
  { linearScoped, jiraScoped, asanaScoped },
  { cloudflareScoped },
  { gitlabScoped },
  { sentryScoped },
  { slackScoped },
] = await Promise.all([
  import('./issue-trackers'),
  import('./cloud-accounts'),
  import('./gitlab'),
  import('./resend-sentry'),
  import('./slack'),
])

const connectors = [
  {
    name: 'linear',
    base: 'linear-workspaces',
    scope: linearScoped,
    selectionKey: 'linearWorkspaceIds',
    method: 'POST',
    path: '/graphql',
    body: { query: 'query Cerin { viewer { id } }' },
    endpoint: 'https://api.linear.app/graphql',
  },
  {
    name: 'jira',
    base: 'jira-sites',
    scope: jiraScoped,
    selectionKey: 'jiraSiteIds',
    method: 'GET',
    path: '/ex/jira/cloud-cerin/rest/api/3/myself',
    endpoint: 'https://api.atlassian.com/ex/jira/cloud-cerin/rest/api/3/myself',
  },
  {
    name: 'asana',
    base: 'asana-accounts',
    scope: asanaScoped,
    selectionKey: 'asanaAccountIds',
    method: 'GET',
    path: '/users/me',
    endpoint: 'https://app.asana.com/api/1.0/users/me',
  },
  {
    name: 'sentry',
    base: 'sentry-accounts',
    scope: sentryScoped,
    selectionKey: 'sentryAccountIds',
    method: 'GET',
    path: '/organizations/',
    endpoint: 'https://sentry.io/api/0/organizations/',
  },
  {
    name: 'gitlab',
    base: 'gitlab-bindings',
    scope: gitlabScoped,
    selectionKey: 'gitlabBindingIds',
    method: 'GET',
    path: '/user',
    endpoint: 'https://gitlab.com/api/v4/user',
  },
  {
    name: 'cloudflare',
    base: 'cloudflare-accounts',
    scope: cloudflareScoped,
    selectionKey: 'cloudflareAccountIds',
    method: 'GET',
    path: `/accounts/${ACCOUNT_ID}`,
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`,
  },
  {
    name: 'slack',
    base: 'slack-integrations',
    scope: slackScoped,
    selectionKey: 'slackIntegrationIds',
    method: 'GET',
    path: '/conversations.list',
    endpoint: 'https://slack.com/api/conversations.list',
  },
] as const

type Connector = (typeof connectors)[number]
type FetchInput = string | URL | Request

const app = new Hono<{ Variables: AgentVars & TeamAuthVariables }>()

app.onError(errorHandler)
app.use('*', async (c, next) => {
  c.set('teamId', currentTeam.toHexString())
  c.set('userId', MEMBER)
  c.set('teamRole', 'EDITOR')
  c.set('agent', { userId: MEMBER, sessionId: 'fixture-session' } as AgentVars['agent'])
  await next()
})
app.route('/linear-workspaces/:bindingId', linearScoped)
app.route('/jira-sites/:bindingId', jiraScoped)
app.route('/asana-accounts/:bindingId', asanaScoped)
app.route('/sentry-accounts/:bindingId', sentryScoped)
app.route('/gitlab-bindings/:bindingId', gitlabScoped)
app.route('/cloudflare-accounts/:accountId', cloudflareScoped)
app.route('/slack-integrations/:integrationId', slackScoped)

const realFetch = globalThis.fetch
const savedKey = config.byos.composio.apiKey
const authConfigSpy = spyOn(composioClient, 'composioAuthConfigId').mockImplementation(
  async (toolkit) => `ac_${toolkit}`,
)

beforeEach(() => {
  selected = [BINDING.toHexString()]
  allowList = [MEMBER]
  currentTeam = TEAM
  remoteStatus = 'ACTIVE'
  selectionKey = 'linearWorkspaceIds'
  calls = []
  config.byos.composio.apiKey = 'fixture-key'
  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const path = new URL(input instanceof Request ? input.url : input.toString()).pathname
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null

    calls.push({ path, body })
    if (path.endsWith('/tools/execute/proxy')) {
      return Response.json({ status: 200, data: { ok: true, endpoint: body?.endpoint } })
    }
    const match = /\/connected_accounts\/ca_([a-z]+)$/u.exec(path)

    if (match) {
      return Response.json({
        status: remoteStatus,
        user_id: COMPOSIO_USER,
        toolkit: { slug: match[1] },
        auth_config: { id: `ac_${match[1]}` },
      })
    }
    throw new Error(`Unexpected Composio request ${path}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})
afterAll(() => {
  authConfigSpy.mockRestore()
  config.byos.composio.apiKey = savedKey
})

function request(connector: Connector, overrides: Record<string, unknown> = {}) {
  const identifier = connector.name === 'cloudflare' ? ACCOUNT_ID : BINDING.toHexString()

  return app.request(`/${connector.base}/${identifier}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: connector.method,
      path: connector.path,
      ...(connector.name === 'linear' ? { body: connector.body } : {}),
      ...overrides,
    }),
  })
}

function select(connector: Connector, ids: string[]) {
  selectionKey = connector.selectionKey
  provider = connector.name
  selected = ids.map((id) =>
    connector.name === 'cloudflare' && id === BINDING.toHexString() ? ACCOUNT_ID : id,
  )
}

for (const connector of connectors) {
  describe(`${connector.name} session proxy`, () => {
    test('uses the selected stored account with no provider token in the response', async () => {
      select(connector, [BINDING.toHexString()])
      const response = await request(connector)

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store, private')
      expect(await response.text()).not.toContain('fixture-key')
      expect(calls[1]?.body).toMatchObject({
        connected_account_id: `ca_${connector.name}`,
        user_id: COMPOSIO_USER,
        endpoint: connector.endpoint,
        method: connector.method,
      })
      expect(JSON.stringify(calls[1]?.body)).not.toMatch(
        /(?:access|refresh|api)[_A-Za-z]*[Tt]oken/u,
      )
    })

    test('denies an empty selection before Composio', async () => {
      select(connector, [])
      expect((await request(connector)).status).toBe(403)
      expect(calls).toHaveLength(0)
    })

    test('denies a different selected binding before Composio', async () => {
      select(connector, [new ObjectId().toHexString()])
      expect((await request(connector)).status).toBe(403)
      expect(calls).toHaveLength(0)
    })

    test('denies member access removed after selection', async () => {
      select(connector, [BINDING.toHexString()])
      allowList = []
      expect((await request(connector)).status).toBe(403)
      expect(calls).toHaveLength(0)
    })

    test('does not look up a binding in another team', async () => {
      select(connector, [BINDING.toHexString()])
      currentTeam = OTHER_TEAM
      expect((await request(connector)).status).toBe(404)
      expect(calls).toHaveLength(0)
    })

    test('refuses caller-chosen connected account or execution identity', async () => {
      select(connector, [BINDING.toHexString()])
      const response = await request(connector, {
        connectedAccountId: 'ca_attacker',
        userId: 'attacker',
      })

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    test('an inactive account ends in one reconnect error without proxy execution', async () => {
      select(connector, [BINDING.toHexString()])
      remoteStatus = 'EXPIRED'
      const response = await request(connector)

      expect(response.status).toBe(403)
      expect(calls).toHaveLength(1)
      expect(await response.text()).toContain('needs to be reconnected')
    })
  })
}
