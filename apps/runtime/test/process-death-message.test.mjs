import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  cerinOomKills,
  cerinOwnCgroup,
  cerinProcessDeathMessage,
} from '../image/process-death.mjs'

// A real cgroup path is required for the limit walk, which stops at /sys/fs/cgroup.
function fakeCgroup(oomKill) {
  const root = mkdtempSync(join(tmpdir(), 'cg-'))
  const scope = join(root, 'agents.slice', 'openab.scope')

  mkdirSync(scope, { recursive: true })
  writeFileSync(join(scope, 'memory.events'), `low 0\nhigh 0\nmax 9\noom 1\noom_kill ${oomKill}\n`)

  return scope
}

test('reads its own cgroup v2 path', () => {
  assert.equal(
    cerinOwnCgroup('0::/user.slice/cerin-agents.slice/openab.scope\n'),
    '/sys/fs/cgroup/user.slice/cerin-agents.slice/openab.scope',
  )
  assert.equal(cerinOwnCgroup(null), null)
})

test('counts OOM kills from memory.events', () => {
  assert.equal(cerinOomKills(fakeCgroup(3)), 3)
  assert.equal(cerinOomKills(null), 0)
})

test('a SIGKILL while the OOM kill count rose names the memory limit', () => {
  const text = cerinProcessDeathMessage(
    'Claude Code',
    'process terminated by signal SIGKILL',
    fakeCgroup(1),
    0,
  )

  assert.match(text, /ran out of memory/)
  assert.match(text, /Send a message to continue/)
  assert.doesNotMatch(text, /new session/)
})

test('a SIGKILL without an OOM kill keeps its signal', () => {
  const text = cerinProcessDeathMessage(
    'Claude Code',
    'process terminated by signal SIGKILL',
    fakeCgroup(2),
    2,
  )

  assert.equal(
    text,
    'Claude Code stopped unexpectedly (process terminated by signal SIGKILL). Send a message to continue.',
  )
})

test('another death keeps its own reason, also outside a cgroup', () => {
  assert.equal(
    cerinProcessDeathMessage('Codex', 'process terminated by signal SIGABRT', null, 0),
    'Codex stopped unexpectedly (process terminated by signal SIGABRT). Send a message to continue.',
  )
})

test('announces the message on stderr for OpenAB', (t) => {
  const written = []

  t.mock.method(process.stderr, 'write', (chunk) => written.push(String(chunk)))
  const text = cerinProcessDeathMessage('Codex', 'process exited with code 1', null, 0)

  assert.deepEqual(written, [`cerin-process-death: ${text}\n`])
})
