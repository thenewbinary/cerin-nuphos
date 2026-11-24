import assert from 'node:assert/strict'
import { test } from 'node:test'

import { joinCommand } from './joinCommand.ts'

test('the command to run on the machine, naming only a non-default API', () => {
  const join = { token: 'tok', expiresAt: '', apiUrl: 'https://platform.cerin.ai' }

  assert.equal(joinCommand(join), 'curl -fsSL https://cerin.ai/install | sh -s -- --join tok')
  assert.match(joinCommand({ ...join, apiUrl: 'https://api.dev' }), / --api-url https:\/\/api.dev$/)
})
