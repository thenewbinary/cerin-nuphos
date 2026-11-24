import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  KEYCHAIN_SERVICE,
  LEGACY_KEYCHAIN_SERVICE,
  withLegacyKeychain,
} from './token-store.ts'
import {
  LEGACY_PROVIDER_KEYCHAIN_SERVICE,
  PROVIDER_KEYCHAIN_SERVICE,
} from '../main/local-runtime/custom-provider.ts'

import type { TokenStore } from './token-store.ts'

test('keychain services use Cerin and retain their legacy names for migration', () => {
  assert.equal(KEYCHAIN_SERVICE, 'ai.cerin.desktop.session')
  assert.equal(LEGACY_KEYCHAIN_SERVICE, 'ai.nuphos.desktop.session')
  assert.equal(PROVIDER_KEYCHAIN_SERVICE, 'ai.cerin.desktop.provider')
  assert.equal(LEGACY_PROVIDER_KEYCHAIN_SERVICE, 'ai.nuphos.desktop.provider')
})

test('a legacy credential is copied to the new service and removed from the old one', async () => {
  const items = new Map([['legacy:account', 'token']])
  const calls: string[] = []
  const store = (name: string): TokenStore => ({
    get: async (account) => {
      calls.push(`${name}:get`)
      return items.get(`${name}:${account}`) ?? null
    },
    set: async (account, token) => {
      calls.push(`${name}:set`)
      items.set(`${name}:${account}`, token)
    },
    delete: async (account) => {
      calls.push(`${name}:delete`)
      items.delete(`${name}:${account}`)
    },
  })
  const migrated = withLegacyKeychain(store('new'), store('legacy'))

  assert.equal(await migrated.get('account'), 'token')
  assert.equal(items.get('new:account'), 'token')
  assert.equal(items.has('legacy:account'), false)
  assert.deepEqual(calls, ['new:get', 'legacy:get', 'new:set', 'legacy:delete'])
})

test('an existing new credential does not read or remove the legacy entry', async () => {
  const items = new Map([
    ['new:account', 'new-token'],
    ['legacy:account', 'old-token'],
  ])
  let legacyReads = 0
  const store = (name: string): TokenStore => ({
    get: async (account) => {
      if (name === 'legacy') legacyReads += 1
      return items.get(`${name}:${account}`) ?? null
    },
    set: async (account, token) => {
      items.set(`${name}:${account}`, token)
    },
    delete: async (account) => {
      items.delete(`${name}:${account}`)
    },
  })

  assert.equal(await withLegacyKeychain(store('new'), store('legacy')).get('account'), 'new-token')
  assert.equal(legacyReads, 0)
  assert.equal(items.get('legacy:account'), 'old-token')
})
