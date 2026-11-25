import { beforeEach, expect, test } from 'bun:test'

import { useDb } from '@/lib/test/doubles/db'
import { portabilityDb } from '@/lib/test/runtime-portability-db'

import type * as dbActual from '@/lib/db'

// Fixtures construct the former value only to verify this one-way stored-data rewrite.
// eslint-disable-next-line no-useless-concat
const OLD = 'nu' + 'phos'
const OLD_CAMEL = `${OLD.charAt(0).toUpperCase()}${OLD.slice(1)}`
const USER_ID = `${OLD}UserId`
const INSTALLER_USER_ID = `installer${OLD_CAMEL}UserId`
const DEVICE_SCHEME = `${OLD}-device:`

const COLLECTIONS = [
  'agent_messages',
  'agent_conversations',
  'teams',
  'agent_bot_imports',
  'push_devices',
  'slack_user_mappings',
  'discord_user_mappings',
  'discord_installations',
  'lark_user_mappings',
  'lark_pair_codes',
]

let memory = portabilityDb()

useDb({ db: (() => memory) as unknown as typeof dbActual.db })

const { migrateStoredProductValues } = await import('./product-name-migration')

beforeEach(() => {
  memory = portabilityDb()
})

function snapshot() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, structuredClone(memory.rows(name))]))
}

