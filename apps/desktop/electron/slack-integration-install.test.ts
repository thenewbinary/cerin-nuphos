import assert from 'node:assert/strict'
import { before, mock, test } from 'node:test'

let install: typeof import('./slack-integration-install.ts')
const completed: string[][] = []
const cancelled: string[][] = []

before(async () => {
  mock.module('electron', { namedExports: { shell: { openExternal: () => Promise.resolve() } } })
  mock.module('./atlas.ts', {
    namedExports: {
      startSlackIntegrationOAuth: () =>
        Promise.resolve({
          authorizeUrl: 'https://connect.composio.dev/link/example',
          state: 'slack-state',
          expiresAt: '2026-11-26T12:00:00.000Z',
        }),
      completeConnectorOAuth: (teamId: string, state: string, code: string) => {
        completed.push([teamId, state, code])

        return Promise.resolve({
          binding_id: 'slack-binding',
          team_id: teamId,
          account_name: 'Example workspace',
        })
      },
      cancelSlackIntegrationOAuth: (teamId: string, state: string) => {
        cancelled.push([teamId, state])

        return Promise.resolve()
      },
    },
  })
  install = await import('./slack-integration-install.ts')
})

test('Slack connector deep links complete the one-time deferred grant', async () => {
  const connecting = install.startInstall('team-one', {
    mode: 'members',
    memberIds: ['member-one'],
  })

  await new Promise((resolve) => setImmediate(resolve))
  await install.handleCallback(
    'cerin://slack-integration-callback?state=slack-state&deferred=1&code=slack-code',
  )

  assert.deepEqual(await connecting, {
    bindingId: 'slack-binding',
    teamId: 'team-one',
    accountName: 'Example workspace',
  })
  assert.deepEqual(completed, [['team-one', 'slack-state', 'slack-code']])
  assert.deepEqual(cancelled, [])
  assert.equal(install.hasPending('slack-state'), false)
})

test('closing the connector attempt cancels the pending grant without retrying', async () => {
  const connecting = install.startInstall('team-one')

  await new Promise((resolve) => setImmediate(resolve))
  install.cancelPending('team-one')

  await assert.rejects(connecting, /Slack connection cancelled/)
  assert.deepEqual(cancelled, [['team-one', 'slack-state']])
  assert.equal(install.hasPending('slack-state'), false)
  assert.equal(install.isCallbackUrl('cerin://slack-callback?state=slack-state'), false)
})
