import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cerinDescribeDefaultEffort,
  patchClaudeDefaultEffort,
} from '../image/claude-agent-acp/default-effort.mjs'

const options = (currentValue) => [
  {
    id: 'effort',
    category: 'thought_level',
    currentValue,
    options: ['default', 'low', 'medium', 'high'].map((value) => ({ value, name: value })),
  },
]
const query = (effort) => ({ getSettings: async () => ({ applied: { effort } }) })

test('the default choice names the level Claude Code will send', async () => {
  const config = options('default')

  await cerinDescribeDefaultEffort(query('medium'), config)
  assert.equal(config[0].options[0].description, 'medium')
})

test('a pinned level, an unknown level or an old CLI leaves the choice alone', async () => {
  for (const [config, q] of [
    [options('high'), query('high')],
    [options('default'), query('ultra')],
    [options('default'), { getSettings: async () => Promise.reject(new Error('unsupported')) }],
  ]) {
    await cerinDescribeDefaultEffort(q, config)
    assert.equal(config[0].options[0].description, undefined)
  }
})

test('a get_settings that never answers leaves the choice alone after the timeout', async () => {
  const config = options('default')
  const started = Date.now()

  await cerinDescribeDefaultEffort({ getSettings: () => new Promise(() => {}) }, config, 20)
  assert.equal(config[0].options[0].description, undefined)
  assert.ok(Date.now() - started < 1000)
})

test('the patch lands once at session creation and once after a config change', () => {
  const source = [
    '            const configOptions = buildConfigOptions(modes, models, modelInfos, settingsEffortForModel(settingsManager.getSettings(), currentModelInfo), agents, currentAgent, fastMode);',
    '            return configOptions;',
    '                session.effortPinnedByUser = value !== "default";',
    '            }',
    '        }',
    '    }',
    '',
  ].join('\n')
  const patched = patchClaudeDefaultEffort(source)

  assert.equal(patched.split('await cerinDescribeDefaultEffort(').length - 1, 2)
  assert.match(patched, /fastMode\);\n {12}await cerinDescribeDefaultEffort\(q, configOptions\);/)
  assert.match(
    patched,
    /\n {8}await cerinDescribeDefaultEffort\(session\.query, session\.configOptions\);\n {4}\}\n$/,
  )
  assert.throws(() => patchClaudeDefaultEffort('nothing to patch'))
})
