import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { patchDesktopAdapter } from './adapter-patches.mjs'
import { cerinBoxDesktopMcpServers } from './box-desktop-mcp.mjs'

// The injected function calls cerinSessionHomeEnv from the adapter's scope.
globalThis.cerinSessionHomeEnv = (sessionEnv) => ({
  HOME: `/homes/${sessionEnv.CERIN_SESSION_ID}`,
})

const bridge = [
  { name: 'cerin-tools', command: '/node', args: ['bridge.mjs', 'https://x'], env: [] },
]
const box = {
  CERIN_DESKTOP_SESSION: '/bundle/desktop-session.mjs',
  CERIN_DESKTOP_POOL: '/agent/desktops',
  CERIN_DESKTOP_POOL_SIZE: '4',
  PATH: '/usr/bin',
}

test('a session on a Box gets a cerin-desktop server on its own desktop', () => {
  const servers = cerinBoxDesktopMcpServers(bridge, { CERIN_SESSION_ID: 's1' }, box)

  assert.equal(servers.length, 2)
  assert.deepEqual(servers[1], {
    name: 'cerin-desktop',
    command: process.execPath,
    args: ['/bundle/desktop-session.mjs', 'serve'],
    env: [
      { name: 'CERIN_SESSION_ID', value: 's1' },
      { name: 'CERIN_DESKTOP_POOL', value: '/agent/desktops' },
      { name: 'CERIN_DESKTOP_POOL_SIZE', value: '4' },
      { name: 'HOME', value: '/homes/s1' },
      { name: 'PATH', value: '/usr/bin' },
      { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
    ],
  })
})

test('without a pool, a session id or servers, nothing changes', () => {
  assert.equal(
    cerinBoxDesktopMcpServers(bridge, { CERIN_SESSION_ID: 's1' }, { PATH: '/usr/bin' }),
    bridge,
  )
  assert.equal(cerinBoxDesktopMcpServers(bridge, {}, box), bridge)
  assert.equal(cerinBoxDesktopMcpServers(undefined, { CERIN_SESSION_ID: 's1' }, box), undefined)
  const own = [{ name: 'cerin-desktop', command: 'x', args: [] }]

  assert.equal(cerinBoxDesktopMcpServers(own, { CERIN_SESSION_ID: 's1' }, box), own)
})

test('Codex on a Box gets the same cerin-desktop server, from its session env', () => {
  const handoff = (fallback) =>
    `config: cerinCodexSessionConfig(await this.createSessionConfig(request.cwd, additionalDirectories, cerinBridgeMcpServers(request.mcpServers${fallback})), request._meta),`
  // What the runtime's codex patch leaves in the bundle: its session-home helper, inlined.
  const sessionHome = readFileSync(
    new URL('../../runtime/image/session-home.mjs', import.meta.url),
    'utf8',
  )
  const source = [
    sessionHome,
    "      args: ['/opt/cerin-runtime/mcp-http-bridge.mjs', server.url],",
    "      env: [{ name: 'OPENAB_CREDENTIALS_DIR', value: dir }],",
    '    await cerinSyncRuntimeSkills(params);',
    '  async handleElicitation(params) {\n    try {',
    handoff(''),
    handoff(' ?? []'),
    handoff(''),
  ].join('\n')
  const patched = patchDesktopAdapter(source, 'codex')

  assert.equal(patched.match(/cerinBoxDesktopMcpServers\(cerinBridgeMcpServers/gu)?.length, 3)
  assert.match(
    patched,
    /request\.mcpServers \?\? \[\]\), request\._meta\?\.\['ai\.cerin\/codex'\]\?\.env/u,
  )
  assert.match(patched, /function cerinBoxDesktopMcpServers\(/u)
  // The env Codex's session carries names the session, as Claude's does.
  const servers = cerinBoxDesktopMcpServers(bridge, { CERIN_SESSION_ID: 'c1' }, box)

  assert.equal(servers[1].name, 'cerin-desktop')
  assert.throws(() => patchDesktopAdapter(source.replace(handoff(' ?? []'), ''), 'codex'))
  // Without the runtime patch's helper underneath, the desktop patch refuses to build.
  assert.throws(
    () => patchDesktopAdapter(source.replace(sessionHome, ''), 'codex'),
    /cerinSessionHomeEnv/u,
  )
})
