import { LinearApiError, linearGraphql } from '@/lib/byos/linear'
import { AppError } from '@/lib/errors'

import type { LinearWorkspaceVariables } from '@/middleware/auth'
import type { Context } from 'hono'

export function linearReconnectError(): AppError {
  return new AppError(
    409,
    'linear_reconnect_required',
    'Linear authorization expired or was revoked. Reconnect the Linear workspace to continue.',
  )
}

export async function queryBindingGraphql<T>(
  c: Context<{ Variables: LinearWorkspaceVariables }>,
  query: string,
  variables: Record<string, unknown>,
  notFound?: AppError,
): Promise<T> {
  const binding = c.get('linearBinding')

  try {
    return await linearGraphql<T>(binding, query, variables)
  } catch (error) {
    if (error instanceof AppError && error.code === 'linear_reconnect_required')
      throw linearReconnectError()
    if (error instanceof LinearApiError) {
      if (notFound && /entity not found/i.test(error.message)) throw notFound
      throw new AppError(502, 'linear_api_error', error.message)
    }
    throw error
  }
}

export function linearTeamUrl(organizationUrlKey: string | null | undefined, key: string) {
  return organizationUrlKey
    ? `https://linear.app/${encodeURIComponent(organizationUrlKey)}/team/${encodeURIComponent(key)}`
    : null
}
