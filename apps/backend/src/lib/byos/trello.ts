import { z } from 'zod'

import { composioConnectLink, verifyComposioConnection } from '@/lib/composio-connect'
import { composioRequest } from '@/lib/composio'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec } from '@/lib/composio-connect'

const TRELLO_CONNECTOR: ComposioConnectorSpec = {
  provider: 'trello',
  displayName: 'Trello',
  toolkitSlug: 'trello',
  verificationErrorMessage: 'Trello connection is inactive or does not match this authorization',
}

const VERSION = '20261104_00'

const id = z.string().regex(/^[a-f0-9]{24}$/iu)
const memberId = z.union([z.literal('me'), id])
const date = z.string().datetime({ offset: true })
const position = z.union([z.enum(['top', 'bottom']), z.number().finite().nonnegative()])
const name = z.string().trim().min(1).max(1024)
const description = z.string().max(16384)
const text = z.string().min(1).max(16384)
const csv = (allowed: readonly string[]) =>
  z
    .string()
    .max(200)
    .refine((value) => value.split(',').every((field) => allowed.includes(field)))
const boardFields = csv([
  'id',
  'name',
  'desc',
  'closed',
  'url',
  'shortUrl',
  'idOrganization',
]).default('id,name,url,closed')
const listFields = csv(['id', 'name', 'closed', 'idBoard', 'pos']).default(
  'id,name,closed,idBoard,pos',
)
const cardFields = csv([
  'id',
  'name',
  'desc',
  'closed',
  'idBoard',
  'idList',
  'url',
  'shortUrl',
  'due',
  'pos',
  'dateLastActivity',
]).default('id,name,desc,closed,idBoard,idList,url,due')
const page = {
  fields: cardFields,
  limit: z.number().int().min(1).max(100).default(100),
  before: z.union([id, date]).optional(),
}
const cardChanges = {
  name: name.optional(),
  desc: description.optional(),
  closed: z.boolean().optional(),
  due: date.optional(),
  pos: position.optional(),
}

const TOOL_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  TRELLO_GET_MEMBERS_BY_ID_MEMBER: z
    .object({
      idMember: memberId,
      fields: csv(['id', 'username', 'fullName', 'url']).default('id,username'),
    })
    .strict(),
  TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER: z
    .object({
      idMember: memberId,
      fields: boardFields,
      filter: z.enum(['all', 'open', 'closed', 'starred']).default('open'),
    })
    .strict(),
  TRELLO_GET_BOARDS_BY_ID_BOARD: z.object({ idBoard: id, fields: boardFields }).strict(),
  TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD: z
    .object({
      idBoard: id,
      fields: listFields,
      filter: z.enum(['all', 'open', 'closed']).default('open'),
    })
    .strict(),
  TRELLO_GET_BOARDS_CARDS_BY_ID_BOARD: z.object({ idBoard: id, ...page }).strict(),
  TRELLO_GET_LISTS_CARDS_BY_ID_LIST: z.object({ idList: id, ...page }).strict(),
  TRELLO_GET_CARDS_BY_ID_CARD: z.object({ idCard: id, fields: cardFields }).strict(),
  TRELLO_ADD_LISTS: z.object({ name, idBoard: id, pos: position.optional() }).strict(),
  TRELLO_UPDATE_LISTS_BY_ID_LIST: z
    .object({
      idList: id,
      name: name.optional(),
      closed: z.boolean().optional(),
      pos: position.optional(),
    })
    .strict(),
  TRELLO_ADD_CARDS: z
    .object({
      name,
      idList: id,
      desc: description.optional(),
      due: date.optional(),
      pos: position.optional(),
    })
    .strict(),
  TRELLO_UPDATE_CARDS_BY_ID_CARD: z.object({ idCard: id, ...cardChanges }).strict(),
  TRELLO_UPDATE_CARDS_ID_LIST_BY_ID_CARD: z.object({ idCard: id, value: id }).strict(),
  TRELLO_ADD_CARDS_ACTIONS_COMMENTS_BY_ID_CARD: z.object({ idCard: id, text }).strict(),
}

export const TRELLO_TOOLS = new Set(Object.keys(TOOL_SCHEMAS))

export function trelloToolArguments(tool: string, args: Record<string, unknown>) {
  const parsed = TOOL_SCHEMAS[tool]?.safeParse(args)

  if (!parsed?.success)
    throw new AppError(400, 'trello_arguments_not_allowed', 'Unsupported Trello tool arguments')

  // Every input of the pinned Composio Trello tools is a string; numbers and booleans fail there.
  return Object.fromEntries(Object.entries(parsed.data).map(([key, value]) => [key, String(value)]))
}

export async function trelloConnectLink(userId: string, callbackUrl: string) {
  return composioConnectLink(TRELLO_CONNECTOR, userId, callbackUrl)
}

export async function verifyTrelloConnection(accountId: string, userId: string) {
  return verifyComposioConnection(TRELLO_CONNECTOR, accountId, userId)
}

export async function executeTrelloTool(
  accountId: string,
  userId: string,
  tool: string,
  args: Record<string, unknown>,
) {
  if (!TRELLO_TOOLS.has(tool))
    throw new AppError(400, 'trello_tool_not_allowed', 'Unsupported Trello tool')
  const toolArguments = trelloToolArguments(tool, args)

  await verifyTrelloConnection(accountId, userId)
  const result = await composioRequest<{ successful: boolean; data: unknown; log_id?: unknown }>(
    'POST',
    `/tools/execute/${tool}`,
    {
      connected_account_id: accountId,
      user_id: userId,
      arguments: toolArguments,
      version: VERSION,
    },
  )

  if (!result.successful)
    throw new AppError(
      502,
      'trello_tool_failed',
      // The upstream error text can echo request URLs, so only Composio's log id goes out:
      // it finds the exact failure in the Composio dashboard's logs.
      `Trello denied or could not complete this operation (Composio log ${typeof result.log_id === 'string' ? result.log_id : 'unavailable'}). Do not automatically retry a write.`,
    )

  return { successful: true, data: result.data }
}
