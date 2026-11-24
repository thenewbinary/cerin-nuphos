import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import { passkeyPageRoutes } from './passkey-page'
import declared from './route-access.json'

const app = new Hono().route('/passkey', passkeyPageRoutes)

describe('passkey page', () => {
  test('serves a public, self-contained Cerin page with a fresh CSP nonce', async () => {
    const response = await app.request('/passkey')
    const html = await response.text()
    const nonce = /<script nonce="([^"]+)">/.exec(html)?.[1] ?? ''

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(nonce).toBeTruthy()
    expect(response.headers.get('Content-Security-Policy')).toBe(
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    )
    expect(html).toContain(`<style nonce="${nonce}">`)
    expect(html).toContain('<title>Cerin</title>')
    expect(html).toContain('<h1>Cerin</h1>')
    expect(html).toContain('Waiting for your passkey…')
    expect(html).not.toContain('<script src=')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await (await app.request('/passkey')).text()).not.toContain(`nonce="${nonce}"`)
    expect(declared['GET /passkey']).toBe('public')
  })
})
