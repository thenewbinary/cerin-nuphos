import {
  constants as cerinDesktopFs,
  mkdirSync as cerinDesktopMkdir,
  writeFileSync as cerinDesktopWrite,
} from 'node:fs'
import { join as cerinDesktopJoin } from 'node:path'

/** macOS needs the host HOME for Keychain; only tool commands get the session HOME. */
export function cerinDesktopClaudeEnv(
  isolated,
  runtimeEnv = process.env,
  platform = process.platform,
) {
  if (platform !== 'darwin' || !isolated.HOME) return isolated
  const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
  const wrapper = cerinDesktopJoin(isolated.HOME, 'tool-shell.sh')
  cerinDesktopMkdir(isolated.HOME, { recursive: true, mode: 0o700 })
  cerinDesktopWrite(
    wrapper,
    '#!/bin/sh\n' +
      Object.entries(isolated)
        .map(([key, value]) => `export ${key}=${quote(value)}\n`)
        .join('') +
      'exec /bin/sh -c "$1"\n',
    {
      mode: 0o700,
      flag:
        cerinDesktopFs.O_WRONLY |
        cerinDesktopFs.O_CREAT |
        cerinDesktopFs.O_TRUNC |
        cerinDesktopFs.O_NOFOLLOW,
    },
  )
  return {
    ...isolated,
    HOME: runtimeEnv.HOME,
    USERPROFILE: runtimeEnv.USERPROFILE ?? runtimeEnv.HOME,
    CLAUDE_CODE_SHELL_PREFIX: wrapper,
    // Non-interactive bash avoids the host's zshenv as well as login profiles.
    CLAUDE_CODE_SHELL: '/bin/bash',
    CLAUDE_CODE_SHELL_SKIP_LOGIN: '1',
    CLAUDE_CODE_DISABLE_SHELL_SNAPSHOT: '1',
  }
}
