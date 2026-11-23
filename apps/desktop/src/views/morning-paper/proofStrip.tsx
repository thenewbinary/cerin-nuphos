import { ArrowUpRight, CheckCircle2 } from 'lucide-react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { t } from '../../i18n/index.ts'
import { botAbove } from '../inbox/inboxItems.ts'

import type { ProofItem } from './morningPaperOutcomes.ts'
import type { AgentConversation } from '../../api/agent-types.ts'

type ProofCard = {
  id: string
  sessionId: string
  caption: string
  image?: string
  bot?: AgentConversation
}

export function ProofStrip({
  proof,
  finished,
  conversations,
  isBot,
  onOpenConversation,
}: {
  proof: readonly ProofItem[]
  finished: readonly AgentConversation[]
  conversations: readonly AgentConversation[]
  isBot: (conversation: AgentConversation) => boolean
  onOpenConversation: (sessionId: string) => void
}) {
  const byId = new Map(conversations.map((conversation) => [conversation.sessionId, conversation]))
  const producer = (sessionId: string, botSessionId?: string) => {
    const explicit = botSessionId ? byId.get(botSessionId) : undefined

    if (explicit) return explicit
    const conversation = byId.get(sessionId)

    if (!conversation) return

    return isBot(conversation) ? conversation : botAbove(conversation, byId, isBot)
  }
  const cards: ProofCard[] =
    proof.length > 0
      ? proof.slice(0, 4).map((item) => ({
          id: item.id,
          sessionId: item.sessionId,
          caption: item.caption,
          image: item.image,
          bot: producer(item.sessionId, item.botSessionId),
        }))
      : finished.slice(0, 4).map((conversation) => ({
          id: conversation.sessionId,
          sessionId: conversation.sessionId,
          caption: conversation.title || conversation.firstMessage || t('Untitled task'),
          bot: producer(conversation.sessionId),
        }))

  if (cards.length === 0) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          aria-label={card.caption}
          title={card.caption}
          onClick={() => onOpenConversation(card.sessionId)}
          className="group relative aspect-[16/10] min-w-0 overflow-hidden rounded-[22px] border border-line-control/80 bg-surface-raised/60 text-left shadow-[var(--surface-shadow)] outline-none backdrop-blur-xl transition-[border-color,transform] duration-150 hover:border-line-focus/60 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sheet motion-safe:active:scale-[0.96]"
        >
          {card.image ? (
            <img
              src={card.image}
              alt=""
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-data-1/10 pb-10">
              <span className="flex size-20 items-center justify-center rounded-full border border-data-1/20 bg-data-1/10 backdrop-blur-md">
                {card.bot ? (
                  <AgentAvatar
                    agentId={card.bot.sessionId}
                    avatar={card.bot.avatar}
                    avatarBackground={card.bot.avatarBackground}
                    provider={card.bot.agentRuntime}
                    size={72}
                    showBadge={false}
                  />
                ) : (
                  <CheckCircle2 aria-hidden className="size-12 text-data-1" strokeWidth={1.4} />
                )}
              </span>
            </span>
          )}
          <span className="absolute inset-x-2 bottom-2 flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-line-control/60 bg-surface-sheet/80 px-3 shadow-[var(--surface-shadow)] backdrop-blur-xl">
            {card.bot && (
              <AgentAvatar
                agentId={card.bot.sessionId}
                avatar={card.bot.avatar}
                avatarBackground={card.bot.avatarBackground}
                provider={card.bot.agentRuntime}
                size={20}
                showBadge={false}
              />
            )}
            <span className="line-clamp-1 min-w-0 flex-1 break-all font-mono text-[9px] font-medium uppercase leading-4 tracking-[0.12em] text-secondary">
              {card.caption}
            </span>
            <ArrowUpRight
              aria-hidden
              className="size-3.5 shrink-0 text-tertiary transition-[color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-main motion-reduce:transition-none"
              strokeWidth={1.5}
            />
          </span>
        </button>
      ))}
    </section>
  )
}
