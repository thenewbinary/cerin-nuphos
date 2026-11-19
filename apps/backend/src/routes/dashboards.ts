import { Hono } from 'hono'

import { registerDashboardAlertRoutes } from '@/routes/dashboards/alerts'
import { registerDashboardRoutes } from '@/routes/dashboards/dashboards'
import { registerDashboardExecutionRoutes } from '@/routes/dashboards/execution'
import { registerDashboardPanelRoutes } from '@/routes/dashboards/panels'

import type { TeamAuthVariables } from '@/middleware/auth'

export {
  appendScriptVersion,
  serializeDashboard,
  serializePanel,
  serializeSnapshot,
} from '@/routes/dashboards/serialize'

export const cerinDashboardsRoutes = new Hono<{ Variables: TeamAuthVariables }>()

registerDashboardRoutes(cerinDashboardsRoutes)
registerDashboardPanelRoutes(cerinDashboardsRoutes)
registerDashboardExecutionRoutes(cerinDashboardsRoutes)
registerDashboardAlertRoutes(cerinDashboardsRoutes)
