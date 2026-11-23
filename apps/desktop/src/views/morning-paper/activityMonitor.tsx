import { RefreshCw } from 'lucide-react'

import { relativeTimeFromNow } from '../../components/agent/panel/textUtils.ts'
import { t, tKey } from '../../i18n/index.ts'

import { smoothPath } from './activityPath.ts'
import { BotAvatarStack } from './botAvatarStack.tsx'

import type { FinishedPerDay } from './morningPaperItems.ts'
import type { AgentConversation } from '../../api/agent-types.ts'

const WIDTH = 1000
const HEIGHT = 240
const CHART_LEFT = 20
const CHART_RIGHT = 900
const CHART_TOP = 48
const CHART_BOTTOM = 194

type ChartLine = {
  id: string
  bot?: AgentConversation
  counts: number[]
  total: number
}

export function ActivityMonitor({
  activity,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  activity: FinishedPerDay
  updatedAt: number
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <section className="dashboard-glass dashboard-panel overflow-hidden p-5 sm:p-6">
      <header className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tertiary">
            {t('Activity')}
          </p>
          <h2 className="mt-2 font-display text-[30px] font-light leading-none tracking-[-0.04em] text-main sm:text-[34px]">
            {tKey('morningPaper.finishedTitle')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 pt-1 text-[10px] text-tertiary">
          <span className="hidden whitespace-nowrap sm:inline">
            {t('Updated')} {relativeTimeFromNow(new Date(updatedAt).toISOString())}
          </span>
          <button
            type="button"
            aria-label={t('Refresh')}
            title={t('Refresh')}
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-line-control/80 bg-surface-sheet/40 text-secondary outline-none transition-[background-color,color,opacity] hover:bg-state-hover hover:text-main disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <RefreshCw
              aria-hidden
              className={`size-3.5 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
              strokeWidth={1.6}
            />
          </button>
        </div>
      </header>
      <ActivityChart activity={activity} />
    </section>
  )
}

function ActivityChart({ activity }: { activity: FinishedPerDay }) {
  const lines = chartLines(activity)
  const geometries = chartGeometries(lines)
  const chipPositions = spreadChips(
    geometries.map(({ line, points }) => ({ id: line.id, y: points.at(-1)?.y ?? CHART_BOTTOM })),
  )
  const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

  return (
    <div className="relative mt-4">
      <div className="pointer-events-none relative z-10 w-fit">
        <div className="text-[11px] text-tertiary">{t('Tasks')}</div>
        <div className="mt-1 font-display text-[64px] font-extralight leading-none tracking-[-0.055em] tabular-nums text-main sm:text-[72px]">
          {activity.total.toLocaleString()}
        </div>
      </div>
      <div className="relative -mt-5 h-[240px] min-w-0 w-full sm:-mt-8">
        <svg
          role="img"
          aria-label={`${String(activity.total)} ${tKey('morningPaper.finishedTitle')}`}
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {[CHART_TOP, 96, 145, CHART_BOTTOM].map((y) => (
            <line
              key={y}
              x1={CHART_LEFT}
              x2="960"
              y1={y}
              y2={y}
              stroke="rgb(var(--color-line-control))"
              strokeOpacity="0.48"
              strokeWidth="1"
              strokeDasharray="2 8"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {geometries.map(({ line, points, d }, index) => (
            <g key={line.id}>
              <path
                d={d}
                fill="none"
                stroke={
                  index === 0
                    ? 'rgb(var(--color-status-warning))'
                    : 'rgb(var(--color-text-tertiary))'
                }
                strokeOpacity={index === 0 ? 0.95 : 0.52 - index * 0.07}
                strokeWidth={index === 0 ? 1.8 : 1.4}
                strokeDasharray={index === 0 ? '7 7' : '6 8'}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((point, pointIndex) => (
                <circle
                  key={pointIndex}
                  cx={point.x}
                  cy={point.y}
                  r={index === 0 ? 2.2 : 1.7}
                  fill={
                    index === 0
                      ? 'rgb(var(--color-status-warning))'
                      : 'rgb(var(--color-text-tertiary))'
                  }
                  fillOpacity={index === 0 ? 0.9 : 0.45}
                />
              ))}
            </g>
          ))}
        </svg>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {activity.days.map((day, index) => {
            const x =
              CHART_LEFT +
              (index / Math.max(1, activity.days.length - 1)) * (CHART_RIGHT - CHART_LEFT)

            return (
              <span
                key={day}
                className="absolute top-[90%] whitespace-nowrap font-mono text-[10px] leading-none text-tertiary/80"
                style={{
                  left: `${String((x / WIDTH) * 100)}%`,
                  transform: dayAnchor(index, activity.days.length),
                }}
              >
                {dayFormat.format(day)}
              </span>
            )
          })}
        </div>
        {geometries.map(({ line }, index) => (
          <div
            key={line.id}
            className="dashboard-chart-chip absolute right-0 flex h-8 max-w-[116px] -translate-y-1/2 items-center gap-1.5 rounded-full px-2"
            style={{
              top: `${String(((chipPositions.get(line.id) ?? CHART_BOTTOM) / HEIGHT) * 100)}%`,
            }}
          >
            {line.bot ? (
              <BotAvatarStack bots={[line.bot]} size={18} />
            ) : (
              <span className="inline-flex size-[18px] items-center justify-center">
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${index === 0 ? 'bg-status-warning' : 'bg-text-tertiary'}`}
                />
              </span>
            )}
            <span className="truncate font-mono text-[10px] font-medium tabular-nums text-secondary">
              {line.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function chartLines(activity: FinishedPerDay): ChartLine[] {
  const bots = activity.bots.slice(0, 3)

  if (bots.length === 0) {
    return [{ id: 'total', counts: activity.totals, total: activity.total }]
  }

  return bots.map((series) => ({
    id: series.bot.sessionId,
    bot: series.bot,
    counts: series.counts,
    total: series.total,
  }))
}

function chartGeometries(lines: readonly ChartLine[]) {
  const maximum = Math.max(1, ...lines.flatMap((line) => line.counts))

  return lines.map((line) => {
    const points = line.counts.map((count, index) => ({
      x:
        CHART_LEFT +
        (index / Math.max(1, line.counts.length - 1)) * (CHART_RIGHT - CHART_LEFT),
      y: CHART_BOTTOM - (count / maximum) * (CHART_BOTTOM - CHART_TOP),
    }))

    return { line, points, d: smoothPath(points) }
  })
}

function dayAnchor(index: number, count: number): 'none' | 'translateX(-50%)' | 'translateX(-100%)' {
  if (index === 0) return 'none'
  if (index === count - 1) return 'translateX(-100%)'

  return 'translateX(-50%)'
}

function spreadChips(lines: readonly { id: string; y: number }[]): Map<string, number> {
  const sorted = [...lines].sort((a, b) => a.y - b.y)
  const positions: number[] = []

  sorted.forEach((line, index) => {
    positions[index] = Math.max(line.y, (positions[index - 1] ?? -Infinity) + 38)
  })
  const overflow = Math.max(0, (positions.at(-1) ?? CHART_BOTTOM) - CHART_BOTTOM)

  return new Map(sorted.map((line, index) => [line.id, positions[index] - overflow]))
}
