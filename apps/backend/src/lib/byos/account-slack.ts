import { teamByosBindings } from '@/models'

import type { SlackIntegrationBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export async function findSlackIntegration(
  teamId: ObjectId,
  bindingId: ObjectId,
): Promise<SlackIntegrationBinding | null> {
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { slackIntegrations: 1 } },
  )

  return (doc?.slackIntegrations ?? []).find((b) => b.id.equals(bindingId)) ?? null
}
