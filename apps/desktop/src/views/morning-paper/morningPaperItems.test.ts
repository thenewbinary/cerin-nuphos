import assert from 'node:assert/strict'
import test from 'node:test'

import { morningPaperItems } from './morningPaperItems.ts'

import type { AgentConversation, AgentInputRequest } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (milliseconds: number) => new Date(milliseconds).toISOString()

function conversation(
  sessionId: string,
  overrides: Partial<AgentConversation> = {},
): AgentConversation {
  return {
    sessionId,
    title: sessionId,
    firstMessage: '',
    messageCount: 1,
    createdAt: at(NOW - 30 * DAY),
    lastActiveAt: at(NOW - HOUR),
    isOwner: true,
    ...overrides,
  }
}

function request(id: string, overrides: Partial<AgentInputRequest> = {}): AgentInputRequest {
  return {
    id,
    category: 'approval',
    question: id,
    askedAt: at(NOW - 2 * HOUR),
    status: 'open',
    ...overrides,
  }
}

function decision(sessionId: string, requestId: string): InboxQuestion {
  return { conversation: conversation(sessionId), request: request(requestId) }
}

function select(
  overrides: Partial<Parameters<typeof morningPaperItems>[0]> = {},
): ReturnType<typeof morningPaperItems> {
  return morningPaperItems({
    conversations: [],
    decisions: [],
    unreadSessionIds: new Set(),
    runtimeStates: new Map(),
    isBot: (row) => Boolean(row.avatar),
    lastSeenAt: NOW - DAY,
    now: NOW,
    ...overrides,
  })
}

const ids = (rows: readonly AgentConversation[]) => rows.map((row) => row.sessionId)

test('decisions keep their Inbox order and outrank the other sections', () => {
  const waiting = conversation('waiting', { inputRequests: [request('q2'), request('q1')] })
  const finished = conversation('finished')
  const changed = conversation('changed', { lastActiveAt: at(NOW - 2 * HOUR) })
  const result = select({
    conversations: [waiting, finished, changed],
    decisions: [decision('waiting', 'q2'), decision('waiting', 'q1')],
    unreadSessionIds: new Set(['waiting', 'finished']),
    lastSeenAt: NOW - 3 * HOUR,
  })

  assert.deepEqual(
    result.decisions.map((row) => row.request.id),
    ['q2', 'q1'],
  )
  assert.deepEqual(ids(result.finished), ['finished'])
  assert.deepEqual(ids(result.changed), ['changed'])
})

test('Finished keeps read and unread ended turns, but not other people’s work, channels or Bots', () => {
  const rows = [
    conversation('included'),
    conversation('read', { activitySeq: 1, readSeq: 1 }),
    conversation('shared', { isOwner: false, activitySeq: 1 }),
    conversation('channel', { kind: 'channel', activitySeq: 1 }),
    conversation('bot', { avatar: 'face', activitySeq: 1 }),
    conversation('no-ended-turn'),
    conversation('old', { lastActiveAt: at(NOW - 7 * DAY - 1) }),
    conversation('invalid', { lastActiveAt: 'not a date' }),
  ]
  const result = select({
    conversations: rows,
    unreadSessionIds: new Set(['included', 'shared', 'channel', 'bot', 'old', 'invalid']),
  })

  assert.deepEqual(ids(result.finished), ['included', 'read'])
})

test('Finished excludes work still running or waiting on any open request', () => {
  const rows = [
    conversation('included'),
    conversation('active-run', { activeRun: { streamId: 'run', startedAt: null } }),
    conversation('turn', { runtimeState: { state: 'active' } }),
    conversation('background', {
      runtimeState: { state: 'idle', schemaVersion: 2, phase: 'background_tools' },
    }),
    conversation('open', { inputRequests: [request('open')] }),
    conversation('snoozed', {
      inputRequests: [request('snoozed', { snoozedUntil: at(NOW + DAY) })],
    }),
  ]
  const result = select({
    conversations: rows,
    unreadSessionIds: new Set(rows.map((row) => row.sessionId)),
  })

  assert.deepEqual(ids(result.finished), ['included'])
})

test('a live runtime snapshot takes precedence over the conversation summary', () => {
  const running = conversation('running')
  const idle = conversation('idle', { runtimeState: { state: 'active' } })
  const result = select({
    conversations: [running, idle],
    unreadSessionIds: new Set(['running', 'idle']),
    runtimeStates: new Map([
      ['running', { state: 'active' }],
      ['idle', { state: 'idle' }],
    ]),
  })

  assert.deepEqual(ids(result.finished), ['idle'])
})

test('Finished includes the seven-day boundary and sorts newest first', () => {
  const rows = [
    conversation('boundary', { lastActiveAt: at(NOW - 7 * DAY) }),
    conversation('newest', { lastActiveAt: at(NOW - HOUR) }),
    conversation('middle', { lastActiveAt: at(NOW - 2 * DAY) }),
  ]
  const result = select({
    conversations: rows,
    unreadSessionIds: new Set(rows.map((row) => row.sessionId)),
  })

  assert.deepEqual(ids(result.finished), ['newest', 'middle', 'boundary'])
})

test('Changed is strictly after the last visit, newest first, without duplicates', () => {
  const rows = [
    conversation('at-baseline', { lastActiveAt: at(NOW - DAY) }),
    conversation('older', { lastActiveAt: at(NOW - 2 * DAY) }),
    conversation('newest', { lastActiveAt: at(NOW - HOUR) }),
    conversation('newer', { lastActiveAt: at(NOW - 2 * HOUR) }),
    conversation('shared', { isOwner: false, lastActiveAt: at(NOW) }),
    conversation('channel', { kind: 'channel', lastActiveAt: at(NOW) }),
    conversation('invalid', { lastActiveAt: '' }),
    conversation('finished'),
    conversation('waiting'),
  ]
  const result = select({
    conversations: rows,
    decisions: [decision('waiting', 'question')],
    unreadSessionIds: new Set(['finished']),
  })

  assert.deepEqual(ids(result.finished), ['finished'])
  assert.deepEqual(ids(result.changed), ['newest', 'newer'])
})

test('a first visit uses its arrival time and shows no historical activity', () => {
  const result = select({
    conversations: [conversation('earlier', { lastActiveAt: at(NOW - 1) })],
    lastSeenAt: NOW,
  })

  assert.deepEqual(result.changed, [])
})
