import { Hand, X } from 'lucide-react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { parseChoiceRequest } from '../../components/agent/panel/connectCardModel.ts'
import { clickOptions, formQuestions } from '../../components/agent/panel/decisionFormModel.ts'
import { botChatQuestion } from '../../components/channels/botChatQuestion.ts'
import { t, tKey } from '../../i18n/index.ts'
import { inboxSource } from '../inbox/inboxItems.ts'

import type { AgentInputRequest } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { HeldReply } from '../inbox/useInbox.ts'

const ACTION_BUTTON =
  'inline-flex h-8 max-w-full cursor-pointer items-center justify-center rounded-full px-3 text-[12px] font-medium outline-none transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised'

export function DecisionStack({
  rows,
  onAnswer,
  onOpenConversation,
}: {
  rows: readonly InboxQuestion[]
  onAnswer: (row: InboxQuestion, reply: HeldReply) => void
  onOpenConversation: (sessionId: string) => void
}) {
  if (rows.length === 0) return null

  return (
    <section aria-label={tKey('morningPaper.decisionsTitle')} className="min-w-0">
      <h2
        aria-label={tKey('morningPaper.decisionsTitle')}
        className="mb-3 flex items-center gap-2.5 text-main"
      >
        <Hand aria-hidden className="size-5 text-secondary" strokeWidth={1.5} />
        <span className="font-display text-[42px] font-light leading-none tracking-[-0.05em] tabular-nums">
          {rows.length}
        </span>
      </h2>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <DecisionPill
            key={row.request.id}
            row={row}
            onAnswer={(reply) => onAnswer(row, reply)}
            onOpen={() => onOpenConversation(row.conversation.sessionId)}
          />
        ))}
      </div>
    </section>
  )
}

function DecisionPill({
  row,
  onAnswer,
  onOpen,
}: {
  row: InboxQuestion
  onAnswer: (reply: HeldReply) => void
  onOpen: () => void
}) {
  const source = inboxSource(row)
  const options = quickChoices(row.request).slice(0, 3)

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-line-control bg-elevated">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-w-0 items-start gap-2.5 p-3.5 pb-2.5 text-left outline-none transition-colors hover:bg-state-hover focus-visible:bg-state-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      >
        <AgentAvatar
          agentId={source.sessionId}
          avatar={source.avatar}
          avatarBackground={source.avatarBackground}
          provider={source.agentRuntime}
          size={24}
          showBadge={false}
        />
        <span className="line-clamp-2 min-w-0 flex-1 break-words pt-0.5 text-[13px] font-medium leading-[1.45] text-main">
          {row.request.question}
        </span>
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3.5 pb-3 pl-[50px]">
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
          aria-label={t('Dismiss')}
          title={t('Dismiss')}
          onClick={() => onAnswer({ dismissed: true })}
          className="ml-auto inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-none transition-[background-color,color,transform] duration-150 hover:bg-state-hover hover:text-main active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="size-3.5" strokeWidth={1.8} />
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
