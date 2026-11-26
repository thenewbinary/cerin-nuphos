// Shared plumbing for the connectors whose provider authorization lives in
// Composio (Trello, Linear, Jira, Asana, Sentry, GitLab, Cloudflare, Slack).
// Composio holds the provider grant; Cerin stores only the connected account
// id and calls the provider through Composio's Proxy Execute with its own
// server-side API key. No provider access/refresh token is stored or handed
// out, and the Connect Link redirect is accepted only on Composio's host.
import { ObjectId } from 'mongodb'

import { config } from '@/config'
import { composioAuthConfigId, composioRequest } from '@/lib/composio'
import { reboundAccess } from '@/lib/connector-oauth'
import { AppError } from '@/lib/errors'
import { errorTelemetryProperties, logError, logEvent } from '@/lib/observability'
import { deleteComposioAccount } from '@/lib/personal-credentials/composio'
import { emptyTeamByosBindings, teamByosBindings } from '@/models'

import type { ComposioAuthConfigKind } from '@/lib/composio'
import type { BindingAccess, ComposioConnectorProvider } from '@/models'

/**
 * An identity probe's terminal, user-actionable failure (e.g. a Jira grant
 * spanning several sites). Its code/description reach the desktop unchanged;
 * every other failure collapses to <provider>_connection_failed.
 */
export class ComposioConnectorCallbackError extends Error {
  constructor(
    public code: string,
    public description?: string,
  ) {
    super(code)
  }
}

export type ComposioConnectorSpec = {
  /** Pending-record and error-code key: 'trello', 'linear', 'jira', … */
  provider: ComposioConnectorProvider
  /** Display name in errors: 'Trello', 'Linear', … */
  displayName: string
  /** Composio toolkit slug the connected account must belong to. */
  toolkitSlug: string
  /** Completion key when it differs from the provider's error/pending key. */
  oauthProvider?: string
  /** 'managed' OAuth2 config, or 'apiKey' for Cloudflare's custom API_KEY config. */
  kind?: ComposioAuthConfigKind
  /** Preserve an existing connector's user-facing verification error. */
  verificationErrorMessage?: string
}

function authConfigId(spec: ComposioConnectorSpec): Promise<string> {
  if (!config.byos.composio.apiKey) {
    throw new AppError(
      503,
      `${spec.provider}_not_configured`,
      `${spec.displayName} connection is not configured on this server`,
    )
  }

  return composioAuthConfigId(spec.toolkitSlug, spec.kind ?? 'managed')
}

/** A Connect Link for the member; Composio returns to callbackUrl when they finish. */
export async function composioConnectLink(
  spec: ComposioConnectorSpec,
  userId: string,
  callbackUrl: string,
): Promise<{ authorizeUrl: string; accountId: string }> {
  const link = await composioRequest<{ redirect_url: string; connected_account_id: string }>(
    'POST',
    '/connected_accounts/link',
    { auth_config_id: await authConfigId(spec), user_id: userId, callback_url: callbackUrl },
  )

  if (
    typeof link.connected_account_id !== 'string' ||
    !/^ca_[A-Za-z0-9_-]+$/u.test(link.connected_account_id)
  )
    throw new AppError(
      502,
      `${spec.provider}_invalid_account`,
      `Invalid ${spec.displayName} connected account`,
    )
  let redirect: URL

  try {
    redirect = new URL(link.redirect_url)
  } catch {
    throw new AppError(
      502,
      `${spec.provider}_invalid_link`,
      `Invalid ${spec.displayName} connection link`,
    )
  }

  if (
    redirect.protocol !== 'https:' ||
    redirect.hostname !== 'connect.composio.dev' ||
    redirect.port ||
    redirect.username ||
    redirect.password
  ) {
    throw new AppError(
      502,
      `${spec.provider}_invalid_link`,
      `Invalid ${spec.displayName} connection link`,
    )
  }

  return { authorizeUrl: redirect.href, accountId: link.connected_account_id }
}

