import { ArrowUpRight, CheckCircle2 } from 'lucide-react'

import { AgentAvatar } from '../../components/agent/AgentAvatar.tsx'
import { t } from '../../i18n/index.ts'
import { botAbove } from '../inbox/inboxItems.ts'

import type { ProofItem } from './morningPaperOutcomes.ts'
import type { AgentConversation } from '../../api/agent-types.ts'

const CARD =
  'dashboard-proof-card group relative min-w-0 rounded-[24px] text-left outline-none backdrop-blur-xl transition-[border-color,transform] duration-150 hover:border-line-focus/60 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sheet motion-safe:active:scale-[0.96]'
const ARROW =
  'size-3.5 shrink-0 text-tertiary transition-[color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-main motion-reduce:transition-none'

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
    <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) =>
        card.image ? (
          <button
            key={card.id}
            type="button"
            aria-label={card.caption}
            title={card.caption}
            onClick={() => onOpenConversation(card.sessionId)}
            className={`${CARD} aspect-[16/10] overflow-hidden`}
          >
            <img
              src={card.image}
              alt=""
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
            <span className="dashboard-proof-caption absolute inset-x-2 bottom-2 flex h-11 min-w-0 items-center gap-2.5 rounded-[18px] px-3">
              {card.bot && <ProofAvatar bot={card.bot} size={20} />}
              <span className="line-clamp-1 min-w-0 flex-1 break-all text-[10px] font-medium uppercase leading-4 tracking-[0.14em] text-secondary">
                {card.caption}
              </span>
              <ArrowUpRight aria-hidden className={ARROW} strokeWidth={1.5} />
            </span>
          </button>
        ) : (
          <button
            key={card.id}
            type="button"
            aria-label={card.caption}
            title={card.caption}
            onClick={() => onOpenConversation(card.sessionId)}
            className={`${CARD} flex min-h-[124px] flex-col justify-between gap-5 p-4`}
          >
            <span className="flex w-full min-w-0 items-center gap-2">
              {card.bot && <ProofAvatar bot={card.bot} size={24} />}
              <CheckCircle2
                aria-hidden
                className="size-4 shrink-0 text-status-success"
                strokeWidth={1.6}
              />
              <ArrowUpRight aria-hidden className={`${ARROW} ml-auto`} strokeWidth={1.5} />
            </span>
            <span className="line-clamp-2 w-full min-w-0 break-words text-[14px] font-medium leading-[1.4] tracking-[-0.005em] text-main">
              {card.caption}
            </span>
          </button>
        ),
      )}
    </section>
  )
}

function ProofAvatar({ bot, size }: { bot: AgentConversation; size: number }) {
  return (
    <AgentAvatar
      agentId={bot.sessionId}
      avatar={bot.avatar}
      avatarBackground={bot.avatarBackground}
      provider={bot.agentRuntime}
      size={size}
      showBadge={false}
    />
  )
}
