import type { OpenAbProvider } from '@/lib/claude-code-preview/runtime-provider'

export type BindingShareDefault = 'private' | 'team'

export type CerinUser = {
  id: string
  email: string
  name: string
  username: string
  avatarURL: string
  language: string
  createdAt: string
}

export type CerinTeamRole = 'ADMINISTRATOR' | 'EDITOR' | 'VIEWER'

export type CerinTeam = {
  id: string
  name: string
  avatarUrl: string
  ownerID: string | null
  contactEmails: string[]
  allowedEmailDomains: string[]
  agentRuntime: OpenAbProvider
  /** Who a newly connected binding is shared with when its owner does not say. */
  bindingShareDefault?: BindingShareDefault
  createdAt: string
  role?: CerinTeamRole
  billing: TeamBillingSummary
}

export type TeamUpdateInput = {
  name?: string
}

export type TeamMembership = {
  role: CerinTeamRole
  team: CerinTeam
}

export type CerinTeamMember = CerinUser & {
  role: CerinTeamRole
  joinedAt: string
  // Set only for members surfaced via `includeRemoved` — the ISO time the
  // member was removed (soft-deleted) from the team. Absent for active members.
  removedAt?: string
}

export type AuthenticatedIdentity = {
  user: CerinUser
  cacheHit: boolean
  provider: 'cerin'
  /** Set when the token is a sign-in session rather than an agent-run JWT. */
  sessionId?: string
  /** A JWT minted for an agent run, not a sign-in. */
  agentRun?: boolean
}

/** Compatibility summary for older clients. Access is always free. */
export type TeamBillingSummary = { activated: boolean; active: boolean }
export type TeamBilling = Record<string, unknown>
