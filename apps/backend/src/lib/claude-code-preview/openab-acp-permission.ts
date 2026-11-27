import { logError, logEvent } from '@/lib/observability'

import { agentHostAway } from './openab-acp-connect'
import { OpenAbConnectionLostError } from './openab-acp-errors'

import type {
  AcpSocket,
  OpenAbPermissionHandler,
  OpenAbPermissionOutcome,
  OpenAbPermissionRequest,
  PendingCall,
} from './openab-acp-session'

type PermissionTarget = {
  sessionId?: string
  onPermissionRequest?: OpenAbPermissionHandler
}

type PermissionToolCall = { title?: string; rawInput?: unknown }
type PermissionToolCallLookup = (
  sessionId: string,
  toolCallId: string,
) => PermissionToolCall | undefined

const permissionToolCallKey = (sessionId: string, toolCallId: string) =>
  JSON.stringify([sessionId, toolCallId])

function turnFinished(payload: Record<string, unknown>): boolean {
  if (payload.sessionUpdate === 'openab_session_interrupted') return true
  const snapshot = payload.snapshot

  if (payload.sessionUpdate !== 'runtime_state' || !snapshot || typeof snapshot !== 'object')
    return false

  return ['idle', 'dormant', 'interrupted'].includes(
    String((snapshot as Record<string, unknown>).state),
  )
}

/** Correlates sparse ACP approvals with reports on this connection, bounded across sessions. */
export function createPermissionToolCallReports() {
  const reports = new Map<string, { sessionId: string; toolCall: PermissionToolCall }>()
  const clearSession = (sessionId: string) => {
    for (const [id, report] of reports) {
      if (report.sessionId === sessionId) reports.delete(id)
    }
  }

  return {
    get: (sessionId: string, toolCallId: string) =>
      reports.get(permissionToolCallKey(sessionId, toolCallId))?.toolCall,
    clearSession,
    startPrompt: (sessionId: string, pending: Iterable<PendingCall>) => {
      if (![...pending].some((call) => call.sessionId === sessionId && call.onTextDelta))
        clearSession(sessionId)
    },
    finishPrompt: (pending: PendingCall, message: Record<string, unknown>) => {
      if (pending.sessionId && pending.onTextDelta && pending.accepted !== false && !message.error)
        clearSession(pending.sessionId)
    },
    clear: () => {
      reports.clear()
    },
    remember: (params: unknown) => {
      if (!params || typeof params !== 'object') return
      const { sessionId, update } = params as Record<string, unknown>

      if (typeof sessionId !== 'string' || !update || typeof update !== 'object') return
      const payload = update as Record<string, unknown>

      if (turnFinished(payload)) {
        clearSession(sessionId)

        return
      }
      if (payload.sessionUpdate !== 'tool_call' && payload.sessionUpdate !== 'tool_call_update')
        return
      if (typeof payload.toolCallId !== 'string' || !payload.toolCallId) return
      const id = permissionToolCallKey(sessionId, payload.toolCallId)
      const previous =
        payload.sessionUpdate === 'tool_call_update' ? reports.get(id)?.toolCall : undefined

      reports.delete(id)
      reports.set(id, {
        sessionId,
        toolCall: {
          ...previous,
          ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
          ...(payload.rawInput === undefined ? {} : { rawInput: payload.rawInput }),
        },
      })
      // Eviction only loses context, so an evicted call still fails closed.
      const oldest = reports.keys().next().value

      if (reports.size > 512 && oldest !== undefined) reports.delete(oldest)
    },
  }
}

export function replyToPermission(
  message: Record<string, unknown>,
  pending: Iterable<PendingCall>,
  socket: AcpSocket,
  context: {
    toolCallLookup: PermissionToolCallLookup
    sessionFallback: (sessionId: string) => OpenAbPermissionHandler | undefined
  },
): void {
  void answerPermissionRequest({
    params: message.params,
    targets: [...pending].filter((call) => call.accepted !== false),
    toolCallLookup: context.toolCallLookup,
    sessionFallback: context.sessionFallback,
    send: (result) => {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }))
    },
  })
}

const cancelled = (): OpenAbPermissionOutcome => ({ outcome: { outcome: 'cancelled' } })

