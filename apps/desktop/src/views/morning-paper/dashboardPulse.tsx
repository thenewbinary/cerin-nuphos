import { Activity, CheckCircle2 } from 'lucide-react'

import { t, tKey } from '../../i18n/index.ts'

import { BotAvatarStack } from './botAvatarStack.tsx'
import { DecisionPulseCard } from './decisionPills.tsx'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { InboxReply } from '../inbox/useInbox.ts'

export function DashboardPulse({
  title,
  eyebrow,
  finished,
  changed,
  changedBots,
  working,
  bots,
  workingBots,
  decisions,
  onAnswer,
  onOpenConversation,
}: {
  title?: string
  eyebrow?: string
  finished: number
  changed: number
  changedBots: readonly AgentConversation[]
  working: number
  bots: readonly AgentConversation[]
  workingBots: readonly AgentConversation[]
  decisions: readonly InboxQuestion[]
  onAnswer: (row: InboxQuestion, reply: InboxReply) => void
  onOpenConversation: (sessionId: string) => void
}) {
  return (
    <section className="dashboard-glass dashboard-panel">
      {Boolean(title ?? eyebrow) && (
        <header className="dashboard-pulse-header">
          {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
          {title && <h2 className="dashboard-title">{title}</h2>}
        </header>
      )}
      <div className="dashboard-pulse-grid">
        <article className="dashboard-tile">
          <CardLabel label={tKey('morningPaper.finishedTitle')} dot="bg-status-success" />
          <div className="dashboard-number mt-8">{finished}</div>
          <div className="mt-auto flex items-center gap-2 pt-5 text-[12px] leading-4 text-secondary">
            <CheckCircle2 aria-hidden className="size-4 text-tertiary" strokeWidth={1.5} />
            <span>{t('Completed')}</span>
          </div>
        </article>

        <article className="dashboard-tile">
          <CardLabel label={tKey('morningPaper.changedTitle')} dot="bg-data-1" />
          <div className="dashboard-number mt-8">{changed}</div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            {changedBots.length > 0 && <BotAvatarStack bots={changedBots} size={24} />}
            <Activity aria-hidden className="size-4 shrink-0 text-tertiary" strokeWidth={1.5} />
          </div>
        </article>

        <article className="dashboard-tile">
          <CardLabel label={t('Bots')} dot="bg-status-success" />
          <div className="dashboard-number mt-8 whitespace-nowrap">
            {working}
            <span className="dashboard-number-of">/{bots.length}</span>
          </div>
          <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-5">
            <BotAvatarStack bots={workingBots.length > 0 ? workingBots : bots} size={24} />
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] leading-4 text-secondary">
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  working > 0
                    ? 'animate-pulse bg-status-success motion-reduce:animate-none'
                    : 'bg-line-control'
                }`}
              />
              {working > 0 ? tKey('morningPaper.statusWorking') : tKey('morningPaper.statusIdle')}
            </span>
          </div>
        </article>

        <DecisionPulseCard
          rows={decisions}
          onAnswer={onAnswer}
          onOpenConversation={onOpenConversation}
        />
      </div>
    </section>
  )
}

function CardLabel({ label, dot }: { label: string; dot: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className="line-clamp-2 min-w-0 break-words text-[13px] font-medium leading-[1.3] text-main">
        {label}
      </span>
    </div>
  )
}
