import { Hono } from 'hono'

import { registerSlackCommandRoutes } from '@/routes/slack/commands'
import { registerSlackEventRoutes } from '@/routes/slack/events'
import { registerSlackInteractionRoutes } from '@/routes/slack/interactions'
import { registerSlackMappingRoutes } from '@/routes/slack/mappings'
import { registerSlackUserMappingRoutes } from '@/routes/slack/user-mappings'

import type { AuthVariables } from '@/middleware/auth'

export const slackRoutes = new Hono<{ Variables: AuthVariables }>()

registerSlackCommandRoutes(slackRoutes)
registerSlackEventRoutes(slackRoutes)
registerSlackInteractionRoutes(slackRoutes)
registerSlackMappingRoutes(slackRoutes)
registerSlackUserMappingRoutes(slackRoutes)

export { handleAppMention } from '@/routes/slack/mention'
export { beginCerinSlackTurn } from '@/routes/slack/cerin-turn'
export type { CerinSlackTurnDelivery, CerinSlackTurnOutcome } from '@/routes/slack/cerin-turn'
export { handlePermissionGrantInteraction } from '@/routes/slack/permission-decide'
export { handleToolApprovalInteraction } from '@/routes/slack/tool-approval-decide'
export { handleThreadMessage } from '@/routes/slack/thread-message'
