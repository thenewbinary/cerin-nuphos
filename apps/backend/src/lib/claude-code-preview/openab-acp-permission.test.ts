import { afterAll, afterEach, expect, spyOn, test } from 'bun:test'

import { OpenAbConnectError } from './openab-acp-connect'
import { OpenAbConnectionLostError } from './openab-acp-errors'
import { answerPermissionRequest, createPermissionToolCallReports } from './openab-acp-permission'

import type { OpenAbPermissionOutcome } from './openab-acp-session'

const error = spyOn(console, 'error').mockImplementation(() => {})
const warn = spyOn(console, 'warn').mockImplementation(() => {})

afterEach(() => {
  error.mockClear()
  warn.mockClear()
})
// Restored, or every later file in the same run gets these mocks back from its
// own spyOn, with the calls logged since, and miscounts its warnings.
afterAll(() => {
  error.mockRestore()
  warn.mockRestore()
})

/** Answers one request whose handler throws `thrown`; returns what the runtime was sent. */
async function answer(thrown: Error) {
  const sent: OpenAbPermissionOutcome[] = []

  await answerPermissionRequest({
    params: { sessionId: 's', toolCall: { toolCallId: 't' }, options: [] },
    targets: [{ sessionId: 's', onPermissionRequest: () => Promise.reject(thrown) }],
    send: (result) => sent.push(result),
  })

  return sent
}

const logged = (spy: typeof error) => spy.mock.calls.map(([line]) => String(line))

test.each([
  [
    'did not take the connection',
    new OpenAbConnectError('Failed to connect to OpenAB ACP endpoint'),
  ],
  ['hung up mid-call', new OpenAbConnectionLostError('socket closed')],
])(
  'a host that %s, as while it restarts, cancels the request with a warning, not an error',
  async (_case, thrown) => {
    expect(await answer(thrown)).toEqual([{ outcome: { outcome: 'cancelled' } }])
    expect(logged(error)).toEqual([])
    expect(logged(warn).join()).toContain('agent.openab_permission.host_away')
  },
)

test('any other handler failure still cancels the request and is logged as an error', async () => {
  expect(await answer(new Error('decision store down'))).toEqual([
    { outcome: { outcome: 'cancelled' } },
  ])
  expect(logged(error).join()).toContain('agent.openab_permission.handler_failed')
})

test('tool reports are bounded across sessions and evict old context', () => {
  const reports = createPermissionToolCallReports()

  for (let index = 0; index <= 512; index++) {
    reports.remember({
      sessionId: `session-${String(index)}`,
      update: { sessionUpdate: 'tool_call', toolCallId: 'call', title: `tool-${String(index)}` },
    })
  }
  expect(reports.get('session-0', 'call')).toBeUndefined()
  expect(reports.get('session-512', 'call')?.title).toBe('tool-512')
})

test.each([
  { sessionUpdate: 'openab_session_interrupted' },
  { sessionUpdate: 'runtime_state', snapshot: { state: 'idle' } },
  { sessionUpdate: 'runtime_state', snapshot: { state: 'dormant' } },
  { sessionUpdate: 'runtime_state', snapshot: { state: 'interrupted' } },
])('clears only the finished session on $sessionUpdate', (update) => {
  const reports = createPermissionToolCallReports()

  for (const sessionId of ['finished', 'still-running']) {
    reports.remember({
      sessionId,
      update: { sessionUpdate: 'tool_call', toolCallId: 'call', title: 'tool' },
    })
  }
  reports.remember({ sessionId: 'finished', update })
  expect(reports.get('finished', 'call')).toBeUndefined()
  expect(reports.get('still-running', 'call')?.title).toBe('tool')
})

test('provider status and usage do not erase reports from a still-running turn', () => {
  const reports = createPermissionToolCallReports()

  for (const update of [
    { sessionUpdate: 'tool_call', toolCallId: 'call', title: 'tool' },
    { sessionUpdate: 'session_info_update', _meta: { codex: { threadStatus: { type: 'idle' } } } },
    { sessionUpdate: 'usage_update', _meta: { '_claude/origin': { kind: 'task-notification' } } },
    { sessionUpdate: 'runtime_state', snapshot: { state: 'active' } },
  ]) {
    reports.remember({ sessionId: 'session', update })
  }
  expect(reports.get('session', 'call')?.title).toBe('tool')
})
