import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import path from 'node:path'

import { getBuiltinSkillsDirectory } from '@/lib/agent/skill-store/inject'

const linearDir = path.join(getBuiltinSkillsDirectory(), 'linear')
const scriptsDir = path.join(linearDir, 'scripts')
const cerinTeamId = '0123456789abcdef01234567'
const bindingId = '76543210fedcba9876543210'

type GraphqlBody = {
  query?: string
  variables?: {
    input?: Record<string, unknown>
    after?: string
    id?: string
    filter?: { or?: Array<Record<string, { containsIgnoreCase: string }>> }
  }
}
type ProxyBody = { method: string; path: string; body: GraphqlBody }

let largeDirectory = false
let failAttachments = false
let requests: Array<{
  url: string
  authorization: string | null
  body: ProxyBody
}> = []

function providerResponse(data: unknown, status = 200) {
  return Response.json({ status, data })
}

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const envelope = (await request.json()) as ProxyBody
    const body = envelope.body

    requests.push({
      url: request.url,
      authorization: request.headers.get('authorization'),
      body: envelope,
    })
    if (body.query?.includes('query IssueContext')) {
      const teams = [
        { id: 'team-pla', key: 'PLA', name: 'Platform' },
        { id: 'team-eng', key: 'ENG', name: 'Engineering' },
      ]
      const users = [
        {
          id: 'user-matthew',
          name: 'Matthew Lee',
          displayName: 'jordan',
          email: 'matthew@example.com',
          active: true,
        },
        {
          id: 'user-jane',
          name: 'Jane Lee',
          displayName: 'jane',
          email: 'jane@example.com',
          active: true,
        },
      ]
      if (largeDirectory) {
        users.push(
          ...Array.from({ length: 250 }, (_, index) => ({
            id: `user-extra-${index}`,
            name: `Extra ${index}`,
            displayName: `extra${index}`,
            email: `extra${index}@example.com`,
            active: true,
          })),
        )
      }
      const page = (nodes: unknown[]) => {
        const offset = Number(body.variables?.after ?? 0)
        const size = largeDirectory ? 100 : 1

        return {
          nodes: nodes.slice(offset, offset + size),
          pageInfo: {
            hasNextPage: offset + size < nodes.length,
            endCursor: String(offset + size),
          },
        }
      }
      if (body.query.includes('IssueContextUsers')) {
        if (body.query.includes('teams(')) {
          return providerResponse({ errors: [{ message: 'Query too complex' }] })
        }
        const filters = body.variables?.filter?.or
        const matched = users.filter(
          (user) =>
            !filters ||
            filters.some((filter) =>
              Object.entries(filter).some(([field, value]) =>
                String(user[field as keyof typeof user])
                  .toLowerCase()
                  .includes(value.containsIgnoreCase.toLowerCase()),
              ),
            ),
        )

        return providerResponse({ data: { users: page(matched) } })
      }
      if (body.query.includes('IssueContextMemberships')) {
        return providerResponse({ data: { user: { teams: page(teams) } } })
      }
      if (body.query.includes('IssueContextTeams')) {
        return providerResponse({ data: { teams: page(teams) } })
      }

      return providerResponse({ data: { viewer: { id: 'viewer-1', name: 'Cerin' } } })
    }
    if (body.query?.includes('mutation CreateAttachment')) {
      if (failAttachments) return providerResponse({ errors: [{ message: 'Attachment failed' }] })

      return providerResponse({
        data: {
          attachmentCreate: {
            success: true,
            attachment: {
              id: 'attachment-1',
              title: 'Cerin session',
              subtitle: 'Source context',
              url: body.variables?.input?.url,
            },
          },
        },
      })
    }

    return providerResponse({
      data: {
        issueCreate: {
          success: true,
          issue: {
            id: 'issue-1',
            identifier: 'EX-1',
            title: body.variables?.input?.title,
            url: 'https://linear.app/example/EX-1',
            priority: 0,
            state: { id: 'state-default', name: 'Backlog', type: 'backlog' },
            assignee: {
              id: 'user-matthew',
              name: 'Matthew Lee',
              displayName: 'jordan',
              email: 'matthew@example.com',
            },
            team: { id: 'team-pla', key: 'PLA', name: 'Platform' },
          },
        },
      },
    })
  },
})

