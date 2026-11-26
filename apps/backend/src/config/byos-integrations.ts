import { bool, optional, optionalList } from './env'

// Per-team SaaS connectors. Most bind with a credential the team pastes, so the
// only server-side setting is the BYOK key that encrypts it at rest.
export function byosIntegrationsConfig() {
  return {
    github: {
      appId: optional('GITHUB_APP_ID'),
      appSlug: optional('GITHUB_APP_SLUG'),
      privateKey: optional('GITHUB_APP_PRIVATE_KEY'),
      privateKeyBase64: optional('GITHUB_APP_PRIVATE_KEY_BASE64'),
      setupRedirect: optional('GITHUB_APP_SETUP_REDIRECT'),
      webhookSecret: optional('GITHUB_APP_WEBHOOK_SECRET'),
      // The App's OAuth client, used only for Personal Credentials (a member's
      // user-to-server token). Its callback URL is derived from setupRedirect.
      clientId: optional('GITHUB_APP_CLIENT_ID'),
      clientSecret: optional('GITHUB_APP_CLIENT_SECRET'),
      encryptionKey: optional('GITHUB_TOKEN_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    gitlab: {
      webhookSecret: optional('GITLAB_WEBHOOK_SECRET'),
    },
    outbound: {
      // Escape hatch for lib/net/safe-outbound: let team-configured hosts
      // (Grafana, GitLab, SonarQube, Uptime Kuma, databases) resolve to
      // private / loopback addresses. Off by default; development only.
      // GITLAB_ALLOW_PRIVATE_HOSTS is the previous name.
      allowPrivateHosts: bool(
        'OUTBOUND_ALLOW_PRIVATE_HOSTS',
        bool('GITLAB_ALLOW_PRIVATE_HOSTS', false),
      ),
      // Address ranges refused besides the private / reserved ones: the
      // cluster's Service CIDR. Defaults to GKE's default Service range.
      blockedCidrs: process.env.OUTBOUND_BLOCKED_CIDRS
        ? optionalList('OUTBOUND_BLOCKED_CIDRS')
        : ['34.118.224.0/20'],
    },
    cloudflare: {
      // Cloudflare R2 secret access keys still use this shared BYOK sealer.
      encryptionKey: optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: process.env.CLOUDFLARE_BYOK_ENCRYPTION_KEY_ID ?? 'default',
    },
    linode: {
      encryptionKey:
        optional('LINODE_BYOK_ENCRYPTION_KEY') ?? optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    hetzner: {
      // Bring-your-own-credential: each team provides its own Hetzner Cloud API
      // token at the connect dialog; the token is encrypted at rest with this
      // BYOK key (shared with the other BYOK providers).
      encryptionKey:
        optional('HETZNER_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    tailscale: {
      encryptionKey:
        optional('TAILSCALE_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    zeabur: {
      encryptionKey:
        optional('ZEABUR_PROVIDER_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    betterStack: {
      encryptionKey: optional('BETTERSTACK_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    grafana: {
      // Grafana service-account tokens pasted at bind time, encrypted at rest.
      encryptionKey:
        optional('GRAFANA_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    uptimeKuma: {
      encryptionKey:
        optional('UPTIME_KUMA_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    vanta: {
      encryptionKey:
        optional('VANTA_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    secureframe: {
      // Secureframe authenticates with a static API key + secret pair (no
      // OAuth), so the only server-side config is the encryption key for the
      // secret at rest.
      encryptionKey:
        optional('SECUREFRAME_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    sonarqube: {
      // SonarQube binds with a static user token pasted by a team admin. Keep
      // it encrypted at rest with the shared BYOS fallback chain so existing
      // self-hosted deployments do not need a new key just to enable this
      // connector, while still allowing independent rotation later.
      encryptionKey:
        optional('SONARQUBE_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
      // Development-only proof path: exposes an Agent tool that can scan the
      // checked-in isolated fixture. It never accepts a repository or path and
      // remains off in every deployment unless explicitly enabled.
      fixtureScannerEnabled: bool('SONARQUBE_FIXTURE_SCANNER_ENABLED', false),
    },
    notion: {
      // Notion binds with a static internal-integration token (ntn_… / legacy
      // secret_…) pasted by the user — no OAuth — so the only server-side config
      // is the encryption key for the token at rest.
      encryptionKey:
        optional('NOTION_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    upstash: {
      // Upstash binds with an account email + a Management API key pasted by the
      // user (Console → Account → Management API) — no OAuth — so the only
      // server-side config is the encryption key for the API key at rest.
      encryptionKey:
        optional('UPSTASH_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    posthog: {
      encryptionKey:
        optional('POSTHOG_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    plaud: {
      // Plaud registers its OAuth client dynamically per connect, so the only
      // server-side config is the encryption key for the tokens at rest.
      encryptionKey:
        optional('PLAUD_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    instabox: {
      // A team's instabox API key, pasted by an admin, shares the Linode key.
      encryptionKey:
        optional('LINODE_BYOK_ENCRYPTION_KEY') ?? optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    resend: {
      // Resend binds with a static API key (re_…) pasted by the user — no OAuth
      // — so the only server-side config is the encryption key for it at rest.
      encryptionKey:
        optional('RESEND_BYOK_ENCRYPTION_KEY') ??
        optional('LINODE_BYOK_ENCRYPTION_KEY') ??
        optional('CLOUDFLARE_BYOK_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
    // When on, connector OAuth callbacks stage the grant and the requester's own
    // client confirms the binding (complete-oauth) with the callback's one-time
    // code. Off until Desktop, iOS and Android builds that confirm have shipped.
    connectorOAuthDeferredBind: bool('CONNECTOR_OAUTH_DEFERRED_BIND', false),
    composio: {
      // A Composio project's API key enables Trello, Slack, Linear, Jira, Asana,
      // Sentry, GitLab and Cloudflare, plus Gmail / Google Drive for teams
      // without their own Google OAuth client. Auth configs are found or created
      // on first use; Cloudflare uses a custom API-key config instead of OAuth.
      apiKey: optional('CERIN_COMPOSIO_API_KEY'),
    },
    linear: {
      // Signing secret of the Linear app's webhook. The /linear-app/webhook
      // endpoint verifies the Linear-Signature HMAC against it. Reverse-sync
      // (Linear → agent) is not implemented yet; the endpoint only acks so the
      // webhook can be wired up in the Linear app ahead of that work.
      webhookSecret: optional('LINEAR_WEBHOOK_SECRET'),
      // This legacy-named key also seals team Google OAuth clients and personal
      // credential PKCE verifiers, so it remains independent of Linear connect.
      encryptionKey: optional('LINEAR_TOKEN_ENCRYPTION_KEY'),
      encryptionKeyId: 'default',
    },
  }
}
