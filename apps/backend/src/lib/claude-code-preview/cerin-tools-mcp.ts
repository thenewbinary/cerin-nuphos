// The `cerin-tools` MCP surface: host-control tools that cannot be expressed
// as ordinary domain REST resources (memory, decisions, local Desktop actions,
// channel delivery, …), served to the Claude Code runtime per conversation.
import { createHash } from 'node:crypto'

import { resolvePreviewToolContext } from './preview-tool-context-resolve'
import { previewToolModules } from './preview-tools'

import type { PreviewToolContext, PreviewToolModule } from './preview-tool-context'
import type { McpSurface, ToolHandler } from '@/lib/mcp/protocol'

export { toolModuleFromAiSdkTools } from './preview-tools/ai-sdk-adapter'

export const CERIN_TOOLS_INSTRUCTIONS =
  "Cerin's native tools for this conversation: memory (save_memory / " +
  'memory_get), charts, artifacts, team-skill authoring, decisions, local Desktop actions, ' +
  'connector setup (create_connector), computers from Cerin on team instabox accounts (list_boxes / create_box / update_box), Cerin sub-agents (create_thread / send_message_to_thread / update_thread / list_agent_runtimes / set_thread_parent / archive_thread / stop_thread), Cerin channels (channel_read / channel_post / channel_create), meetings (meeting_join / meeting_chat / meeting_leave, when set up), and channel delivery. ' +
  'When the user asks for a sub-agent (in any language), use create_thread, not your ' +
  "runtime's built-in subagent tool, unless they explicitly ask for the built-in one. " +
  'List yours with list_recent_conversations children:true. ' +
  'When progress needs an answer only the user can provide, use request_user_decision ' +
  'with the question as one short line, its context in `body`, and optional choices; its answer ' +
  'arrives as a new message. ' +
  'This registers the question in Needs your input; a question written only in chat does not. ' +
  'When the user asks for an artifact, a document, or to see HTML, an SVG or a full file ' +
  'rendered, show it with render_artifact; it opens beside the chat. ' +
  'Domain resources use native skills backed by the ' +
  'canonical Cerin REST API. Every call renders its own card in the Cerin chat UI — ' +
  'do not re-describe the output in prose beyond what the user needs. Every ' +
  "tool takes a `label`: a 5-12 word summary of this call in the user's " +
  'language, shown as the step title. For save_memory, always pass `scope` ' +
  'explicitly: use `team` for shared infrastructure state or changes, ' +
  'operational decisions, and reusable findings; use `personal` only for ' +
  'user-specific preferences or context.'

export function cerinToolsSurface(modules: readonly PreviewToolModule[]): McpSurface {
  return {
    serverName: 'cerin-tools',
    instructions: CERIN_TOOLS_INSTRUCTIONS,
    toolDefinitions: modules.flatMap((module) => [...module.definitions]),
  }
}

export function mergeToolHandlers(
  modules: readonly PreviewToolModule[],
  ctx: PreviewToolContext,
): Record<string, ToolHandler> {
  const merged: Record<string, ToolHandler> = {}

  for (const module of modules) {
    for (const [name, handler] of Object.entries(module.handlers(ctx))) {
      if (name in merged) throw new Error(`Duplicate preview tool name: ${name}`)
      merged[name] = handler
    }
  }

  return merged
}

/** Surface + handlers for one conversation's `cerin-tools` MCP request. */
export async function cerinToolsMcp(
  ctx: PreviewToolContext,
): Promise<{ surface: McpSurface; tools: Record<string, ToolHandler> }> {
  const modules = await previewToolModules(ctx)

  return { surface: cerinToolsSurface(modules), tools: mergeToolHandlers(modules, ctx) }
}

/**
 * A short hash of the tools' names and input schemas: a new parameter on an
 * existing tool counts too. Descriptions are left out, as they embed per-turn
 * data (the date, the selected credentials) that would respawn every turn.
 */
export function toolsHash(definitions: readonly unknown[]): string {
  const tools = definitions.map((definition) => {
    const { name, inputSchema } = definition as { name: string; inputSchema?: unknown }

    return JSON.stringify([name, inputSchema ?? null])
  })

  return createHash('sha256').update(tools.join('\n')).digest('hex').slice(0, 12)
}

/**
 * The conversation's `toolsHash`, declared in the `cerin-tools` URL. Agents
 * read the tool list only when they start, so the runtime respawns an idle
 * agent, resuming its conversation, when this changes.
 */
export async function cerinToolsVersion(
  args: Parameters<typeof resolvePreviewToolContext>[0],
): Promise<string | undefined> {
  try {
    const modules = await previewToolModules(await resolvePreviewToolContext(args))

    return toolsHash(cerinToolsSurface(modules).toolDefinitions)
  } catch {
    return undefined
  }
}
