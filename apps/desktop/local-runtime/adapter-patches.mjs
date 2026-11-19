import { cerinBoxDesktopMcpServers } from './box-desktop-mcp.mjs'
import { cerinAuthorizeComputerUse } from './computer-use-permission.mjs'
import { cerinDesktopClaudeEnv } from './claude-session-env.mjs'
import { cerinLocalSyncSkills } from './skills-sync.mjs'

const CODEX_HANDOFF = /cerinBridgeMcpServers\(request\.mcpServers( \?\? \[\])?\)/gu

function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2)
    throw new Error(`Desktop adapter patch anchor moved: ${anchor.slice(0, 80)}`)

  return source.replace(anchor, () => replacement)
}

/**
 * Runs after cerin-runtime's own patch. The image keeps its MCP bridge and
 * skills sync at fixed Linux paths; on a desktop both live beside the adapter,
 * and the bridge runs on Electron's own Node.
 */
/** The MCP bridge beside the adapter, run on Electron's own Node. */
export function patchDesktopBridge(source) {
  const patched = replaceOnce(
    source,
    "args: ['/opt/cerin-runtime/mcp-http-bridge.mjs', server.url],",
    "args: [env.CERIN_MCP_BRIDGE ?? '/opt/cerin-runtime/mcp-http-bridge.mjs', server.url],",
  )

  return replaceOnce(
    patched,
    "env: [{ name: 'OPENAB_CREDENTIALS_DIR', value: dir }],",
    "env: [{ name: 'OPENAB_CREDENTIALS_DIR', value: dir }, { name: 'ELECTRON_RUN_AS_NODE', value: '1' }],",
  )
}

/**
 * The image's ACP shim, for Grok Build, OpenCode and DeepSeek Harness: the same bridge as the
 * adapters (in its own module), and the desktop's skills sync.
 */
export function patchDesktopShim(source) {
  const patched = replaceOnce(
    source,
    'await cerinSyncRuntimeSkills(message.params)',
    'await cerinLocalSyncSkills(message.params)',
  )

  // Appended: a declaration hoists, and the shim's #! line has to stay first.
  return `${patched}\n${cerinLocalSyncSkills.toString()}\n`
}

export function patchDesktopAdapter(source, provider) {
  let patched = patchDesktopBridge(source)
  if (!patched.includes('await cerinSyncRuntimeSkills(params);'))
    throw new Error('Desktop adapter patch anchor moved: skills sync')
  patched = patched.replaceAll(
    'await cerinSyncRuntimeSkills(params);',
    'await cerinLocalSyncSkills(params);',
  )
  if (provider === 'claude-code') {
    // A Linux Box gives every session a `cerin-desktop` server on its own desktop.
    patched = replaceOnce(
      patched,
      'for (const server of cerinBridgeMcpServers(params.mcpServers)) {',
      'for (const server of cerinBoxDesktopMcpServers(cerinBridgeMcpServers(params.mcpServers), params._meta?.claudeCode?.options?.env, process.env)) {',
    )
    patched = replaceOnce(
      patched,
      'const isolated = cerinSessionHomeEnv(sessionEnv, runtimeEnv)',
      'const isolated = cerinDesktopClaudeEnv(cerinSessionHomeEnv(sessionEnv, runtimeEnv), runtimeEnv)',
    )
    patched = replaceOnce(
      patched,
      '...cerinSessionHomeEnv(userProvidedOptions?.env),',
      '...cerinDesktopClaudeEnv(cerinSessionHomeEnv(userProvidedOptions?.env)),',
    )
  }
  if (provider === 'codex') {
    patched = replaceOnce(
      patched,
      'async handleElicitation(params) {\n    try {',
      'async handleElicitation(params) {\n    try {\n      await cerinAuthorizeComputerUse(params, this.cancellationSignal);',
    )
    // The same per-session desktop as Claude's, at each of Codex's three session handoffs.
    const handoffs = patched.match(CODEX_HANDOFF)?.length ?? 0

    if (handoffs !== 3) throw new Error('Desktop adapter patch anchor moved: Codex MCP servers')
    // The injected server takes the session's HOME from the runtime patch's inlined helper.
    if (!patched.includes('function cerinSessionHomeEnv('))
      throw new Error('Desktop adapter patch anchor moved: Codex cerinSessionHomeEnv')
    patched = patched.replace(
      CODEX_HANDOFF,
      (_, fallback = '') =>
        `cerinBoxDesktopMcpServers(cerinBridgeMcpServers(request.mcpServers${fallback}), request._meta?.['ai.cerin/codex']?.env, process.env)`,
    )
  }
  const shebang = /^#![^\n]*\n/u.exec(patched)?.[0] ?? ''

  const claudeEnv =
    provider === 'claude-code'
      ? `import { constants as cerinDesktopFs, mkdirSync as cerinDesktopMkdir, writeFileSync as cerinDesktopWrite } from 'node:fs';\nimport { join as cerinDesktopJoin } from 'node:path';\n${cerinDesktopClaudeEnv.toString()}\n${cerinBoxDesktopMcpServers.toString()}\n`
      : ''

  const computerUse =
    provider === 'codex'
      ? `${cerinAuthorizeComputerUse.toString()}\n${cerinBoxDesktopMcpServers.toString()}\n`
      : ''

  return `${shebang}${computerUse}${claudeEnv}${cerinLocalSyncSkills.toString()}\n${patched.slice(shebang.length)}`
}