afterAll(() => server.stop(true))
beforeEach(() => {
  requests = []
  largeDirectory = false
  failAttachments = false
})

function tokenFor(origin: string): string {
  const payload = Buffer.from(JSON.stringify({ ori: origin })).toString('base64url')

  return `header.${payload}.signature`
}

async function run(script: string, args: string[], stdin = '') {
  const child = Bun.spawn(['bash', path.join(scriptsDir, script), ...args], {
    env: {
      ...process.env,
      CERIN_TOKEN: tokenFor(server.url.origin),
      CERIN_SESSION_ID: 'session-123',
      CERIN_PUBLIC_URL: '',
      CERIN_BACKEND_URL: 'https://attacker.invalid',
    },
    stdin: new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])

  return { exitCode, stdout, stderr }
}

function graphqlRequests() {
  return requests.map((request) => request.body.body)
}

describe('linear skill proxy helpers', () => {
  test('filters users and paginates teams and memberships through the selected session proxy', async () => {
    const result = await run('issue-context.sh', [cerinTeamId, bindingId, 'matthew|matt'])

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(JSON.parse(result.stdout)).toMatchObject({
      userSearchMatched: true,
      teams: [
        { id: 'team-pla', key: 'PLA' },
        { id: 'team-eng', key: 'ENG' },
      ],
      users: [
        {
          id: 'user-matthew',
          name: 'Matthew Lee',
          teams: { nodes: [{ id: 'team-pla' }, { id: 'team-eng' }] },
        },
      ],
    })
    expect(requests).toHaveLength(6)
    expect(
      requests.every(
        (request) =>
          request.url ===
            `${server.url.origin}/agent-sessions/session-123/teams/${cerinTeamId}/linear-workspaces/${bindingId}/proxy` &&
          request.authorization === `Bearer ${tokenFor(server.url.origin)}` &&
          request.body.method === 'POST' &&
          request.body.path === '/graphql',
      ),
    ).toBe(true)
    expect(graphqlRequests()[0]).toMatchObject({
      variables: {
        filter: {
          active: { eq: true },
          or: [
            { name: { containsIgnoreCase: 'matthew' } },
            { displayName: { containsIgnoreCase: 'matthew' } },
            { email: { containsIgnoreCase: 'matthew' } },
            { name: { containsIgnoreCase: 'matt' } },
            { displayName: { containsIgnoreCase: 'matt' } },
            { email: { containsIgnoreCase: 'matt' } },
          ],
        },
      },
    })
  })

  test.each([
    ['nobody-matches', false],
    ['', true],
    ['LEE', true],
    ['  matthew@example.com | nobody  ', true],
  ])('paginates users and preserves fallback for %s', async (search, matched) => {
    const result = await run('issue-context.sh', [cerinTeamId, bindingId, search])

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    const output = JSON.parse(result.stdout)

    expect(output.userSearchMatched).toBe(matched)
    expect(output.users.map((user: { id: string }) => user.id)).toEqual(
      search.includes('@') ? ['user-matthew'] : ['user-matthew', 'user-jane'],
    )
    if (search.includes('@')) {
      expect(output.users[0].teams.nodes).toHaveLength(2)
    } else {
      expect(output.users.every((user: { teams: unknown }) => user.teams === null)).toBe(true)
      expect(
        graphqlRequests().some((request) => request.query?.includes('IssueContextMemberships')),
      ).toBe(false)
      expect(
        graphqlRequests().some(
          (request) =>
            request.query?.includes('IssueContextUsers') && request.variables?.after === '1',
        ),
      ).toBe(true)
    }
  })

  test('does not expand memberships for a large fallback directory', async () => {
    largeDirectory = true
    const result = await run('issue-context.sh', [cerinTeamId, bindingId, 'no-such-member'])
    const output = JSON.parse(result.stdout)

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(output.users).toHaveLength(252)
    expect(output.userSearchMatched).toBe(false)
    expect(requests).toHaveLength(6)
    expect(
      graphqlRequests().some((request) => request.query?.includes('IssueContextMemberships')),
    ).toBe(false)
  })

  test('rejects excessive aliases before making API requests', async () => {
    const aliases = Array.from({ length: 1000 }, (_, index) => `alias${index}`).join('|')
    const result = await run('issue-context.sh', [cerinTeamId, bindingId, aliases])

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('at most 10 search aliases')
    expect(requests).toHaveLength(0)
  })

  test('creates an issue from stdin without inventing state or priority', async () => {
    const description = '## Summary\n\nPreserve this markdown.\n'
    const result = await run(
      'issue-create.sh',
      [
        cerinTeamId,
        bindingId,
        '--team',
        'team-pla',
        '--assignee',
        'user-matthew',
        '--title',
        'Fix the orphan cleanup',
      ],
      description,
    )

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(JSON.parse(result.stdout)).toMatchObject({
      identifier: 'EX-1',
      sourceLink: {
        title: 'Cerin session',
        url: `https://api.cerin.ai/teams/${cerinTeamId}/agent/session-123`,
      },
    })
    expect(graphqlRequests()).toHaveLength(2)
    expect(graphqlRequests()[0]).toMatchObject({
      variables: {
        input: {
          teamId: 'team-pla',
          assigneeId: 'user-matthew',
          title: 'Fix the orphan cleanup',
          description,
        },
      },
    })
    const input = graphqlRequests()[0]?.variables?.input

    expect(input).not.toHaveProperty('stateId')
    expect(input).not.toHaveProperty('priority')
    expect(graphqlRequests()[1]).toMatchObject({
      variables: {
        input: {
          issueId: 'issue-1',
          title: 'Cerin session',
          subtitle: 'Source context',
          url: `https://api.cerin.ai/teams/${cerinTeamId}/agent/session-123`,
          metadata: { cerinSessionId: 'session-123' },
        },
      },
    })
  })

  test('uses the native Links field when the description already mentions the session URL', async () => {
    const sessionUrl = `https://api.cerin.ai/teams/${cerinTeamId}/agent/session-123`
    const result = await run(
      'issue-create.sh',
      [cerinTeamId, bindingId, '--team', 'team-pla', '--title', 'Already linked'],
      `Context: ${sessionUrl}\n`,
    )

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(graphqlRequests()).toHaveLength(2)
    expect(graphqlRequests()[0]?.variables?.input?.description).toBe(`Context: ${sessionUrl}\n`)
    expect(graphqlRequests()[1]).toMatchObject({
      variables: { input: { issueId: 'issue-1', url: sessionUrl } },
    })
  })

  test('does not repeat issue creation when its attachment fails', async () => {
    failAttachments = true
    const result = await run(
      'issue-create.sh',
      [cerinTeamId, bindingId, '--team', 'team-pla', '--title', 'Keep the created issue'],
      'Description',
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Do not rerun issue-create.sh')
    expect(JSON.parse(result.stdout)).toMatchObject({
      identifier: 'EX-1',
      sourceLink: { success: false },
    })
    expect(graphqlRequests()).toHaveLength(2)
    expect(graphqlRequests()[0]?.query).toContain('mutation CreateIssue')
    expect(graphqlRequests()[1]?.query).toContain('mutation CreateAttachment')
  })

  test('fails on GraphQL errors and never references a provider token', async () => {
    failAttachments = true
    const payload = JSON.stringify({ query: 'mutation CreateAttachment { attachmentCreate }' })
    const result = await run('graphql.sh', [cerinTeamId, bindingId], payload)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Attachment failed')
    const files = ['SKILL.md', 'scripts/graphql.sh', 'scripts/issue-context.sh', 'scripts/issue-create.sh']
    for (const file of files) {
      const source = await Bun.file(path.join(linearDir, file)).text()

      expect(source).not.toContain('LINEAR_ACCESS_TOKEN')
      expect(source).not.toContain('setup-credentials.sh')
    }
  })
})
