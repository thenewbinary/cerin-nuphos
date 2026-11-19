import { expect, mock, test } from 'bun:test'

// What each conversation read asked for.
const reads: { sessionId: string; options?: Record<string, unknown> }[] = []

mock.module('../../api', () => ({
  api: {
    agentGetConversation: async (
      sessionId: string,
      _team?: string,
      options?: Record<string, unknown>,
    ) => {
      reads.push({ sessionId, options })

      return { sessionId, title: 'Cerin SRE', kind: 'bot', avatar: 'owl', messages: [] }
    },
  },
}))
mock.module('../../grafana/client', () => ({
  listAlertRules: async () => [],
  listDashboards: async () => [],
}))

const { resolveMentionLabel } = await import('./resolveLabel')

test("an agent session's chip reads its name without any of its messages", async () => {
  const label = await resolveMentionLabel(
    { type: 'agent-session', teamId: 'team-1', sessionId: 'long-session' } as never,
    'https://platform.cerin.ai/teams/team-1/agent/long-session',
  )

  expect(label).toBe('Cerin SRE')
  expect(reads).toEqual([
    {
      sessionId: 'long-session',
      // A long session holds tens of thousands of messages; a chip shows none.
      options: { tail: 1, messages: 'omit', runtimeState: 'omit' },
    },
  ])
})
