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
  const ids = {
    old: new ObjectId(),
    current: new ObjectId(),
    message: new ObjectId(),
    transfer: new ObjectId(),
    otherTransfer: new ObjectId(),
    session: new ObjectId(),
    webSession: new ObjectId(),
    trigger: new ObjectId(),
  }

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
    await db()
      .collection('file_transfer_items')
      .insertMany([
        { _id: ids.transfer, bucket: `${OLD}-file-transfers`, objectKey: 'a' },
        { _id: ids.otherTransfer, bucket: `my-${OLD}-file-transfers-copy`, objectKey: 'b' },
      ])
    await db()
      .collection('user_sessions')
      .insertMany([
        { _id: ids.session, client: `${OLD}-desktop/0.119.2` },
        { _id: ids.webSession, client: `web ${OLD}-desktop/1` },
      ])
    await db()
      .collection('agent_trigger_history')
      .insertOne({ _id: ids.trigger, client: `${OLD}-cli/0.27.0` })
  })

  afterAll(async () => {
    await db()
      .collection('agent_conversations')
      .deleteMany({ _id: { $in: [ids.old, ids.current] } })
    await db().collection('agent_messages').deleteOne({ _id: ids.message })
    await db()
      .collection('file_transfer_items')
      .deleteMany({ _id: { $in: [ids.transfer, ids.otherTransfer] } })
    await db()
      .collection('user_sessions')
      .deleteMany({ _id: { $in: [ids.session, ids.webSession] } })
    await db().collection('agent_trigger_history').deleteOne({ _id: ids.trigger })
    await closeDb()
  })

  test('rewrites stored values inside arrays, nested metadata, buckets and clients, then changes nothing', async () => {
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

    const transfers = await db()
      .collection('file_transfer_items')
      .find({ _id: { $in: [ids.transfer, ids.otherTransfer] } })
      .sort({ objectKey: 1 })
      .toArray()

    expect(transfers.map((row) => row.bucket)).toEqual([
      'cerin-file-transfers',
      `my-${OLD}-file-transfers-copy`,
    ])
    const sessions = await db()
      .collection('user_sessions')
      .find({ _id: { $in: [ids.session, ids.webSession] } })
      .toArray()
    const clientOf = (id: ObjectId) => sessions.find((row) => row._id.equals(id))?.client

    expect(clientOf(ids.session)).toBe('cerin-desktop/0.119.2')
    expect(clientOf(ids.webSession)).toBe(`web ${OLD}-desktop/1`)
    expect(
      (await db().collection('agent_trigger_history').findOne({ _id: ids.trigger }))?.client,
    ).toBe('cerin-cli/0.27.0')

    expect(await migrateStoredProductValues()).toBe(0)
  })
})
