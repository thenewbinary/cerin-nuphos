import { createHmac, randomBytes } from 'node:crypto'

import { expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'

import { config } from '@/config'

import { registerSlackCommandRoutes } from './commands'

import type { AuthVariables } from '@/middleware/auth'

test('Slack commands accept Cerin and legacy names and show Cerin usage', async () => {
  const saved = config.slack.signingSecret
  const secret = randomBytes(16).toString('hex')
  const timestamp = String(Math.floor(Date.now() / 1000))
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
  const app = new Hono<{ Variables: AuthVariables }>()

  registerSlackCommandRoutes(app)
  config.slack.signingSecret = secret

  try {
    for (const command of ['/cerin', '/nuphos', '/other']) {
      const body = new URLSearchParams({
        command,
        team_id: 'workspace',
        user_id: 'user',
        response_url: 'https://slack.test/response',
        text: 'help',
      }).toString()
      const signature = `v0=${createHmac('sha256', secret)
        .update(`v0:${timestamp}:${body}`)
        .digest('hex')}`
      const response = await app.request('/commands', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': signature,
        },
        body,
      })

      expect(response.status).toBe(200)
      await new Promise((resolve) => setImmediate(resolve))
    }

    expect(fetchSpy.mock.calls).toHaveLength(2)
    for (const call of fetchSpy.mock.calls) {
      const init = call[1]

      if (typeof init?.body !== 'string') throw new Error('Expected a JSON response body')
      expect(JSON.parse(init.body)).toEqual({
        response_type: 'ephemeral',
        text: expect.stringContaining('/cerin pickup'),
      })
    }
  } finally {
    config.slack.signingSecret = saved
    fetchSpy.mockRestore()
  }
})
