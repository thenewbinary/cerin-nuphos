import assert from 'node:assert/strict'
import test from 'node:test'

import {
  botActivity,
  finishedPerDay,
  firstName,
  greetingKey,
  morningPaperCounts,
  morningPaperItems,
} from './morningPaperItems.ts'

import type { AgentConversation, AgentInputRequest } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (milliseconds: number) => new Date(milliseconds).toISOString()
const atHour = (hour: number) => greetingKey(new Date(2026, 10, 22, hour))

test('greetingKey uses local morning, afternoon and evening boundaries', () => {
  assert.equal(atHour(0), 'evening')
  assert.equal(atHour(4), 'evening')
  assert.equal(atHour(5), 'morning')
  assert.equal(atHour(11), 'morning')
  assert.equal(atHour(12), 'afternoon')
  assert.equal(atHour(17), 'afternoon')
  assert.equal(atHour(18), 'evening')
  assert.equal(atHour(23), 'evening')
})

test('firstName extracts and capitalises display names and email local parts', () => {
  assert.equal(firstName(' Isaac Efik '), 'Isaac')
  assert.equal(firstName('chris'), 'Chris')
  assert.equal(firstName('isaac.live@example.com'), 'Isaac')
  assert.equal(firstName('isaac_live-example@example.com'), 'Isaac')
  assert.equal(firstName('isaac..live@example.com'), 'Isaac')
  assert.equal(firstName(''), '')
  assert.equal(firstName('   '), '')
  assert.equal(firstName(null), '')
  assert.equal(firstName(undefined), '')
})

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

function activity(
  overrides: Partial<Parameters<typeof botActivity>[0]> = {},
): ReturnType<typeof botActivity> {
  return botActivity({
    conversations: [],
    decisions: [],
    unreadSessionIds: new Set(),
    runtimeStates: new Map(),
    isBot: (row) => Boolean(row.avatar),
    lastSeenAt: NOW - DAY,
    ...overrides,
  })
}

test('bot activity orders waiting, working and finished ahead of idle, then newest first', () => {
  const rows = [
    conversation('idle', { avatar: 'face', lastActiveAt: at(NOW - 2 * DAY) }),
    conversation('working-older', {
      avatar: 'face',
      lastActiveAt: at(NOW - 3 * HOUR),
      runtimeState: { state: 'active' },
    }),
    conversation('finished', { avatar: 'face', lastActiveAt: at(NOW - 4 * HOUR) }),
    conversation('waiting', {
      avatar: 'face',
      lastActiveAt: at(NOW - 5 * HOUR),
      activeRun: { streamId: 'run', startedAt: null },
      inputRequests: [request('question')],
    }),
    conversation('working-newer', {
      avatar: 'face',
      lastActiveAt: at(NOW - HOUR),
      activeRun: { streamId: 'run', startedAt: null },
    }),
  ]
  const result = activity({ conversations: rows })

  assert.deepEqual(
    result.map(({ bot, status }) => [bot.sessionId, status]),
    [
      ['waiting', 'waiting'],
      ['working-newer', 'working'],
      ['working-older', 'working'],
      ['finished', 'finished'],
      ['idle', 'idle'],
    ],
  )
})

test('bot activity rolls nested task work, decisions and unread finishes up to their Bots', () => {
  const workingBot = conversation('working-bot', {
    avatar: 'face',
    lastActiveAt: at(NOW - 3 * DAY),
  })
  const parent = conversation('parent', {
    parentSessionId: workingBot.sessionId,
    lastActiveAt: at(NOW - 2 * DAY),
  })
  const workingTask = conversation('working-task', {
    parentSessionId: parent.sessionId,
    lastActiveAt: at(NOW - HOUR),
    runtimeState: { state: 'active' },
  })
  const waitingBot = conversation('waiting-bot', {
    avatar: 'face',
    lastActiveAt: at(NOW - 4 * DAY),
  })
  const waitingTask = conversation('waiting-task', {
    parentSessionId: waitingBot.sessionId,
    lastActiveAt: at(NOW - 2 * HOUR),
  })
  const finishedBot = conversation('finished-bot', {
    avatar: 'face',
    lastActiveAt: at(NOW - 5 * DAY),
  })
  const finishedTask = conversation('finished-task', {
    parentSessionId: finishedBot.sessionId,
    lastActiveAt: at(NOW - 3 * DAY),
    activitySeq: 1,
  })
  const result = activity({
    conversations: [
      workingBot,
      parent,
      workingTask,
      waitingBot,
      waitingTask,
      finishedBot,
      finishedTask,
    ],
    decisions: [{ ...decision(waitingTask.sessionId, 'question'), bot: waitingBot }],
    unreadSessionIds: new Set([finishedTask.sessionId]),
  })

  assert.deepEqual(
    result.map(({ bot, status, lastActiveAt }) => ({ id: bot.sessionId, status, lastActiveAt })),
    [
      { id: waitingBot.sessionId, status: 'waiting', lastActiveAt: waitingTask.lastActiveAt },
      { id: workingBot.sessionId, status: 'working', lastActiveAt: workingTask.lastActiveAt },
      { id: finishedBot.sessionId, status: 'finished', lastActiveAt: finishedTask.lastActiveAt },
    ],
  )
})

