import type { CloudflareAccountHandle } from '@/lib/byos/cloudflare'
import type { CloudflareAccountBinding } from '@/models'
import type { ObjectId } from 'mongodb'

/** Provider credentials stay in Composio; this handle carries only account ids. */
export async function cloudflareAccountHandle(
  _teamId: ObjectId,
  binding: CloudflareAccountBinding,
): Promise<CloudflareAccountHandle> {
  return {
    accountId: binding.accountId,
    composioAccountId: binding.composioAccountId,
    composioUserId: binding.composioUserId,
  }
}
