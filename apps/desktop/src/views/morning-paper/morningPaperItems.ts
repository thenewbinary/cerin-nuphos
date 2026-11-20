import { attentionInputRequests } from '../../lib/agentInputRequests.ts'
import { runtimeBackgroundRunning, runtimeTurnActive } from '../../lib/runtimeExecution.ts'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { RuntimeExecution } from '../../lib/runtimeExecution.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'

const RECENT_FINISHED_MS = 7 * 24 * 60 * 60 * 1000

export type MorningPaperItems = {
  decisions: InboxQuestion[]
  finished: AgentConversation[]
  changed: AgentConversation[]
}

export function morningPaperItems({
  conversations,
  decisions,
  unreadSessionIds,
  runtimeStates,
  isBot,
  lastSeenAt,
  now,
}: {
  conversations: readonly AgentConversation[]
  decisions: readonly InboxQuestion[]
  unreadSessionIds: ReadonlySet<string>
  runtimeStates: ReadonlyMap<string, RuntimeExecution>
  isBot: (conversation: AgentConversation) => boolean
  lastSeenAt: number
  now: number
}): MorningPaperItems {
  const represented = new Set(decisions.map((row) => row.conversation.sessionId))
  const activityAt = (conversation: AgentConversation) => {
    const value = Date.parse(conversation.lastActiveAt)

    return Number.isFinite(value) ? value : null
  }
  const newestFirst = (a: AgentConversation, b: AgentConversation) =>
    (activityAt(b) ?? 0) - (activityAt(a) ?? 0)
  const ownedWork = (conversation: AgentConversation) =>
    conversation.isOwner === true && conversation.kind !== 'channel'
  const isWorking = (conversation: AgentConversation) => {
    const runtime = runtimeStates.get(conversation.sessionId) ?? conversation.runtimeState

    return (
      Boolean(conversation.activeRun) ||
      runtimeTurnActive(runtime) ||
      runtimeBackgroundRunning(runtime)
    )
  }

  const finished = conversations
    .filter(
      (conversation) =>
        ownedWork(conversation) &&
        !isBot(conversation) &&
        !represented.has(conversation.sessionId) &&
        ((conversation.activitySeq ?? 0) > 0 || unreadSessionIds.has(conversation.sessionId)) &&
        attentionInputRequests(conversation).length === 0 &&
        !isWorking(conversation) &&
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
