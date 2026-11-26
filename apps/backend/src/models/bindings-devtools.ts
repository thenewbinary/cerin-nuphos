import type { BindingAccess, EncryptedEnvelope } from '@/models/common'
import type { ObjectId } from 'mongodb'

export type GrafanaInstanceBinding = {
  id: ObjectId
  name: string
  grafanaUrl: string
  encryptedSaToken?: EncryptedEnvelope
  /** Legacy plaintext token; read only until scripts/encrypt-grafana-tokens.ts has run. */
  saToken?: string
  createdAt: Date
  access?: BindingAccess
}

export type GithubInstallationBinding = {
  id: ObjectId
  installationId: number
  accountLogin: string
  accountType: 'User' | 'Organization'
  accountId: number
  targetType: 'all' | 'selected'
  createdAt: Date
  access?: BindingAccess
}

export type GitlabBinding = {
  id: ObjectId
  label: string
  // Always "https://gitlab.com": Composio's managed GitLab app covers
  // gitlab.com only, so self-managed instances are not supported.
  hostUrl: string
  // GitLab user id + login that authorised the grant.
  accountId: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  // The Composio connected account holding the grant. No provider token is
  // stored here; API calls go through Composio Proxy Execute.
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

export type LinearWorkspaceBinding = {
  id: ObjectId
  label: string
  // Linear organization (workspace) the grant is scoped to.
  workspaceId: string
  workspaceName: string
  // urlKey is the slug in linear.app/<urlKey>/… deep links.
  organizationUrlKey: string | null
  // Linear user who authorised the grant.
  accountId: string
  accountName: string | null
  // The Composio connected account holding the grant. No provider token is
  // stored here; API calls go through Composio Proxy Execute.
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

export type JiraSiteBinding = {
  id: ObjectId
  label: string
  // Atlassian site (cloudId) the grant is scoped to. Jira REST calls go
  // to api.atlassian.com/ex/jira/<cloudId>/rest/api/3/…
  cloudId: string
  siteName: string
  // Base URL of the site, e.g. https://acme.atlassian.net (for deep links).
  siteUrl: string
  // Atlassian account that authorised the grant.
  accountId: string
  accountName: string | null
  // The Composio connected account holding the grant. No provider token is
  // stored here; API calls go through Composio Proxy Execute.
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

export type AsanaAccountBinding = {
  id: ObjectId
  label: string
  // Asana user (gid) that authorised the grant. The grant is account-wide, so a
  // binding represents the connected Asana account, not a single workspace —
  // the agent selects the workspace at query time via the Asana API.
  accountGid: string
  accountName: string | null
  accountEmail: string | null
  // The Composio connected account holding the grant. No provider token is
  // stored here; API calls go through Composio Proxy Execute.
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

export type SentryAccountBinding = {
  id: ObjectId
  label: string
  // The organizations the grant could see at setup, via GET /api/0/organizations/.
  // The grant is account-wide, so the agent selects the org at query time; the
  // sorted slug list is also the binding's dedup key on reconnect.
  organizationSlugs: string[]
  // Display name of the first organization, for labelling.
  organizationName: string | null
  // The Composio connected account holding the grant. No provider token is
  // stored here; API calls go through Composio Proxy Execute.
  composioAccountId: string
  composioUserId: string
  createdAt: Date
  access?: BindingAccess
}

export type SonarqubeIntegrationBinding = {
  id: ObjectId
  label: string
  /** Normalized instance origin/base path without a trailing slash. */
  baseUrl: string
  /** SonarQube user token. Analysis tokens are deliberately not stored here. */
  encryptedToken: EncryptedEnvelope
  /** Discovered on bind for capability-aware UI/skill behavior. */
  version: string | null
  createdAt: Date
  access?: BindingAccess
}
