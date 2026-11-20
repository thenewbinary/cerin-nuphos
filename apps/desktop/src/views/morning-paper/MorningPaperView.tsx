import { useEffect, useState } from 'react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { useAgentSessions } from '../../components/sidebar/agentSessions.ts'
import { chatPreview, chatTime } from '../../components/sidebar/chat-preview.ts'
import { t, tKey } from '../../i18n/index.ts'
import { isBotRow, useAgentAvatarPicks } from '../../lib/agentAvatarChoices.ts'
import { useAgentRuntimeStates } from '../../lib/agentRuntimeStates.ts'
import { useAgentUnreadSessions } from '../../lib/agentUnreadSessions.ts'
import { inboxSource } from '../inbox/inboxItems.ts'
import { useInboxQuestions } from '../inbox/useInboxQuestions.ts'

import { morningPaperItems } from './morningPaperItems.ts'
import { readMorningPaperLastSeen, recordMorningPaperLastSeen } from './morningPaperLastSeen.ts'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { ReactNode } from 'react'

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

  const conversations = sessions.data ?? []
  const items = morningPaperItems({
    conversations,
    decisions: questions ?? [],
    unreadSessionIds,
    runtimeStates,
    isBot: (conversation) => isBotRow(conversation, avatarPicks.get(conversation.sessionId)),
    lastSeenAt: visit.lastSeenAt,
    now: visit.enteredAt,
  })
  const loading = sessions.data === undefined || questions === null

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto bg-main text-main">
      <div className="mx-auto w-full max-w-[1120px] px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <header className="border-b border-line-control pb-8">
          <time
            dateTime={new Date(visit.enteredAt).toISOString()}
            className="text-[13px] leading-5 text-tertiary"
          >
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(visit.enteredAt)}
          </time>
          <h1 className="mt-3 font-display text-4xl font-medium leading-[1.1] tracking-[-0.03em] text-balance sm:text-5xl">
            {tKey('morningPaper.title')}
          </h1>
        </header>

        {loading ? (
          <div role="status" className="py-8 text-sm text-tertiary">
            {t('Loading…')}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-2">
            <Section
              title={tKey('morningPaper.decisionsTitle')}
              empty={tKey('morningPaper.decisionsEmpty')}
              className="lg:col-span-2"
            >
              {items.decisions.map((row) => (
                <PaperRow
                  key={row.request.id}
                  conversation={inboxSource(row)}
                  title={row.request.question}
                  detail={row.bot ? conversationTitle(row.conversation) : undefined}
                  sourceTitle={conversationTitle(inboxSource(row))}
                  at={row.request.updatedAt ?? row.request.askedAt}
                  onOpen={() => onOpenConversation(row.conversation.sessionId)}
                />
              ))}
            </Section>

            <Section
              title={tKey('morningPaper.finishedTitle')}
              empty={tKey('morningPaper.finishedEmpty')}
            >
              {items.finished.map((conversation) => (
                <PaperRow
                  key={conversation.sessionId}
                  conversation={conversation}
                  title={conversationTitle(conversation)}
                  at={conversation.lastActiveAt}
                  onOpen={() => onOpenConversation(conversation.sessionId)}
                />
              ))}
            </Section>

            <Section
              title={tKey('morningPaper.changedTitle')}
              empty={tKey('morningPaper.changedEmpty')}
            >
              {items.changed.map((conversation) => (
                <PaperRow
                  key={conversation.sessionId}
                  conversation={conversation}
                  title={conversationTitle(conversation)}
                  detail={chatPreview(conversation.lastMessage, conversation.faces)}
                  at={conversation.lastActiveAt}
                  onOpen={() => onOpenConversation(conversation.sessionId)}
                />
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  empty,
  className = '',
  children,
}: {
  title: string
  empty: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className}>
      <h2 className="font-display text-lg font-medium leading-6 tracking-[-0.01em]">{title}</h2>
      <div className="mt-5 border-t border-line-control">
        {children}
        {!Array.isArray(children) || children.length === 0 ? (
          <p className="py-5 text-sm leading-6 text-tertiary">{empty}</p>
        ) : null}
      </div>
    </section>
  )
}

function PaperRow({
  conversation,
  title,
  detail,
  sourceTitle,
  at,
  onOpen,
}: {
  conversation: AgentConversation
  title: string
  detail?: string
  sourceTitle?: string
  at: string
  onOpen: () => void
}) {
  const time = chatTime(at)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-w-0 items-start gap-3 rounded-sm border-b border-line-control px-2 py-4 text-left outline-none transition-colors hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
    >
      <AgentAvatar
        agentId={conversation.sessionId}
        avatar={conversation.avatar}
        avatarBackground={conversation.avatarBackground}
        provider={conversation.agentRuntime}
        size={28}
        showBadge={false}
      />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-medium leading-6 text-main">
          {title}
        </span>
        {detail && (
          <span className="mt-1 line-clamp-2 break-words text-sm leading-5 text-secondary">
            {detail}
          </span>
        )}
        {sourceTitle && (
          <span className="mt-2 block break-words text-xs leading-4 text-tertiary">
            {sourceTitle}
          </span>
        )}
      </span>
      {time && (
        <time dateTime={at} className="shrink-0 pt-0.5 text-xs leading-5 text-tertiary">
          {time}
        </time>
      )}
    </button>
  )
}

function conversationTitle(conversation: AgentConversation): string {
  return conversation.title || conversation.firstMessage || t('Untitled task')
}
