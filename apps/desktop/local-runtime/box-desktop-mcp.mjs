// On a Linux Box the host sets CERIN_DESKTOP_SESSION (the wrapper's path) and
// CERIN_DESKTOP_POOL; every Claude session then gets a `cerin-desktop` MCP server
// that serves it on its own desktop. Not `computer-use`: Claude Code reserves that
// name for its own server and silently drops a configured one. The function body is injected into the
// adapter, so it must stand alone (adapter-patches.mjs).
export function cerinBoxDesktopMcpServers(servers, sessionEnv, env = process.env) {
  const sessionId = sessionEnv?.CERIN_SESSION_ID
  const wrapper = env.CERIN_DESKTOP_SESSION
  const pool = env.CERIN_DESKTOP_POOL

  if (!sessionId || !wrapper || !pool || !Array.isArray(servers)) return servers
  if (servers.some((server) => server?.name === 'cerin-desktop')) return servers

  return [
    ...servers,
    {
      name: 'cerin-desktop',
      command: process.execPath,
      args: [wrapper, 'serve'],
      env: [
        { name: 'CERIN_SESSION_ID', value: sessionId },
        { name: 'CERIN_DESKTOP_POOL', value: pool },
        { name: 'CERIN_DESKTOP_POOL_SIZE', value: env.CERIN_DESKTOP_POOL_SIZE ?? '' },
        { name: 'HOME', value: cerinSessionHomeEnv(sessionEnv, env).HOME },
        { name: 'PATH', value: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' },
        { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
      ],
    },
  ]
}
