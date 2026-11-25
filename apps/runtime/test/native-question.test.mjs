import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { patchClaudeAskUserQuestion } from '../image/claude-agent-acp/ask-user-question.mjs'
import { patchCodexUserInput } from '../image/codex-acp/ask-user-input.mjs'
import {
  CERIN_QUESTION_ASKED,
  CERIN_QUESTION_FAILED,
  cerinAskClaudeQuestion,
  cerinAskCodexQuestion,
  cerinAskInCerin,
  cerinDecisionArguments,
  cerinOffersDecisions,
  cerinRememberDecisionServer,
} from '../image/native-question.mjs'

const servers = [
  { name: 'cerin-credentials', type: 'http', url: 'https://api.test/mcp', headers: [] },
  {
    name: 'cerin-tools',
    type: 'http',
    url: 'https://api.test/mcp-tools',
    headers: [{ name: 'Authorization', value: 'Bearer from-session' }],
  },
]

function recorder(result = { content: [] }, ok = true) {
  const calls = []
  const request = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body), signal: init.signal })
    return { ok, json: async () => ({ jsonrpc: '2.0', id: 1, result }) }
  }
  return { calls, request }
}

test('AskUserQuestion registers a decision and tells Claude the answer comes later', async () => {
  cerinRememberDecisionServer(servers)
  const { calls, request } = recorder()
  const answer = await cerinAskClaudeQuestion(
    {
      questions: [
        {
          header: 'Region',
          question: 'Which region?',
          options: [{ label: 'us-east-1' }, { label: 'eu-west-1', description: 'EU' }],
          multiSelect: false,
        },
      ],
    },
    {},
    request,
  )

  assert.deepEqual(answer, { behavior: 'deny', message: CERIN_QUESTION_ASKED })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.test/mcp-tools')
  assert.equal(calls[0].headers.authorization, 'Bearer from-session')
  assert.deepEqual(calls[0].body.params, {
    name: 'request_user_decision',
    arguments: {
      label: 'Region',
      category: 'preference',
      question: 'Which region?',
      body: 'Which region?',
      options: ['us-east-1', 'eu-west-1'],
    },
  })
})

test('the current credential file wins over the session header', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cerin-question-'))
  try {
    writeFileSync(join(dir, 'CERIN_TOKEN'), 'rotated\n')
    cerinRememberDecisionServer(servers)
    const { calls, request } = recorder()

    await cerinAskClaudeQuestion(
      { questions: [{ question: 'Proceed?' }] },
      { OPENAB_CREDENTIALS_DIR: dir },
      request,
    )
    assert.equal(calls[0].headers.authorization, 'Bearer rotated')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a failed registration tells the agent to ask with request_user_decision', async () => {
  cerinRememberDecisionServer(servers)
  for (const { request } of [
    recorder({ isError: true, content: [] }),
    recorder(undefined, false),
    { request: async () => Promise.reject(new Error('offline')) },
  ]) {
    const answer = await cerinAskClaudeQuestion(
      { questions: [{ question: 'Proceed?' }] },
      {},
      request,
    )

    assert.equal(answer.message, CERIN_QUESTION_FAILED)
  }
  const { calls, request } = recorder()
  const empty = await cerinAskClaudeQuestion({ questions: [] }, {}, request)

  assert.equal(empty.message, CERIN_QUESTION_FAILED)
  assert.equal(calls.length, 0)
})

test('a load without servers keeps the conversation server', async () => {
  cerinRememberDecisionServer(servers)
  cerinRememberDecisionServer(undefined)
  cerinRememberDecisionServer([])
  const { calls, request } = recorder()

  await cerinAskClaudeQuestion({ questions: [{ question: 'Proceed?' }] }, {}, request)
  assert.equal(calls[0].url, 'https://api.test/mcp-tools')
})

test('request_user_input answers every question with the next step', async () => {
  cerinRememberDecisionServer(servers)
  const { calls, request } = recorder()
  const response = await cerinAskCodexQuestion(
    {
      questions: [
        {
          id: 'db',
          header: 'Database',
          question: 'Which database?',
          options: [{ label: 'Postgres' }, { label: 'MySQL' }],
        },
        { id: 'name', header: 'Name', question: 'Project name?', options: null },
      ],
    },
    {},
    request,
  )

  assert.deepEqual(response, {
    answers: {
      db: { answers: [CERIN_QUESTION_ASKED] },
      name: { answers: [CERIN_QUESTION_ASKED] },
    },
  })
  assert.deepEqual(calls[0].body.params.arguments, {
    label: 'Database',
    category: 'preference',
    question: 'Which database?',
    body: '1. Which database? (Postgres / MySQL)\n2. Project name?',
  })
})

