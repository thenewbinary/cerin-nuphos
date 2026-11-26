import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { getBuiltinSkillsDirectory } from '@/lib/agent/skill-store/inject'

const skills = getBuiltinSkillsDirectory()

function jwt(secret: string) {
  const payload = Buffer.from(JSON.stringify({ ori: 'http://backend.invalid' })).toString(
    'base64url',
  )

  return `header.${payload}.${secret}`
}

// Records every argument (also to CURL_ARGV) and every --config or -H @file
// curl receives, then fails the call.
const fakeCurl = `#!/usr/bin/env bash
prev=
for arg in "$@"; do
  printf '%s\\n' "$arg" | tee -a "$CURL_ARGV" >>"$CURL_CAPTURE"
  if [[ "$prev" == --config ]]; then cat "$arg" >>"$CURL_CAPTURE"; fi
  if [[ "$prev" == -H && "$arg" == @* ]]; then cat "\${arg#@}" >>"$CURL_CAPTURE"; fi
  prev=$arg
done
exit 22
`

async function capturedAuthorization(script: string[], stdin = '', revoked = false) {
  const dir = mkdtempSync(join(tmpdir(), 'cerin-credential-scripts-'))
  const bin = join(dir, 'bin')
  const credentials = join(dir, 'credentials')
  const capture = join(dir, 'capture')
  const argv = join(dir, 'argv')

  Bun.spawnSync(['mkdir', '-p', bin, credentials])
  writeFileSync(join(bin, 'curl'), fakeCurl)
  chmodSync(join(bin, 'curl'), 0o755)
  writeFileSync(capture, '')
  writeFileSync(argv, '')
  if (!revoked) {
    writeFileSync(join(credentials, 'CERIN_TOKEN'), jwt('fresh'))
  }
  const child = Bun.spawn(['bash', ...script], {
    env: {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      HOME: dir,
      CURL_CAPTURE: capture,
      CURL_ARGV: argv,
      OPENAB_CREDENTIALS_DIR: credentials,
      CERIN_TOKEN: jwt('stale'),
      CERIN_BACKEND_URL: 'http://backend.invalid',
      CERIN_SESSION_ID: 'session',
    },
    stdin: new Blob([stdin]),
    stdout: 'ignore',
    stderr: 'ignore',
  })

  await child.exited

  return { captured: readFileSync(capture, 'utf8'), argv: readFileSync(argv, 'utf8') }
}

describe('skill scripts prefer the per-turn credential file over the spawn-time env', () => {
  const cases: [string, string[], string?][] = [
    ['Cerin API helper', [join(skills, '_runtime/scripts/cerin-api.sh'), 'GET', '/teams']],
    [
      'Composio proxy',
      [
        join(skills, '_runtime/scripts/composio-proxy.sh'),
        'jira-sites',
        '0123456789abcdef01234567',
        '76543210fedcba9876543210',
        'GET',
        '/ex/jira/cloud/rest/api/3/myself',
      ],
    ],
    [
      'file transfer',
      [join(skills, 'file-transfer/scripts/transfer-pull.sh'), 'team', 'group', 'out'],
    ],
    ['credential setup', [join(skills, 'aws/scripts/setup-credentials.sh'), 'team', 'account']],
    [
      'PostHog credential setup',
      [join(skills, 'posthog/scripts/setup-credentials.sh'), 'team', 'integration'],
    ],
  ]

  for (const [name, script, stdin] of cases) {
    test(name, async () => {
      const { captured, argv } = await capturedAuthorization(script, stdin)

      expect(captured).toContain(`Bearer ${jwt('fresh')}`)
      expect(captured).not.toContain('stale')
      // The bearer never appears in a process's argument list.
      expect(argv).not.toContain(jwt('fresh'))
    })

    test(`${name} never falls back to a revoked token`, async () => {
      expect((await capturedAuthorization(script, stdin, true)).captured).not.toContain('stale')
    })
  }
})

test('no skill script or doc passes a bearer token as a curl argument', () => {
  const offenders = Array.from(new Bun.Glob('**/*.{sh,md}').scanSync(skills)).filter((file) =>
    /-H\s+"Authorization: Bearer \$/u.test(readFileSync(join(skills, file), 'utf8')),
  )

  expect(offenders).toEqual([])
})

const tokenLookupScripts = ['betterstack', 'notion', 'plaud', 'posthog', 'resend', 'upstash'].map(
  (skill) => join(skills, skill, 'scripts/setup-credentials.sh'),
)

async function authorizationWithEnv(script: string, env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'cerin-token-lookup-'))
  const bin = join(dir, 'bin')
  const capture = join(dir, 'capture')

  Bun.spawnSync(['mkdir', '-p', bin, join(dir, '.config/cerin')])
  writeFileSync(join(bin, 'curl'), fakeCurl)
  chmodSync(join(bin, 'curl'), 0o755)
  writeFileSync(capture, '')
  // The account's full session token, which scripts must never pick up.
  writeFileSync(join(dir, '.config/cerin/cli.yaml'), `token: ${jwt('session')}\n`)
  writeFileSync(join(dir, '.config/cerin/desktop.yaml'), `token: ${jwt('session')}\n`)
  const child = Bun.spawn(['bash', script, 'team', 'binding'], {
    env: {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      HOME: dir,
      CURL_CAPTURE: capture,
      CURL_ARGV: join(dir, 'argv'),
      CERIN_BACKEND_URL: 'http://backend.invalid',
      ...env,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  })
  const stderr = await new Response(child.stderr).text()
  const code = await child.exited

  return { captured: readFileSync(capture, 'utf8'), stderr, code }
}

describe('builtin setup scripts share one Cerin token lookup', () => {
  for (const script of tokenLookupScripts) {
    const name = script.slice(skills.length + 1)

    test(`${name} sources the shared lookup`, () => {
      expect(readFileSync(script, 'utf8')).toContain(
        'source "$script_dir/../../_runtime/scripts/cerin-token.sh"',
      )
    })

    test(`${name} uses CERIN_TOKEN without a credentials directory`, async () => {
      const { captured } = await authorizationWithEnv(script, { CERIN_TOKEN: jwt('env') })

      expect(captured).toContain(`Bearer ${jwt('env')}`)
      expect(captured).not.toContain('session')
    })

    test(`${name} never reads the local session token`, async () => {
      const { captured, stderr, code } = await authorizationWithEnv(script, {})

      expect(code).toBe(1)
      expect(captured).toBe('')
      expect(stderr).toContain('Cerin authorization is unavailable')
    })
  }
})

test('no skill script reads the session token from ~/.config/cerin', () => {
  const offenders = Array.from(new Bun.Glob('**/*.sh').scanSync(skills)).filter((file) =>
    /\.config\/cerin\/|"cerin" \/ name|read_local_cerin_token/u.test(
      // Comments may mention the file; only code is checked.
      readFileSync(join(skills, file), 'utf8').replace(/^\s*#.*$/gmu, ''),
    ),
  )

  expect(offenders).toEqual([])
})
