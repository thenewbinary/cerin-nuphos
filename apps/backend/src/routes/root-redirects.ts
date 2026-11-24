import { Hono } from 'hono'

export const rootRedirects = new Hono()

rootRedirects.get('/device', (c) => {
  const queryIndex = c.req.url.indexOf('?')
  const query = queryIndex === -1 ? '' : c.req.url.slice(queryIndex)

  return c.redirect(`/auth/social/device${query}`, 302)
})

rootRedirects.get('/install', (c) => c.redirect('https://cerin.ai/install', 302))
rootRedirects.get('/', (c) => c.redirect('https://cerin.ai', 302))
