// Linear through Composio: the managed Linear OAuth app holds the grant and
// Cerin calls api.linear.app through Composio Proxy Execute. Only the GraphQL
// endpoint is exposed, and no Linear token is ever stored or handed out.
import { createHmac, timingSafeEqual } from 'node:crypto'

import { config } from '@/config'
import { composioProxyExecute } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { LinearWorkspaceBinding } from '@/models'

export const LINEAR_CONNECTOR: ComposioConnectorSpec = {
  provider: 'linear',
  displayName: 'Linear',
  toolkitSlug: 'linear',
}

export const LINEAR_PROXY: ComposioProxySpec = {
  ...LINEAR_CONNECTOR,
  baseUrl: 'https://api.linear.app',
  methods: ['POST'],
  allowPath: (path) => path === '/graphql',
}

export class LinearApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export type LinearConnection = Pick<LinearWorkspaceBinding, 'composioAccountId' | 'composioUserId'>

export function linearProxy(
  connection: LinearConnection,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  return composioProxyExecute(LINEAR_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
}

export async function linearGraphql<T>(
  connection: LinearConnection,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { status, data } = await linearProxy(connection, {
    method: 'POST',
    path: '/graphql',
    body: { query, variables: variables ?? {} },
  })
  const payload = data as { data?: T; errors?: { message?: string }[] } | null

  if (status < 200 || status >= 300) {
    const detail = payload?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('; ')

    throw new LinearApiError(
      status,
      `Linear GraphQL failed: ${String(status)} ${detail ?? ''}`.trim(),
    )
  }
  if (payload?.errors?.length) {
    throw new LinearApiError(
      400,
      `Linear GraphQL error: ${payload.errors.map((e) => e.message).join('; ')}`,
    )
  }
  if (payload?.data === undefined) {
    throw new LinearApiError(502, 'Linear GraphQL returned an empty response')
  }

  return payload.data
}

// Identifies the authorising user + their organization (workspace) at setup so
// the binding can be labelled and deduped, mirroring the native viewer probe.
export async function linearViewer(connection: LinearConnection): Promise<{
  user: { id: string; name: string | null }
  organization: { id: string; name: string; urlKey: string | null }
}> {
  const data = await linearGraphql<{
    viewer: { id: string; name: string | null } | null
    organization: { id: string; name: string; urlKey: string | null } | null
  }>(
    connection,
    `query CerinViewer {
      viewer { id name }
      organization { id name urlKey }
    }`,
  )

  if (!data.viewer || !data.organization) {
    throw new AppError(502, 'linear_invalid_profile', 'Linear profile is unavailable')
  }

  return { user: data.viewer, organization: data.organization }
}

// ── Webhook signature ──
//
// Linear signs webhook deliveries with an HMAC-SHA256 of the raw request body,
// keyed by the app's webhook signing secret, sent hex-encoded in the
// `Linear-Signature` header. timingSafeEqual avoids leaking via comparison time.
export function verifyWebhookSignature(
  rawBody: Uint8Array,
  header: string | null | undefined,
): boolean {
  const secret = config.byos.linear.webhookSecret

  if (!secret) return false
  if (!header) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)

  if (provided.length !== expectedBuf.length) return false

  return timingSafeEqual(provided, expectedBuf)
}
