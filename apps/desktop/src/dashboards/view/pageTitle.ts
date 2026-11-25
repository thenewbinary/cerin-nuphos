import { t } from '../../i18n/index.ts'

import type { CerinDashboardRef } from '../../lib/appRoutes'

export const DASHBOARDS_TITLE = t('Custom boards')

export function dashboardsPageTitle({
  cerinDashboard,
  cerinDashboards,
  restoredTitle,
}: {
  cerinDashboard: CerinDashboardRef | null
  cerinDashboards: { id: string; name: string }[] | undefined
  restoredTitle: string | undefined
}): string {
  if (!cerinDashboard) return DASHBOARDS_TITLE

  const listed = cerinDashboards?.find((d) => d.id === cerinDashboard.dashboardId)

  if (listed) return listed.name
  // A restored ref carries the name from when it was pushed (or a URL
  // placeholder); the title persisted with the tab is fresher until the list loads.
  if (cerinDashboards === undefined && restoredTitle) return restoredTitle

  return cerinDashboard.dashboardName
}
