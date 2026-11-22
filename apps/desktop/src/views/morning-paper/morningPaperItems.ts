import { attentionInputRequests } from '../../lib/agentInputRequests.ts'
import { runtimeBackgroundRunning, runtimeTurnActive } from '../../lib/runtimeExecution.ts'
import { botAbove, inboxSource } from '../inbox/inboxItems.ts'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { RuntimeExecution } from '../../lib/runtimeExecution.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'

const RECENT_FINISHED_MS = 7 * 24 * 60 * 60 * 1000

export type MorningPaperItems = {
  decisions: InboxQuestion[]
  finished: AgentConversation[]
  changed: AgentConversation[]
}

export type MorningPaperInput = {
  conversations: readonly AgentConversation[]
  decisions: readonly InboxQuestion[]
  unreadSessionIds: ReadonlySet<string>
  runtimeStates: ReadonlyMap<string, RuntimeExecution>
  isBot: (conversation: AgentConversation) => boolean
  lastSeenAt: number
  now: number
}

export type BotActivityStatus = 'waiting' | 'working' | 'finished' | 'idle'

export type BotActivity = {
  bot: AgentConversation
  status: BotActivityStatus
  lastActiveAt: string
}

const activityAt = (conversation: AgentConversation) => {
  const value = Date.parse(conversation.lastActiveAt)

  return Number.isFinite(value) ? value : null
}

const newestFirst = (a: AgentConversation, b: AgentConversation) =>
  (activityAt(b) ?? 0) - (activityAt(a) ?? 0)

const ownedWork = (conversation: AgentConversation) =>
  conversation.isOwner === true && conversation.kind !== 'channel'

function isWorking(
  conversation: AgentConversation,
  runtimeStates: ReadonlyMap<string, RuntimeExecution>,
) {
  const runtime = runtimeStates.get(conversation.sessionId) ?? conversation.runtimeState

  return (
    Boolean(conversation.activeRun) ||
    runtimeTurnActive(runtime) ||
    runtimeBackgroundRunning(runtime)
  )
}

export function morningPaperCounts(items: MorningPaperItems) {
  return {
    decisions: items.decisions.length,
    finished: items.finished.length,
    changed: items.changed.length,
  }
}

export function botActivity({
  conversations,
  decisions,
  unreadSessionIds,
  runtimeStates,
  isBot,
  lastSeenAt,
}: Omit<MorningPaperInput, 'now'>): BotActivity[] {
  const byId = new Map(conversations.map((conversation) => [conversation.sessionId, conversation]))
  const bots = conversations.filter(
    (conversation) => ownedWork(conversation) && isBot(conversation),
  )
  const workByBot = new Map(bots.map((bot) => [bot.sessionId, [bot]]))

  for (const conversation of conversations) {
    if (!ownedWork(conversation) || isBot(conversation)) continue
    const bot = botAbove(conversation, byId, isBot)

    if (bot) workByBot.get(bot.sessionId)?.push(conversation)
  }

  const waitingSources = new Set(decisions.map((row) => inboxSource(row).sessionId))
  const statusRank: Record<BotActivityStatus, number> = {
    waiting: 0,
    working: 1,
    finished: 2,
    idle: 3,
  }

  return bots
    .map((bot) => {
      const rows = workByBot.get(bot.sessionId) ?? [bot]
      const waiting =
        waitingSources.has(bot.sessionId) ||
        rows.some((conversation) => attentionInputRequests(conversation).length > 0)
      const working = rows.some((conversation) => isWorking(conversation, runtimeStates))
      const finished = rows.some(
        (conversation) =>
          (activityAt(conversation) ?? -Infinity) > lastSeenAt ||
          (unreadSessionIds.has(conversation.sessionId) && (conversation.activitySeq ?? 0) > 0),
      )
      const latest = rows.reduce(
        (current, conversation) =>
          (activityAt(conversation) ?? -Infinity) > (activityAt(current) ?? -Infinity)
            ? conversation
            : current,
        bot,
      )
      let status: BotActivityStatus = 'idle'

      if (finished) status = 'finished'
      if (working) status = 'working'
      if (waiting) status = 'waiting'

      return { bot, status, lastActiveAt: latest.lastActiveAt }
    })
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        (Date.parse(b.lastActiveAt) || 0) - (Date.parse(a.lastActiveAt) || 0),
    )
}

export function morningPaperItems({
  conversations,
  decisions,
  unreadSessionIds,
  runtimeStates,
  isBot,
  lastSeenAt,
  now,
}: MorningPaperInput): MorningPaperItems {
  const represented = new Set(decisions.map((row) => row.conversation.sessionId))

  const finished = conversations
    .filter(
      (conversation) =>
        ownedWork(conversation) &&
        !isBot(conversation) &&
        !represented.has(conversation.sessionId) &&
        ((conversation.activitySeq ?? 0) > 0 || unreadSessionIds.has(conversation.sessionId)) &&
        attentionInputRequests(conversation).length === 0 &&
        !isWorking(conversation, runtimeStates) &&
        (activityAt(conversation) ?? -Infinity) >= now - RECENT_FINISHED_MS,
    )
    .sort(newestFirst)

  for (const conversation of finished) represented.add(conversation.sessionId)

  const changed = conversations
    .filter(
      (conversation) =>
        ownedWork(conversation) &&
        !represented.has(conversation.sessionId) &&
        (activityAt(conversation) ?? -Infinity) > lastSeenAt,
    )
    .sort(newestFirst)

  return { decisions: [...decisions], finished, changed }
}
