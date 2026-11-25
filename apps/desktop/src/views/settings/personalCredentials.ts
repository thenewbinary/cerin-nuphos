import { parseAtlasError } from '../../api/errors.ts'
import { api } from '../../api.ts'
import { toast } from '../../components/ui/toast.ts'
import { t } from '../../i18n/index.ts'
import { isGoogle } from '../../types.ts'

<<<<<<< origin/main
import type {
  PersonalCredential,
  PersonalCredentialDeepLinkPayload,
  PersonalCredentialProvider,
} from '../../types.ts'
=======
import type { PersonalCredentialDeepLinkPayload, PersonalCredentialProvider } from '../../types'
>>>>>>> a52b7a082b4734d1c39a5ca7777f07f38a4bec6c

/** Fired after the main process claims an OAuth grant, so an open section refetches. */
export const PERSONAL_CREDENTIALS_CHANGED = 'personal-credentials:changed'

const NAMES: Record<PersonalCredentialProvider, string> = {
  github: 'GitHub',
  linear: 'Linear',
  gmail: 'Gmail',
  'google-drive': 'Google Drive',
  'google-calendar': 'Google Calendar',
}

export function nameOf(provider: PersonalCredentialProvider): string {
  return NAMES[provider]
}

<<<<<<< origin/main
export const PERSONAL_CREDENTIALS_SECTION = 'account.personalCredentials'

const PERSONAL_CREDENTIAL_TIMEOUT_MS = 10 * 60_000

type PendingPersonalCredential = {
  wait: Promise<void>
  settle: () => void
  timeout?: ReturnType<typeof setTimeout>
}

// A return names its provider, not its team, so all clicks for one provider share this wait.
const pendingPersonalCredentials = new Map<PersonalCredentialProvider, PendingPersonalCredential>()

function settlePersonalCredential(provider: PersonalCredentialProvider) {
  const attempt = pendingPersonalCredentials.get(provider)

  if (!attempt) return
  pendingPersonalCredentials.delete(provider)
  if (attempt.timeout) clearTimeout(attempt.timeout)
  attempt.settle()
}

/** Starts signing in to the member's own account and waits for its bounded browser return. */
=======
/** Starts signing in to the member's own account in the browser; a failure says why. */
>>>>>>> a52b7a082b4734d1c39a5ca7777f07f38a4bec6c
export async function connectPersonalCredential(
  provider: PersonalCredentialProvider,
  teamId: string | undefined,
): Promise<void> {
  const existing = pendingPersonalCredentials.get(provider)

  if (existing) return existing.wait
  let settle!: () => void
  const wait = new Promise<void>((resolve) => {
    settle = resolve
  })
  const attempt: PendingPersonalCredential = { wait, settle }

  pendingPersonalCredentials.set(provider, attempt)
  attempt.timeout = setTimeout(() => {
    if (pendingPersonalCredentials.get(provider) !== attempt) return
    settlePersonalCredential(provider)
    toast.error(
      t('Could not connect {name}', { name: nameOf(provider) }),
      t('This connection attempt expired or was cancelled. Click Connect again.'),
    )
  }, PERSONAL_CREDENTIAL_TIMEOUT_MS)

  try {
    const { authorizeUrl } = await api.atlasStartPersonalCredential(
      provider,
      isGoogle(provider) ? teamId : undefined,
    )

    if (pendingPersonalCredentials.get(provider) !== attempt) return await wait
    await api.appOpenExternal(authorizeUrl)

    return await wait
  } catch (err) {
    if (pendingPersonalCredentials.get(provider) !== attempt) return wait
    settlePersonalCredential(provider)
    if (parseAtlasError(err).code === 'personal_credential_not_configured') {
      toast.error(
        t('Could not connect {name}', { name: nameOf(provider) }),
        t('Not configured on this server yet'),
      )
    } else {
      toast.apiError(t('Could not connect {name}', { name: nameOf(provider) }), err)
    }
  }
}

/** The personal entries the Connectors page lists, with the words people search them by. */
export type PersonalConnector = {
  provider: PersonalCredentialProvider
  summary: string
  keywords: string
}

export const PERSONAL_CONNECTORS: PersonalConnector[] = [
  {
    provider: 'github',
    summary: t('Commits, PRs and comments authored by you.'),
    keywords: 'git',
  },
  { provider: 'linear', summary: t('Issues and comments authored by you.'), keywords: '' },
  {
    provider: 'gmail',
    summary: t('Read, draft and send your mail.'),
    keywords: 'google mail email inbox',
  },
  {
    provider: 'google-drive',
    summary: t('Find, read and save your own files.'),
    keywords: 'google docs sheets files',
  },
  {
    provider: 'google-calendar',
    summary: t('Check your schedule and set up events.'),
    keywords: 'google calendar events meetings schedule',
  },
]

/** Global handler for the claimed cerin://personal-credential deep link. */
export function announcePersonalCredential({
  provider,
  login,
  error,
}: PersonalCredentialDeepLinkPayload) {
  settlePersonalCredential(provider)
  const name = nameOf(provider)

  if (login) {
    toast.success(t('Connected {name} as {login}', { name, login }))
  } else if (error === 'oauth_not_ready') {
    toast.error(
      t('Couldn’t connect {name}', { name }),
      t('This link expired or was started from another account.'),
    )
  } else {
    toast.error(t('Couldn’t connect {name}', { name }), t('Please try again.'))
  }
  window.dispatchEvent(new Event(PERSONAL_CREDENTIALS_CHANGED))
}

/** The personal entries a search keeps; every term has to match, as in the team catalog. */
export function matchingPersonalConnectors(terms: string[]) {
  return PERSONAL_CONNECTORS.filter(({ provider, summary, keywords }) => {
    const haystack = `${nameOf(provider)} ${summary} ${provider} personal ${keywords}`.toLowerCase()

    return terms.every((term) => haystack.includes(term))
  })
}
