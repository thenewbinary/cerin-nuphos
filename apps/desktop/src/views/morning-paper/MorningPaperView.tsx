import { useEffect, useState } from 'react'

import { useAgentSessions } from '../../components/sidebar/agentSessions.ts'
import { t, tKey } from '../../i18n/index.ts'
import { isBotRow, useAgentAvatarPicks } from '../../lib/agentAvatarChoices.ts'
import { useAgentRuntimeStates } from '../../lib/agentRuntimeStates.ts'
import { useAgentUnreadSessions } from '../../lib/agentUnreadSessions.ts'
import { answerInboxWithUndo } from '../inbox/answerInboxWithUndo.ts'
import { sendHeldAnswer } from '../inbox/useInbox.ts'
import { useInboxQuestions } from '../inbox/useInboxQuestions.ts'

import { botActivity, morningPaperCounts, morningPaperItems } from './morningPaperItems.ts'
import { readMorningPaperLastSeen, recordMorningPaperLastSeen } from './morningPaperLastSeen.ts'
import { BotTile, CountTile, DecisionTile } from './scoreboardTiles.tsx'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { HeldReply } from '../inbox/useInbox.ts'

type Props = {
  teamId: string
  currentUserId: string
  onOpenConversation: (sessionId: string) => void
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

  useEffect(() => {
    const record = () => recordMorningPaperLastSeen(currentUserId, teamId, Date.now())

    window.addEventListener('pagehide', record)

    return () => {
      window.removeEventListener('pagehide', record)
      record()
    }
  }, [currentUserId, teamId])

  useEffect(() => sendHeldAnswer, [])

  const conversations = sessions.data ?? []
  const isBot = (conversation: AgentConversation) =>
    isBotRow(conversation, avatarPicks.get(conversation.sessionId))
  const items = morningPaperItems({
    conversations,
    decisions: questions ?? [],
    unreadSessionIds,
    runtimeStates,
    isBot,
    lastSeenAt: visit.lastSeenAt,
    now: visit.enteredAt,
  })
  const counts = morningPaperCounts(items)
  const bots = botActivity({
    conversations,
    decisions: questions ?? [],
    unreadSessionIds,
    runtimeStates,
    isBot,
    lastSeenAt: visit.lastSeenAt,
  })
  const loading = sessions.data === undefined || questions === null
  const answer = (row: InboxQuestion, reply: HeldReply) => answerInboxWithUndo(teamId, row, reply)

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto bg-main text-main">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <header>
          <time
            dateTime={new Date(visit.enteredAt).toISOString()}
            className="font-mono text-[10px] uppercase leading-4 tracking-[0.18em] text-tertiary"
          >
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(visit.enteredAt)}
          </time>
          <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-[-0.03em] text-balance sm:text-4xl">
            {tKey('morningPaper.title')}
          </h1>
        </header>

        {loading ? (
          <div role="status" className="py-8 text-sm text-tertiary">
            {t('Loading…')}
          </div>
        ) : (
          <main className="mt-8 space-y-10">
            <section className="grid grid-cols-2 gap-3 sm:gap-4">
              <CountTile
                label={tKey('morningPaper.finishedTitle')}
                count={counts.finished}
                conversations={items.finished}
                onOpenConversation={onOpenConversation}
              />
              <CountTile
                label={tKey('morningPaper.changedTitle')}
                count={counts.changed}
                conversations={items.changed}
                onOpenConversation={onOpenConversation}
              />
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2.5">
                <h2 className="font-display text-xl font-medium leading-7 tracking-[-0.02em]">
                  {tKey('morningPaper.decisionsTitle')}
                </h2>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-action-primary px-2 font-mono text-[11px] leading-none tabular-nums text-inverse">
                  {counts.decisions}
                </span>
              </div>
              {items.decisions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.decisions.map((row) => (
                    <DecisionTile
                      key={row.request.id}
                      row={row}
                      onAnswer={(reply) => answer(row, reply)}
                      onOpen={() => onOpenConversation(row.conversation.sessionId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line-control bg-elevated px-5 py-6">
                  <p
                    className="truncate text-sm leading-5 text-tertiary"
                    title={tKey('morningPaper.decisionsEmpty')}
                  >
                    {tKey('morningPaper.decisionsEmpty')}
                  </p>
                </div>
              )}
            </section>

            {bots.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-medium leading-7 tracking-[-0.02em]">
                  {t('Bots')}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {bots.map(({ bot, status }) => (
                    <BotTile
                      key={bot.sessionId}
                      bot={bot}
                      status={status}
                      onOpen={() => onOpenConversation(bot.sessionId)}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  )
}
