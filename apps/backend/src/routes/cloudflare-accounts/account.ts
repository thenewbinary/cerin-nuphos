import { z } from 'zod'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import {
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
  listCloudflareDnsRecords,
  listCloudflareZones,
  updateCloudflareDnsRecord,
} from '@/lib/byos/cloudflare'
import { getCloudflareIamPermissions } from '@/lib/byos/cloudflare-iam'
import { deleteComposioAccountBestEffort } from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import { zv } from '@/lib/validate'
import { disconnectBinding, requireCanDisconnect, requireTeamRole } from '@/middleware/auth'
import { teamByosBindings } from '@/models'
import { accountHandleFor, parseCloudflareIdParam } from '@/routes/cloudflare-accounts/shared'

import type { CloudflareAccountVariables } from '@/middleware/auth'
import type { Hono } from 'hono'

const dnsRecordSchema = z
  .object({
    type: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(
        z.enum([
          'A',
          'AAAA',
          'CAA',
          'CERT',
          'CNAME',
          'DNSKEY',
          'DS',
          'HTTPS',
          'LOC',
          'MX',
          'NAPTR',
          'NS',
          'PTR',
          'SMIMEA',
          'SRV',
          'SSHFP',
          'SVCB',
          'TLSA',
          'TXT',
          'URI',
        ]),
      ),
    name: z.string().trim().min(1),
    content: z.string().trim().min(1),
    ttl: z.number().int().min(1).max(2147483647).optional(),
    proxied: z.boolean().optional(),
    priority: z.number().int().min(0).max(65535).optional(),
    comment: z.string().trim().max(500).optional(),
  })
  .transform((v) => ({
    ...v,
    ttl: v.ttl ?? 1,
  }))

/** Disconnecting and the member list are the admin's, so they skip the member gate. */
export function registerCloudflareAdminRoutes(
  accountScoped: Hono<{ Variables: CloudflareAccountVariables }>,
): void {
  accountScoped.delete(
    '/',
    requireTeamRole('ADMINISTRATOR'),
    requireCanDisconnect('cloudflareBinding'),
    async (c) => {
      const teamId = parseObjectId(c.get('teamId'), 'teamId')
      const accountId = c.get('cloudflareAccountId')
      const binding = c.get('cloudflareBinding')

      await disconnectBinding(c, teamId, 'cloudflareAccounts', { accountId })
      await deleteComposioAccountBestEffort('cloudflare', binding.composioAccountId)

      return c.body(null, 204)
    },
  )

  registerBindingAccessRoutes(accountScoped, 'cloudflareAccounts', (c) =>
    c.get('cloudflareBinding'),
  )
}

export function registerCloudflareAccountRoutes(
  accountScoped: Hono<{ Variables: CloudflareAccountVariables }>,
): void {
  accountScoped.get('/', (c) => {
    return c.json({
      accountId: c.get('cloudflareAccountId'),
      accountName: c.get('cloudflareAccountName'),
    })
  })

  accountScoped.get('/zones', async (c) => {
    const zones = await listCloudflareZones(await accountHandleFor(c))

    return c.json({ zones })
  })

  accountScoped.get('/iam-permissions', async (c) => {
    return c.json(await getCloudflareIamPermissions(await accountHandleFor(c)))
  })

  accountScoped.get('/zones/:zoneId/dns-records', async (c) => {
    const zoneId = parseCloudflareIdParam(c.req.param('zoneId'), 'zoneId')
    const records = await listCloudflareDnsRecords(await accountHandleFor(c), zoneId)

    return c.json({ records })
  })

  accountScoped.post(
    '/zones/:zoneId/dns-records',
    requireTeamRole('ADMINISTRATOR'),
    zv('json', dnsRecordSchema),
    async (c) => {
      const zoneId = parseCloudflareIdParam(c.req.param('zoneId'), 'zoneId')
      const record = await createCloudflareDnsRecord(
        await accountHandleFor(c),
        zoneId,
        c.req.valid('json'),
      )

      return c.json(record, 201)
    },
  )

  accountScoped.put(
    '/zones/:zoneId/dns-records/:recordId',
    requireTeamRole('ADMINISTRATOR'),
    zv('json', dnsRecordSchema),
    async (c) => {
      const zoneId = parseCloudflareIdParam(c.req.param('zoneId'), 'zoneId')
      const recordId = parseCloudflareIdParam(c.req.param('recordId'), 'recordId')
      const record = await updateCloudflareDnsRecord(
        await accountHandleFor(c),
        zoneId,
        recordId,
        c.req.valid('json'),
      )

      return c.json(record)
    },
  )

  accountScoped.delete(
    '/zones/:zoneId/dns-records/:recordId',
    requireTeamRole('ADMINISTRATOR'),
    async (c) => {
      const zoneId = parseCloudflareIdParam(c.req.param('zoneId'), 'zoneId')
      const recordId = parseCloudflareIdParam(c.req.param('recordId'), 'recordId')

      await deleteCloudflareDnsRecord(await accountHandleFor(c), zoneId, recordId)

      return c.body(null, 204)
    },
  )
}
