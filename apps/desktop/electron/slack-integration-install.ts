import { shell } from 'electron'

import * as atlas from './atlas.ts'
import { connectorCallbackError, connectorCallbackParams } from './connector-oauth-callback.ts'

export const SLACK_INTEGRATION_CALLBACK_HOST = 'slack-integration-callback'
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000

type Pending = {
  teamId: string
  resolve: (result: { bindingId: string; teamId: string; accountName: string }) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

const pending = new Map<string, Pending>()

export const hasPending = (state: string) => pending.has(state)

export async function startInstall(teamId: string, share?: atlas.BindingShare) {
  const { authorizeUrl, state } = await atlas.startSlackIntegrationOAuth(teamId, share)

  return new Promise<{ bindingId: string; teamId: string; accountName: string }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pending.delete(state)) {
          atlas.cancelSlackIntegrationOAuth(teamId, state).catch(() => {})
          reject(new Error('Slack connection timed out — please try again.'))
        }
      }, INSTALL_TIMEOUT_MS)

      pending.set(state, { teamId, resolve, reject, timeout })
      shell.openExternal(authorizeUrl).catch(() => {
        if (pending.delete(state)) {
          clearTimeout(timeout)
          atlas.cancelSlackIntegrationOAuth(teamId, state).catch(() => {})
          reject(new Error('Could not open Slack authorization in your browser.'))
        }
      })
    },
  )
}

export function cancelAllPending() {
  for (const [state, p] of pending) {
    clearTimeout(p.timeout)
    atlas.cancelSlackIntegrationOAuth(p.teamId, state).catch(() => {})
    p.reject(new Error('Slack connection cancelled'))
  }
  pending.clear()
}

export function cancelPending(teamId: string) {
  for (const [state, p] of pending) {
    if (p.teamId !== teamId) continue
    pending.delete(state)
    clearTimeout(p.timeout)
    atlas.cancelSlackIntegrationOAuth(teamId, state).catch(() => {})
    p.reject(new Error('Slack connection cancelled'))
  }
}

export function isCallbackUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)

    return url.protocol === 'cerin:' && url.hostname === SLACK_INTEGRATION_CALLBACK_HOST
  } catch {
    return false
  }
}

export async function handleCallback(rawUrl: string): Promise<void> {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return
  }
  if (!isCallbackUrl(rawUrl)) return
  const state = parsed.searchParams.get('state')
  const p = state ? pending.get(state) : undefined

  if (!state || !p) return
  pending.delete(state)
  clearTimeout(p.timeout)
  const params = await connectorCallbackParams(parsed, p.teamId, atlas.completeConnectorOAuth)
  const error = params.get('error')

  if (error) {
    p.reject(connectorCallbackError('Slack', params))

    return
  }
  const bindingId = params.get('binding_id')

  if (!bindingId) {
    p.reject(new Error('Slack callback missing binding_id'))

    return
  }
  p.resolve({
    bindingId,
    teamId: params.get('team_id') ?? p.teamId,
    accountName: params.get('account_name') ?? '',
  })
}
