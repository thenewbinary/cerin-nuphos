import { useId } from 'react'

import { t, tKey } from '../../i18n/index.ts'

import { greetingKey } from './morningPaperItems.ts'

import type { OutcomeMetric } from './morningPaperOutcomes.ts'

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
}: {
  enteredAt: number
  name: string
  metrics: readonly OutcomeMetric[]
  workingCount: number
}) {
  return (
    <header className="flex min-w-0 flex-col gap-7 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div className="min-w-0 flex-1 lg:pb-5 lg:pt-2">
        <h1 className="max-w-[760px] break-words font-display text-[42px] font-light leading-[1.04] tracking-[-0.05em] text-main sm:text-[52px]">
          {greetingText(new Date(enteredAt), name)}
        </h1>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-secondary">
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
              single={metrics.length === 1}
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
}: {
  metric: OutcomeMetric
  position: 'front' | 'back'
  single: boolean
}) {
  const gradientId = `dashboard-spark-${useId().replaceAll(':', '')}`
  const geometry = trendGeometry(metric.trend)

  return (
    <article
      className={`dashboard-glass dashboard-value-card dashboard-value-${position} ${
        single ? 'dashboard-value-single' : ''
      }`}
    >
      {geometry && (
        <svg
          aria-hidden
          viewBox="0 0 200 76"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-3 bottom-1 h-[82px] w-[calc(100%-24px)]"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="color-mix(in srgb, rgb(var(--color-data-1)) 18%, transparent)"
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
            strokeOpacity="0.34"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div className="relative z-10">
        <div className="truncate font-mono text-[9px] font-medium uppercase leading-4 tracking-[0.18em] text-tertiary">
          {metric.label}
        </div>
        <div className="mt-6 whitespace-nowrap font-display text-[36px] font-light leading-none tracking-[-0.05em] tabular-nums text-main">
          {metric.value}
        </div>
        {metric.caption && (
          <div className="mt-2 truncate text-[10px] leading-4 text-tertiary">{metric.caption}</div>
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
