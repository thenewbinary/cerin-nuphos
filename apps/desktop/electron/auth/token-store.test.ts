import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  LEGACY_PROVIDER_KEYCHAIN_SERVICE,
  PROVIDER_KEYCHAIN_SERVICE,
} from '../main/local-runtime/custom-provider.ts'

import { KEYCHAIN_SERVICE, LEGACY_KEYCHAIN_SERVICE, withLegacyKeychain } from './token-store.ts'

import type { TokenStore } from './token-store.ts'

test('keychain services use Cerin and retain their legacy names for migration', () => {
  assert.equal(KEYCHAIN_SERVICE, 'ai.cerin.desktop.session')
  assert.equal(LEGACY_KEYCHAIN_SERVICE, 'ai.nuphos.desktop.session')
  assert.equal(PROVIDER_KEYCHAIN_SERVICE, 'ai.cerin.desktop.provider')
  assert.equal(LEGACY_PROVIDER_KEYCHAIN_SERVICE, 'ai.nuphos.desktop.provider')
})

function memoryStores(
  items: Map<string, string>,
  calls: string[] = [],
  fail: Partial<Record<string, 'set' | 'delete'>> = {},
) {
  return (name: string): TokenStore => ({
    get: async (account) => {
      calls.push(`${name}:get`)

      return items.get(`${name}:${account}`) ?? null
    },
    set: async (account, token) => {
      calls.push(`${name}:set`)
      if (fail[name] === 'set') throw new Error('the store refused the write')
      items.set(`${name}:${account}`, token)
    },
    delete: async (account) => {
      calls.push(`${name}:delete`)
      if (fail[name] === 'delete') throw new Error('the store refused the delete')
      items.delete(`${name}:${account}`)
    },
  })
}

test('a legacy credential is copied to the new service and the old item is kept', async () => {
  const items = new Map([['legacy:account', 'token']])
  const calls: string[] = []
  const store = memoryStores(items, calls)
  const migrated = withLegacyKeychain(store('new'), store('legacy'))

  assert.equal(await migrated.get('account'), 'token')
  assert.equal(items.get('new:account'), 'token')
  // The previous app and CLI 0.28.1 and older read only the old item.
  assert.equal(items.get('legacy:account'), 'token')
  assert.deepEqual(calls, ['new:get', 'legacy:get', 'new:set'])
})

test('a store that refuses the copy still returns the legacy token', async () => {
  const items = new Map([['legacy:account', 'token']])
  const store = memoryStores(items, [], { new: 'set' })

  assert.equal(await withLegacyKeychain(store('new'), store('legacy')).get('account'), 'token')
  assert.equal(items.has('new:account'), false)
  assert.equal(items.get('legacy:account'), 'token')
})

test('an existing new credential does not read the legacy entry', async () => {
  const items = new Map([
    ['new:account', 'new-token'],
    ['legacy:account', 'old-token'],
  ])
  const calls: string[] = []
  const store = memoryStores(items, calls)

  assert.equal(await withLegacyKeychain(store('new'), store('legacy')).get('account'), 'new-token')
  assert.deepEqual(calls, ['new:get'])
  assert.equal(items.get('legacy:account'), 'old-token')
})

test('signing out removes both items, so the account does not come back', async () => {
  const items = new Map([
    ['new:account', 'token'],
    ['legacy:account', 'token'],
  ])
  const store = memoryStores(items)
  const migrated = withLegacyKeychain(store('new'), store('legacy'))

  await migrated.delete('account')
  assert.equal(items.size, 0)
  assert.equal(await migrated.get('account'), null)
})

test('signing out still removes the new item when the legacy delete fails', async () => {
  const items = new Map([
    ['new:account', 'token'],
    ['legacy:account', 'token'],
  ])
  const store = memoryStores(items, [], { legacy: 'delete' })

  await assert.rejects(withLegacyKeychain(store('new'), store('legacy')).delete('account'))
  assert.equal(items.has('new:account'), false)
})
