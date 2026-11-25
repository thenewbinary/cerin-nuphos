import { bool, boundedInt, optional } from './env'

/**
 * Boxes: cloud machines Cerin creates on instabox for a user, registered as that
 * user's devices through a one-time join token. One partner key for the whole
 * deployment; the feature is off when it is unset.
 */
export type BoxConfig = {
  instabox: { apiKey: string; apiUrl?: string } | null
  /** Where a Box downloads the CLI and its runtime bundle; unset means the GitHub release. */
  downloadUrl?: string
  /** vCPUs a team's running Boxes may use when its document sets no `boxVcpuLimit`; unset is unlimited. */
  defaultVcpuLimit?: number
  /**
   * Hours a month a team without its own `boxVcpuLimit` may run Boxes at `defaultVcpuLimit`.
   * Set, such a team has one Box, which Cerin pauses when idle; unset is unlimited.
   */
  defaultMonthlyHours?: number
  /** The billing service clients open to buy or change a plan; unset shows no Upgrade. */
  billingUrl?: string
  /** Whether the backend updates idle Boxes whose CLI does not update itself between turns (#2104). */
  autoUpdate: boolean
  /** Makes each new account's free Box an OpenRouter key for its OpenCode; unset makes none. */
  openRouterManagementKey?: string
}

export function boxConfig(): BoxConfig {
  const apiKey = optional('INSTABOX_API_KEY')
  const downloadUrl = optional('CERIN_BOX_DOWNLOAD_URL') ?? optional('BOX_DEV_DOWNLOAD_URL')

  return {
    autoUpdate: bool('BOX_AUTO_UPDATE', true),
    ...(downloadUrl ? { downloadUrl } : {}),
    ...(optional('BOX_DEFAULT_VCPU_LIMIT')
      ? { defaultVcpuLimit: boundedInt('BOX_DEFAULT_VCPU_LIMIT', 0, { min: 0, max: 10_000 }) }
      : {}),
    ...(optional('BOX_DEFAULT_MONTHLY_HOURS')
      ? { defaultMonthlyHours: boundedInt('BOX_DEFAULT_MONTHLY_HOURS', 0, { min: 0, max: 744 }) }
      : {}),
    ...(optional('OPENROUTER_MANAGEMENT_KEY')
      ? { openRouterManagementKey: optional('OPENROUTER_MANAGEMENT_KEY') }
      : {}),
    ...(optional('CERIN_BILLING_URL') ? { billingUrl: optional('CERIN_BILLING_URL') } : {}),
    instabox: apiKey
      ? {
          apiKey,
          ...(optional('INSTABOX_API_URL') ? { apiUrl: optional('INSTABOX_API_URL') } : {}),
        }
      : null,
  }
}
