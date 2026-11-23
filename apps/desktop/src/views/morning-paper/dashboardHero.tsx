import { useId } from 'react'

import { t, tKey } from '../../i18n/index.ts'

import { BotAvatarStack } from './botAvatarStack.tsx'
import { greetingKey } from './morningPaperItems.ts'

import type { OutcomeMetric } from './morningPaperOutcomes.ts'
import type { AgentConversation } from '../../api/agent-types.ts'

function greetingText(date: Date, name: string): string {
  switch (greetingKey(date)) {
    case 'morning':
      return t('Good morning, {name}', { name })
    case 'afternoon':
      return t('Good afternoon, {name}', { name })
    case 'evening':
      return t('Good evening, {name}', { name })
  }
}

export function DashboardHero({
  enteredAt,
  name,
  metrics,
  workingCount,
  workingBots,
}: {
  enteredAt: number
  name: string
  metrics: readonly OutcomeMetric[]
  workingCount: number
  /** Set when the lone card counts work in progress: the Bots doing it sit under the figure. */
  workingBots?: readonly AgentConversation[]
}) {
  const single = metrics.length === 1

  return (
    <header className={`dashboard-hero ${single ? 'dashboard-hero-single' : ''}`}>
      <div className="dashboard-hero-copy min-w-0 flex-1">
        <h1 className="dashboard-greeting">{greetingText(new Date(enteredAt), name)}</h1>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-[14px] leading-5 text-secondary">
          <time dateTime={new Date(enteredAt).toISOString()}>
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }).format(enteredAt)}
          </time>
          {workingCount > 0 && (
            <span
              role="status"
              aria-label={`${String(workingCount)} ${tKey('morningPaper.statusWorking')}`}
              className="inline-flex items-center gap-2 text-tertiary"
            >
              <span aria-hidden className="size-1 rounded-full bg-line-control" />
              <span
                aria-hidden
                className="size-2 animate-pulse rounded-full bg-status-success motion-reduce:animate-none"
              />
              <span className="font-medium tabular-nums text-secondary">{workingCount}</span>
              <span>{tKey('morningPaper.statusWorking')}</span>
            </span>
          )}
        </div>
      </div>
      {metrics.length > 0 && (
        <div className="dashboard-value-deck">
          {metrics.slice(0, 2).map((metric, index) => (
            <ValueCard
              key={metric.id}
              metric={metric}
              position={index === 0 ? 'front' : 'back'}
              single={single}
              workingBots={single ? workingBots : undefined}
            />
          ))}
        </div>
      )}
    </header>
  )
}

function ValueCard({
  metric,
  position,
  single,
  workingBots,
}: {
  metric: OutcomeMetric
  position: 'front' | 'back'
  single: boolean
  workingBots?: readonly AgentConversation[]
}) {
  const gradientId = `dashboard-spark-${useId().replaceAll(':', '')}`
  const geometry = trendGeometry(metric.trend)

  return (
    <article
      className={`dashboard-value-card dashboard-value-${position} ${
        single ? 'dashboard-value-single' : ''
      }`}
    >
      {geometry && (
        <svg
          aria-hidden
          viewBox="0 0 200 76"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52px] w-full"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="color-mix(in srgb, rgb(var(--color-data-1)) 22%, transparent)"
              />
              <stop
                offset="100%"
                stopColor="color-mix(in srgb, rgb(var(--color-data-1)) 0%, transparent)"
              />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="rgb(var(--color-data-1))"
            strokeOpacity="0.55"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div className={`relative z-10 ${geometry ? 'pb-9' : ''}`}>
        <div className="dashboard-value-label">{metric.label}</div>
        <div className="dashboard-value-figure">{metric.value}</div>
        {metric.caption && <div className="dashboard-value-caption">{metric.caption}</div>}
        {workingBots && (
          <div className="mt-4 flex min-h-6 min-w-0 items-center gap-2 text-[12px] leading-4 text-secondary">
            {workingBots.length > 0 ? (
              <BotAvatarStack bots={workingBots} size={22} />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-line-control" />
                {tKey('morningPaper.statusIdle')}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function trendGeometry(trend: number[] | undefined) {
  const values = trend?.filter(Number.isFinite) ?? []

  if (values.length < 2) return null

  const low = Math.min(...values)
  const high = Math.max(...values)
  const range = high - low || 1
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * 200,
    y: 64 - ((value - low) / range) * 48,
  }))
  const line = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  return { line, area: `${line} L200 76 L0 76 Z` }
}
