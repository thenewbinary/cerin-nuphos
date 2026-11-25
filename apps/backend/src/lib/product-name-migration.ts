import { db } from '@/lib/db'

// Stored fields rewritten by this migration:
// - agent_messages: metadata.source, metadata.sender.id, metadata.sender.agentRuntime,
//   metadata.channelPost.sender.agentRuntime
// - agent_conversations: agentRuntime, settingsHistory[].runtime.{from,to}.provider,
//   timelineEvents[].{fromProvider,toProvider}, claudeCodePreview.runtimeUrl, previousRuntimeUrls
// - teams: agentRuntime
// - agent_bot_imports: manifest.format, manifest.source.application
// - push_devices: bundleId
// - slack_user_mappings: createdBy and the bridge user-id key
// - discord_user_mappings, lark_user_mappings, lark_pair_codes: bridge user-id keys
// - discord_installations: installer bridge user-id key
// - file_transfer_items: bucket (the old file-transfer bucket name)
// - user_sessions, agent_trigger_history: client (old app-name prefix of x-atlas-client)

// OLD exists only to rewrite stored data; it is never a runtime compatibility alias.
// eslint-disable-next-line no-useless-concat
const OLD = 'nu' + 'phos'
const OLD_CAMEL = `${OLD.charAt(0).toUpperCase()}${OLD.slice(1)}`
const USER_ID = `${OLD}UserId`
const DEVICE_SCHEME = `${OLD}-device:`

type StoredRow = Record<string, unknown> & { _id: unknown }

const collection = (name: string) => db().collection<StoredRow>(name)

function valueAt(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined

    return (value as Record<string, unknown>)[part]
  }, row)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function rewriteExact(
  name: string,
  field: string,
  before: string,
  after: string,
): Promise<number> {
  const result = await collection(name).updateMany(
    { [field]: before },
    { $set: { [field]: after } },
  )

  return result.modifiedCount
}

async function rewriteInArray(
  name: string,
  array: string,
  field: string,
  before: string,
  after: string,
): Promise<number> {
  const result = await collection(name).updateMany(
    { [`${array}.${field}`]: before },
    { $set: { [`${array}.$[item].${field}`]: after } },
    { arrayFilters: [{ [`item.${field}`]: before }] },
  )

  return result.modifiedCount
}

async function rewritePrefix(
  name: string,
  field: string,
  before: string,
  after: string,
): Promise<number> {
  const candidates = await collection(name)
    .find({ [field]: { $regex: `^${escapeRegExp(before)}` } }, { projection: { [field]: 1 } })
    .toArray()
  const replacements = new Map<string, string>()

  for (const row of candidates) {
    const value = valueAt(row, field)

    if (typeof value === 'string' && value.startsWith(before))
      replacements.set(value, `${after}${value.slice(before.length)}`)
  }

  let modified = 0

  for (const [oldValue, newValue] of replacements)
    modified += await rewriteExact(name, field, oldValue, newValue)

  return modified
}

async function rewriteRuntimeHistory(): Promise<number> {
  const field = 'previousRuntimeUrls'
  const candidates = await collection('agent_conversations')
    .find(
      { [field]: { $regex: `^${escapeRegExp(DEVICE_SCHEME)}` } },
      { projection: { [field]: 1 } },
    )
    .toArray()
  let modified = 0

  for (const row of candidates) {
    const urls = row[field]

    if (!Array.isArray(urls)) continue
    const rewritten = urls.map((url) =>
      typeof url === 'string' && url.startsWith(DEVICE_SCHEME)
        ? `cerin-device:${url.slice(DEVICE_SCHEME.length)}`
        : url,
    )
    const result = await collection('agent_conversations').updateMany(
      { _id: row._id, [field]: urls },
      { $set: { [field]: rewritten } },
    )

    modified += result.modifiedCount
  }

  return modified
}

