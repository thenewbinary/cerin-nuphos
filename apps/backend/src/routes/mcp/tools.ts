import { getMyTeams } from '@/lib/identity'
import { getCapabilities, toolResult } from '@/lib/mcp/protocol'
import { cerinAsk } from '@/routes/mcp/ask'
import { cerinCheck } from '@/routes/mcp/check'
import {
  cerinArchiveSession,
  cerinEvents,
  cerinListQueue,
  cerinListRuntimes,
  cerinRemoveQueued,
  cerinStop,
} from '@/routes/mcp/control'
import { cerinListCredentials, cerinUpdateCredentials } from '@/routes/mcp/credentials'
import { cerinFiles } from '@/routes/mcp/files'
import { cerinFindPrSessions } from '@/routes/mcp/resources'
import { cerinListSessions, cerinUpdateSession } from '@/routes/mcp/sessions'
import { cerinWebhooks } from '@/routes/mcp/webhooks'

import type { ToolHandler, ToolResult } from '@/lib/mcp/protocol'
import type { McpCallContext } from '@/routes/mcp/types'

async function cerinListTeams(ctx: McpCallContext): Promise<ToolResult> {
  const teams = await getMyTeams(ctx.userId)

  return toolResult({
    teams: teams.map((team) => ({
      team_id: team.id,
      name: team.name,
      role: team.role ?? null,
    })),
  })
}

// Bind the tool implementations to the authenticated caller for a single request.
export function toolsForContext(ctx: McpCallContext): Record<string, ToolHandler> {
  return {
    cerin_ask: (args) => cerinAsk(args, ctx),
    cerin_check: (args) => cerinCheck(args, ctx),
    cerin_list_teams: () => cerinListTeams(ctx),
    cerin_list_runtimes: (args) => cerinListRuntimes(args, ctx),
    cerin_list_sessions: (args) => cerinListSessions(args, ctx),
    cerin_events: (args) => cerinEvents(args, ctx),
    cerin_stop: (args) => cerinStop(args, ctx),
    cerin_archive_session: (args) => cerinArchiveSession(args, ctx),
    cerin_list_queue: (args) => cerinListQueue(args, ctx),
    cerin_remove_queued: (args) => cerinRemoveQueued(args, ctx),
    cerin_update_session: (args) => cerinUpdateSession(args, ctx),
    cerin_list_credentials: (args) => cerinListCredentials(args, ctx),
    cerin_update_credentials: (args) => cerinUpdateCredentials(args, ctx),
    cerin_files: (args) => cerinFiles(args, ctx),
    cerin_find_pr_sessions: (args) => cerinFindPrSessions(args, ctx),
    cerin_webhooks: (args) => cerinWebhooks(args, ctx),
    cerin_capabilities: async () => toolResult(getCapabilities()),
  }
}
