// The array rewrites use arrayFilters, which only a real MongoDB evaluates.
// Runs when TEST_MONGODB_URI is set, with MONGODB_URI pointing at the same server.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ObjectId } from 'mongodb'

import { closeDb, connectDb, db } from '@/lib/db'

import { migrateStoredProductValues } from './product-name-migration'

// Builds the former value only to seed the stored data this migration rewrites.
// eslint-disable-next-line no-useless-concat
const OLD = 'nu' + 'phos'

describe.skipIf(!process.env.TEST_MONGODB_URI)('migrateStoredProductValues', () => {
  const ids = { old: new ObjectId(), current: new ObjectId(), message: new ObjectId() }

  beforeAll(async () => {
    await connectDb()
    await db()
      .collection('agent_conversations')
      .insertMany([
        {
          _id: ids.old,
          agentRuntime: OLD,
          settingsHistory: [
            { runtime: { from: { provider: OLD }, to: { provider: 'codex' } } },
            { runtime: { from: { provider: 'codex' }, to: { provider: OLD } } },
            { title: { from: 'a', to: 'b' } },
          ],
          timelineEvents: [
            { kind: 'runtime_moved', fromProvider: OLD, toProvider: 'codex' },
            { kind: 'other' },
          ],
        },
        { _id: ids.current, agentRuntime: 'codex', settingsHistory: [], timelineEvents: [] },
      ])
    await db()
      .collection('agent_messages')
      .insertOne({
        _id: ids.message,
        metadata: { source: OLD, sender: { id: `${OLD}:decision`, agentRuntime: OLD } },
      })
  })

  afterAll(async () => {
    await db()
      .collection('agent_conversations')
      .deleteMany({ _id: { $in: [ids.old, ids.current] } })
    await db().collection('agent_messages').deleteOne({ _id: ids.message })
    await closeDb()
  })

  test('rewrites stored values inside arrays and nested metadata, then changes nothing', async () => {
    expect(await migrateStoredProductValues()).toBeGreaterThan(0)

    const conversation = await db().collection('agent_conversations').findOne({ _id: ids.old })

    expect(conversation?.agentRuntime).toBe('cerin')
    expect(conversation?.settingsHistory).toEqual([
      { runtime: { from: { provider: 'cerin' }, to: { provider: 'codex' } } },
      { runtime: { from: { provider: 'codex' }, to: { provider: 'cerin' } } },
      { title: { from: 'a', to: 'b' } },
    ])
    expect(conversation?.timelineEvents).toEqual([
      { kind: 'runtime_moved', fromProvider: 'cerin', toProvider: 'codex' },
      { kind: 'other' },
    ])
    const message = await db().collection('agent_messages').findOne({ _id: ids.message })

    expect(message?.metadata).toEqual({
      source: 'cerin',
      sender: { id: 'cerin:decision', agentRuntime: 'cerin' },
    })

    expect(await migrateStoredProductValues()).toBe(0)
  })
})
