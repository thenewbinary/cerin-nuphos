import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import { ObjectId } from 'mongodb'

import { config } from '@/config'
import * as composioClient from '@/lib/composio'
import { errorHandler } from '@/lib/errors'
import { useIdentity } from '@/lib/test/doubles/identity'
import { useModels } from '@/lib/test/doubles/models'

import type { TeamAuthVariables } from '@/middleware/auth'
import type { ComposioConnectorPendingOAuth, ConnectorOAuthReady } from '@/models'

const TEAM = new ObjectId()
const MEMBER = new ObjectId().toHexString()
const COMPOSIO_USER = `${TEAM.toHexString()}:${MEMBER}`
const ACCOUNT_ID = '0123456789abcdef0123456789abcdef'

useIdentity({ getTeamMembership: async () => null })

let pending: ComposioConnectorPendingOAuth[]
let ready: ConnectorOAuthReady[]
let stored: Record<string, Record<string, unknown>[]>
let deleted: string[]
let linkCounts: Record<string, number>
let linkCallbacks: string[]
let disconnectRace: boolean
let cleanupFails: boolean

useModels({
  composioConnectorPendingOAuth: () => ({
    insertOne: async (doc: ComposioConnectorPendingOAuth) => {
      pending.push(doc)

      return { acknowledged: true }
    },
    findOneAndDelete: async (filter: { _id: string; provider?: string }) => {
      const index = pending.findIndex(
        (row) => row._id === filter._id && (!filter.provider || row.provider === filter.provider),
      )

      return index < 0 ? null : pending.splice(index, 1)[0]
    },
  }),
  connectorOAuthReady: () => ({
    insertOne: async (doc: ConnectorOAuthReady) => {
      ready.push(doc)

      return { acknowledged: true }
    },
    findOneAndDelete: async (filter: { _id: string; codeHash: string }) => {
      const index = ready.findIndex(
        (row) => row._id === filter._id && row.codeHash === filter.codeHash,
      )

      return index < 0 ? null : ready.splice(index, 1)[0]
    },
  }),
  teamByosBindings: () => ({
    findOne: async () => stored,
    updateOne: async (_filter: unknown, update: Record<string, unknown>) => {
      const push = update.$push as Record<string, Record<string, unknown>> | undefined
      const pull = update.$pull as Record<string, { id?: ObjectId; accountId?: string }> | undefined
      const set = update.$set as Record<string, unknown> | undefined

      if (push) {
        for (const [field, binding] of Object.entries(push)) {
          stored[field] = [...(stored[field] ?? []), binding]
        }

        return { matchedCount: 1, modifiedCount: 1 }
      }
      if (pull) {
        if (disconnectRace) return { matchedCount: 0, modifiedCount: 0 }
        for (const field of Object.keys(pull)) stored[field] = []

        return { matchedCount: 1, modifiedCount: 1 }
      }
      const replacement = Object.entries(set ?? {}).find(([key]) => key.includes('.$'))

      if (replacement) {
        const [key, binding] = replacement
        const field = key.split('.$')[0]!

        stored[field] = [binding as Record<string, unknown>]
      }

      return { matchedCount: 1, modifiedCount: set ? 1 : 0 }
    },
    countDocuments: async () => (Object.values(stored).some((rows) => rows.length > 0) ? 1 : 0),
  }),
})

const [
  { linearWorkspacesRoutes },
  { linearAppRoutes },
  { jiraSitesRoutes },
  { jiraAppRoutes },
  { asanaAccountsRoutes },
  { asanaAppRoutes },
  { sentryAccountsRoutes },
  { sentryAppRoutes },
  { gitlabBindingsRoutes },
  { gitlabAppRoutes },
  { cloudflareAccountsRoutes },
  { cloudflareAppRoutes },
  { slackIntegrationsRoutes },
  { slackIntegrationAppRoutes },
  { connectorOAuthRoutes },
] = await Promise.all([
  import('./linear-workspaces'),
  import('./linear-app'),
  import('./jira-sites'),
  import('./jira-app'),
  import('./asana-accounts'),
  import('./asana-app'),
  import('./sentry-accounts'),
  import('./sentry-app'),
  import('./gitlab-bindings'),
  import('./gitlab-app'),
  import('./cloudflare-accounts'),
  import('./cloudflare-app'),
  import('./slack-integrations'),
  import('./slack-integration-app'),
  import('./connector-oauth'),
])