test('rewrites stored product values and keys once, without touching current or unrelated data', async () => {
  const messages = memory.collection('agent_messages')

  await messages.insertOne({
    _id: 'message-exact',
    metadata: {
      source: OLD,
      sender: { id: OLD, agentRuntime: OLD },
      channelPost: { sender: { agentRuntime: OLD } },
    },
  })
  for (const suffix of ['bot-onboarding', 'credentials', 'decision', 'future-system'])
    await messages.insertOne({
      _id: `message-${suffix}`,
      metadata: { sender: { id: `${OLD}:${suffix}` } },
    })
  await messages.insertOne({
    _id: 'message-current',
    metadata: { source: 'slack', sender: { id: 'cerin' }, unattested: true },
  })

  await memory.collection('agent_conversations').insertOne({
    _id: 'conversation-old',
    agentRuntime: OLD,
    claudeCodePreview: { runtimeUrl: `${DEVICE_SCHEME}//runtime/owner/device-a?team=team` },
    previousRuntimeUrls: [
      `${DEVICE_SCHEME}//runtime/owner/device-b?team=team`,
      'wss://runtime.example/acp',
      `${DEVICE_SCHEME}//runtime/owner/device-c?team=team`,
    ],
  })
  await memory.collection('agent_conversations').insertOne({
    _id: 'conversation-current',
    agentRuntime: 'codex',
    claudeCodePreview: { runtimeUrl: 'wss://runtime.example/acp' },
    previousRuntimeUrls: ['wss://previous.example/acp'],
  })
  await memory.collection('teams').insertOne({ _id: 'team-old', agentRuntime: OLD })
  await memory.collection('teams').insertOne({ _id: 'team-current', agentRuntime: 'codex' })
  await memory.collection('agent_bot_imports').insertOne({
    _id: 'import-old',
    manifest: {
      format: `${OLD}-bot-bundle`,
      source: { application: `${OLD}-template`, templateId: 'research' },
    },
  })
  await memory.collection('agent_bot_imports').insertOne({
    _id: 'import-current',
    manifest: {
      format: 'cerin-bot-bundle',
      source: { application: 'cerin-template', templateId: 'desk' },
    },
  })
  await memory.collection('push_devices').insertOne({
    _id: 'push-android',
    bundleId: `ai.${OLD}.android`,
  })
  await memory.collection('push_devices').insertOne({
    _id: 'push-ios',
    bundleId: `ai.${OLD}.ios`,
  })
  await memory.collection('push_devices').insertOne({
    _id: 'push-current',
    bundleId: 'ai.cerin.ios',
  })
  await memory.collection('slack_user_mappings').insertOne({
    _id: 'slack_user_mappings-old',
    [USER_ID]: 'slack_user_mappings-user',
    createdBy: `auto:${OLD}-email`,
  })
  await memory.collection('slack_user_mappings').insertOne({
    _id: 'slack-conflict',
    [USER_ID]: 'stale-user',
    cerinUserId: 'current-user',
  })
  await memory.collection('discord_user_mappings').insertOne({
    _id: 'discord_user_mappings-old',
    [USER_ID]: 'discord_user_mappings-user',
  })
  await memory.collection('discord_installations').insertOne({
    _id: 'discord-installation-old',
    [INSTALLER_USER_ID]: 'installer-user',
  })
  await memory.collection('lark_user_mappings').insertOne({
    _id: 'lark_user_mappings-old',
    [USER_ID]: 'lark_user_mappings-user',
  })
  await memory.collection('lark_pair_codes').insertOne({
    _id: 'lark_pair_codes-old',
    [USER_ID]: 'lark_pair_codes-user',
  })

  expect(await migrateStoredProductValues()).toBeGreaterThan(0)

  expect(await messages.findOne({ _id: 'message-exact' })).toEqual({
    _id: 'message-exact',
    metadata: {
      source: 'cerin',
      sender: { id: 'cerin', agentRuntime: 'cerin' },
      channelPost: { sender: { agentRuntime: 'cerin' } },
    },
  })
  for (const suffix of ['bot-onboarding', 'credentials', 'decision', 'future-system'])
    expect((await messages.findOne({ _id: `message-${suffix}` }))?.metadata.sender.id).toBe(
      `cerin:${suffix}`,
    )
  expect(await messages.findOne({ _id: 'message-current' })).toEqual({
    _id: 'message-current',
    metadata: { source: 'slack', sender: { id: 'cerin' }, unattested: true },
  })

  expect(
    await memory.collection('agent_conversations').findOne({ _id: 'conversation-old' }),
  ).toEqual({
    _id: 'conversation-old',
    agentRuntime: 'cerin',
    claudeCodePreview: { runtimeUrl: 'cerin-device://runtime/owner/device-a?team=team' },
    previousRuntimeUrls: [
      'cerin-device://runtime/owner/device-b?team=team',
      'wss://runtime.example/acp',
      'cerin-device://runtime/owner/device-c?team=team',
    ],
  })
  expect(
    await memory.collection('agent_conversations').findOne({ _id: 'conversation-current' }),
  ).toEqual({
    _id: 'conversation-current',
    agentRuntime: 'codex',
    claudeCodePreview: { runtimeUrl: 'wss://runtime.example/acp' },
    previousRuntimeUrls: ['wss://previous.example/acp'],
  })
  expect((await memory.collection('teams').findOne({ _id: 'team-old' }))?.agentRuntime).toBe(
    'cerin',
  )
  expect((await memory.collection('teams').findOne({ _id: 'team-current' }))?.agentRuntime).toBe(
    'codex',
  )
  expect(
    (await memory.collection('agent_bot_imports').findOne({ _id: 'import-old' }))?.manifest,
  ).toEqual({
    format: 'cerin-bot-bundle',
    source: { application: 'cerin-template', templateId: 'research' },
  })
  expect(
    (await memory.collection('agent_bot_imports').findOne({ _id: 'import-current' }))?.manifest,
  ).toEqual({
    format: 'cerin-bot-bundle',
    source: { application: 'cerin-template', templateId: 'desk' },
  })
  expect((await memory.collection('push_devices').findOne({ _id: 'push-android' }))?.bundleId).toBe(
    'ai.cerin.android',
  )
  expect((await memory.collection('push_devices').findOne({ _id: 'push-ios' }))?.bundleId).toBe(
    'ai.cerin.ios',
  )

  for (const name of [
    'slack_user_mappings',
    'discord_user_mappings',
    'lark_user_mappings',
    'lark_pair_codes',
  ]) {
    const row = await memory.collection(name).findOne({ _id: `${name}-old` })

    expect(row?.cerinUserId).toBe(`${name}-user`)
    expect(row?.[USER_ID]).toBeUndefined()
  }
  expect(
    await memory.collection('slack_user_mappings').findOne({ _id: 'slack_user_mappings-old' }),
  ).toMatchObject({ createdBy: 'auto:cerin-email' })
  expect(await memory.collection('slack_user_mappings').findOne({ _id: 'slack-conflict' })).toEqual(
    { _id: 'slack-conflict', cerinUserId: 'current-user' },
  )
  expect(
    await memory.collection('discord_installations').findOne({ _id: 'discord-installation-old' }),
  ).toEqual({ _id: 'discord-installation-old', installerCerinUserId: 'installer-user' })

  for (const name of COLLECTIONS)
    expect(JSON.stringify(memory.rows(name)).toLowerCase()).not.toContain(OLD)

  const afterFirstRun = snapshot()

  expect(await migrateStoredProductValues()).toBe(0)
  expect(snapshot()).toEqual(afterFirstRun)
})
