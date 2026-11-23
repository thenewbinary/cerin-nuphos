import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useAgentSessions } from '../../components/sidebar/agentSessions.ts'
import { t, tKey } from '../../i18n/index.ts'
import { isBotRow, useAgentAvatarPicks } from '../../lib/agentAvatarChoices.ts'
import { useAgentRuntimeStates } from '../../lib/agentRuntimeStates.ts'
import { useAgentUnreadSessions } from '../../lib/agentUnreadSessions.ts'
import { queryKeys } from '../../lib/query/keys.ts'
import { answerInboxWithUndo } from '../inbox/answerInboxWithUndo.ts'
import { botAbove } from '../inbox/inboxItems.ts'
import { sendHeldAnswer } from '../inbox/useInbox.ts'
import { useInboxQuestions } from '../inbox/useInboxQuestions.ts'

import { ActivityMonitor } from './activityMonitor.tsx'
import { DashboardHero } from './dashboardHero.tsx'
import { DashboardPulse } from './dashboardPulse.tsx'
import { botActivity, finishedPerDay, morningPaperCounts, morningPaperItems } from './morningPaperItems.ts'
import { readMorningPaperLastSeen, recordMorningPaperLastSeen } from './morningPaperLastSeen.ts'
import { useMorningPaperOutcomes } from './morningPaperOutcomes.ts'
import { ProofStrip } from './proofStrip.tsx'
import './morningPaperDashboard.css'

import type { MorningPaperOutcomes } from './morningPaperOutcomes.ts'
import type { AgentConversation } from '../../api/agent-types.ts'
import type { RuntimeExecution } from '../../lib/runtimeExecution.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { HeldReply } from '../inbox/useInbox.ts'

type Props = {
  teamId: string
  currentUserId: string
  onOpenConversation: (sessionId: string) => void
}

type ViewModelInput = {
  conversations: readonly AgentConversation[]
  decisions: readonly InboxQuestion[]
  unreadSessionIds: ReadonlySet<string>
  runtimeStates: ReadonlyMap<string, RuntimeExecution>
  avatarPicks: ReadonlyMap<string, string | null>
  outcomes: MorningPaperOutcomes | null
  lastSeenAt: number
  now: number
}

function viewModel({
  conversations,
  decisions,
  unreadSessionIds,
  runtimeStates,
  avatarPicks,
  outcomes,
  lastSeenAt,
  now,
}: ViewModelInput) {
  const isBot = (conversation: AgentConversation) =>
    isBotRow(conversation, avatarPicks.get(conversation.sessionId))
  const activityInput = {
    conversations,
    decisions,
    unreadSessionIds,
    runtimeStates,
    isBot,
    lastSeenAt,
  }
  const items = morningPaperItems({ ...activityInput, now })
  const counts = morningPaperCounts(items)
  const activities = botActivity(activityInput)
  const bots = activities.map(({ bot }) => bot)
  const workingBots = activities
    .filter(({ status }) => status === 'working')
    .map(({ bot }) => bot)
  const byId = new Map(conversations.map((conversation) => [conversation.sessionId, conversation]))
  const changedBotIds = new Set<string>()
  const changedBots: AgentConversation[] = []

  for (const conversation of items.changed) {
    const bot = isBot(conversation) ? conversation : botAbove(conversation, byId, isBot)

    if (!bot || changedBotIds.has(bot.sessionId)) continue
    changedBotIds.add(bot.sessionId)
    changedBots.push(bot)
  }

  const activity = finishedPerDay({
    conversations,
    finished: items.finished,
    isBot,
    now,
    days: 7,
  })
  const objective = outcomes?.objective ?? tKey('morningPaper.home')
  const heroMetrics = outcomes
    ? outcomes.metrics.filter((metric) => metric.featured).slice(0, 2)
    : [
        {
          id: 'finished',
          value: String(activity.total),
          label: tKey('morningPaper.finishedTitle'),
          trend: activity.totals,
        },
      ]

  return {
    conversations,
    isBot,
    items,
    counts,
    bots,
    workingBots,
    changedBots,
    activity,
    objective,
    pulseTitle:
      outcomes?.objective ??
      [
        counts.finished.toLocaleString(),
        tKey('morningPaper.finishedTitle'),
        '·',
        bots.length.toLocaleString(),
        t('Bots'),
      ].join(' '),
    heroMetrics,
    proof: outcomes?.proof ?? [],
  }
}

export function MorningPaperView({ teamId, currentUserId, onOpenConversation }: Props) {
  const [visit] = useState(() => {
    const enteredAt = Date.now()

    return {
      enteredAt,
      lastSeenAt: readMorningPaperLastSeen(currentUserId, teamId) ?? enteredAt,
    }
  })
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()
  const sessions = useAgentSessions(teamId)
  const questions = useInboxQuestions(teamId)
  const unreadSessionIds = useAgentUnreadSessions()
  const runtimeStates = useAgentRuntimeStates()
  const avatarPicks = useAgentAvatarPicks()
  const outcomes = useMorningPaperOutcomes(teamId)

  useEffect(() => {
    const record = () => recordMorningPaperLastSeen(currentUserId, teamId, Date.now())

    window.addEventListener('pagehide', record)

    return () => {
      window.removeEventListener('pagehide', record)
      record()
    }
  }, [currentUserId, teamId])

  useEffect(() => sendHeldAnswer, [])

  const model = viewModel({
    conversations: sessions.data ?? [],
    decisions: questions ?? [],
    unreadSessionIds,
    runtimeStates,
    avatarPicks,
    outcomes,
    lastSeenAt: visit.lastSeenAt,
    now: visit.enteredAt,
  })
  const loading = sessions.data === undefined || questions === null
  const answer = (row: InboxQuestion, reply: HeldReply) => answerInboxWithUndo(teamId, row, reply)
  const refresh = () => {
    setRefreshing(true)
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.agentSessions(teamId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(teamId) }),
    ]).finally(() => setRefreshing(false))
  }

  return (
    <div className="selectable min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-main text-main">
      <div className="dashboard-canvas min-h-full">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <DashboardHero
            enteredAt={visit.enteredAt}
            objective={model.objective}
            metrics={model.heroMetrics}
            workingCount={model.workingBots.length}
          />

          {loading ? (
            <div role="status" className="py-8 text-sm text-tertiary">
              {t('Loading…')}
            </div>
          ) : (
            <main className="mt-8 space-y-6 sm:mt-9 sm:space-y-7">
              <DashboardPulse
                title={model.pulseTitle}
                finished={model.counts.finished}
                changed={model.counts.changed}
                changedBots={model.changedBots}
                working={model.workingBots.length}
                bots={model.bots}
                workingBots={model.workingBots}
                decisions={model.items.decisions}
                onAnswer={answer}
                onOpenConversation={onOpenConversation}
              />
              <ActivityMonitor
                activity={model.activity}
                updatedAt={sessions.dataUpdatedAt || visit.enteredAt}
                refreshing={refreshing}
                onRefresh={refresh}
              />
              <ProofStrip
                proof={model.proof}
                finished={model.items.finished}
                conversations={model.conversations}
                isBot={model.isBot}
                onOpenConversation={onOpenConversation}
              />
            </main>
          )}
        </div>
      </div>
    </div>
  )
}
