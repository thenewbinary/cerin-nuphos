import { useMemo } from 'react'

import { api } from '../../api'

import { resolveChatExternalLink } from './chatExternalLink'
import { buildChatLinkMenuActions } from './chatLinkMenuActions'

import type { ChatLinkMenuDeps } from './chatLinkMenuActions'
import type { ChatLinkMenuActions } from '../../components/agent/chatLinkMenuContext'

export function useChatLinkMenuActions({
  teamId,
  resolveExternalLink = resolveExternalLinkFromApi,
  copyLink,
  openExternalLink,
  openCerinLinkFromChat,
  openCerinLinkInNewTab,
}: ChatLinkMenuDeps): ChatLinkMenuActions {
  return useMemo(
    () =>
      buildChatLinkMenuActions({
        teamId,
        resolveExternalLink,
        copyLink,
        openExternalLink,
        openCerinLinkFromChat,
        openCerinLinkInNewTab,
      }),
    [
      copyLink,
      openExternalLink,
      openCerinLinkFromChat,
      openCerinLinkInNewTab,
      resolveExternalLink,
      teamId,
    ],
  )
}

function resolveExternalLinkFromApi(href: string): Promise<string> {
  return resolveChatExternalLink(href, {
    getLinearIssue: api.atlasGetLinearIssue,
    listLinearTeams: api.atlasListLinearTeams,
  })
}