const connectors = [
  {
    name: 'linear',
    base: 'linear-workspaces',
    accounts: linearWorkspacesRoutes,
    callbackApp: linearAppRoutes,
    field: 'linearWorkspaces',
    deepLink: 'linear-callback',
    expected: {
      workspaceId: 'workspace-linear',
      workspaceName: 'Cerin Linear',
      organizationUrlKey: 'cerin',
      accountId: 'user-linear',
      accountName: 'Linear User',
    },
  },
  {
    name: 'jira',
    base: 'jira-sites',
    accounts: jiraSitesRoutes,
    callbackApp: jiraAppRoutes,
    field: 'jiraSites',
    deepLink: 'jira-callback',
    expected: {
      cloudId: 'cloud-cerin',
      siteName: 'Cerin Jira',
      siteUrl: 'https://cerin.atlassian.net',
      accountId: 'jira-user',
      accountName: 'Jira User',
    },
  },
  {
    name: 'asana',
    base: 'asana-accounts',
    accounts: asanaAccountsRoutes,
    callbackApp: asanaAppRoutes,
    field: 'asanaAccounts',
    deepLink: 'asana-callback',
    expected: {
      accountGid: 'gid-asana',
      accountName: 'Asana User',
      accountEmail: 'asana@example.test',
    },
  },
  {
    name: 'sentry',
    base: 'sentry-accounts',
    accounts: sentryAccountsRoutes,
    callbackApp: sentryAppRoutes,
    field: 'sentryAccounts',
    deepLink: 'sentry-callback',
    expected: { organizationSlugs: ['cerin'], organizationName: 'Cerin Sentry' },
  },
  {
    name: 'gitlab',
    base: 'gitlab-bindings',
    accounts: gitlabBindingsRoutes,
    callbackApp: gitlabAppRoutes,
    field: 'gitlabAccounts',
    deepLink: 'gitlab-callback',
    expected: {
      hostUrl: 'https://gitlab.com',
      accountId: 42,
      username: 'cerin-gitlab',
      displayName: 'GitLab User',
      avatarUrl: null,
    },
  },
  {
    name: 'cloudflare',
    base: 'cloudflare-accounts',
    accounts: cloudflareAccountsRoutes,
    callbackApp: cloudflareAppRoutes,
    field: 'cloudflareAccounts',
    deepLink: 'cloudflare-callback',
    expected: { accountId: ACCOUNT_ID, accountName: 'Cerin Cloudflare' },
  },
  {
    name: 'slack',
    base: 'slack-integrations',
    accounts: slackIntegrationsRoutes,
    callbackApp: slackIntegrationAppRoutes,
    field: 'slackIntegrations',
    deepLink: 'slack-integration-callback',
    expected: {
      slackTeamId: 'T-CERIN',
      slackTeamName: 'Cerin Slack',
      slackUserId: 'U-CERIN',
      slackUserName: 'cerin-user',
      authorizedBy: MEMBER,
    },
  },
] as const

type Connector = (typeof connectors)[number]
type FetchInput = string | URL | Request

const app = new Hono<{ Variables: TeamAuthVariables }>()

app.onError(errorHandler)
app.use('*', async (c, next) => {
  c.set('teamId', TEAM.toHexString())
  c.set('userId', MEMBER)
  c.set('teamRole', 'ADMINISTRATOR')
  await next()
})
function callbackBase(connector: Connector): string {
  return connector.name === 'slack' ? 'slack-integration-app' : `${connector.name}-app`
}
for (const connector of connectors) {
  app.route(`/${connector.base}`, connector.accounts)
  app.route(`/${callbackBase(connector)}`, connector.callbackApp)
}
app.route('/connector-oauth', connectorOAuthRoutes)

