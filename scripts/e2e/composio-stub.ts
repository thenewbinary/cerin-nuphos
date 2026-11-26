// Composio as the backend sees it: Connect Link, connected accounts and the provider proxy.
// Every URL it serves is loopback-only; Connect Link redirects are answered by the scenarios.
import { createServer } from 'node:http'

type AuthConfig = {
  id: string
  toolkit: string
  managed: boolean
  authScheme: string
  createdAt: string
}

type ConnectedAccount = {
  id: string
  userId: string
  authConfigId: string
  toolkit: string
  gitlabAccountId?: number
}

type LinkBody = {
  auth_config_id?: string
  user_id?: string
}

type ProxyBody = {
  connected_account_id?: string
  endpoint?: string
}

const authConfigs = new Map<string, AuthConfig>()
const accounts = new Map<string, ConnectedAccount>()
const deleted: string[] = []
const gitlabAccountIds: number[] = []
let configCount = 0
let accountCount = 0

/** The GitLab identity the next Connect Link stands for. */
export function queueGitlabAccount(accountId: number) {
  gitlabAccountIds.push(accountId)
}

/** Connected accounts deleted by the backend, oldest first. */
export const composioDeletedAccounts = () => [...deleted]

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function accountView(account: ConnectedAccount) {
  return {
    status: 'ACTIVE',
    user_id: account.userId,
    toolkit: { slug: account.toolkit },
    auth_config: { id: account.authConfigId },
  }
}

async function answer(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/v3\.1/u, '')
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (path === '/auth_configs' && request.method === 'GET') {
    const toolkit = url.searchParams.get('toolkit_slug')
    const managed = url.searchParams.get('is_composio_managed') === 'true'
    const items = [...authConfigs.values()]
      .filter((config) => config.toolkit === toolkit && config.managed === managed)
      .map((config) => ({
        id: config.id,
        created_at: config.createdAt,
        auth_scheme: config.authScheme,
      }))

    return json({ items })
  }
  if (path === '/auth_configs' && request.method === 'POST') {
    const toolkit = (body.toolkit as { slug?: string } | undefined)?.slug
    const auth = body.auth_config as { type?: string; authScheme?: string } | undefined

    if (!toolkit) return json({ error: { message: 'Missing toolkit' } }, 400)
    configCount += 1
    const config: AuthConfig = {
      id: `ac_e2e_${String(configCount)}`,
      toolkit,
      managed: auth?.type === 'use_composio_managed_auth',
      authScheme: auth?.authScheme ?? 'OAUTH2',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, configCount)).toISOString(),
    }

    authConfigs.set(config.id, config)

    return json({ auth_config: { id: config.id } }, 201)
  }
  if (path === '/connected_accounts/link' && request.method === 'POST') {
    const link = body as LinkBody
    const config = authConfigs.get(link.auth_config_id ?? '')

    if (!config || !link.user_id) {
      return json({ error: { message: 'Unknown auth config or user' } }, 400)
    }
    accountCount += 1
    const account: ConnectedAccount = {
      id: `ca_e2e_${String(accountCount)}`,
      userId: link.user_id,
      authConfigId: config.id,
      toolkit: config.toolkit,
      ...(config.toolkit === 'gitlab'
        ? { gitlabAccountId: gitlabAccountIds.shift() ?? 4000 + accountCount }
        : {}),
    }

    accounts.set(account.id, account)

    return json({
      connected_account_id: account.id,
      redirect_url: `https://connect.composio.dev/link/${account.id}`,
    })
  }
  const accountMatch = /^\/connected_accounts\/([^/]+)$/u.exec(path)

  if (accountMatch && request.method === 'GET') {
    const account = accounts.get(accountMatch[1]!)

    return account ? json(accountView(account)) : json({ error: { message: 'Not found' } }, 404)
  }
  if (accountMatch && request.method === 'DELETE') {
    const id = accountMatch[1]!

    deleted.push(id)
    accounts.delete(id)

    return json({})
  }
  if (path === '/tools/execute/proxy' && request.method === 'POST') {
    const proxy = body as ProxyBody
    const account = accounts.get(proxy.connected_account_id ?? '')

    if (!account) return json({ error: { message: 'Unknown connected account' } }, 404)
    if (account.toolkit === 'gitlab' && proxy.endpoint === 'https://gitlab.com/api/v4/user') {
      const id = account.gitlabAccountId!

      return json({
        status: 200,
        data: {
          id,
          username: `fixture-${String(id)}`,
          name: `Fixture Owner ${String(id)}`,
          avatar_url: null,
        },
      })
    }
    if (
      account.toolkit === 'gitlab' &&
      proxy.endpoint?.startsWith('https://gitlab.com/api/v4/projects')
    ) {
      return json({ status: 200, data: [] })
    }
    if (
      account.toolkit === 'cloudflare' &&
      proxy.endpoint === 'https://api.cloudflare.com/client/v4/accounts'
    ) {
      return json({
        status: 200,
        data: {
          success: true,
          result: [{ id: '0123456789abcdef0123456789abcdef', name: 'Cerin Cloudflare' }],
        },
      })
    }

    return json({ error: { message: `Unexpected proxy endpoint ${String(proxy.endpoint)}` } }, 400)
  }

  return json(
    { error: { message: `Unknown Composio fixture route ${request.method} ${path}` } },
    404,
  )
}

/** Starts it on a free port; the backend's environment to reach it. */
export async function startComposioStub(): Promise<Record<string, string>> {
  authConfigs.clear()
  accounts.clear()
  deleted.length = 0
  gitlabAccountIds.length = 0
  configCount = 0
  accountCount = 0
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const method = request.method ?? 'GET'
      const body = Buffer.concat(chunks)
      const fetchRequest = new Request(`http://composio${request.url ?? '/'}`, {
        method,
        ...(method === 'GET' || method === 'DELETE' || body.length === 0 ? {} : { body }),
      })

      void answer(fetchRequest)
        .then(async (answer) => {
          response.writeHead(answer.status, { 'content-type': 'application/json' })
          response.end(Buffer.from(await answer.arrayBuffer()))
        })
        .catch((error: unknown) => {
          response.writeHead(500, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ error: { message: String(error) } }))
        })
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  server.unref()
  const { port } = server.address() as { port: number }

  return {
    CERIN_COMPOSIO_API_KEY: 'e2e-composio-key-not-a-production-credential',
    CERIN_COMPOSIO_API_URL: `http://127.0.0.1:${String(port)}/api/v3.1`,
  }
}
