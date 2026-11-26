import { db } from '@/lib/db'

import type { BindingAccess, BindingShareChoice, EncryptedEnvelope } from '@/models/common'
import type { Collection, ObjectId } from 'mongodb'

/**
 * Connectors whose provider grant lives in a Composio connected account
 * (Trello keeps its own pending collection; these seven share this one).
 */
export type ComposioConnectorProvider =
  'trello' | 'linear' | 'jira' | 'asana' | 'sentry' | 'gitlab' | 'cloudflare' | 'slack'

/**
 * A started Composio Connect Link flow, keyed by the one-time state token.
 * The account id comes from the flow's start, never the callback URL.
 * Mongo TTL index removes expired pending records once expiresAt passes.
 */
export type ComposioConnectorPendingOAuth = {
  _id: string
  provider: ComposioConnectorProvider
  teamId: ObjectId
  requesterUserId: string
  share?: BindingShareChoice
  composioAccountId: string
  expiresAt: Date
}

export const composioConnectorPendingOAuth = (): Collection<ComposioConnectorPendingOAuth> =>
  db().collection<ComposioConnectorPendingOAuth>('composio_connector_oauth_pending')

export type SlackPendingOAuth = {
  _id: string
  teamId: ObjectId
  requesterUserId: string
  // On reinstall, the Slack workspace this team is already bound to. The setup
  // callback rejects approval of a different workspace, since Slack's `team`
  // authorize param only pre-selects (does not enforce) it. Absent on a fresh
  // install, where any workspace is accepted.
  expectedSlackTeamId?: string
  expiresAt: Date
}

export const slackPendingOAuth = (): Collection<SlackPendingOAuth> =>
  db().collection<SlackPendingOAuth>('slack_oauth_pending')

export type PosthogPendingOAuth = {
  _id: string
  teamId: ObjectId
  requesterUserId: string
  share?: BindingShareChoice
  label: string
  region: 'us' | 'eu'
  clientId: string
  redirectUri: string
  encryptedCodeVerifier: EncryptedEnvelope
  requestedScopes: string[]
  // Reconnect: the binding whose grant this authorization replaces.
  integrationId?: ObjectId
  expiresAt: Date
}

export const posthogPendingOAuth = (): Collection<PosthogPendingOAuth> =>
  db().collection<PosthogPendingOAuth>('posthog_oauth_pending')

export type PlaudPendingOAuth = {
  _id: string
  teamId: ObjectId
  requesterUserId: string
  share?: BindingShareChoice
  clientId: string
  redirectUri: string
  encryptedCodeVerifier: EncryptedEnvelope
  expiresAt: Date
}

export const plaudPendingOAuth = (): Collection<PlaudPendingOAuth> =>
  db().collection<PlaudPendingOAuth>('plaud_oauth_pending')

/**
 * A connector grant the provider approved, staged until the requester's own
 * client completes it. `binding` is the provider's binding draft with tokens
 * already encrypted; `persist` for `provider` writes it. TTL-reaped.
 */
export type TrelloPendingOAuth = {
  _id: string
  teamId: ObjectId
  requesterUserId: string
  share?: BindingShareChoice
  composioAccountId: string
  expiresAt: Date
}
export const trelloPendingOAuth = (): Collection<TrelloPendingOAuth> =>
  db().collection<TrelloPendingOAuth>('trello_oauth_pending')

export type ConnectorOAuthReady = {
  _id: string
  /** sha256 of the one-time code delivered only to the approving client. */
  codeHash: string
  provider: string
  teamId: ObjectId
  requesterUserId: string
  binding: Record<string, unknown>
  /** The new binding's member list, decided when the provider called back. */
  access?: BindingAccess
  expiresAt: Date
}

export const connectorOAuthReady = (): Collection<ConnectorOAuthReady> =>
  db().collection<ConnectorOAuthReady>('connector_oauth_ready')
