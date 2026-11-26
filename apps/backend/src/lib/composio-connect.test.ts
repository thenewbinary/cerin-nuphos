import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { config } from '@/config'
import * as composioClient from '@/lib/composio'
import {
  composioConnectLink,
  composioProxyPathAllowed,
  verifyComposioConnection,
} from '@/lib/composio-connect'
import { asanaProxy } from '@/lib/byos/asana'
import { cloudflareIdentity } from '@/lib/byos/cloudflare-client'
import { gitlabProxy } from '@/lib/byos/gitlab/http'
import { jiraProxy } from '@/lib/byos/jira'
import { linearProxy } from '@/lib/byos/linear'
import { sentryProxy } from '@/lib/byos/sentry'
import { slackProxy } from '@/lib/byos/slack-connector'

import type { ComposioConnectorSpec } from '@/lib/composio-connect'
import type { AppError } from '@/lib/errors'

const spec: ComposioConnectorSpec = {
  provider: 'asana',
  displayName: 'Asana',
  toolkitSlug: 'asana',
}
const connection = { composioAccountId: 'ca_fixture', composioUserId: 'team:member' }

type FetchInput = string | URL | Request

const requestPath = (input: FetchInput) =>
  new URL(input instanceof Request ? input.url : input.toString()).pathname
const realFetch = globalThis.fetch
const originalKey = config.byos.composio.apiKey
const authConfigSpy = spyOn(composioClient, 'composioAuthConfigId').mockImplementation(
  async (toolkit) => `ac_${toolkit}`,
)
let account: Record<string, unknown>
let calls: { method: string; path: string; body: Record<string, unknown> | null }[]

