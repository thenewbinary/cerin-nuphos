import { describe, expect, test } from 'bun:test'

import { attachmentPrompt } from './openab-acp-lifecycle'

describe('attachmentPrompt', () => {
  test("sends the user's own text last, after everything Cerin adds", () => {
    const { prompt } = attachmentPrompt(
      's',
      '/goal tests pass',
      [{ type: 'resource_link', name: 'a.png', uri: 'file:///a.png' }],
      {},
      '<cerin_message_metadata>{}</cerin_message_metadata>',
    )

    expect(prompt).toEqual([
      { type: 'text', text: '<cerin_message_metadata>{}</cerin_message_metadata>' },
      { type: 'resource_link', name: 'a.png', uri: 'file:///a.png' },
      { type: 'text', text: '/goal tests pass' },
    ])
  })

  test('omits empty blocks', () => {
    expect(attachmentPrompt('s', 'hello', [], {}).prompt).toEqual([{ type: 'text', text: 'hello' }])
  })
})
