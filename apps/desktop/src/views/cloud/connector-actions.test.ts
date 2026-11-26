import assert from 'node:assert/strict'
import test from 'node:test'

import { installedConnectorAddAction } from './connector-actions.ts'

test('multi-connection kinds keep a plain Add', () => {
  for (const key of [
    'aws',
    'gcp',
    'azure',
    'cloudflare',
    'github',
    'grafana',
    'mongodb',
    'slack',
  ] as const) {
    assert.deepEqual(installedConnectorAddAction(key), { label: 'Add', mode: 'install' })
  }
})

test('single-app Lark reconfigures instead', () => {
  assert.deepEqual(installedConnectorAddAction('lark'), { label: 'Reconfigure', mode: 'reinstall' })
})