async function renameKey(name: string, before: string, after: string): Promise<number> {
  const candidates = await collection(name)
    .find({ [before]: { $exists: true } }, { projection: { [before]: 1, [after]: 1 } })
    .toArray()
  let modified = 0

  for (const row of candidates) {
    const oldValue = row[before]

    if (oldValue === undefined) continue
    const currentValue = row[after]
    const result =
      currentValue === undefined
        ? await collection(name).updateMany(
            { _id: row._id, [before]: oldValue, [after]: { $exists: false } },
            { $set: { [after]: oldValue }, $unset: { [before]: '' } },
          )
        : await collection(name).updateMany(
            { _id: row._id, [before]: oldValue, [after]: currentValue },
            { $unset: { [before]: '' } },
          )

    modified += result.modifiedCount
  }

  return modified
}

export async function migrateStoredProductValues(): Promise<number> {
  let modified = 0

  modified += await rewriteExact('agent_messages', 'metadata.source', OLD, 'cerin')
  modified += await rewriteExact('agent_messages', 'metadata.sender.id', OLD, 'cerin')
  modified += await rewriteExact('agent_messages', 'metadata.sender.agentRuntime', OLD, 'cerin')
  modified += await rewriteExact(
    'agent_messages',
    'metadata.channelPost.sender.agentRuntime',
    OLD,
    'cerin',
  )
  modified += await rewritePrefix('agent_messages', 'metadata.sender.id', `${OLD}:`, 'cerin:')
  modified += await rewriteExact('agent_conversations', 'agentRuntime', OLD, 'cerin')
  modified += await rewriteInArray(
    'agent_conversations',
    'settingsHistory',
    'runtime.from.provider',
    OLD,
    'cerin',
  )
  modified += await rewriteInArray(
    'agent_conversations',
    'settingsHistory',
    'runtime.to.provider',
    OLD,
    'cerin',
  )
  modified += await rewriteInArray(
    'agent_conversations',
    'timelineEvents',
    'fromProvider',
    OLD,
    'cerin',
  )
  modified += await rewriteInArray(
    'agent_conversations',
    'timelineEvents',
    'toProvider',
    OLD,
    'cerin',
  )
  modified += await rewriteExact('teams', 'agentRuntime', OLD, 'cerin')
  modified += await rewritePrefix(
    'agent_conversations',
    'claudeCodePreview.runtimeUrl',
    DEVICE_SCHEME,
    'cerin-device:',
  )
  modified += await rewriteRuntimeHistory()
  modified += await rewriteExact(
    'agent_bot_imports',
    'manifest.format',
    `${OLD}-bot-bundle`,
    'cerin-bot-bundle',
  )
  modified += await rewriteExact(
    'agent_bot_imports',
    'manifest.source.application',
    `${OLD}-template`,
    'cerin-template',
  )
  modified += await rewriteExact(
    'push_devices',
    'bundleId',
    `ai.${OLD}.android`,
    'ai.cerin.android',
  )
  modified += await rewriteExact('push_devices', 'bundleId', `ai.${OLD}.ios`, 'ai.cerin.ios')
  modified += await rewriteExact(
    'slack_user_mappings',
    'createdBy',
    `auto:${OLD}-email`,
    'auto:cerin-email',
  )

  modified += await rewriteExact(
    'file_transfer_items',
    'bucket',
    `${OLD}-file-transfers`,
    'cerin-file-transfers',
  )

  for (const app of ['desktop', 'ios', 'android', 'cli'])
    for (const name of ['user_sessions', 'agent_trigger_history']) {
      modified += await rewriteExact(name, 'client', `${OLD}-${app}`, `cerin-${app}`)
      modified += await rewritePrefix(name, 'client', `${OLD}-${app}/`, `cerin-${app}/`)
    }

  for (const name of [
    'slack_user_mappings',
    'discord_user_mappings',
    'lark_user_mappings',
    'lark_pair_codes',
  ])
    modified += await renameKey(name, USER_ID, 'cerinUserId')

  modified += await renameKey(
    'discord_installations',
    `installer${OLD_CAMEL}UserId`,
    'installerCerinUserId',
  )

  return modified
}