/** The stored account must be active, for this member, toolkit and auth config. */
export async function verifyComposioConnection(
  spec: ComposioConnectorSpec,
  accountId: string,
  userId: string,
): Promise<void> {
  const account = await composioRequest<{
    user_id?: string
    status?: string
    toolkit?: { slug?: string }
    auth_config?: { id?: string }
  }>('GET', `/connected_accounts/${encodeURIComponent(accountId)}`)

  if (
    account.status !== 'ACTIVE' ||
    account.user_id !== userId ||
    account.toolkit?.slug !== spec.toolkitSlug ||
    account.auth_config?.id !== (await authConfigId(spec))
  ) {
    throw new AppError(
      403,
      `${spec.provider}_reconnect_required`,
      spec.verificationErrorMessage ?? `${spec.displayName} needs to be reconnected`,
    )
  }
}

/** After the guarded pull, never before: a disconnect that loses to an access
 * change must not delete the connection the binding still uses. Best effort. */
export async function deleteComposioAccountBestEffort(
  provider: string,
  accountId: string,
): Promise<void> {
  await deleteComposioAccount(accountId).catch((cause: unknown) => {
    logEvent('warn', `${provider}.disconnect_cleanup_failed`, errorTelemetryProperties(cause))
  })
}

// ---- Binding persistence -------------------------------------------------------

export type ComposioBindingBase = {
  id: ObjectId
  label: string
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

/** Team document array fields holding a Composio-backed binding. */
export type ComposioBindingField =
  | 'linearWorkspaces'
  | 'jiraSites'
  | 'asanaAccounts'
  | 'sentryAccounts'
  | 'gitlabAccounts'
  | 'slackIntegrations'

/**
 * Re-binding the same provider account replaces the existing binding in place
 * (id, label and ACL preserved), and the superseded Composio account is
 * deleted. A new account is pushed with the access decided at callback time.
 */
export async function persistComposioConnectorBinding<B extends ComposioBindingBase>(args: {
  spec: ComposioConnectorSpec
  field: ComposioBindingField
  teamId: ObjectId
  draft: Omit<B, 'id' | 'label' | 'createdAt' | 'access'>
  access: BindingAccess
  matches: (existing: B) => boolean
  label: string
  result?: Record<string, string>
}): Promise<Record<string, string>> {
  const { spec, field, teamId, access } = args
  const draft = args.draft as B
  const doc = await teamByosBindings().findOne({ _id: teamId }, { projection: { [field]: 1 } })
  const existing = ((doc?.[field] ?? []) as unknown as B[]).find(args.matches)
  const binding = {
    ...draft,
    id: existing?.id ?? new ObjectId(),
    label: existing?.label ?? args.label,
    createdAt: existing?.createdAt ?? new Date(),
    ...reboundAccess(existing, access),
  } as B

  if (existing) {
    const result = await teamByosBindings().updateOne(
      { _id: teamId },
      { $set: { [`${field}.$[el]`]: binding, updatedAt: new Date() } },
      { arrayFilters: [{ 'el.id': existing.id }] },
    )

    if (!result.matchedCount)
      throw new AppError(
        409,
        `${spec.provider}_reconnect_conflict`,
        `${spec.displayName} connection changed during authorization. Try again.`,
      )
    if (existing.composioAccountId !== binding.composioAccountId) {
      await deleteComposioAccount(existing.composioAccountId).catch((error: unknown) => {
        logError(`${spec.provider}.previous_connection_cleanup_failed`, error)
      })
    }
  } else {
    const { [field]: _pushed, ...insertDefaults } = emptyTeamByosBindings()

    await teamByosBindings().updateOne(
      { _id: teamId },
      {
        $push: { [field]: binding },
        $set: { updatedAt: new Date() },
        $setOnInsert: insertDefaults,
      },
      { upsert: true },
    )
  }

  return {
    binding_id: binding.id.toHexString(),
    team_id: teamId.toHexString(),
    ...args.result,
  }
}
