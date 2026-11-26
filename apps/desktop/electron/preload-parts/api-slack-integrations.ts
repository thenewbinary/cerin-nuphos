import { ipcRenderer } from 'electron'

import type { BindingShare } from '../../src/lib/bindingShare'

export const slackIntegrationsApi = {
  atlasStartSlackIntegrationOAuth: (teamId: string, share?: BindingShare) =>
    ipcRenderer.invoke('atlas:startSlackIntegrationOAuth', teamId, share),
  atlasCancelSlackIntegrationOAuth: (teamId: string) =>
    ipcRenderer.invoke('atlas:cancelSlackIntegrationOAuth', teamId),
  atlasListSlackIntegrations: (teamId: string) =>
    ipcRenderer.invoke('atlas:listSlackIntegrations', teamId),
  atlasUnbindSlackIntegration: (teamId: string, integrationId: string) =>
    ipcRenderer.invoke('atlas:unbindSlackIntegration', teamId, integrationId),
}
