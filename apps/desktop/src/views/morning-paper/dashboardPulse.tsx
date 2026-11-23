import { Activity, CheckCircle2 } from 'lucide-react'

import { t, tKey } from '../../i18n/index.ts'

import { BotAvatarStack } from './botAvatarStack.tsx'
import { DecisionPulseCard } from './decisionPills.tsx'

import type { AgentConversation } from '../../api/agent-types.ts'
import type { InboxQuestion } from '../inbox/inboxItems.ts'
import type { HeldReply } from '../inbox/useInbox.ts'

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
  title: string
  eyebrow?: string
  finished: number
  changed: number
  changedBots: readonly AgentConversation[]
  working: number
  bots: readonly AgentConversation[]
  workingBots: readonly AgentConversation[]
  decisions: readonly InboxQuestion[]
  onAnswer: (row: InboxQuestion, reply: HeldReply) => void
  onOpenConversation: (sessionId: string) => void
}) {
  return (
    <section className="dashboard-glass dashboard-panel p-5 sm:p-6">
      <header>
        {eyebrow && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tertiary">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-2 break-words font-display text-[30px] font-light leading-[1.12] tracking-[-0.04em] text-main sm:text-[34px]">
          {title}
        </h2>
      </header>
      <div className="dashboard-pulse-grid mt-6">
        <article className="dashboard-tile">
          <CardLabel label={tKey('morningPaper.finishedTitle')} dot="bg-status-success" />
          <div className="dashboard-number mt-7">{finished}</div>
          <div className="mt-auto flex items-center gap-2 pt-5 text-[11px] text-secondary">
            <CheckCircle2 aria-hidden className="size-3.5 text-tertiary" strokeWidth={1.6} />
            <span>{t('Completed')}</span>
          </div>
        </article>

        <article className="dashboard-tile">
          <CardLabel label={tKey('morningPaper.changedTitle')} dot="bg-data-1" />
          <div className="dashboard-number mt-7">{changed}</div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            <BotAvatarStack bots={changedBots} size={22} />
            <Activity aria-hidden className="size-3.5 shrink-0 text-tertiary" strokeWidth={1.6} />
          </div>
        </article>

        <article className="dashboard-tile">
          <CardLabel label={t('Bots')} dot="bg-status-success" />
          <div className="mt-7 flex items-baseline whitespace-nowrap font-display font-light tracking-[-0.05em] tabular-nums text-main">
            <span className="dashboard-number">{working}</span>
            <span className="ml-1 text-[25px] tracking-[-0.04em] text-tertiary">/{bots.length}</span>
          </div>
          <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-5">
            <BotAvatarStack bots={workingBots.length > 0 ? workingBots : bots} size={22} />
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-secondary">
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  working > 0
                    ? 'animate-pulse bg-status-success motion-reduce:animate-none'
                    : 'bg-line-control'
                }`}
              />
              {tKey('morningPaper.statusWorking')}
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
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="line-clamp-2 min-w-0 break-words text-[10px] font-medium leading-[1.35] text-secondary">
        {label}
      </span>
    </div>
  )
}
