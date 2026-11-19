import { describe, expect, test } from 'bun:test'

import { buildDownloadLinkEmail } from './download-link-email'

describe('buildDownloadLinkEmail', () => {
  const expectedLinks = [
    'https://platform.cerin.ai/download',
    'https://platform.cerin.ai/api/desktop/download?arch=arm64',
    'https://platform.cerin.ai/api/desktop/download?arch=x64',
    'https://platform.cerin.ai/api/desktop/download?platform=windows',
  ]

  test('every link appears in both the text and the HTML body', () => {
    const email = buildDownloadLinkEmail()

    for (const url of expectedLinks) {
      expect(email.text).toContain(url)
      expect(email.html).toContain(url)
    }
  })

  // Mail clients with images or CSS disabled still need a working message, so
  // the plain-text part must lead with the primary link, not just say "see
  // HTML".
  test('the download page link is the first URL in the text body', () => {
    const email = buildDownloadLinkEmail()

    expect(email.text.match(/https:\/\/\S+/)?.[0]).toBe('https://platform.cerin.ai/download')
  })
})
