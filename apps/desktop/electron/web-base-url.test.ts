import assert from 'node:assert/strict'
import test from 'node:test'

// WEB_BASE_URL is resolved once at module load, so each case that needs a
// different NUPHOS_WEB_URL imports a fresh copy through a cache-busting
// specifier rather than trying to mutate a frozen const.
let caseId = 0

async function load(webUrl?: string) {
  const previous = process.env.NUPHOS_WEB_URL

  if (webUrl === undefined) delete process.env.NUPHOS_WEB_URL
  else process.env.NUPHOS_WEB_URL = webUrl
  try {
    return (await import(
      `./web-base-url.ts?case=${++caseId}`
    )) as typeof import('./web-base-url.ts')
  } finally {
    if (previous === undefined) delete process.env.NUPHOS_WEB_URL
    else process.env.NUPHOS_WEB_URL = previous
  }
}

test('defaults to platform.cerin.ai when nothing is configured', async () => {
  const m = await load(undefined)

  assert.equal(m.WEB_BASE_URL, 'https://platform.cerin.ai')
  assert.deepEqual([...m.ALLOWED_WEB_HOSTS].sort(), [
    'app.platform.cerin.ai',
    'platform.cerin.ai',
    'www.platform.cerin.ai',
  ])
})

test('a self-hosted origin replaces the default everywhere, aliases included', async () => {
  const m = await load('https://cerin.acme.internal')

  assert.equal(m.WEB_BASE_URL, 'https://cerin.acme.internal')
  assert.ok(m.isAppWebUrl('https://cerin.acme.internal/teams/abc'))
  // The old default is just another host once the app is pointed elsewhere.
  assert.equal(m.isAppWebUrl('https://platform.cerin.ai/teams/abc'), null)
  assert.ok(m.ALLOWED_WEB_HOSTS.has('www.cerin.acme.internal'))
})

test('a configured value keeps only its origin', async () => {
  // A base URL carrying a path would make every `new URL(path, base)` resolve
  // relative to that path instead of the site root.
  const m = await load('https://cerin.acme.internal/app/?x=1')

  assert.equal(m.WEB_BASE_URL, 'https://cerin.acme.internal')
})

test('an unparseable value falls back rather than breaking every link', async () => {
  const m = await load('not a url')

  assert.equal(m.WEB_BASE_URL, 'https://platform.cerin.ai')
})

test('isAppWebUrl matches the exact host only', async () => {
  const m = await load(undefined)

  assert.ok(m.isAppWebUrl('https://platform.cerin.ai/teams/x'))
  // A bare path is ours by definition — it has no other host to belong to.
  assert.ok(m.isAppWebUrl('/teams/x'))
  // Subdomains are separate services, not app pages. docs.platform.cerin.ai is the
  // case that used to slip through the chat-link handler and get routed into
  // in-app navigation on whatever app page shared its pathname.
  assert.equal(m.isAppWebUrl('https://docs.platform.cerin.ai/teams/x'), null)
  assert.equal(m.isAppWebUrl('https://api.platform.cerin.ai/teams/x'), null)
  assert.equal(m.isAppWebUrl('https://platform.cerin.ai.evil.example/teams/x'), null)
  assert.equal(m.isAppWebUrl('http://['), null)
})

test('a same-host URL on another scheme or port is not ours', async () => {
  const m = await load(undefined)

  // messageInlineLinks used to require a literal `https://platform.cerin.ai/` prefix
  // and openNodeLink an origin match. Comparing hostname alone would have let a
  // downgraded link render as a trusted app mention.
  assert.equal(m.isAppWebUrl('http://platform.cerin.ai/teams/x'), null)
  assert.equal(m.isAppWebUrl('https://platform.cerin.ai:8443/teams/x'), null)
})

test('a www-prefixed self-hosted origin does not produce www.www', async () => {
  const m = await load('https://www.example.com')

  assert.deepEqual([...m.ALLOWED_WEB_HOSTS].sort(), ['app.example.com', 'www.example.com'])
})
