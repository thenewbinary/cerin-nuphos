import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { config } from '@/config'

import { buildDownloadLinkEmail } from './download-link-email'

const originalWebUrl = config.auth.publicWebUrl

beforeEach(() => {
  config.auth.publicWebUrl = 'https://cerin.ai'
})
afterEach(() => {
  config.auth.publicWebUrl = originalWebUrl
})

describe('buildDownloadLinkEmail', () => {
  const expectedLinks = [
    'https://cerin.ai/download',
    'https://cerin.ai/api/desktop/download?arch=arm64',
    'https://cerin.ai/api/desktop/download?arch=x64',
    'https://cerin.ai/api/desktop/download?platform=windows',
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

    expect(email.text.match(/https:\/\/\S+/)?.[0]).toBe('https://cerin.ai/download')
  })
})
