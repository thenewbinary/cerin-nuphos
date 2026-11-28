import { homedir } from 'node:os'
import { join } from 'node:path'

import { cerinSessionHomeEnv } from '../session-home.mjs'

// Applied to thread/start and thread/resume on every ACP new/load/resume.
// Never change process.env: concurrent conversations have different principals.
export function cerinCodexSessionConfig(config, meta, processEnv = process.env) {
  const context = meta?.['ai.cerin/codex']
  if (!context) return config
  const allowed = new Set([
    'CERIN_TOKEN',
    'CERIN_BACKEND_URL',
    'CERIN_PUBLIC_URL',
    'CERIN_TEAM_ID',
    'TEAM',
    'CERIN_SESSION_ID',
    'CERIN_SESSION_ACTOR',
    'CERIN_SESSION_HOME_EPOCH',
    'CERIN_PLAN_API_BASE',
    'CERIN_PLAN_API_TOKEN',
  ])
  const env = Object.fromEntries(
    Object.entries(context.env ?? {}).filter(
      ([key, value]) => allowed.has(key) && typeof value === 'string',
    ),
  )
  // Preserve CLI discovery and the runtime home without inheriting transport
  // keys or unrelated credentials from an adapter process environment.
  const baseline = Object.fromEntries(
    // These budgets come from the managed runtime's [agent.env], never from
    // actor metadata. Codex otherwise drops them with inherit: 'none'.
    // BASH_ENV (and ZDOTDIR for zsh) sources runtime-guard.sh, which refreshes
    // per-turn credentials, and GOFLAGS/MAKEFLAGS keep a build's process tree from
    // adding up to the container limit.
    [
      'PATH',
      'HOME',
      'USER',
      'LANG',
      'LC_ALL',
      'TERM',
      'TMPDIR',
      'GOMEMLIMIT',
      'NODE_OPTIONS',
      'GOFLAGS',
      'MAKEFLAGS',
      'BASH_ENV',
      'ZDOTDIR',
      'OPENAB_CREDENTIALS_DIR',
      // Windows itself needs these: PowerShell will not start without SystemRoot.
      'SystemRoot',
      'SystemDrive',
      'ComSpec',
      'PATHEXT',
    ]
      .filter((key) => typeof processEnv[key] === 'string')
      .map((key) => [key, processEnv[key]]),
  )
  return {
    ...config,
    developer_instructions:
      typeof context.developerInstructions === 'string' ? context.developerInstructions : '',
    // Codex sizes the available-skills catalog at 2% of the model's context window by
    // default — 5,440 tokens at 272k — and truncates descriptions to fit, which cuts most
    // of a team's skills in half. Cerin pays for the catalog on every turn either way, so
    // a session asks for Codex's own ceiling instead; a catalog past it is still shared
    // fairly, and every name and locator is kept. Thread config outranks the account's
    // config.toml, and unlike a baked one it survives the home volume.
    skills: { ...config.skills, max_context_tokens: 10_000 },
    shell_environment_policy: {
      inherit: 'none',
      set: {
        ...baseline,
        ...env,
        ...cerinSessionHomeEnv(env, processEnv),
        // Nested Codex commands use the runtime's existing model login, just as
        // Claude keeps CLAUDE_CONFIG_DIR when HOME becomes conversation-local.
        // Only the trusted runtime chooses this path; actor metadata cannot
        // select another login. Desktop supplies its isolated Codex home here.
        CODEX_HOME:
          processEnv.CODEX_HOME ||
          join(processEnv.HOME || processEnv.USERPROFILE || homedir(), '.codex'),
      },
    },
    // Codex's Browser plugin drives only the Codex App's own browser (`iab`), which
    // never exists here, so every call fails with "Browser is not available: iab".
    // The account syncs it in when the owner enabled it in the App; Codex lets a
    // per-plugin setting outrank that account state only while `_default` is set,
    // so one is supplied when absent. Cerin's browser is local_browser.
    plugins: {
      ...config.plugins,
      _default: config.plugins?._default ?? { enabled: true },
      'browser@openai-bundled': { enabled: false },
      'browser@openai-curated-remote': { enabled: false },
    },
    mcp_servers: Object.fromEntries(
      Object.entries(config.mcp_servers ?? {}).map(([name, server]) => [
        name,
        { ...server, tool_timeout_sec: 1800 },
      ]),
    ),
  }
}

// The session home each thread was last opened with by this adapter process.
const cerinThreadHomes = new Map()

function cerinThreadHome(meta, processEnv) {
  const env = meta?.['ai.cerin/codex']?.env ?? {}
  const { CERIN_SESSION_ID, CERIN_SESSION_ACTOR, CERIN_SESSION_HOME_EPOCH } = env
  return (
    cerinSessionHomeEnv(
      { CERIN_SESSION_ID, CERIN_SESSION_ACTOR, CERIN_SESSION_HOME_EPOCH },
      processEnv,
    ).HOME ?? ''
  )
}

// App Server ignores a resume's config while a subscription holds the loaded
// thread. When the acting principal's home changed since this process last
// opened the thread, release the subscription first so the idle thread is
// rebuilt with the new config. Any other reload keeps the thread as it is.
export async function cerinReleaseMovedThread(client, threadId, meta, processEnv = process.env) {
  const home = cerinThreadHome(meta, processEnv)
  const last = cerinThreadHomes.get(threadId)
  cerinThreadHomes.set(threadId, home)
  if (last !== undefined && last !== home)
    await client.threadUnsubscribe({ threadId }).catch(() => {})
}

export function cerinRememberThreadHome(threadId, meta, processEnv = process.env) {
  cerinThreadHomes.set(threadId, cerinThreadHome(meta, processEnv))
}

// Codex follows a change of standing instructions only when the developer makes
// it, so the prompt that carries one injects it as a developer message first.
export async function cerinInjectInstructions(codexClient, request) {
  const text = request._meta?.['ai.cerin/instructionsUpdate']
  if (typeof text !== 'string' || !text) return
  await codexClient.sendRequest({
    method: 'thread/inject_items',
    params: {
      threadId: request.sessionId,
      items: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text }] }],
    },
  })
}