test('decision arguments stay within request_user_decision limits', () => {
  const args = cerinDecisionArguments([
    {
      question: 'q'.repeat(2000),
      options: ['a', 'b', 'c', 'd', 'e', 'f'].map((o) => o.repeat(400)),
    },
  ])

  // One line in the card; the whole question in its body.
  assert.equal(args.question.length, 120)
  assert.ok(args.question.endsWith('…'))
  assert.equal(args.body, 'q'.repeat(2000))
  assert.equal(args.label.length, 80)
  assert.equal(args.options.length, 5)
  assert.ok(args.options.every((option) => option.length === 300))
  assert.equal(
    cerinDecisionArguments([{ question: 'Only one?', options: ['yes'] }]).options,
    undefined,
  )
})

test('the Claude patch keeps AskUserQuestion and asks through Cerin', () => {
  const source = [
    '        const mcpServers = {};',
    '        const disallowedTools = elicitationSupport.form ? [] : ["AskUserQuestion"];',
    '            if (toolName === "AskUserQuestion" && this.clientCapabilities?.elicitation?.form) {',
    '',
  ].join('\n')
  const patched = patchClaudeAskUserQuestion(source)

  assert.match(
    patched,
    /const mcpServers = \{\};\n {8}cerinRememberDecisionServer\(params\.mcpServers\);/,
  )
  assert.match(
    patched,
    /const disallowedTools = elicitationSupport\.form \|\| cerinOffersDecisions\(params\.mcpServers\) \? \[\] : \["AskUserQuestion"\];/,
  )
  assert.match(
    patched,
    /!this\.clientCapabilities\?\.elicitation\?\.form\) \{\n.*ensureToolCallEmitted.*\n {16}return cerinAskClaudeQuestion\(toolInput\);\n {12}\}\n {12}if \(toolName === "AskUserQuestion" && this\.clientCapabilities/,
  )
  assert.throws(() => patchClaudeAskUserQuestion('nothing to patch'))
})

test('AskUserQuestion stays off for a session that cannot ask through Cerin', () => {
  assert.equal(cerinOffersDecisions(servers), true)
  assert.equal(cerinOffersDecisions([servers[0]]), false)
  assert.equal(cerinOffersDecisions(undefined), false)
})

test('a secret question is never asked in chat, so its answer cannot reach the model', async () => {
  cerinRememberDecisionServer(servers)
  const { calls, request } = recorder()
  const response = await cerinAskCodexQuestion(
    {
      questions: [
        { id: 'token', header: 'Token', question: 'Paste your API token', isSecret: true },
        { id: 'region', header: 'Region', question: 'Which region?' },
      ],
    },
    {},
    request,
  )

  assert.equal(calls.length, 0)
  assert.deepEqual(response, {
    answers: {
      token: { answers: [CERIN_QUESTION_FAILED] },
      region: { answers: [CERIN_QUESTION_FAILED] },
    },
  })
})

test('a hung tools server times out instead of holding the turn', async () => {
  cerinRememberDecisionServer(servers)
  const { calls, request: recorded } = recorder()

  await cerinAskInCerin([{ question: 'Proceed?' }], {}, recorded)
  assert.ok(calls[0].signal instanceof AbortSignal, 'every request carries a timeout signal')
  const hung = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
    })
  const started = Date.now()

  assert.equal(await cerinAskInCerin([{ question: 'Proceed?' }], {}, hung, 20), false)
  assert.ok(Date.now() - started < 5_000)
})

test('a revoked credential file fails the question instead of using the session header', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cerin-question-'))
  try {
    cerinRememberDecisionServer(servers)
    const { calls, request } = recorder()
    const missing = await cerinAskClaudeQuestion(
      { questions: [{ question: 'Proceed?' }] },
      { OPENAB_CREDENTIALS_DIR: dir },
      request,
    )

    writeFileSync(join(dir, 'CERIN_TOKEN'), '\n')
    const empty = await cerinAskClaudeQuestion(
      { questions: [{ question: 'Proceed?' }] },
      { OPENAB_CREDENTIALS_DIR: dir },
      request,
    )

    assert.equal(missing.message, CERIN_QUESTION_FAILED)
    assert.equal(empty.message, CERIN_QUESTION_FAILED)
    assert.equal(calls.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the Codex patch asks through Cerin at both server handoffs and the user input call', () => {
  const servers = '    const requestedMcpServers = request.mcpServers ?? [];'
  const userInput = [
    '  async handleUserInput(params) {',
    '    if (!clientSupportsFormElicitation(this.clientCapabilities)) {',
    '      return { answers: {} };',
    '    }',
  ].join('\n')
  const source = [servers, 'newSession();', servers, 'loadSession();', userInput, ''].join('\n')
  const patched = patchCodexUserInput(source)

  assert.equal(patched.split('cerinRememberDecisionServer(request.mcpServers);').length, 3)
  assert.match(patched, /return await cerinAskCodexQuestion\(params\);/)
  assert.doesNotMatch(patched, /return \{ answers: \{\} \};/)
  // An anchor that moved, vanished or appears more often fails the build.
  assert.throws(() => patchCodexUserInput([servers, userInput].join('\n')))
  assert.throws(() => patchCodexUserInput([servers, servers, userInput, userInput].join('\n')))
  assert.throws(() => patchCodexUserInput('nothing to patch'))
})