const realFetch = globalThis.fetch
const saved = {
  apiKey: config.byos.composio.apiKey,
  publicBackendUrl: config.agent.publicBackendUrl,
  backendUrl: config.agent.backendUrl,
  podNamespace: config.otel.podNamespace,
}
const authConfigSpy = spyOn(composioClient, 'composioAuthConfigId').mockImplementation(
  async (toolkit) => `ac_${toolkit}`,
)

function identityPayload(connector: Connector, endpoint: string): unknown {
  switch (connector.name) {
    case 'linear':
      return {
        data: {
          viewer: { id: 'user-linear', name: 'Linear User' },
          organization: { id: 'workspace-linear', name: 'Cerin Linear', urlKey: 'cerin' },
        },
      }
    case 'jira':
      return endpoint.endsWith('/accessible-resources')
        ? [{ id: 'cloud-cerin', name: 'Cerin Jira', url: 'https://cerin.atlassian.net' }]
        : { accountId: 'jira-user', displayName: 'Jira User' }
    case 'asana':
      return { data: { gid: 'gid-asana', name: 'Asana User', email: 'asana@example.test' } }
    case 'sentry':
      return [{ slug: 'cerin', name: 'Cerin Sentry' }]
    case 'gitlab':
      return { id: 42, username: 'cerin-gitlab', name: 'GitLab User', avatar_url: null }
    case 'cloudflare':
      return { success: true, result: [{ id: ACCOUNT_ID, name: 'Cerin Cloudflare' }] }
    case 'slack':
      return {
        ok: true,
        team_id: 'T-CERIN',
        team: 'Cerin Slack',
        user_id: 'U-CERIN',
        user: 'cerin-user',
      }
  }
}

beforeEach(() => {
  pending = []
  ready = []
  stored = {}
  deleted = []
  linkCounts = {}
  linkCallbacks = []
  disconnectRace = false
  cleanupFails = false
  config.byos.composio.apiKey = 'fixture-key'
  config.agent.publicBackendUrl = 'https://api.cerin.test'
  config.agent.backendUrl = undefined
  config.otel = { ...config.otel, podNamespace: undefined }
  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null

    if (url.pathname.endsWith('/connected_accounts/link')) {
      const callback = String(body?.callback_url)

      linkCallbacks.push(callback)
      const connector =
        connectors.find((item) => callback.includes(`/${item.name}-app/setup`)) ??
        (callback.includes('/slack-integration-app/setup') ? connectors[6] : undefined)

      if (!connector) throw new Error(`Unexpected callback ${callback}`)
      const count = (linkCounts[connector.name] ?? 0) + 1

      linkCounts[connector.name] = count

      return Response.json({
        connected_account_id: `ca_${connector.name}_${String(count)}`,
        redirect_url: 'https://connect.composio.dev/link/fixture',
      })
    }
    if (init?.method === 'DELETE') {
      deleted.push(url.pathname)

      return Response.json({}, { status: cleanupFails ? 503 : 200 })
    }
    const accountMatch = /\/connected_accounts\/(ca_([a-z]+)_\d+)$/u.exec(url.pathname)

    if (accountMatch) {
      return Response.json({
        status: 'ACTIVE',
        user_id: COMPOSIO_USER,
        toolkit: { slug: accountMatch[2] },
        auth_config: { id: `ac_${accountMatch[2]}` },
      })
    }
    if (url.pathname.endsWith('/tools/execute/proxy')) {
      const endpoint = String(body?.endpoint)
      const connector =
        connectors.find((item) => endpoint.includes(item.name)) ??
        (endpoint.includes('slack.com') ? connectors[6] : undefined)
      const jira = endpoint.includes('api.atlassian.com') ? connectors[1] : undefined
      const linear = endpoint.includes('api.linear.app') ? connectors[0] : undefined
      const cloudflare = endpoint.includes('api.cloudflare.com') ? connectors[5] : undefined
      const gitlab = endpoint.includes('gitlab.com') ? connectors[4] : undefined
      const selected = jira ?? linear ?? cloudflare ?? gitlab ?? connector

      if (!selected) throw new Error(`Unexpected proxy endpoint ${endpoint}`)

      return Response.json({ status: 200, data: identityPayload(selected, endpoint) })
    }
    throw new Error(`Unexpected Composio request ${init?.method ?? 'GET'} ${url.pathname}`)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})
