import { Activity, CircleAlert } from 'lucide-react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { t, tKey } from '../../i18n/index.ts'

import type { FlowGeometry, FlowPoint } from './matrixFlowGeometry.ts'
import type { BotActivity, BotActivityStatus, FlowModel } from './morningPaperItems.ts'
import type { AgentConversation } from '../../api/agent-types.ts'
import type { CSSProperties, Ref } from 'react'

const STATUS_LABELS = {
  working: 'morningPaper.statusWorking',
  waiting: 'morningPaper.statusWaiting',
  finished: 'morningPaper.statusFinished',
  idle: 'morningPaper.statusIdle',
} as const

const STATUS_DOTS: Record<BotActivityStatus, string> = {
  working: 'bg-data-1',
  waiting: 'bg-status-warning',
  finished: 'bg-status-success',
  idle: 'bg-line-control',
}

const STATUS_RINGS: Record<BotActivityStatus, string> = {
  working: 'border-data-1 animate-pulse motion-reduce:animate-none',
  waiting: 'border-status-warning/60',
  finished: 'border-status-success/50',
  idle: 'border-line-control',
}

export function FlowLines({ geometry }: { geometry: FlowGeometry }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${String(geometry.width)} ${String(geometry.height)}`}
      className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
    >
      {geometry.edges.map((edge) => (
        <path
          key={edge.id}
          d={edge.d}
          fill="none"
          stroke="color-mix(in srgb, rgb(var(--color-text-tertiary)) 52%, rgb(var(--color-line-control)))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {geometry.edges
        .filter((edge) => edge.working)
        .map((edge) => (
          <path
            key={`${edge.id}-signal`}
            d={edge.d}
            className="matrix-flow-signal"
            fill="none"
            stroke="rgb(var(--color-data-1))"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      {geometry.dots.map((dot) => (
        <circle
          key={dot.id}
          cx={dot.x}
          cy={dot.y}
          r="2.25"
          fill={
            dot.working
              ? 'rgb(var(--color-data-1))'
              : 'color-mix(in srgb, rgb(var(--color-text-tertiary)) 52%, rgb(var(--color-line-control)))'
          }
        />
      ))}
    </svg>
  )
}

export function LeadNode({
  activity,
  nodeRef,
  onOpen,
}: {
  activity: BotActivity
  nodeRef: Ref<HTMLButtonElement>
  onOpen: () => void
}) {
  const name = flowBotName(activity.bot)

  return (
    <button
      ref={nodeRef}
      type="button"
      aria-label={`${name}, ${tKey(STATUS_LABELS[activity.status])}`}
      title={tKey(STATUS_LABELS[activity.status])}
      onClick={onOpen}
      className="matrix-flow-lead min-h-[124px] rounded-2xl border border-action-primary matrix-inverse-panel p-5 text-left text-inverse shadow-[var(--surface-shadow-raised)] outline-none transition-[opacity,transform] duration-150 hover:opacity-95 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sheet"
    >
      <span className="flex h-full flex-col justify-between gap-5">
        <StatusAvatar activity={activity} size={48} inverted />
        <span className="line-clamp-1 break-all font-display text-[20px] font-medium leading-6 tracking-[-0.025em]">
          {name}
        </span>
      </span>
    </button>
  )
}

export function DepartmentNode({
  department,
  index,
  count,
  nodeRef,
  onOpen,
}: {
  department: FlowModel['departments'][number]
  index: number
  count: number
  nodeRef: Ref<HTMLButtonElement>
  onOpen: () => void
}) {
  const { activity, taskCount } = department
  const name = flowBotName(activity.bot)
  const layers = 1 + Math.min(taskCount, 3)
  const style = {
    left: `${String(((index + 0.5) / count) * 100)}%`,
    width: `min(176px, calc(${String(100 / count)}% - 12px))`,
  } satisfies CSSProperties

  return (
    <div className="matrix-department" style={style}>
      {Array.from({ length: layers }, (_, layer) => {
        const offset = (layers - layer) * 6

        return (
          <span
            key={layer}
            aria-hidden
            className="matrix-department-layer"
            style={{
              transform: `translate(${String(offset)}px, -${String(offset)}px)`,
              zIndex: layer,
            }}
          />
        )
      })}
      <button
        ref={nodeRef}
        type="button"
        aria-label={`${name}, ${tKey(STATUS_LABELS[activity.status])}`}
        title={tKey(STATUS_LABELS[activity.status])}
        onClick={onOpen}
        className="absolute inset-x-0 bottom-0 top-7 z-10 flex min-w-0 flex-col justify-between rounded-xl border border-data-1/25 bg-surface-sheet/95 p-4 text-left shadow-[var(--surface-shadow)] outline-none transition-[background-color,border-color,transform] duration-150 hover:bg-state-hover active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sheet"
      >
        <StatusAvatar activity={activity} size={48} />
        <span className="w-full min-w-0 truncate font-display text-[14px] font-semibold leading-5 text-main">
          {name}
        </span>
      </button>
    </div>
  )
}

function StatusAvatar({
  activity,
  size,
  inverted = false,
}: {
  activity: BotActivity
  size: number
  inverted?: boolean
}) {
  return (
    <span className="relative inline-flex w-fit shrink-0 rounded-full">
      <span
        aria-hidden
        className={`absolute -inset-1 rounded-full border ${STATUS_RINGS[activity.status]}`}
      />
      <AgentAvatar
        agentId={activity.bot.sessionId}
        avatar={activity.bot.avatar}
        avatarBackground={activity.bot.avatarBackground}
        provider={activity.bot.agentRuntime}
        size={size}
        showBadge={false}
      />
      <span
        aria-hidden
        className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 ${STATUS_DOTS[activity.status]} ${
          inverted ? 'border-action-primary' : 'border-surface-sheet'
        }`}
      />
    </span>
  )
}

export function EdgePill({
  position,
  icon,
  count,
}: {
  position: FlowPoint | undefined
  icon: 'activity' | 'decisions'
  count: number
}) {
  if (!position) return null

  const Icon = icon === 'activity' ? Activity : CircleAlert

  return (
    <span
      aria-hidden
      className="absolute z-20 flex h-7 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 rounded-full matrix-inverse-panel px-2.5 font-mono text-[12px] font-medium tabular-nums text-inverse shadow-[var(--surface-shadow)]"
      style={{ left: position.x, top: position.y }}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
      {count}
    </span>
  )
}

function flowBotName(conversation: AgentConversation): string {
  return conversation.title || conversation.firstMessage || t('Untitled task')
}
