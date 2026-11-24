export type BoxJoin = { token: string; expiresAt: string; apiUrl: string | null }

/** The command that makes a machine one of your computers, run on the machine itself. */
export function joinCommand(join: BoxJoin): string {
  // Cerin Cloud is the CLI's default; only another deployment (self-hosted, dev) names itself.
  const api =
    join.apiUrl && join.apiUrl !== 'https://platform.cerin.ai' ? ` --api-url ${join.apiUrl}` : ''

  // The installer starts `cerin agent` when given a token, so a PATH without it does not matter.
  return `curl -fsSL https://cerin.ai/install | sh -s -- --join ${join.token}${api}`
}