afterAll(() => {
  authConfigSpy.mockRestore()
  config.byos.composio.apiKey = originalKey
})
beforeEach(() => {
  config.byos.composio.apiKey = 'fixture-key'
  account = {
    status: 'ACTIVE',
    user_id: connection.composioUserId,
    toolkit: { slug: 'asana' },
    auth_config: { id: 'ac_asana' },
  }
  calls = []
  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null

    calls.push({ method: init?.method ?? 'GET', path: url.pathname, body })
    if (url.pathname.endsWith('/link')) {
      return Response.json({
        connected_account_id: 'ca_fixture',
        redirect_url: 'https://connect.composio.dev/link/fixture',
      })
    }
    if (url.pathname.includes('/connected_accounts/')) return Response.json(account)
    if (url.pathname.endsWith('/tools/execute/proxy')) {
      return Response.json({ status: 200, data: { data: { gid: 'user-1' } } })
    }
    throw new Error(`Unexpected fixture request ${url.href}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('Composio Connect Link and account verification', () => {
  test('accepts only a normal HTTPS link on connect.composio.dev', async () => {
    const link = await composioConnectLink(spec, 'team:member', 'https://api.cerin.test/setup')

    expect(link).toEqual({
      accountId: 'ca_fixture',
      authorizeUrl: 'https://connect.composio.dev/link/fixture',
    })
    expect(calls[0]?.body).toEqual({
      auth_config_id: 'ac_asana',
      user_id: 'team:member',
      callback_url: 'https://api.cerin.test/setup',
    })
  })

  test.each([
    'http://connect.composio.dev/link/fixture',
    'https://connect.composio.dev.attacker.invalid/link',
    'https://attacker.invalid/link',
    'https://user:password@connect.composio.dev/link',
    'not a URL',
  ])('rejects %s', async (redirect) => {
    globalThis.fetch = (async () =>
      Response.json({
        connected_account_id: 'ca_fixture',
        redirect_url: redirect,
      })) as unknown as typeof fetch

    const error = await composioConnectLink(spec, 'team:member', 'https://api.cerin.test').catch(
      (cause: unknown) => cause as AppError,
    )

    expect(error).toMatchObject({ status: 502, code: 'asana_invalid_link' })
  })

  test.each([
    ['user', { user_id: 'another:member' }],
    ['toolkit', { toolkit: { slug: 'slack' } }],
    ['auth config', { auth_config: { id: 'ac_other' } }],
    ['inactive', { status: 'INITIATED' }],
  ])('rejects a mismatched %s', async (_field, override) => {
    Object.assign(account, override)
    const error = await verifyComposioConnection(spec, 'ca_fixture', 'team:member').catch(
      (cause: unknown) => cause as AppError,
    )

    expect(error).toMatchObject({ status: 403, code: 'asana_reconnect_required' })
  })
})

describe('Composio provider proxy allow-lists', () => {
  test.each([
    '//attacker.invalid/path',
    'https://attacker.invalid/path',
    '/safe/../secret',
    '/safe/%2e%2e/secret',
    '/safe%2fsecret',
    '/safe?query=secret',
    '/safe#fragment',
    '/safe\\secret',
  ])('rejects unsafe relative path %s before Composio is called', async (path) => {
    expect(composioProxyPathAllowed(path)).toBe(false)
    const error = await linearProxy(connection, { method: 'POST', path }).catch(
      (cause: unknown) => cause as AppError,
    )

    expect(error).toMatchObject({ status: 400, code: 'linear_path_not_allowed' })
    expect(calls).toHaveLength(0)
  })

  test('Linear exposes only POST /graphql', async () => {
    const error = await linearProxy(connection, { method: 'POST', path: '/rest' }).catch(
      (cause: unknown) => cause as AppError,
    )

    expect(error).toMatchObject({ code: 'linear_path_not_allowed' })
    expect(calls).toHaveLength(0)
  })

  test('Jira cannot cross the binding cloudId', async () => {
    const binding = { ...connection, cloudId: 'cloud-one' }
    const error = await jiraProxy(binding, {
      method: 'GET',
      path: '/ex/jira/cloud-two/rest/api/3/myself',
    }).catch((cause: unknown) => cause as AppError)

    expect(error).toMatchObject({ code: 'jira_path_not_allowed' })
    expect(calls).toHaveLength(0)
  })

  test.each([
    ['Asana', 'asana', asanaProxy, 'GET', '/users/me', 'https://app.asana.com/api/1.0/users/me'],
    [
      'Sentry',
      'sentry',
      sentryProxy,
      'GET',
      '/organizations/',
      'https://sentry.io/api/0/organizations/',
    ],
    ['GitLab', 'gitlab', gitlabProxy, 'GET', '/user', 'https://gitlab.com/api/v4/user'],
    [
      'Slack',
      'slack',
      slackProxy,
      'GET',
      '/conversations.list',
      'https://slack.com/api/conversations.list',
    ],
  ])(
    '%s pins the provider origin and forwards structured query parameters',
    async (_name, toolkit, proxy, method, path, endpoint) => {
      account.toolkit = { slug: toolkit }
      account.auth_config = { id: `ac_${toolkit}` }
      const result = await proxy(connection, { method, path, query: { limit: '20' } })

      expect(result.status).toBe(200)
      expect(calls.at(-1)?.body).toMatchObject({
        connected_account_id: 'ca_fixture',
        user_id: 'team:member',
        endpoint,
        method,
        parameters: [{ name: 'limit', value: '20', in: 'query' }],
      })
    },
  )

  test('Slack cannot write an arbitrary Slack endpoint', async () => {
    const error = await slackProxy(connection, {
      method: 'POST',
      path: '/admin.users.assign',
      body: {},
    }).catch((cause: unknown) => cause as AppError)

    expect(error).toMatchObject({ code: 'slack_path_not_allowed' })
    expect(calls).toHaveLength(0)
  })

  test('a provider 429 is terminal and never retries the write', async () => {
    let executes = 0

    globalThis.fetch = (async (input: FetchInput) => {
      const path = requestPath(input)

      if (path.endsWith('/tools/execute/proxy')) {
        executes += 1

        return Response.json({ status: 429, data: {} })
      }

      return Response.json(account)
    }) as typeof fetch
    const error = await asanaProxy(connection, { method: 'POST', path: '/tasks', body: {} }).catch(
      (cause: unknown) => cause as AppError,
    )

    expect(error).toMatchObject({ status: 429, code: 'asana_rate_limited' })
    expect(executes).toBe(1)
  })

  test.each([
    ['account_inactive', 403, 'slack_reconnect_required'],
    ['invalid_auth', 403, 'slack_reconnect_required'],
    ['not_authed', 403, 'slack_reconnect_required'],
    ['token_revoked', 403, 'slack_reconnect_required'],
    ['ratelimited', 429, 'slack_rate_limited'],
    ['channel_not_found', 400, 'slack_api_error'],
  ])('Slack HTTP-200 error %s is terminal with no retry', async (slackError, status, code) => {
    account.toolkit = { slug: 'slack' }
    account.auth_config = { id: 'ac_slack' }
    let executes = 0

    globalThis.fetch = (async (input: FetchInput) => {
      if (requestPath(input).endsWith('/tools/execute/proxy')) {
        executes += 1

        return Response.json({ status: 200, data: { ok: false, error: slackError } })
      }

      return Response.json(account)
    }) as typeof fetch
    const error = await slackProxy(connection, {
      method: 'POST',
      path: '/chat.postMessage',
      body: { channel: 'C_FIXTURE', text: 'fixture' },
    }).catch((cause: unknown) => cause as AppError)

    expect(error).toMatchObject({ status, code })
    expect(executes).toBe(1)
  })

  test('Cloudflare resolves a custom API_KEY config and requires exactly one account', async () => {
    globalThis.fetch = (async (input: FetchInput) => {
      const path = requestPath(input)

      if (path.endsWith('/connected_accounts/ca_fixture')) {
        return Response.json({
          ...account,
          toolkit: { slug: 'cloudflare' },
          auth_config: { id: 'ac_cloudflare' },
        })
      }

      return Response.json({
        status: 200,
        data: {
          success: true,
          result: [{ id: '0123456789abcdef0123456789abcdef', name: 'Cerin' }],
        },
      })
    }) as typeof fetch
    const identity = await cloudflareIdentity(connection)

    expect(identity).toEqual({
      accountId: '0123456789abcdef0123456789abcdef',
      accountName: 'Cerin',
    })
    expect(authConfigSpy).toHaveBeenLastCalledWith('cloudflare', 'apiKey')
  })
})
