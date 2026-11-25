import { spawn as cerinSpawn } from 'node:child_process'
import { createHash as cerinHomeHash } from 'node:crypto'
import {
  mkdirSync as cerinMkdir,
  readFileSync as cerinReadFile,
  lstatSync as cerinLstat,
  symlinkSync as cerinSymlink,
  utimesSync as cerinUtimes,
  writeFileSync as cerinWriteFile,
} from 'node:fs'
import { homedir as cerinHostHome, userInfo as cerinAccount } from 'node:os'
import { join as cerinJoin, delimiter as cerinPathDelimiter } from 'node:path'

// Configuration isolation, not a filesystem security boundary: sessions still
// run as the same OS user. Never mutate process.env or copy ambient credentials.
// Use the conversation ID, not the ACP process/turn ID, so load/resume and token
// refresh keep the same home. Hash it so metadata cannot supply a filesystem path.
// A teammate's turns in someone else's conversation (NUPHOS_SESSION_ACTOR) get a
// home of their own, so neither side picks up the other's CLI logins.
export function cerinSessionHomeEnv(sessionEnv = {}, runtimeEnv = process.env) {
  const id = sessionEnv.NUPHOS_SESSION_ID
  if (typeof id !== 'string' || !id.trim()) {
    if (sessionEnv.NUPHOS_TOKEN || sessionEnv.NUPHOS_TEAM_ID)
      throw new Error('Cerin sessions require NUPHOS_SESSION_ID for CLI configuration isolation')
    return {} // Ordinary ACP clients without a Cerin conversation keep their defaults.
  }
  const runtimeHome = runtimeEnv.HOME || runtimeEnv.USERPROFILE || cerinHostHome()
  const root = cerinJoin(runtimeHome, '.cerin', 'session-homes')
  const hash = (value) => cerinHomeHash('sha256').update(value).digest('hex')
  // <conversation> for the owner, <conversation>.<actor> for a teammate, so
  // reclaiming a conversation finds every home it left from its ID alone.
  const actor = sessionEnv.NUPHOS_SESSION_ACTOR
  const name = typeof actor === 'string' && actor ? `${hash(id)}.${hash(actor)}` : hash(id)
  const home = cerinJoin(root, name)
  for (const dir of [root, home]) {
    cerinMkdir(dir, { recursive: true, mode: 0o700 })
    if (!cerinLstat(dir).isDirectory()) throw new Error('Session home must be a directory')
  }
  cerinKeepSessionHome(root, home)
  // macOS finds the login Keychain through HOME, so without this a session has
  // none and every Keychain user (Chrome, for one) raises "Keychain Not Found".
  // OS credential stores stay shared. Link the account's own Keychains, which is
  // where they live whatever HOME the runtime itself was given.
  if (process.platform === 'darwin') {
    cerinMkdir(cerinJoin(home, 'Library'), { recursive: true, mode: 0o700 })
    try {
      cerinSymlink(
        cerinJoin(cerinAccount().homedir, 'Library', 'Keychains'),
        cerinJoin(home, 'Library', 'Keychains'),
      )
    } catch (error) {
      if (error.code !== 'EEXIST') throw error // Already linked, or a Keychain made here.
    }
  }
  const config = cerinJoin(home, '.config')
  // pnpm 9 and 10 read the store from this rc, pnpm 11 from pnpm_config_store_dir.
  // npm_config_store_dir would reach 9 and 10 too, but npm 11 warns about it on every command.
  const pnpmStore = cerinJoin(runtimeHome, '.local', 'share', 'pnpm', 'store')
  try {
    cerinMkdir(cerinJoin(config, 'pnpm'), { recursive: true, mode: 0o700 })
    cerinWriteFile(cerinJoin(config, 'pnpm', 'rc'), `store-dir=${pnpmStore}\n`, {
      flag: 'wx',
      mode: 0o600,
    })
  } catch (error) {
    // A session's own rc wins, and a cache setting never stops a session from starting.
    if (error.code !== 'EEXIST')
      process.stderr.write(`cerin: could not share the pnpm store: ${error.message}\n`)
  }
  // Gradle has no setting for its caches alone, and gradle.properties beside them can
  // hold repository credentials, so only caches/ is linked. Gradle locks inside it.
  try {
    const gradleCaches = cerinJoin(runtimeHome, '.gradle', 'caches')
    cerinMkdir(gradleCaches, { recursive: true, mode: 0o700 })
    cerinMkdir(cerinJoin(home, '.gradle'), { recursive: true, mode: 0o700 })
    cerinSymlink(gradleCaches, cerinJoin(home, '.gradle', 'caches'), 'junction')
  } catch (error) {
    // Already linked, or caches this home made before they were shared.
    if (error.code !== 'EEXIST')
      process.stderr.write(`cerin: could not share the Gradle caches: ${error.message}\n`)
  }
  return {
    HOME: home,
    USERPROFILE: home,
    APPDATA: cerinJoin(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: cerinJoin(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: config,
    XDG_CACHE_HOME: cerinJoin(home, '.cache'),
    // Only these content-addressed, concurrency-safe caches are shared, so each
    // conversation stops re-downloading and rebuilding the same artifacts. Other
    // tools keep login state under XDG_CACHE_HOME, so that stays per conversation.
    GOCACHE: cerinJoin(runtimeHome, '.cache', 'go-build'),
    GOMODCACHE: cerinJoin(runtimeHome, 'go', 'pkg', 'mod'),
    BUN_INSTALL_CACHE_DIR: cerinJoin(runtimeHome, '.bun', 'install', 'cache'),
    PLAYWRIGHT_BROWSERS_PATH: cerinJoin(runtimeHome, '.cache', 'ms-playwright', 'browsers'),
    PIP_CACHE_DIR: cerinJoin(runtimeHome, '.cache', 'pip'),
    UV_CACHE_DIR: cerinJoin(runtimeHome, '.cache', 'uv'),
    npm_config_cache: cerinJoin(runtimeHome, '.npm'),
    pnpm_config_store_dir: pnpmStore,
    XDG_DATA_HOME: cerinJoin(home, '.local', 'share'),
    XDG_STATE_HOME: cerinJoin(home, '.local', 'state'),
    CLOUDSDK_CONFIG: cerinJoin(config, 'gcloud'),
    GH_CONFIG_DIR: cerinJoin(config, 'gh'),
    AWS_SHARED_CREDENTIALS_FILE: cerinJoin(home, '.aws', 'credentials'),
    AWS_CONFIG_FILE: cerinJoin(home, '.aws', 'config'),
    KUBECONFIG: cerinJoin(home, '.kube', 'config'),
    AZURE_CONFIG_DIR: cerinJoin(home, '.azure'),
    DOCKER_CONFIG: cerinJoin(home, '.docker'),
    GIT_CONFIG_GLOBAL: cerinJoin(home, '.gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    NPM_CONFIG_USERCONFIG: cerinJoin(home, '.npmrc'),
    GNUPGHOME: cerinJoin(home, '.gnupg'),
    PATH: [cerinJoin(home, '.local', 'bin'), runtimeEnv.PATH]
      .filter(Boolean)
      .join(cerinPathDelimiter),
    NUPHOS_SESSION_HOME: home,
  }
}

// Claude's own login/session store belongs to the runtime. Pin its location
// before giving the SDK child (and its shell tools) the conversation's HOME.
export function cerinClaudeSessionEnv(env, sessionEnv, runtimeEnv = process.env, now = Date.now()) {
  const configDir =
    runtimeEnv.CLAUDE_CONFIG_DIR ||
    cerinJoin(runtimeEnv.HOME || runtimeEnv.USERPROFILE || cerinHostHome(), '.claude')
  // A token already in the environment was set on purpose and wins. Every spawn gets
  // it, a session-less one (the model probe) too, or that one would refresh the old login.
  const token = runtimeEnv.CLAUDE_CODE_OAUTH_TOKEN ? null : cerinLongLivedToken(configDir, now)
  const withToken = token ? { ...env, CLAUDE_CODE_OAUTH_TOKEN: token } : env
  const isolated = cerinSessionHomeEnv(sessionEnv, runtimeEnv)
  if (!isolated.HOME) return withToken
  return { ...withToken, CLAUDE_CONFIG_DIR: configDir, ...isolated }
}

// The one-year token claude-login.mjs --long-lived stores. It never refreshes, so
// sessions starting together cannot spend a refresh token another one still holds.
// Read at every session start: a new sign-in reaches the next session, and a lapsed
// token falls back to the runtime's ordinary login, if it still has one.
export function cerinLongLivedToken(configDir, now = Date.now()) {
  try {
    const record = JSON.parse(
      cerinReadFile(cerinJoin(configDir, '.cerin-oauth-token.json'), 'utf8'),
    )
    if (typeof record.token !== 'string' || !record.token) return null
    return Date.parse(record.expiresAt) > now ? record.token : null
  } catch {
    return null
  }
}

// Homes are never removed when a conversation ends, so a runtime sweeps the
// ones nobody has used for a week. It runs here because creating homes is what
// fills the disk, and every runtime (cloud image, Desktop, CLI host) creates
// them through this module. A woken conversation whose home was swept gets a
// fresh one from cerinSessionHomeEnv, without its old CLI logins.
const CERIN_SWEEP_EVERY_MS = 60 * 60 * 1000
const cerinLiveHomes = new Set()
let cerinHomeHeartbeat
let cerinSweepCheckedAt = 0

function cerinTouchHome(home) {
  const now = new Date()
  try {
    cerinUtimes(home, now, now)
  } catch {
    /* Gone or unwritable; the sweep keeps a home it cannot judge. */
  }
}

// The lease: while this process lives, the homes it handed out stay fresh.
function cerinKeepSessionHome(root, home) {
  cerinTouchHome(home)
  cerinLiveHomes.add(home)
  cerinHomeHeartbeat ??= setInterval(
    () => cerinLiveHomes.forEach(cerinTouchHome),
    CERIN_SWEEP_EVERY_MS,
  )
  cerinHomeHeartbeat.unref?.()
  if (Date.now() - cerinSweepCheckedAt < CERIN_SWEEP_EVERY_MS) return
  cerinSweepCheckedAt = Date.now()
  // Without /proc, ps or lsof nothing can tell a home is in use, so Windows keeps them.
  if (process.platform !== 'linux' && process.platform !== 'darwin') return
  const stamp = cerinJoin(root, '.sweep')
  try {
    if (Date.now() - cerinLstat(stamp).mtimeMs < CERIN_SWEEP_EVERY_MS) return
  } catch {
    /* First sweep on this runtime. */
  }
  try {
    cerinWriteFile(stamp, '')
  } catch {
    return
  }
  // Its own process at the lowest CPU and IO priority, so a shared machine does
  // not slow down. Only PATH (and Electron's run-as-Node switch) is passed on.
  const node = [process.execPath, '-e', `(${cerinSweepSessionHomes})(process.argv[1])`, root]
  const env = { PATH: process.env.PATH ?? '/usr/bin:/bin' }
  if (process.env.ELECTRON_RUN_AS_NODE) env.ELECTRON_RUN_AS_NODE = process.env.ELECTRON_RUN_AS_NODE
  const start = (argv, fallback) => {
    const child = cerinSpawn(argv[0], argv.slice(1), { env, detached: true, stdio: 'ignore' })
    child.once('error', () => fallback && start(fallback))
    child.unref()
  }
  const low =
    process.platform === 'linux' ? ['ionice', '-c3', 'nice', '-n19'] : ['taskpolicy', '-b']
  start([...low, ...node], node)
}

// Self-contained (its source is run as the sweep process): removes the direct
// children of `root` named like a session home that no process uses and
// where nothing in the tree changed within `idleMs`.
export async function cerinSweepSessionHomes(root, options = {}) {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const os = await import('node:os')
  const { execFile } = await import('node:child_process')
  const { randomUUID } = await import('node:crypto')
  const { now = Date.now(), idleMs = 7 * 24 * 60 * 60 * 1000, pauseMs = 20 } = options
  const cutoff = now - idleMs
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  try {
    os.setPriority(19)
  } catch {
    /* Already as low as allowed. */
  }
  const run = (command, args) =>
    new Promise((resolve) =>
      execFile(command, args, { maxBuffer: 64 << 20 }, (error, out) =>
        resolve(error && !out ? null : out),
      ),
    )
  // The HOME and working directory of every process of this user, as text;
  // null when they cannot be listed, which keeps every home.
  const processes = async () => {
    if (process.platform === 'linux') {
      const seen = []
      for (const pid of await fs.readdir('/proc')) {
        if (!/^\d+$/.test(pid)) continue
        const env = await fs.readFile(`/proc/${pid}/environ`, 'utf8').catch(() => '')
        const cwd = await fs.readlink(`/proc/${pid}/cwd`).catch(() => '')
        seen.push(...env.split('\0').filter((item) => item.startsWith('HOME=')), `CWD=${cwd}`)
      }
      return seen.join('\n')
    }
    const uid = String(os.userInfo().uid)
    const env = await run('ps', ['-E', '-ww', '-o', 'command=', '-U', uid])
    const cwd = await run('lsof', ['-a', '-u', uid, '-d', 'cwd', '-Fn'])
    if (env === null || cwd === null) return null
    const cwds = cwd.split('\n').filter((line) => line.startsWith('n'))
    return `${env}\n${cwds.map((line) => `CWD=${line.slice(1)}`).join('\n')}`
  }
  // Working directories are reported resolved (macOS's /var is /private/var),
  // HOME as it was given, so both spellings of the root are checked. Prefix
  // matches: a sibling sharing the prefix is kept too, which is always safe.
  const roots = [root, await fs.realpath(root).catch(() => root)]
  const used = (seen, dir, home) =>
    seen === null ||
    roots.some((at) =>
      [`HOME=${home}`, `CWD=${home}`, `CWD=${dir}`].some((item) =>
        seen.includes(item.replace(root, () => at)),
      ),
    )
  // Everything removed must sit on the root's own filesystem: a home holding
  // a mount (bind mount, volume, disk image, network share) is kept whole.
  const dev = (await fs.lstat(root).catch(() => null))?.dev
  // True when anything in the tree changed after the cutoff, cannot be read,
  // or is on another filesystem.
  const fresh = async (dir) => {
    for (const stack = [dir]; stack.length;) {
      const at = stack.pop()
      const stat = await fs.lstat(at).catch(() => null)
      if (!stat) continue
      if (stat.mtimeMs > cutoff || stat.dev !== dev) return true
      if (!stat.isDirectory()) continue
      const names = await fs.readdir(at).catch(() => null)
      if (!names) return true
      stack.push(...names.map((name) => path.join(at, name)))
    }
    return false
  }
  // Never follows a symlink: a link is removed, not what it points to. A mount
  // that appeared since the check stops the removal before anything in it.
  let count = 0
  const remove = async (at) => {
    const stat = await fs.lstat(at).catch(() => null)
    if (!stat) return
    if (stat.dev !== dev) throw new Error(`${at} is on another filesystem`)
    if (stat.isDirectory()) {
      await fs.chmod(at, 0o700).catch(() => {})
      for (const name of await fs.readdir(at)) await remove(path.join(at, name))
      await fs.rmdir(at)
    } else await fs.unlink(at)
    if (++count % 200 === 0) await sleep(pauseMs)
  }
  // <sha256(session)>[.<sha256(actor)>], or one a reclaim left set aside.
  const homeName = /^[0-9a-f]{64}(\.[0-9a-f]{64})?(\.reclaim-\d+-[0-9a-f-]+)?$/
  const removed = []
  for (const entry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
    // Dirent types come from lstat, so a symlink named like a home is skipped.
    if (!entry.isDirectory() || !homeName.test(entry.name)) continue
    const dir = path.join(root, entry.name)
    const home = path.join(root, entry.name.replace(/\.reclaim-.*$/, ''))
    try {
      if ((await fresh(dir)) || used(await processes(), dir, home)) continue
      // Set aside, then look again: a session that starts now gets a fresh
      // home, and one that started during the scan keeps this one.
      const aside = dir === home ? `${home}.reclaim-${Date.now()}-${randomUUID()}` : dir
      if (aside !== dir) await fs.rename(dir, aside)
      const stat = await fs.lstat(aside)
      if (!stat.isDirectory() || stat.mtimeMs > cutoff || used(await processes(), aside, home)) {
        // Not over a home a session has created since: this one stays aside
        // and is judged again by the next sweep.
        if (aside !== dir && !(await fs.lstat(dir).catch(() => null)))
          await fs.rename(aside, dir).catch(() => {})
        continue
      }
      await remove(aside)
      removed.push(entry.name)
    } catch {
      /* Taken by another sweep, or partly removed; the next sweep retries. */
    }
    await sleep(pauseMs)
  }
  return removed
}