afterAll(() => {
  authConfigSpy.mockRestore()
  config.byos.composio.apiKey = saved.apiKey
  config.agent.publicBackendUrl = saved.publicBackendUrl
  config.agent.backendUrl = saved.backendUrl
  config.otel = { ...config.otel, podNamespace: saved.podNamespace }
})

async function start(connector: Connector): Promise<string> {
  const response = await app.request(`/${connector.base}/start-oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })

  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    state: string
    authorizeUrl: string
    expiresAt: string
  }

  expect(body.authorizeUrl).toBe('https://connect.composio.dev/link/fixture')
  expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now())

  return body.state
}

async function callback(connector: Connector, state: string, status = 'success') {
  const response = await app.request(
    `/${callbackBase(connector)}/setup?state=${state}&status=${status}&connected_account_id=ca_attacker`,
  )
  const html = await response.text()
  const serialized = /location\.href = ("(?:\\.|[^"\\])*")/u.exec(html)?.[1]

  expect(response.status).toBe(200)
  expect(serialized).toBeDefined()

  return new URL(JSON.parse(serialized!) as string)
}

async function connect(connector: Connector) {
  const previousCount = stored[connector.field]?.length ?? 0
  const state = await start(connector)
  const deepLink = await callback(connector, state)

  expect(deepLink.protocol).toBe('cerin:')
  expect(deepLink.host).toBe(connector.deepLink)
  expect(deepLink.searchParams.get('deferred')).toBe('1')
  expect(stored[connector.field] ?? []).toHaveLength(previousCount)
  const staged = ready.find((row) => row._id === state)

  expect(staged).toMatchObject({
    provider: connector.name === 'slack' ? 'slackIntegration' : connector.name,
    binding: {
      ...connector.expected,
      composioAccountId: `ca_${connector.name}_${String(linkCounts[connector.name])}`,
      composioUserId: COMPOSIO_USER,
    },
  })
  expect(JSON.stringify(staged?.binding)).not.toContain('ca_attacker')
  expect(JSON.stringify(staged?.binding)).not.toMatch(/(?:access|refresh|api)[_A-Za-z]*[Tt]oken/u)
  const response = await app.request(`/connector-oauth/${state}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: deepLink.searchParams.get('code') }),
  })

  expect(response.status).toBe(200)
  expect(stored[connector.field]).toHaveLength(1)
  expect(stored[connector.field]?.[0]).toMatchObject(connector.expected)

  return deepLink
}

