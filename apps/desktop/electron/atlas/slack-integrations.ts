import { withShare } from './binding-access'
import { call } from './client'

import type { BindingShare } from '../../src/lib/bindingShare'

export type SlackIntegration = {
  id: string
  label: string
  slackTeamId: string
  slackTeamName: string
  slackUserId: string
  slackUserName: string | null
  authorizedBy: string
  createdAt: string
}

export async function listSlackIntegrations(teamId: string): Promise<SlackIntegration[]> {
  const data = await call<{ integrations?: SlackIntegration[] }>(
    'GET',
    `/teams/${teamId}/slack-integrations`,
  )

  return data.integrations ?? []
}

export function startSlackIntegrationOAuth(
  teamId: string,
  share?: BindingShare,
): Promise<{ state: string; authorizeUrl: string; expiresAt: string }> {
  return call('POST', `/teams/${teamId}/slack-integrations/start-oauth`, withShare({}, share), {
    retry: false,
  })
}

export async function cancelSlackIntegrationOAuth(teamId: string, state: string): Promise<void> {
  await call(
    'DELETE',
    `/teams/${teamId}/slack-integrations/start-oauth/${encodeURIComponent(state)}`,
    undefined,
    { retry: false },
  )
}

export async function unbindSlackIntegration(teamId: string, integrationId: string): Promise<void> {
  await call(
    'DELETE',
    `/teams/${teamId}/slack-integrations/${encodeURIComponent(integrationId)}`,
    undefined,
    { retry: false },
  )
}
