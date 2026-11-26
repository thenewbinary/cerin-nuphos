import assert from 'node:assert/strict'
import { before, mock, test } from 'node:test'

let install: typeof import('./cloudflare-install.ts')
const completed: string[][] = []

before(async () => {
  mock.module('electron', { namedExports: { shell: { openExternal: () => Promise.resolve() } } })
  mock.module('./atlas.ts', {
    namedExports: {
      startCloudflareOAuth: (_teamId: string, share?: unknown) =>
        Promise.resolve({
          authorizeUrl: `https://connect.composio.dev/link/${share ? 'shared' : 'private'}`,
          state: 'state-one',
          expiresAt: '2026-11-26T12:00:00.000Z',
        }),
      completeConnectorOAuth: (teamId: string, state: string, code: string) => {
        completed.push([teamId, state, code])

        return Promise.resolve({
          binding_id: 'binding-one',
          team_id: teamId,
          account_id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
          account_name: 'Example account',
        })
      },
      cancelCloudflareOAuth: () => Promise.resolve(),
    },
  })
  install = await import('./cloudflare-install.ts')
})

test('the deferred deep link completes the connection exactly once', async () => {
  const connecting = install.startInstall('team-one', {
    mode: 'members',
    memberIds: ['member-one'],
  })

  await new Promise((resolve) => setImmediate(resolve))
  await install.handleCallback(
    'cerin://cloudflare-callback?state=state-one&deferred=1&code=one-time-code',
  )

  assert.deepEqual(await connecting, {
    bindingId: 'binding-one',
    teamId: 'team-one',
    accountId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    accountName: 'Example account',
  })
  assert.deepEqual(completed, [['team-one', 'state-one', 'one-time-code']])
  assert.equal(install.hasPending('state-one'), false)
})

test('a terminal callback error rejects without reopening or retrying authorization', async () => {
  const connecting = install.startInstall('team-one')

  await new Promise((resolve) => setImmediate(resolve))
  await install.handleCallback(
    'cerin://cloudflare-callback?state=state-one&error=access_denied&error_description=Declined',
  )

  await assert.rejects(connecting, /Cloudflare OAuth failed: Declined/)
  assert.deepEqual(completed, [['team-one', 'state-one', 'one-time-code']])
  assert.equal(install.hasPending('state-one'), false)
  assert.equal(install.isCallbackUrl('https://cloudflare-callback?state=state-one'), false)
})