for (const connector of connectors) {
  describe(`${connector.name} Composio lifecycle`, () => {
    test.each(['http://127.0.0.1:3718', 'http://localhost:3718'])(
      'uses the off-cluster loopback backend %s for its callback',
      async (base) => {
        config.agent.publicBackendUrl = undefined
        config.agent.backendUrl = base
        const state = await start(connector)

        expect(linkCallbacks).toEqual([`${base}/${callbackBase(connector)}/setup?state=${state}`])
      },
    )

    test.each([
      ['plaintext remote backend', undefined, 'http://api.cerin.test', undefined],
      ['plaintext public override', 'http://api.cerin.test', undefined, undefined],
      ['loopback in a pod', 'http://127.0.0.1:3718', undefined, 'cerin'],
      ['cluster service', 'https://cerin-backend.cerin.svc', undefined, 'cerin'],
      ['missing backend', undefined, undefined, undefined],
    ])('rejects a %s before requesting a Connect Link', async (_name, publicUrl, backend, pod) => {
      config.agent.publicBackendUrl = publicUrl
      config.agent.backendUrl = backend
      config.otel = { ...config.otel, podNamespace: pod }
      const response = await app.request(`/${connector.base}/start-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })

      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({
        error: { code: `${connector.name}_not_configured` },
      })
      expect(linkCallbacks).toHaveLength(0)
      expect(pending).toHaveLength(0)
    })

    test('connects with verified identity and reconnects without changing binding id or ACL', async () => {
      await connect(connector)
      const original = stored[connector.field]![0]!
      const originalId = original.id
      const access = { memberAllowList: ['*'], updatedAt: new Date(), updatedBy: MEMBER }

      original.access = access
      deleted = []
      await connect(connector)

      expect(stored[connector.field]).toHaveLength(1)
      expect(stored[connector.field]?.[0]?.id).toBe(originalId)
      expect(stored[connector.field]?.[0]?.access).toBe(access)
      expect(deleted).toEqual([`/api/v3.1/connected_accounts/ca_${connector.name}_1`])
    })

    test('declined, expired, invalid and replayed callbacks terminate without staging', async () => {
      const declined = await start(connector)

      expect((await callback(connector, declined, 'failed')).searchParams.get('error')).toBe(
        'access_denied',
      )
      const expired = await start(connector)

      pending.find((row) => row._id === expired)!.expiresAt = new Date(0)
      expect((await callback(connector, expired)).searchParams.get('error')).toBe('expired_state')
      expect((await callback(connector, expired)).searchParams.get('error')).toBe('expired_state')
      expect((await callback(connector, 'a'.repeat(48))).searchParams.get('error')).toBe(
        'expired_state',
      )
      expect((await callback(connector, 'bad')).searchParams.get('error')).toBe('invalid_state')
      expect(deleted).toHaveLength(2)
      expect(ready).toHaveLength(0)
      expect(stored[connector.field] ?? []).toHaveLength(0)
    })

    test('cancel deletes the pending account once and blocks a late callback', async () => {
      const state = await start(connector)
      const response = await app.request(`/${connector.base}/start-oauth/${state}`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(204)
      await callback(connector, state)
      expect(deleted).toEqual([`/api/v3.1/connected_accounts/ca_${connector.name}_1`])
      expect(ready).toHaveLength(0)
    })

    test('disconnect deletes the account only after the guarded binding removal', async () => {
      await connect(connector)
      const identifier =
        connector.name === 'cloudflare' ? ACCOUNT_ID : String(stored[connector.field]?.[0]?.id)
      const response = await app.request(`/${connector.base}/${identifier}`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      expect(stored[connector.field]).toHaveLength(0)
      expect(deleted).toEqual([`/api/v3.1/connected_accounts/ca_${connector.name}_1`])
    })

    test('a lost disconnect race does not delete the still-referenced account', async () => {
      await connect(connector)
      const identifier =
        connector.name === 'cloudflare' ? ACCOUNT_ID : String(stored[connector.field]?.[0]?.id)

      disconnectRace = true
      deleted = []
      const response = await app.request(`/${connector.base}/${identifier}`, { method: 'DELETE' })

      expect(response.status).toBe(409)
      expect(stored[connector.field]).toHaveLength(1)
      expect(deleted).toHaveLength(0)
    })

    test('disconnect still succeeds when best-effort Composio cleanup fails', async () => {
      await connect(connector)
      const identifier =
        connector.name === 'cloudflare' ? ACCOUNT_ID : String(stored[connector.field]?.[0]?.id)

      cleanupFails = true
      const response = await app.request(`/${connector.base}/${identifier}`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      expect(stored[connector.field]).toHaveLength(0)
      expect(deleted).toHaveLength(1)
    })
  })
}
