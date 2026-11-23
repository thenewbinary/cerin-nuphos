import { Newspaper } from 'lucide-react'

import { tKey } from '../../i18n/index.ts'
import { MorningPaperView } from '../../views/morning-paper/MorningPaperView.tsx'

import type { ScopeRenderContext } from './context.ts'

export function renderTeamMorningPaperPage(ctx: ScopeRenderContext): React.ReactNode | undefined {
  const { scope, active, currentUserId, teamName, onOpenConversation, renderPage } = ctx

  if (scope.kind !== 'team' || active !== 'team.morning-paper') return undefined

  return renderPage(
    'team.morning-paper',
    tKey('morningPaper.title'),
    <Newspaper className="w-3.5 h-3.5 text-tertiary" strokeWidth={1.8} />,
    <MorningPaperView
      key={`${currentUserId}:${scope.teamId}`}
      teamId={scope.teamId}
      teamName={teamName}
      currentUserId={currentUserId}
      onOpenConversation={onOpenConversation}
    />,
  )
}
