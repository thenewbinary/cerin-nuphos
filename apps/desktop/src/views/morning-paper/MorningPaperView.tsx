import { useEffect, useState } from 'react'

import { useAgentSessions } from '../../components/sidebar/agentSessions.ts'
import { t, tKey } from '../../i18n/index.ts'
import { isBotRow, useAgentAvatarPicks } from '../../lib/agentAvatarChoices.ts'
import { useAgentRuntimeStates } from '../../lib/agentRuntimeStates.ts'
import { useAgentUnreadSessions } from '../../lib/agentUnreadSessions.ts'
import { answerInboxWithUndo } from '../inbox/answerInboxWithUndo.ts'
import { sendHeldAnswer } from '../inbox/useInbox.ts'
import { useInboxQuestions } from '../inbox/useInboxQuestions.ts'

import { DecisionStack } from './decisionPills.tsx'
import { MatrixFlow } from './matrixFlow.tsx'
import { MatrixHero, OutcomeCounters } from './matrixHero.tsx'
import { botActivity, flowModel, morningPaperCounts, morningPaperItems } from './morningPaperItems.ts'
import { readMorningPaperLastSeen, recordMorningPaperLastSeen } from './morningPaperLastSeen.ts'
import { useMorningPaperOutcomes } from './morningPaperOutcomes.ts'
import { ProofStrip } from './proofStrip.tsx'
import './morningPaperMatrix.css'

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
  const activityInput = { conversations, decisions, unreadSessionIds, runtimeStates, isBot, lastSeenAt }
  const items = morningPaperItems({ ...activityInput, now })
  const counts = morningPaperCounts(items)
  const bots = botActivity(activityInput)
  const flow = flowModel(bots, conversations, isBot)
  const objective = outcomes?.objective ?? tKey('morningPaper.title')
  const counters = outcomes?.metrics ?? [
    { id: 'finished', value: String(counts.finished), label: tKey('morningPaper.finishedTitle') },
    { id: 'changed', value: String(counts.changed), label: tKey('morningPaper.changedTitle') },
    { id: 'decisions', value: String(counts.decisions), label: tKey('morningPaper.decisionsTitle') },
    { id: 'bots', value: String(bots.length), label: t('Bots') },
  ]

  return {
    conversations,
    isBot,
    items,
    counts,
    flow,
    objective,
    counters,
    heroMetrics: outcomes?.metrics ?? [],
    proof: outcomes?.proof ?? [],
    workingCount: bots.filter(({ status }) => status === 'working').length,
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

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto bg-main text-main">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <MatrixHero enteredAt={visit.enteredAt} objective={model.objective} metrics={model.heroMetrics} />

        {loading ? (
          <div role="status" className="py-8 text-sm text-tertiary">
            {t('Loading…')}
          </div>
        ) : (
          <main className="mt-8 space-y-8 sm:mt-10 sm:space-y-10">
            <OutcomeCounters metrics={model.counters} working={model.workingCount > 0} />

            <div
              className={
                model.flow.lead && model.items.decisions.length > 0
                  ? 'grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start'
                  : undefined
              }
            >
              {model.flow.lead && (
                <MatrixFlow
                  objective={model.objective}
                  model={model.flow}
                  workingCount={model.workingCount}
                  decisionCount={model.counts.decisions}
                  onOpenConversation={onOpenConversation}
                />
              )}
              <DecisionStack
                rows={model.items.decisions}
                onAnswer={answer}
                onOpenConversation={onOpenConversation}
              />
            </div>

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
  )
}
