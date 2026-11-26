import { ObjectId } from 'mongodb'

import { CLOUDFLARE_CONNECTOR } from '@/lib/byos/cloudflare'
import { appendEnvironmentBinding } from '@/lib/byos/environment-bindings'
import { reboundAccess } from '@/lib/connector-oauth'
import { deleteComposioAccountBestEffort } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { teamByosBindings } from '@/models'

import type { BindingAccess, CloudflareAccountBinding } from '@/models'

export type CloudflareBindingDraft = Pick<
  CloudflareAccountBinding,
  'accountId' | 'accountName' | 'composioAccountId' | 'composioUserId'
>

/** Rebind in place so environment slots, binding ids, ACLs and R2 S3 keys survive. */
export async function persistCloudflareBinding(
  teamId: ObjectId,
  draft: CloudflareBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  const now = new Date()
  const entryForAccount = async () =>
    (
      await teamByosBindings().findOne(
        { _id: teamId, 'cloudflareAccounts.accountId': draft.accountId },
        { projection: { 'cloudflareAccounts.$': 1 } },
      )
    )?.cloudflareAccounts?.[0]

  const rebindInPlace = async (): Promise<CloudflareAccountBinding | null> => {
    const existing = await entryForAccount()

    if (!existing) return null
    const binding: CloudflareAccountBinding = {
      ...draft,
      id: existing.id,
      createdAt: existing.createdAt,
      ...reboundAccess(existing, access),
      ...(existing.r2S3 ? { r2S3: existing.r2S3 } : {}),
    }
    const result = await teamByosBindings().updateOne(
      {
        _id: teamId,
        cloudflareAccounts: {
          $elemMatch: { id: existing.id, 'access.updatedAt': existing.access?.updatedAt ?? null },
        },
      },
      { $set: { 'cloudflareAccounts.$': binding, updatedAt: now } },
    )

    if (result.matchedCount === 0) {
      throw new AppError(
        409,
        'binding_access_changed',
        'Who may use this Cloudflare account changed while it was being connected. Try again.',
      )
    }

    return existing
  }

  let replaced = await rebindInPlace()
  let bindingId = replaced?.id

  if (!bindingId) {
    bindingId = new ObjectId()
    const binding: CloudflareAccountBinding = {
      ...draft,
      id: bindingId,
      createdAt: now,
      access,
    }
    const inserted = await appendEnvironmentBinding(
      teamId,
      { 'cloudflareAccounts.accountId': { $ne: draft.accountId } },
      { $push: { cloudflareAccounts: binding }, $set: { updatedAt: now } },
    )

    if (!inserted) {
      replaced = await rebindInPlace()
      if (!replaced) {
        throw new AppError(
          409,
          'cloudflare_account_already_bound',
          'Cloudflare account is already bound',
        )
      }
      bindingId = replaced.id
    }
  }

  if (replaced && replaced.composioAccountId !== draft.composioAccountId) {
    await deleteComposioAccountBestEffort(CLOUDFLARE_CONNECTOR.provider, replaced.composioAccountId)
  }

  return {
    binding_id: bindingId.toHexString(),
    team_id: teamId.toHexString(),
    account_id: draft.accountId,
    account_name: draft.accountName ?? '',
  }
}
