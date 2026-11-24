import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import { notFoundHandler } from '@/lib/errors'

import { rootRedirects } from './root-redirects'
import declared from './route-access.json'

const app = new Hono().route('/', rootRedirects).notFound(notFoundHandler)
const redirects = [
  ['/', 'https://cerin.ai'],
  ['/device', '/auth/social/device'],
  ['/install', 'https://cerin.ai/install'],
] as const

describe('root redirects', () => {
  test.each(redirects)('GET %s redirects to %s publicly', async (path, location) => {
    const response = await app.request(path)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(location)
    expect(declared[`GET ${path}`]).toBe('public')
  })

  test.each(redirects)('HEAD %s redirects to %s', async (path, location) => {
    const response = await app.request(path, { method: 'HEAD' })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(location)
    expect(await response.text()).toBe('')
  })

  test.each([
    '?user_code=ABCD-EFGH',
    '?user_code=ABCD-EFGH&next=%2fa%2Fb&label=a+b&label=a%20b&empty=&flag',
    '?',
  ])('preserves the exact device query string %s', async (query) => {
    const response = await app.request(`/device${query}`)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(`/auth/social/device${query}`)
  })

  test.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    '%s falls through to notFound on the redirect paths',
    async (method) => {
      for (const [path] of redirects) {
        const response = await app.request(path, { method })

        expect(response.status).toBe(404)
        expect(response.headers.get('Location')).toBeNull()
        expect(await response.json()).toMatchObject({ error: { code: 'route_not_found' } })
      }
    },
  )

  test.each(['/device/extra', '/install/extra', '/unknown', '/devices', '/installer'])(
    'does not match %s',
    async (path) => {
      const response = await app.request(path)

      expect(response.status).toBe(404)
      expect(response.headers.get('Location')).toBeNull()
    },
  )
})
