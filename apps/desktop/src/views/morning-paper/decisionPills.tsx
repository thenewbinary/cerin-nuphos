import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { parseChoiceRequest } from '../../components/agent/panel/connectCardModel.ts'
import { clickOptions, formQuestions } from '../../components/agent/panel/decisionFormModel.ts'
import { botChatQuestion } from '../../components/channels/botChatQuestion.ts'
import { t, tKey } from '../../i18n/index.ts'
import { inboxSource } from '../inbox/inboxItems.ts'

import type { AgentInputRequest } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { InboxReply } from '../inbox/useInbox.ts'

const ACTION_BUTTON =
  'inline-flex h-8 max-w-full cursor-pointer items-center justify-center rounded-full px-3.5 text-[12px] font-medium outline-none transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised'
const ICON_BUTTON =
  'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-none transition-[background-color,color] hover:bg-state-hover hover:text-main focus-visible:ring-2 focus-visible:ring-line-focus'

export function DecisionPulseCard({
  rows,
  onAnswer,
  onOpenConversation,
}: {
  rows: readonly InboxQuestion[]
  onAnswer: (row: InboxQuestion, reply: InboxReply) => void
  onOpenConversation: (sessionId: string) => void
}) {
  const [selected, setSelected] = useState(0)

  if (rows.length === 0) {
    return (
      <article className="dashboard-tile">
        <CardHeader count={0} />
        <div className="dashboard-number mt-8">0</div>
        <div className="mt-auto flex min-w-0 items-center gap-2 pt-5 text-[12px] leading-4 text-secondary">
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-tertiary" strokeWidth={1.5} />
          <span className="line-clamp-1 min-w-0 break-words">
            {tKey('morningPaper.decisionsEmpty')}
          </span>
        </div>
      </article>
    )
  }

  const index = Math.min(selected, rows.length - 1)
  const row = rows[index]
  const source = inboxSource(row)
  const options = quickChoices(row.request).slice(0, 3)

  return (
    <article className="dashboard-tile">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <CardHeader count={rows.length > 1 ? undefined : rows.length} />
        {rows.length > 1 && (
          <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t('Back')}
              title={t('Back')}
              onClick={() => setSelected((index - 1 + rows.length) % rows.length)}
              className={ICON_BUTTON}
            >
              <ChevronLeft aria-hidden className="size-3.5" strokeWidth={1.7} />
            </button>
            <span className="text-[11px] tabular-nums text-tertiary">
              {index + 1}/{rows.length}
            </span>
            <button
              type="button"
              aria-label={t('Forward')}
              title={t('Forward')}
              onClick={() => setSelected((index + 1) % rows.length)}
              className={ICON_BUTTON}
            >
              <ChevronRight aria-hidden className="size-3.5" strokeWidth={1.7} />
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpenConversation(row.conversation.sessionId)}
        className="mt-5 flex w-full min-w-0 items-start gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <AgentAvatar
          agentId={source.sessionId}
          avatar={source.avatar}
          avatarBackground={source.avatarBackground}
          provider={source.agentRuntime}
          size={24}
          showBadge={false}
        />
        <span className="line-clamp-3 min-w-0 flex-1 break-words text-[14px] font-medium leading-[1.4] tracking-[-0.005em] text-main">
          “{row.request.question}”
        </span>
      </button>
      <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 pt-4">
        {options.map((option, optionIndex) => (
          <button
            key={option}
            type="button"
            title={option}
            onClick={() => onAnswer(row, { choices: [option] })}
            className={`${ACTION_BUTTON} ${
              optionIndex === 0
                ? 'bg-action-primary text-inverse hover:opacity-90'
                : 'border border-line-control/80 bg-surface-raised/50 text-primary hover:bg-state-hover'
            }`}
          >
            <span className="truncate">{option}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label={t('Dismiss')}
          title={t('Dismiss')}
          onClick={() => onAnswer(row, { dismissed: true })}
          className="ml-auto inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-none transition-[background-color,color,transform] duration-150 hover:bg-state-hover hover:text-main active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="size-3.5" strokeWidth={1.7} />
        </button>
      </div>
    </article>
  )
}

function CardHeader({ count }: { count?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-status-warning" />
      <span className="line-clamp-2 min-w-0 break-words text-[13px] font-medium leading-[1.3] text-main">
        {tKey('morningPaper.decisionsTitle')}
      </span>
      {count !== undefined && (
        <span className="shrink-0 text-[11px] tabular-nums text-tertiary">{count}</span>
      )}
    </div>
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
