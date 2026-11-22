import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { parseChoiceRequest } from '../../components/agent/panel/connectCardModel.ts'
import { clickOptions, formQuestions } from '../../components/agent/panel/decisionFormModel.ts'
import { botChatQuestion } from '../../components/channels/botChatQuestion.ts'
import { chatTime } from '../../components/sidebar/chat-preview.ts'
import { t, tKey } from '../../i18n/index.ts'
import { inboxSource } from '../inbox/inboxItems.ts'

import type { BotActivityStatus } from './morningPaperItems.ts'
import type { AgentConversation, AgentInputRequest } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { HeldReply } from '../inbox/useInbox.ts'

const STATUS_LABELS = {
  working: 'morningPaper.statusWorking',
  waiting: 'morningPaper.statusWaiting',
  finished: 'morningPaper.statusFinished',
  idle: 'morningPaper.statusIdle',
} as const

const STATUS_DOTS: Record<BotActivityStatus, string> = {
  working: 'bg-data-1 animate-pulse motion-reduce:animate-none',
  waiting: 'bg-status-warning',
  finished: 'bg-status-success',
  idle: 'bg-line-control',
}

const ACTION_BUTTON =
  'inline-flex h-8 max-w-full cursor-pointer items-center justify-center rounded-full px-3.5 text-[12px] font-medium outline-none transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised'

export function CountTile({
  label,
  count,
  conversations,
  onOpenConversation,
}: {
  label: string
  count: number
  conversations: readonly AgentConversation[]
  onOpenConversation: (sessionId: string) => void
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-line-control bg-elevated p-4 sm:p-6">
      <h2 className="truncate font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.18em] text-tertiary">
        {label}
      </h2>
      <div className="mt-4 font-display text-[48px] font-medium leading-none tracking-[-0.045em] tabular-nums sm:mt-5 sm:text-[64px]">
        {count}
      </div>
      <AvatarStack conversations={conversations} onOpenConversation={onOpenConversation} />
    </article>
  )
}

function AvatarStack({
  conversations,
  onOpenConversation,
}: {
  conversations: readonly AgentConversation[]
  onOpenConversation: (sessionId: string) => void
}) {
  const visible = conversations.slice(0, 5)
  const hidden = conversations.length - visible.length

  return (
    <div className="mt-6 flex min-h-8 -space-x-2">
      {visible.map((conversation) => (
        <button
          key={conversation.sessionId}
          type="button"
          aria-label={conversationTitle(conversation)}
          title={conversationTitle(conversation)}
          onClick={() => onOpenConversation(conversation.sessionId)}
          className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-surface-raised bg-surface-raised outline-none transition-[transform,opacity] duration-150 hover:z-10 hover:-translate-y-0.5 active:scale-[0.96] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <AgentAvatar
            agentId={conversation.sessionId}
            avatar={conversation.avatar}
            avatarBackground={conversation.avatarBackground}
            provider={conversation.agentRuntime}
            size={28}
            showBadge={false}
          />
        </button>
      ))}
      {hidden > 0 && (
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-surface-raised bg-surface-sunken font-mono text-[10px] font-medium tabular-nums text-secondary">
          +{hidden}
        </span>
      )}
    </div>
  )
}

export function DecisionTile({
  row,
  onAnswer,
  onOpen,
}: {
  row: InboxQuestion
  onAnswer: (reply: HeldReply) => void
  onOpen: () => void
}) {
  const source = inboxSource(row)
  const at = row.request.updatedAt ?? row.request.askedAt
  const time = chatTime(at)
  const options = quickChoices(row.request).slice(0, 3)

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line-control bg-elevated">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-1 flex-col rounded-t-2xl p-5 text-left outline-none transition-colors hover:bg-state-hover focus-visible:bg-state-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          <AgentAvatar
            agentId={source.sessionId}
            avatar={source.avatar}
            avatarBackground={source.avatarBackground}
            provider={source.agentRuntime}
            size={20}
            showBadge={false}
          />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4 text-secondary">
            {conversationTitle(source)}
          </span>
          {time && (
            <time dateTime={at} className="shrink-0 font-mono text-[10px] leading-4 text-tertiary">
              {time}
            </time>
          )}
        </span>
        <span className="mt-5 line-clamp-3 break-words font-display text-[17px] font-semibold leading-[1.4] tracking-[-0.015em] text-main">
          {row.request.question}
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-control/70 px-5 py-4">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            title={option}
            onClick={() => onAnswer({ choices: [option] })}
            className={`${ACTION_BUTTON} ${
              index === 0
                ? 'bg-data-1 text-inverse hover:bg-data-1/90'
                : 'border border-line-control bg-surface-sheet text-primary hover:bg-state-hover'
            }`}
          >
            <span className="truncate">{option}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onAnswer({ dismissed: true })}
          className={`${ACTION_BUTTON} border border-line-control bg-surface-sheet text-secondary hover:bg-state-hover hover:text-main`}
        >
          {t('Dismiss')}
        </button>
      </div>
    </article>
  )
}

function quickChoices(request: AgentInputRequest): string[] {
  const { part, typed } = botChatQuestion(request)
  const choice = parseChoiceRequest(part.input)

  if (!choice) return []
  const questions = formQuestions(choice)

  if (!typed && !questions.some((question) => question.options.length > 0)) return []

  return clickOptions(questions) ?? []
}

export function BotTile({
  bot,
  status,
  onOpen,
}: {
  bot: AgentConversation
  status: BotActivityStatus
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-[208px] shrink-0 rounded-2xl border border-line-control bg-elevated p-4 text-left outline-none transition-[background-color,border-color,transform] duration-150 hover:bg-state-hover active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised"
    >
      <span className="flex min-w-0 items-center gap-3">
        <AgentAvatar
          agentId={bot.sessionId}
          avatar={bot.avatar}
          avatarBackground={bot.avatarBackground}
          provider={bot.agentRuntime}
          size={32}
          showBadge={false}
        />
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold leading-5 text-main">
          {conversationTitle(bot)}
        </span>
      </span>
      <StatusChip status={status} />
    </button>
  )
}

function StatusChip({ status }: { status: BotActivityStatus }) {
  return (
    <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-line-control bg-surface-sheet px-2.5 py-1 text-[11px] font-medium leading-4 text-secondary">
      <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {tKey(STATUS_LABELS[status])}
    </span>
  )
}

function conversationTitle(conversation: AgentConversation): string {
  return conversation.title || conversation.firstMessage || t('Untitled task')
}
