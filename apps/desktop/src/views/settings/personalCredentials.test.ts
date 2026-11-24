import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import type { PersonalCredentialProvider } from '../../types.ts'

type Start = (
  provider: PersonalCredentialProvider,
  teamId: string | undefined,
) => Promise<{ authorizeUrl: string; state: string }>

let start: Start
let open: (url: string) => Promise<void>
let starts: [PersonalCredentialProvider, string | undefined][]
let opened: string[]
let errors: [unknown, unknown][]
let successes: [unknown, unknown][]
let apiErrors: [unknown, unknown][]
let changes: number

Object.assign(globalThis, { window: new EventTarget() })
window.addEventListener('personal-credentials:changed', () => {
  changes += 1
})

mock.module('../../api.ts', {
  namedExports: {
    api: {
      atlasStartPersonalCredential: (provider: PersonalCredentialProvider, teamId?: string) => {
        starts.push([provider, teamId])

        return start(provider, teamId)
      },
      appOpenExternal: (url: string) => {
        opened.push(url)

        return open(url)
      },
    },
  },
})
mock.module('../../components/ui/toast.ts', {
  namedExports: {
    toast: {
      error: (title: unknown, description?: unknown) => {
        errors.push([title, description])
      },
      success: (title: unknown, description?: unknown) => {
        successes.push([title, description])
      },
      apiError: (title: unknown, error: unknown) => {
        apiErrors.push([title, error])
      },
    },
  },
})
mock.module('../../i18n/index.ts', {
  namedExports: {
    t: (text: string, values?: Record<string, string>) =>
      Object.entries(values ?? {}).reduce(
        (result, [key, value]) => result.replaceAll(`{${key}}`, value),
        text,
      ),
  },
})
mock.module('../../types.ts', {
  namedExports: {
    isGoogle: (provider: PersonalCredentialProvider) =>
      provider.startsWith('google-') || provider === 'gmail',
  },
})

const { announcePersonalCredential, connectPersonalCredential } =
  await import('./personalCredentials.ts')

function authorize(url: string): Start {
  return () => Promise.resolve({ authorizeUrl: url, state: 'state' })
}

function reset() {
  starts = []
  opened = []
  errors = []
  successes = []
  apiErrors = []
  changes = 0
  start = authorize('https://oauth.test/authorize')
  open = () => Promise.resolve()
}

test('one personal-credential attempt is shared until its deep link arrives', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reset()
  const first = connectPersonalCredential('google-calendar', 'team-one')
  const second = connectPersonalCredential('google-calendar', 'team-two')

  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(starts, [['google-calendar', 'team-one']])
  assert.deepEqual(opened, ['https://oauth.test/authorize'])

  announcePersonalCredential({ provider: 'google-calendar', login: 'isaac' })
  await Promise.all([first, second])
  t.mock.timers.tick(10 * 60_000)
  assert.deepEqual(starts, [['google-calendar', 'team-one']])
  assert.deepEqual(opened, ['https://oauth.test/authorize'])
  assert.deepEqual(successes, [['Connected Google Calendar as isaac', undefined]])
  assert.deepEqual(errors, [])
  assert.equal(changes, 1)
})

test('a lost personal-credential deep link times out once without restarting OAuth', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reset()
  const connecting = connectPersonalCredential('gmail', 'team-gmail')

  await Promise.resolve()
  await Promise.resolve()
  t.mock.timers.tick(10 * 60_000 - 1)
  assert.deepEqual(errors, [])
  t.mock.timers.tick(1)
  await connecting
  assert.deepEqual(errors, [
    [
      'Could not connect Gmail',
      'This connection attempt expired or was cancelled. Click Connect again.',
    ],
  ])
  assert.deepEqual(starts, [['gmail', 'team-gmail']])
  assert.deepEqual(opened, ['https://oauth.test/authorize'])

  t.mock.timers.tick(20 * 60_000)
  assert.equal(errors.length, 1)
  assert.equal(starts.length, 1)
  assert.equal(opened.length, 1)
})

test('an unconfigured personal credential fails cleanly and is not retried', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reset()
  start = () =>
    Promise.reject(
      new Error(
        `__ATLAS_API_ERROR__${JSON.stringify({
          message: 'Personal credential is not configured',
          code: 'personal_credential_not_configured',
        })}`,
      ),
    )

  await connectPersonalCredential('google-drive', 'team-drive')
  t.mock.timers.tick(10 * 60_000)
  assert.deepEqual(errors, [
    ['Could not connect Google Drive', 'Not configured on this server yet'],
  ])
  assert.deepEqual(apiErrors, [])
  assert.deepEqual(opened, [])
  assert.equal(starts.length, 1)
})

test('another provider’s deep link does not settle the pending attempt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reset()
  let settled = false
  const connecting = connectPersonalCredential('linear', undefined).then(() => {
    settled = true
  })

  await Promise.resolve()
  await Promise.resolve()
  announcePersonalCredential({ provider: 'github', login: 'other' })
  await Promise.resolve()
  assert.equal(settled, false)

  announcePersonalCredential({ provider: 'linear', error: 'access_denied' })
  await connecting
  assert.equal(settled, true)
  assert.deepEqual(errors, [['Couldn’t connect Linear', 'Please try again.']])
})

test('failure to open the browser clears pending state without waiting for expiry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reset()
  const failure = new Error('browser unavailable')

  open = () => Promise.reject(failure)

  await connectPersonalCredential('github', undefined)
  assert.deepEqual(apiErrors, [['Could not connect GitHub', failure]])

  t.mock.timers.tick(10 * 60_000)
  assert.deepEqual(errors, [])
  assert.equal(starts.length, 1)
})
