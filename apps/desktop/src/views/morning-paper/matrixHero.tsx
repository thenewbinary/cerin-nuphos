import { useId } from 'react'

import { tKey } from '../../i18n/index.ts'

import type { OutcomeMetric } from './morningPaperOutcomes.ts'

type Counter = Pick<OutcomeMetric, 'id' | 'value' | 'label'>

export function MatrixHero({
  enteredAt,
  objective,
  metrics,
}: {
  enteredAt: number
  objective: string
  metrics: readonly OutcomeMetric[]
}) {
  const featured = metrics.filter((metric) => metric.featured).slice(0, 2)

  return (
    <header className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="min-w-0 flex-1 lg:pb-4">
        <time
          dateTime={new Date(enteredAt).toISOString()}
          className="font-mono text-[10px] uppercase leading-4 tracking-[0.2em] text-tertiary"
        >
          {new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(enteredAt)}
        </time>
        <h1 className="mt-3 max-w-[780px] break-words font-display text-[44px] font-light leading-[1.02] tracking-[-0.05em] text-main sm:text-[52px] xl:text-[56px]">
          {objective}
        </h1>
      </div>
      {featured.length > 0 && (
        <div className="flex min-w-0 items-stretch gap-3 lg:w-[390px] lg:shrink-0 lg:items-start lg:justify-end lg:gap-0 lg:pr-4 lg:pt-1">
          {featured.map((metric, index) => (
            <ValueCard key={metric.id} metric={metric} index={index} />
          ))}
        </div>
      )}
    </header>
  )
}

function ValueCard({ metric, index }: { metric: OutcomeMetric; index: number }) {
  const gradientId = `matrix-spark-${useId().replaceAll(':', '')}`
  const geometry = trendGeometry(metric.trend)

  return (
    <article
      className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line-control/80 bg-elevated/95 px-5 py-4 shadow-[var(--surface-shadow-raised)] lg:min-h-[142px] lg:w-[196px] lg:flex-none lg:backdrop-blur-sm ${
        index === 0
          ? 'z-10 lg:-rotate-3 lg:translate-y-5'
          : 'lg:-ml-7 lg:rotate-2 lg:-translate-y-1'
      }`}
    >
      {geometry && (
        <svg
          aria-hidden
          viewBox="0 0 180 64"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-3 bottom-2 h-[74px] w-auto"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-data-1))" stopOpacity="0.24" />
              <stop offset="100%" stopColor="rgb(var(--color-data-1))" stopOpacity="0.015" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="rgb(var(--color-data-1))"
            strokeOpacity="0.32"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div className="relative z-10">
        <div className="truncate font-mono text-[9px] font-medium uppercase leading-4 tracking-[0.18em] text-tertiary">
          {metric.label}
        </div>
        <div className="mt-5 whitespace-nowrap font-display text-[32px] font-light leading-none tracking-[-0.045em] tabular-nums text-main sm:text-[38px]">
          {metric.value}
        </div>
      </div>
    </article>
  )
}

function trendGeometry(trend: number[] | undefined) {
  if (!trend || trend.length < 2) return null

  const low = Math.min(...trend)
  const high = Math.max(...trend)
  const range = high - low || 1
  const points = trend.map((value, index) => ({
    x: (index / (trend.length - 1)) * 180,
    y: 55 - ((value - low) / range) * 42,
  }))
  const line = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  return { line, area: `${line} L180 64 L0 64 Z` }
}

export function OutcomeCounters({
  metrics,
  working,
}: {
  metrics: readonly Counter[]
  working: boolean
}) {
  if (metrics.length === 0) return null

  return (
    <section className="relative border-t border-line-control">
      {working && (
        <span
          role="status"
          aria-label={tKey('morningPaper.statusWorking')}
          title={tKey('morningPaper.statusWorking')}
          className="absolute -top-[5px] right-0 flex size-2.5 items-center justify-center rounded-full bg-main"
        >
          <span
            aria-hidden
            className="size-1.5 animate-pulse rounded-full bg-status-success motion-reduce:animate-none"
          />
        </span>
      )}
      <div className="matrix-counters">
        {metrics.slice(0, 4).map((metric) => (
          <div key={metric.id} className="matrix-counter min-w-0">
            <div className="whitespace-nowrap font-display text-[48px] font-light leading-none tracking-[-0.055em] tabular-nums text-main sm:text-[52px] lg:text-[60px] xl:text-[64px]">
              {metric.value}
            </div>
            <div className="mt-3 line-clamp-2 font-mono text-[11px] font-medium uppercase leading-[1.5] tracking-[0.16em] text-tertiary">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
