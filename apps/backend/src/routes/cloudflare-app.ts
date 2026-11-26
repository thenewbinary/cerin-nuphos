import { Hono } from 'hono'

import { CLOUDFLARE_CONNECTOR, cloudflareIdentity } from '@/lib/byos/cloudflare'
import { handleComposioConnectorCallback } from '@/lib/composio-connect'
import { persistCloudflareBinding } from '@/routes/cloudflare-accounts/persist'

export { persistCloudflareBinding }

export const cloudflareAppRoutes = new Hono()

cloudflareAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: CLOUDFLARE_CONNECTOR,
    deepLink: 'cerin://cloudflare-callback',
    identity: async (pending, composioUserId) => ({
      ...(await cloudflareIdentity({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })),
      composioAccountId: pending.composioAccountId,
      composioUserId,
    }),
    persist: persistCloudflareBinding,
  }),
)
