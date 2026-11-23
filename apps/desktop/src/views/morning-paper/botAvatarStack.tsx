import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'

import type { AgentConversation } from '../../api/agent-types.ts'

export function BotAvatarStack({
  bots,
  max = 3,
  size = 24,
}: {
  bots: readonly AgentConversation[]
  max?: number
  size?: number
}) {
  const shown = bots.slice(0, max)

  return (
    <span aria-hidden className="inline-flex min-w-0 items-center">
      {shown.map((bot, index) => (
        <span
          key={bot.sessionId}
          className="relative inline-flex shrink-0 rounded-full border-2 border-surface-raised bg-surface-raised"
          style={{ marginLeft: index === 0 ? 0 : -size * 0.3, zIndex: shown.length - index }}
        >
          <AgentAvatar
            agentId={bot.sessionId}
            avatar={bot.avatar}
            avatarBackground={bot.avatarBackground}
            provider={bot.agentRuntime}
            size={size}
            showBadge={false}
          />
        </span>
      ))}
      {bots.length > shown.length && (
        <span className="ml-1.5 font-mono text-[10px] font-medium tabular-nums text-tertiary">
          +{bots.length - shown.length}
        </span>
      )}
    </span>
  )
}
