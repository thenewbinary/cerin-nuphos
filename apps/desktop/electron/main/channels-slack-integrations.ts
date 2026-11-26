import * as atlas from '../atlas'
import * as slackIntegrationInstall from '../slack-integration-install'

export const slackIntegrationChannels = {
  'atlas:startSlackIntegrationOAuth': (_e: unknown, teamId: string, share?: atlas.BindingShare) =>
    slackIntegrationInstall.startInstall(teamId, share),
  'atlas:cancelSlackIntegrationOAuth': (_e: unknown, teamId: string) =>
    slackIntegrationInstall.cancelPending(teamId),
  'atlas:listSlackIntegrations': (_e: unknown, teamId: string) =>
    atlas.listSlackIntegrations(teamId),
  'atlas:unbindSlackIntegration': (_e: unknown, teamId: string, integrationId: string) =>
    atlas.unbindSlackIntegration(teamId, integrationId),
} as const
