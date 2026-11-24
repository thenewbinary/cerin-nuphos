import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAgentChatUrl } from './agent-chat-deeplink.ts'
import { parseAppOpenUrl } from './app-open-deeplink.ts'

const legacyScheme = (url: string) => url.replace(/^cerin:/u, 'nuphos:')

test('app-open accepts both schemes and the exact legacy web origin', () => {
  const legacyWeb = 'https://nuphos.ai/teams/0123456789abcdef01234567/agent/session-1'
  const link = `cerin://open?url=${encodeURIComponent(legacyWeb)}`

  for (const url of [link, legacyScheme(link)]) {
    assert.deepEqual(parseAppOpenUrl(url), {
      url: legacyWeb,
      path: '/teams/0123456789abcdef01234567/agent/session-1',
    })
  }
  for (const webUrl of [
    legacyWeb.replace('https:', 'http:'),
    legacyWeb.replace('nuphos.ai', 'www.nuphos.ai'),
    legacyWeb.replace('nuphos.ai', 'app.nuphos.ai'),
    legacyWeb.replace('nuphos.ai', 'nuphos.ai:443'),
    legacyWeb.replace('nuphos.ai', 'user@nuphos.ai'),
    legacyWeb.replace('nuphos.ai', 'nuphos.ai.evil.example'),
  ]) {
    const url = `cerin://open?url=${encodeURIComponent(webUrl)}`

    assert.equal(parseAppOpenUrl(url), null, webUrl)
    assert.equal(parseAppOpenUrl(legacyScheme(url)), null, webUrl)
  }
})

test('agent-chat accepts legacy links without changing their payload', () => {
  const link = 'cerin://agent-chat?prompt=Investigate&draft=1&teamId=team-1'

  assert.deepEqual(parseAgentChatUrl(legacyScheme(link)), parseAgentChatUrl(link))
})
