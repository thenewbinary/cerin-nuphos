import { toast } from '../../components/ui/toast.ts'
import { t } from '../../i18n/index.ts'

import { ANSWER_UNDO_MS, holdAnswer } from './useInbox.ts'

import type { InboxQuestion } from './inboxItems.ts'
import type { HeldReply } from './useInbox.ts'

export function answerInboxWithUndo(
  teamId: string,
  row: InboxQuestion,
  reply: HeldReply,
  onUndo?: () => void,
) {
  const dismissed = 'dismissed' in reply
  const undo = holdAnswer(teamId, row.conversation.sessionId, row.request.id, reply, (reason) =>
    toast.error(
      dismissed ? t('Could not dismiss question') : t('Could not send your answer'),
      reason,
    ),
  )

  toast.success(
    dismissed
      ? t('Dismissed')
      : t('Answered “{answer}”', {
          answer: reply.choices?.join(', ') ?? reply.text ?? row.request.question,
        }),
    undefined,
    {
      timeoutMs: ANSWER_UNDO_MS,
      dedupe: false,
      action: {
        label: t('Undo'),
        onClick: () => {
          if (undo()) onUndo?.()
        },
      },
    },
  )
}
