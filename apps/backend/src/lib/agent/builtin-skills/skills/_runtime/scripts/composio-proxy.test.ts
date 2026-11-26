import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

const teamId = '0123456789abcdef01234567'
const bindingId = '76543210fedcba9876543210'
const requests: Array<{ url: string; authorization: string | null; body: unknown }> = []
let providerStatus = 200
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    requests.push({
      url: request.url,
      authorization: request.headers.get('authorization'),
      body: await request.json(),
    })

    return Response.json({ status: providerStatus, data: { ok: true, marker: 'provider-data' } })
  },
})

afterAll(() => server.stop(true))
beforeEach(() => {
  requests.length = 0
  providerStatus = 200
})

function tokenFor(origin: string): string {
  const payload = Buffer.from(JSON.stringify({ ori: origin })).toString('base64url')

  return `header.${payload}.signature`
}

async function run(
  args: string[],
  env: Record<string, string> = {},
  options: { prefix?: string[]; script?: string } = {},
) {
  const child = Bun.spawn(
    [
      'bash',
      options.script ?? `${import.meta.dir}/composio-proxy.sh`,
      ...(options.prefix ?? ['jira-sites', teamId, bindingId]),
      ...args,
    ],
    {
      env: {
        ...Bun.env,
        CERIN_TOKEN: tokenFor(server.url.origin),
        CERIN_SESSION_ID: 'session-fixture',
        CERIN_BACKEND_URL: 'https://attacker.invalid',
        ...env,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  return {
    exitCode: await child.exited,
    stdout: await new Response(child.stdout).text(),
    stderr: await new Response(child.stderr).text(),
  }
}

describe('Composio proxy skill helper', () => {
  test('uses the selected agent-session route, signed origin, and structured body and query', async () => {
    const result = await run([
      'post',
      '/ex/jira/cloud-fixture/rest/api/3/issue',
      '{"fields":{"summary":"fixture"}}',
      '{"notifyUsers":"false"}',
    ])

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, marker: 'provider-data' })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      url: `${server.url.origin}/agent-sessions/session-fixture/teams/${teamId}/jira-sites/${bindingId}/proxy`,
      body: {
        method: 'POST',
        path: '/ex/jira/cloud-fixture/rest/api/3/issue',
        body: { fields: { summary: 'fixture' } },
        query: { notifyUsers: 'false' },
      },
    })
    expect(requests[0]?.authorization).toBe(`Bearer ${tokenFor(server.url.origin)}`)
  })

  test('accepts a Cloudflare account id through the provider wrapper', async () => {
    const cloudflareAccountId = '0123456789abcdef0123456789abcdef'
    const script = new URL('../../cloudflare/scripts/proxy.sh', import.meta.url).pathname
    const result = await run(['GET', `/accounts/${cloudflareAccountId}`], {}, {
      prefix: [teamId, cloudflareAccountId],
      script,
    })

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(
      `${server.url.origin}/agent-sessions/session-fixture/teams/${teamId}/cloudflare-accounts/${cloudflareAccountId}/proxy`,
    )
  })

  test('rejects absolute provider URLs before making a request', async () => {
    const result = await run(['GET', 'https://attacker.invalid/token'])

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('Provider path must be relative')
    expect(requests).toHaveLength(0)
  })

  test('surfaces a provider error once without retrying', async () => {
    providerStatus = 400
    const result = await run(['POST', '/ex/jira/cloud-fixture/rest/api/3/issue', '{}'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ status: 400 })
    expect(requests).toHaveLength(1)
  })

  test.each(['linear', 'jira', 'asana', 'sentry', 'gitlab', 'cloudflare', 'slack'])(
    '%s has a proxy skill and no native-token setup script',
    async (provider) => {
      const root = new URL(`../../${provider}/`, import.meta.url)

      expect(await Bun.file(new URL('scripts/proxy.sh', root)).exists()).toBe(true)
      expect(await Bun.file(new URL('scripts/setup-credentials.sh', root)).exists()).toBe(false)
      const skill = await Bun.file(new URL('SKILL.md', root)).text()

      expect(skill).toContain(`skills/${provider}/scripts/`)
      expect(skill).not.toContain('setup-credentials.sh')
    },
  )
})