test('an owned Bot without work, questions or new activity defaults to idle', () => {
  const idle = conversation('idle', { avatar: 'face', lastActiveAt: at(NOW - 2 * DAY) })
  const shared = conversation('shared', {
    avatar: 'face',
    isOwner: false,
    activeRun: { streamId: 'run', startedAt: null },
  })
  const channel = conversation('channel', {
    avatar: 'face',
    kind: 'channel',
    activeRun: { streamId: 'run', startedAt: null },
  })
  const result = activity({ conversations: [shared, channel, idle] })

  assert.deepEqual(
    result.map(({ bot, status }) => [bot.sessionId, status]),
    [['idle', 'idle']],
  )
})

test('scoreboard counts come from the three visible buckets', () => {
  const waiting = conversation('waiting')
  const finished = conversation('finished')
  const changed = conversation('changed', { lastActiveAt: at(NOW - HOUR) })
  const result = select({
    conversations: [waiting, finished, changed],
    decisions: [decision(waiting.sessionId, 'question')],
    unreadSessionIds: new Set([finished.sessionId]),
    lastSeenAt: NOW - 2 * HOUR,
  })

  assert.deepEqual(morningPaperCounts(result), { decisions: 1, finished: 1, changed: 1 })
})

test('finishedPerDay counts local days and rolls nested tasks into their Bots', () => {
  const alpha = conversation('alpha', { avatar: 'face' })
  const beta = conversation('beta', { avatar: 'face' })
  const parent = conversation('parent', { parentSessionId: alpha.sessionId })
  const rows = [
    conversation('alpha-today', {
      parentSessionId: alpha.sessionId,
      lastActiveAt: at(NOW - HOUR),
    }),
    conversation('alpha-yesterday', {
      parentSessionId: alpha.sessionId,
      lastActiveAt: at(NOW - DAY),
    }),
    conversation('alpha-nested', {
      parentSessionId: parent.sessionId,
      lastActiveAt: at(NOW - 2 * DAY),
    }),
    conversation('beta-today', {
      parentSessionId: beta.sessionId,
      lastActiveAt: at(NOW - 2 * HOUR),
    }),
    conversation('unassigned', { lastActiveAt: at(NOW - 3 * HOUR) }),
    conversation('outside', {
      parentSessionId: alpha.sessionId,
      lastActiveAt: at(NOW - 8 * DAY),
    }),
    conversation('invalid', { parentSessionId: alpha.sessionId, lastActiveAt: 'not a date' }),
  ]
  const result = finishedPerDay({
    conversations: [alpha, beta, parent, ...rows],
    finished: rows,
    isBot: (row) => Boolean(row.avatar),
    now: NOW,
    days: 7,
  })

  assert.equal(result.days.length, 7)
  assert.deepEqual(result.totals, [0, 0, 0, 0, 1, 1, 3])
  assert.equal(result.total, 5)
  assert.deepEqual(
    result.bots.map(({ bot, counts, total }) => ({ id: bot.sessionId, counts, total })),
    [
      { id: 'alpha', counts: [0, 0, 0, 0, 1, 1, 1], total: 3 },
      { id: 'beta', counts: [0, 0, 0, 0, 0, 0, 1], total: 1 },
    ],
  )
})

test('finishedPerDay honors a shorter window and keeps an empty series deliberate', () => {
  const bot = conversation('bot', { avatar: 'face' })
  const rows = [
    conversation('included', {
      parentSessionId: bot.sessionId,
      lastActiveAt: at(NOW - 2 * DAY),
    }),
    conversation('excluded', {
      parentSessionId: bot.sessionId,
      lastActiveAt: at(NOW - 3 * DAY),
    }),
  ]
  const result = finishedPerDay({
    conversations: [bot, ...rows],
    finished: rows,
    isBot: (row) => Boolean(row.avatar),
    now: NOW,
    days: 3,
  })

  assert.deepEqual(result.totals, [1, 0, 0])
  assert.equal(result.total, 1)
  assert.deepEqual(result.bots[0]?.counts, [1, 0, 0])

  const empty = finishedPerDay({
    conversations: [],
    finished: [],
    isBot: () => false,
    now: NOW,
    days: 7,
  })

  assert.deepEqual(empty.totals, [0, 0, 0, 0, 0, 0, 0])
  assert.equal(empty.total, 0)
  assert.deepEqual(empty.bots, [])
})