function parsePermissionRequest(
  params: unknown,
  lookup: PermissionToolCallLookup | undefined,
): OpenAbPermissionRequest | null {
  if (!params || typeof params !== 'object') return null
  const value = params as Record<string, unknown>
  const toolCall = value.toolCall

  if (
    typeof value.sessionId !== 'string' ||
    !toolCall ||
    typeof toolCall !== 'object' ||
    typeof (toolCall as Record<string, unknown>).toolCallId !== 'string' ||
    !Array.isArray(value.options)
  ) {
    return null
  }
  const call = toolCall as Record<string, unknown> & { toolCallId: string }
  const reported = lookup?.(value.sessionId, call.toolCallId)
  const title = call.title === undefined ? reported?.title : call.title
  const rawInput = call.rawInput === undefined ? reported?.rawInput : call.rawInput
  const options = value.options.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const option = candidate as Record<string, unknown>

    return typeof option.optionId === 'string' &&
      typeof option.name === 'string' &&
      typeof option.kind === 'string'
      ? [{ optionId: option.optionId, name: option.name, kind: option.kind }]
      : []
  })

  return {
    sessionId: value.sessionId,
    toolCall: {
      toolCallId: call.toolCallId,
      title: typeof title === 'string' ? title : 'OpenAB tool request',
      ...(rawInput === undefined ? {} : { rawInput }),
    },
    options,
  }
}

export async function answerPermissionRequest(args: {
  params: unknown
  targets: PermissionTarget[]
  toolCallLookup?: PermissionToolCallLookup
  /**
   * Answers a request that belongs to no in-flight prompt. The runtime starts
   * turns on its own (a ScheduleWakeup firing, a background task reporting
   * back), and those tool calls must still reach the authorization layer
   * instead of being cancelled for want of a pending `session/prompt`.
   */
  sessionFallback?: (sessionId: string) => OpenAbPermissionHandler | undefined
  send: (result: OpenAbPermissionOutcome) => void
}): Promise<void> {
  const request = parsePermissionRequest(args.params, args.toolCallLookup)
  const pendingHandler = request
    ? args.targets.find(
        (target) => target.sessionId === request.sessionId && target.onPermissionRequest,
      )?.onPermissionRequest
    : undefined
  const handler =
    request && !pendingHandler ? args.sessionFallback?.(request.sessionId) : pendingHandler
  let result = cancelled()

  // Every fail-closed branch here silently cancels the agent's tool call,
  // which the runtime then reports as a completed empty turn — the user sees
  // "(no response)". Name the branch so a cancel is always attributable.
  if (!request) {
    const shape =
      args.params && typeof args.params === 'object'
        ? Object.fromEntries(
            Object.entries(args.params as Record<string, unknown>).map(([k, v]) => [
              k,
              Array.isArray(v) ? `array[${String(v.length)}]` : typeof v,
            ]),
          )
        : { params: typeof args.params }

    logEvent('warn', 'agent.openab_permission.cancelled', { reason: 'parse_failed', ...shape })
  } else if (!handler) {
    logEvent('warn', 'agent.openab_permission.cancelled', {
      reason: 'no_handler_for_session',
      openab_session_id: request.sessionId,
      tool_call_id: request.toolCall.toolCallId,
      target_session_ids: args.targets.map((t) => t.sessionId ?? 'none').join(','),
      session_fallback_registered: Boolean(args.sessionFallback),
    })
  } else {
    try {
      result = await handler(request)
    } catch (err) {
      // Permission handling is an authorization boundary; still fail closed.
      const fields = {
        openab_session_id: request.sessionId,
        tool_call_id: request.toolCall.toolCallId,
      }

      // A host that is away or hung up, as while it restarts, is expected: a warning (#3425).
      if (agentHostAway(err) || err instanceof OpenAbConnectionLostError)
        logEvent('warn', 'agent.openab_permission.host_away', fields)
      else logError('agent.openab_permission.handler_failed', err, fields)
    }
  }
  try {
    args.send(result)
  } catch {
    // A disconnected transport cannot receive the decision; OpenAB also
    // fails the inner request closed when its relay handle disappears.
  }
}
