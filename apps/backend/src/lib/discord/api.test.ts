import { describe, expect, spyOn, test } from 'bun:test'

import { config } from '@/config'
import { messagingConfig } from '@/config/messaging'

import {
  CERIN_DISCORD_COMMAND,
  registerDiscordCommands,
  sendDiscordApproval,
  splitDiscordText,
} from './api'

describe('Cerin Discord command', () => {
  test('defaults to cerin and supports an explicit command name', () => {
    const original = process.env.DISCORD_COMMAND_NAME

    try {
      delete process.env.DISCORD_COMMAND_NAME
      expect(messagingConfig().discord.commandName).toBe('cerin')
      process.env.DISCORD_COMMAND_NAME = 'assistant'
      expect(messagingConfig().discord.commandName).toBe('assistant')
    } finally {
      if (original === undefined) delete process.env.DISCORD_COMMAND_NAME
      else process.env.DISCORD_COMMAND_NAME = original
    }
  })

  test('bulk overwrites global commands with only our configured command', async () => {
    const saved = { ...config.discord }
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([]))

    try {
      Object.assign(config.discord, { botToken: 'test-token', clientId: 'test-app' })
      await registerDiscordCommands()
      expect(fetchSpy.mock.calls).toHaveLength(1)
      const request = fetchSpy.mock.calls.at(0)

      if (!request) throw new Error('Expected a Discord API request')
      const [url, init] = request

      expect(url).toBe('https://discord.com/api/v10/applications/test-app/commands')
      expect(init?.method).toBe('PUT')
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body')
      expect(JSON.parse(init.body)).toEqual([CERIN_DISCORD_COMMAND])
      expect(CERIN_DISCORD_COMMAND.name).toBe(config.discord.commandName)
    } finally {
      fetchSpy.mockRestore()
      Object.assign(config.discord, saved)
    }
  })

  test('emits Cerin approval and rejection button IDs', async () => {
    const saved = config.discord.botToken
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}))

    try {
      config.discord.botToken = 'test-token'
      await sendDiscordApproval({ channelId: 'channel', content: 'Approve?', decisionId: 'id' })
      const init = fetchSpy.mock.calls.at(0)?.[1]

      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body')
      const body = JSON.parse(init.body) as {
        components: { components: { custom_id: string }[] }[]
      }

      expect(body.components[0]?.components.map((button) => button.custom_id)).toEqual([
        'cerin:tool:approve:id',
        'cerin:tool:reject:id',
      ])
    } finally {
      fetchSpy.mockRestore()
      config.discord.botToken = saved
    }
  })

  test('allows members to use mode commands while handlers guard channel administration', () => {
    expect(CERIN_DISCORD_COMMAND.default_member_permissions).toBeNull()
    expect(CERIN_DISCORD_COMMAND.dm_permission).toBe(false)
    expect(CERIN_DISCORD_COMMAND.options.map((option) => option.name)).toEqual([
      'full-access',
      'auto',
      'enable',
      'disable',
    ])
  })
})

describe('splitDiscordText', () => {
  test('keeps short messages intact', () => {
    expect(splitDiscordText('hello')).toEqual(['hello'])
  })

  test('splits every message within Discord limit without losing text', () => {
    const input = Array.from({ length: 600 }, (_, index) => `word-${index}`).join(' ')
    const chunks = splitDiscordText(input)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true)
    expect(chunks.join('')).toBe(input)
  })

  test('does not emit an empty message', () => {
    expect(splitDiscordText('   ')).toEqual([])
  })

  test('closes and reopens fenced code blocks across Discord chunks', () => {
    const code = Array.from({ length: 300 }, (_, index) => `const value${index} = ${index}`).join(
      '\n',
    )
    const chunks = splitDiscordText(`Here is the result:\n\n\`\`\`ts\n${code}\n\`\`\``)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true)
    expect(chunks.every((chunk) => (chunk.match(/```/g)?.length ?? 0) % 2 === 0)).toBe(true)
    for (let index = 0; index < 300; index++) {
      expect(chunks.join('\n')).toContain(`const value${index} = ${index}`)
    }
  })

  test('respects the limit when boundary snapping excludes a closing fence', () => {
    const chunks = splitDiscordText(`\`\`\`txt\n${'a'.repeat(1986)}\n\`\`\` trailing text`)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true)
    expect(chunks.every((chunk) => (chunk.match(/```/g)?.length ?? 0) % 2 === 0)).toBe(true)
  })
})
