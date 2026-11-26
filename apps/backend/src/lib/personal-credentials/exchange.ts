// The OAuth code exchange shared by the GitHub and Google team-client flows.
import { publicBackendUrl } from '@/lib/claude-code-preview/runtime-backend-url'
import { AppError } from '@/lib/errors'

import { pkceFlow } from './pkce'
import { open, seal } from './seal'

import type { ProviderTokens } from './github'
import type { getTeamMembership } from '@/lib/identity'
import type {
  PersonalCredential,
  PersonalCredentialPendingOAuth,
  PersonalCredentialProvider,
} from '@/models'

export const NAMES: Record<PersonalCredentialProvider, string> = {
  github: 'GitHub',
  gmail: 'Gmail',
  'google-drive': 'Google Drive',
  'google-calendar': 'Google Calendar',
}

/** The callback is on the backend's public origin (CERIN_PUBLIC_BACKEND_URL). */
export function callbackUrl(provider: PersonalCredentialProvider): string | null {
  const base = publicBackendUrl()

  return base?.startsWith('https://')
    ? `${base.replace(/\/$/u, '')}/personal-credentials/${provider}/callback`
    : null
}

export function notConfigured(provider: PersonalCredentialProvider): AppError {
  return new AppError(
    503,
    'personal_credential_not_configured',
    `Personal Credentials for ${NAMES[provider]} are not configured on this server`,
  )
}

type Identity = Pick<PersonalCredential, 'providerUserId' | 'login' | 'workspaceName' | 'teamId'>

/** Trades the provider's code for a grant, ready to stage. */
export async function exchangeGrant(
  provider: PersonalCredentialProvider,
  pending: PersonalCredentialPendingOAuth,
  code: string,
  membership: Awaited<ReturnType<typeof getTeamMembership>>,
): Promise<NonNullable<PersonalCredentialPendingOAuth['staged']>> {
  const redirectUri = callbackUrl(provider)
  const teamId = pending.teamId
  let tokens: ProviderTokens
  let identity: Identity

  const flow = await pkceFlow(provider, teamId)

  if (flow) {
    if (!flow.client || !redirectUri || !pending.encryptedCodeVerifier) {
      throw notConfigured(provider)
    }
    tokens = await flow.exchange({
      ...flow.client,
      code,
      redirectUri,
      codeVerifier: open(provider, pending.encryptedCodeVerifier),
    })
    const user = await flow.user(tokens.accessToken)

    identity = { providerUserId: user.id, login: user.login }
    // `membership` is non-null here: a departed member was refused above.
    if (teamId && membership) {
      identity = { ...identity, teamId, workspaceName: membership.team.name }
    }
  } else {
    throw notConfigured(provider)
  }

  return {
    ...identity,
    encryptedAccessToken: seal(provider, tokens.accessToken),
    encryptedRefreshToken: tokens.refreshToken ? seal(provider, tokens.refreshToken) : null,
    accessTokenExpiresAt: tokens.expiresAt,
  }
}
