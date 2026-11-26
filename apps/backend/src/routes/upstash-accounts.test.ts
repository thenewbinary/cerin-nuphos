import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { ObjectId } from 'mongodb'

import { errorHandler } from '@/lib/errors'
import { useByosSecrets } from '@/lib/test/doubles/byos-secrets'
import { useModels } from '@/lib/test/doubles/models'
import { emptyTeamByosBindings } from '@/models'

import { upstashAccountsRoutes } from './upstash-accounts'

import type { TeamAuthVariables } from '@/middleware/auth'
import type { TeamByosBindings } from '@/models'
import type { Filter, UpdateFilter, UpdateOptions } from 'mongodb'

const TEAM = new ObjectId()
const MEMBER = new ObjectId().toHexString()
const EMAIL = 'upstash@example.test'
const realFetch = globalThis.fetch
let stored: TeamByosBindings | null
let writes: { update: UpdateFilter<TeamByosBindings>; options?: UpdateOptions }[]

useByosSecrets({
  encryptUpstashSecret: () => ({
    alg: 'A256GCM',
    keyId: 'fixture',
    iv: 'fixture',
    authTag: 'fixture',
    ciphertext: 'sealed-fixture',
  }),
})
useModels({
  teamByosBindings: () => ({
    updateOne: async (
      filter: Filter<TeamByosBindings>,
      update: UpdateFilter<TeamByosBindings>,
      options?: UpdateOptions,
    ) => {
      writes.push({ update, options })
      if (stored?.upstashAccounts?.some((binding) => binding.email === EMAIL)) {
        throw Object.assign(new Error('Duplicate team document'), { code: 11000 })
      }
      stored ??= {
        _id: filter._id as ObjectId,
        ...update.$setOnInsert,
      } as TeamByosBindings
      stored.upstashAccounts = [
        ...(stored.upstashAccounts ?? []),
        update.$push!.upstashAccounts!,
      ] as TeamByosBindings['upstashAccounts']
      Object.assign(stored, update.$set)

      return { matchedCount: 1, modifiedCount: 1 }
    },
  }),
})

const app = new Hono<{ Variables: TeamAuthVariables }>()

app.onError(errorHandler)
app.use('*', async (c, next) => {
  c.set('teamId', TEAM.toHexString())
  c.set('userId', MEMBER)
  c.set('teamRole', 'ADMINISTRATOR')
  await next()
})
app.route('/upstash-accounts', upstashAccountsRoutes)

beforeEach(() => {
  stored = null
  writes = []
  globalThis.fetch = (async () => Response.json([])) as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

function bind() {
  return app.request('/upstash-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Cache', email: EMAIL, apiKey: 'fixture' }),
  })
}

describe('Upstash binding persistence', () => {
  test('a first connector creates the binding and other defaults without conflicting operators', async () => {
    expect(stored).toBeNull()
    const response = await bind()

    expect(response.status).toBe(201)
    expect(writes).toHaveLength(1)
    const { update, options } = writes[0]!

    expect(options).toEqual({ upsert: true })
    expect(update.$push?.upstashAccounts).toMatchObject({ email: EMAIL })
    expect(update.$setOnInsert).not.toHaveProperty('upstashAccounts')
    expect(update.$setOnInsert).not.toHaveProperty('updatedAt')
    expect(stored).toEqual({
      _id: TEAM,
      ...emptyTeamByosBindings(),
      upstashAccounts: [
        expect.objectContaining({
          email: EMAIL,
          label: 'Cache',
          access: expect.objectContaining({ memberAllowList: [MEMBER], ownerUserId: MEMBER }),
        }),
      ],
      updatedAt: expect.any(Date),
    })
  })

  test('an existing document retains its other bindings and duplicate accounts still return 409', async () => {
    const awsRole = { id: new ObjectId(), roleArn: 'arn:aws:iam::123456789012:role/existing' }

    stored = { _id: TEAM, awsRoles: [awsRole], updatedAt: new Date(0) } as TeamByosBindings
    expect((await bind()).status).toBe(201)
    expect(stored.awsRoles).toMatchObject([awsRole])
    expect(stored.upstashAccounts).toHaveLength(1)
    expect((await bind()).status).toBe(409)
    expect(stored.upstashAccounts).toHaveLength(1)
  })
})
