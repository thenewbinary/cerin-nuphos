import { RefreshCw } from 'lucide-react'
import { useId } from 'react'

import { relativeTimeFromNow } from '../../components/agent/panel/textUtils.ts'
import { t, tKey } from '../../i18n/index.ts'

import { LeadGlow } from './activityGlow.tsx'
import { smoothPath } from './activityPath.ts'
import { BotAvatarStack } from './botAvatarStack.tsx'

import type { FinishedPerDay } from './morningPaperItems.ts'
import type { AgentConversation } from '../../api/agent-types.ts'

const WIDTH = 1000
const HEIGHT = 260
const CHART_LEFT = 0
const CHART_RIGHT = 1000
const CHART_TOP = 40
const CHART_BOTTOM = 204
const LABEL_Y = 236
const CHIP_GAP = 42
const LEADER = 22

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
    <section className="dashboard-glass dashboard-panel overflow-hidden">
      <header className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="dashboard-eyebrow">{t('Activity')}</p>
          <h2 className="dashboard-title">{tKey('morningPaper.finishedTitle')}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12px] text-tertiary">
          <span className="hidden whitespace-nowrap sm:inline">
            {t('Updated')} {relativeTimeFromNow(new Date(updatedAt).toISOString())}
          </span>
          <button
            type="button"
            aria-label={t('Refresh')}
            title={t('Refresh')}
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-line-control/70 bg-surface-raised/40 text-secondary outline-none transition-[background-color,color,opacity] hover:bg-state-hover hover:text-main disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <RefreshCw
              aria-hidden
              className={`size-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
              strokeWidth={1.5}
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
  const glowId = `dashboard-activity-${useId().replaceAll(':', '')}`
  const lead = geometries[0]

  return (
    <div className="relative mt-6">
      <div className="pointer-events-none relative z-10 w-fit">
        <div className="dashboard-eyebrow">{t('Tasks')}</div>
        <div className="dashboard-headline mt-2">{activity.total.toLocaleString()}</div>
      </div>
      <div className={`dashboard-chart -mt-4 ${lines[0].bot ? '' : 'dashboard-chart-plain'}`}>
        <div className="dashboard-chart-plot">
          <svg
            role="img"
            aria-label={`${String(activity.total)} ${tKey('morningPaper.finishedTitle')}`}
            viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            {[CHART_TOP, (CHART_TOP + CHART_BOTTOM) / 2, CHART_BOTTOM].map((y) => (
              <line
                key={y}
                x1={CHART_LEFT}
                x2={CHART_RIGHT}
                y1={y}
                y2={y}
                stroke="rgb(var(--color-text-tertiary))"
                strokeOpacity={y === CHART_BOTTOM ? 0.2 : 0.1}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {lead.line.total > 0 && (
              <LeadGlow
                id={glowId}
                d={`${lead.d} L${String(CHART_RIGHT)} ${String(CHART_BOTTOM)} L${String(CHART_LEFT)} ${String(CHART_BOTTOM)} Z`}
              />
            )}
            {[...geometries].reverse().map(({ line, d }) => {
              const leading = line.id === geometries[0].line.id
              const index = geometries.findIndex((geometry) => geometry.line.id === line.id)

              return (
                <path
                  key={line.id}
                  d={d}
                  fill="none"
                  stroke={
                    leading ? 'rgb(var(--color-status-warning))' : 'rgb(var(--color-text-tertiary))'
                  }
                  strokeOpacity={leading ? 1 : 0.7 - index * 0.14}
                  strokeWidth={leading ? 2.6 : 2.2}
                  strokeDasharray="9 9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {activity.days.map((day, index) => {
              const x =
                CHART_LEFT +
                (index / Math.max(1, activity.days.length - 1)) * (CHART_RIGHT - CHART_LEFT)

              return (
                <span
                  key={day}
                  className="absolute whitespace-nowrap text-[11px] leading-none text-tertiary"
                  style={{
                    left: `${String((x / WIDTH) * 100)}%`,
                    top: `${String((LABEL_Y / HEIGHT) * 100)}%`,
                    transform: dayAnchor(index, activity.days.length),
                  }}
                >
                  {dayFormat.format(day)}
                </span>
              )
            })}
            {geometries.map(({ line, points }, index) => {
              const end = points.at(-1)

              if (!end) return null

              return (
                <span
                  key={line.id}
                  className={`dashboard-chart-end ${index === 0 ? 'text-status-warning' : 'text-tertiary'}`}
                  style={{
                    left: `${String((end.x / WIDTH) * 100)}%`,
                    top: `${String((end.y / HEIGHT) * 100)}%`,
                  }}
                />
              )
            })}
          </div>
        </div>
        <svg
          aria-hidden
          viewBox={`0 0 ${String(LEADER)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          className="dashboard-chart-leaders"
        >
          {geometries.map(({ line, points }, index) => (
            <line
              key={line.id}
              x1="0"
              x2={LEADER}
              y1={points.at(-1)?.y ?? CHART_BOTTOM}
              y2={chipPositions.get(line.id) ?? CHART_BOTTOM}
              stroke={seriesColor(index)}
              strokeOpacity={index === 0 ? 0.7 : 0.5}
              strokeWidth="1"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {geometries.map(({ line }, index) => (
          <div
            key={line.id}
            className="dashboard-chart-chip"
            style={{
              top: `${String(((chipPositions.get(line.id) ?? CHART_BOTTOM) / HEIGHT) * 100)}%`,
            }}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: seriesColor(index) }}
            />
            {line.bot && <BotAvatarStack bots={[line.bot]} size={22} />}
            <span className="min-w-0">
              {line.bot?.title && (
                <span className="dashboard-chart-chip-label truncate text-[10px] leading-3 text-tertiary">
                  {line.bot.title}
                </span>
              )}
              <span className="block truncate text-[14px] font-medium leading-[18px] tabular-nums text-main">
                {line.total.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function seriesColor(index: number): string {
  return index === 0 ? 'rgb(var(--color-status-warning))' : 'rgb(var(--color-text-tertiary))'
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
      x: CHART_LEFT + (index / Math.max(1, line.counts.length - 1)) * (CHART_RIGHT - CHART_LEFT),
      y: CHART_BOTTOM - (count / maximum) * (CHART_BOTTOM - CHART_TOP),
    }))

    return { line, points, d: smoothPath(points) }
  })
}

function dayAnchor(
  index: number,
  count: number,
): 'none' | 'translateX(-50%)' | 'translateX(-100%)' {
  if (index === 0) return 'none'
  if (index === count - 1) return 'translateX(-100%)'

  return 'translateX(-50%)'
}

function spreadChips(lines: readonly { id: string; y: number }[]): Map<string, number> {
  const sorted = [...lines].sort((a, b) => a.y - b.y)
  const positions: number[] = []

  sorted.forEach((line, index) => {
    positions[index] = Math.max(line.y, (positions[index - 1] ?? -Infinity) + CHIP_GAP)
  })

  for (let index = positions.length - 1; index >= 0; index -= 1) {
    const ceiling = index === positions.length - 1 ? CHART_BOTTOM : positions[index + 1] - CHIP_GAP

    positions[index] = Math.min(positions[index], ceiling)
  }

  return new Map(sorted.map((line, index) => [line.id, positions[index]]))
}
