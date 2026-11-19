import { ChartNoAxesColumn } from 'lucide-react'

import { CerinDashboardsView } from '../../dashboards/CerinDashboardsView'
import { t } from '../../i18n'
import { TeamHomeView } from '../../views/TeamHomeView'

import type { ScopeRenderContext } from './context'

export function renderTeamHomePage(ctx: ScopeRenderContext) {
  return ctx.renderPage(
    'team.home',
    t('Stats'),
    <ChartNoAxesColumn className="size-3.5 text-tertiary" strokeWidth={1.8} />,
    <TeamHomeView
      customBoardOpen={Boolean(ctx.cerinDashboard)}
      customBoards={
        <CerinDashboardsView
          embedded
          teamId={ctx.scope.teamId}
          refreshKey={ctx.refreshKey}
          filter=""
          onCount={ctx.onCount}
          onLoading={ctx.onLoading}
          onOpenAgentChat={ctx.onOpenAgentChat}
          openDashboardId={ctx.cerinDashboard?.dashboardId ?? null}
          viewRange={ctx.cerinDashboard?.viewRange}
          onDashboardOpened={ctx.setCerinDashboard}
          onDashboardsChange={ctx.setCerinDashboards}
        />
      }
      teamId={ctx.scope.teamId}
      refreshKey={ctx.refreshKey}
      isTeamAdmin={ctx.isTeamAdmin}
      onOpenConversation={ctx.onOpenConversation}
      onOpenLink={ctx.onOpenNodeLink}
    />,
  )
}
