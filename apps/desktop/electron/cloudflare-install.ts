import { shell } from 'electron'

import * as atlas from './atlas.ts'
import { connectorCallbackError, connectorCallbackParams } from './connector-oauth-callback.ts'

export const CLOUDFLARE_CALLBACK_HOST = 'cloudflare-callback'
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000

type Pending = {
  teamId: string
  resolve: (result: CloudflareBindResult) => void
  reject: (err: Error) => void
  timeout: NodeJS.Timeout
}

export type CloudflareBindResult = {
  bindingId: string
  teamId: string
  accountId: string
  accountName: string
}

const pending = new Map<string, Pending>()

export const hasPending = (state: string) => pending.has(state)

export async function startInstall(
  teamId: string,
  share?: atlas.BindingShare,
): Promise<CloudflareBindResult> {
  const { authorizeUrl, state } = await atlas.startCloudflareOAuth(teamId, share)

  return new Promise<CloudflareBindResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pending.delete(state)) {
        atlas.cancelCloudflareOAuth(teamId, state).catch(() => {})
        reject(new Error('Cloudflare connection timed out — please try again.'))
      }
    }, INSTALL_TIMEOUT_MS)

    pending.set(state, { teamId, resolve, reject, timeout })
    shell.openExternal(authorizeUrl).catch(() => {
      if (pending.delete(state)) {
        clearTimeout(timeout)
        atlas.cancelCloudflareOAuth(teamId, state).catch(() => {})
        reject(new Error('Could not open Cloudflare authorization in your browser.'))
      }
    })
  })
}

export function cancelAllPending() {
  for (const [state, p] of pending) {
    clearTimeout(p.timeout)
    atlas.cancelCloudflareOAuth(p.teamId, state).catch(() => {})
    p.reject(new Error('Cloudflare connection cancelled'))
  }
  pending.clear()
}

export function cancelPending(teamId: string) {
  for (const [state, p] of pending) {
    if (p.teamId !== teamId) continue
    pending.delete(state)
    clearTimeout(p.timeout)
    atlas.cancelCloudflareOAuth(teamId, state).catch(() => {})
    p.reject(new Error('Cloudflare connection cancelled'))
  }
}

export function isCallbackUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)

    return url.protocol === 'cerin:' && url.hostname === CLOUDFLARE_CALLBACK_HOST
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
    p.reject(connectorCallbackError('Cloudflare', params))

    return
  }
  const bindingId = params.get('binding_id')

  if (!bindingId) {
    p.reject(new Error('Cloudflare callback missing binding_id'))

    return
  }
  p.resolve({
    bindingId,
    teamId: params.get('team_id') ?? p.teamId,
    accountId: params.get('account_id') ?? '',
    accountName: params.get('account_name') ?? '',
  })
}
