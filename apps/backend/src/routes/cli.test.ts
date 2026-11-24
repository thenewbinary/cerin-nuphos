import { describe, expect, test } from 'bun:test'

import { config } from '@/config'
import { cliConfig } from '@/config/cli'
import { resetRuntimeReleaseCache } from '@/lib/claude-code-preview/runtime-release'
import { createCliRoutes } from '@/routes/cli'

describe('GET /cli/latest', () => {
  test.each([
    { env: undefined, repo: 'thenewbinary/cerin-nuphos' },
    { env: 'example/cerin-releases', repo: 'example/cerin-releases' },
  ])('reads CLI releases from $repo with env $env', async ({ env, repo }) => {
    const originalEnv = process.env.CERIN_CLI_RELEASES_REPO
    const originalConfig = config.cli
    const originalFetch = globalThis.fetch
    const requests: string[] = []

    resetRuntimeReleaseCache()
    try {
      if (env === undefined) delete process.env.CERIN_CLI_RELEASES_REPO
      else process.env.CERIN_CLI_RELEASES_REPO = env
      config.cli = cliConfig()
      globalThis.fetch = (async (input: string | URL | Request) => {
        requests.push(input instanceof Request ? input.url : String(input))

        return Response.json([{ tag_name: 'runtime-v99.0.0' }, { tag_name: 'cli-v0.5.4' }])
      }) as typeof fetch

      const res = await createCliRoutes().request('/latest')

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('0.5.4\n')
      expect(res.headers.get('content-type')).toContain('text/plain')
      expect(res.headers.get('cache-control')).toBe('public, max-age=300')
      expect(requests).toEqual([`https://api.github.com/repos/${repo}/releases?per_page=50`])
    } finally {
      if (originalEnv === undefined) delete process.env.CERIN_CLI_RELEASES_REPO
      else process.env.CERIN_CLI_RELEASES_REPO = originalEnv
      config.cli = originalConfig
      globalThis.fetch = originalFetch
      resetRuntimeReleaseCache()
    }
  })

  test('answers the newest version as plain text', async () => {
    const app = createCliRoutes({
      latest: () => Promise.resolve({ version: '0.5.4', url: 'https://x', body: '' }),
    })
    const res = await app.request('/latest')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('0.5.4\n')
  })

  test('says why when the release feed cannot be read', async () => {
    const res = await createCliRoutes({ latest: () => Promise.resolve(null) }).request('/latest')

    expect(res.status).toBe(503)
    expect(await res.text()).toContain('could not be read')
  })
})
