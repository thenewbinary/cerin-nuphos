import assert from 'node:assert/strict'
import test from 'node:test'

import { botActivity, flowModel, morningPaperCounts, morningPaperItems } from './morningPaperItems.ts'

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

function flowBot(
  sessionId: string,
  overrides: Partial<AgentConversation> = {},
): ReturnType<typeof botActivity>[number] {
  const bot = conversation(sessionId, { avatar: 'face', ...overrides })

  return { bot, status: 'idle', lastActiveAt: bot.lastActiveAt }
}

test('flow selects the chief and keeps department order with nested task counts', () => {
  const bots = [
    flowBot('alpha'),
    flowBot('chief', { title: 'Chief of Staff' }),
    flowBot('beta'),
  ]
  const alphaTask = conversation('alpha-task', { parentSessionId: 'alpha' })
  const betaParent = conversation('beta-parent', { parentSessionId: 'beta' })
  const betaNested = conversation('beta-nested', { parentSessionId: 'beta-parent' })
  const result = flowModel(
    bots,
    [...bots.map(({ bot }) => bot), alphaTask, betaParent, betaNested],
    (row) => Boolean(row.avatar),
  )

  assert.equal(result.lead?.bot.sessionId, 'chief')
  assert.deepEqual(
    result.departments.map(({ activity: { bot }, taskCount }) => [bot.sessionId, taskCount]),
    [
      ['alpha', 1],
      ['beta', 2],
    ],
  )
})

test('flow falls back to the bot with the most tasks', () => {
  const bots = [flowBot('first'), flowBot('busiest'), flowBot('last')]
  const tasks = [
    conversation('first-task', { parentSessionId: 'first' }),
    conversation('busy-one', { parentSessionId: 'busiest' }),
    conversation('busy-two', { parentSessionId: 'busiest' }),
  ]
  const result = flowModel(
    bots,
    [...bots.map(({ bot }) => bot), ...tasks],
    (row) => Boolean(row.avatar),
  )

  assert.equal(result.lead?.bot.sessionId, 'busiest')
  assert.deepEqual(
    result.departments.map(({ activity: { bot }, taskCount }) => [bot.sessionId, taskCount]),
    [
      ['first', 1],
      ['last', 0],
    ],
  )
})

test('flow is empty without bots', () => {
  assert.deepEqual(flowModel([], [], () => false), { lead: null, departments: [] })
})
