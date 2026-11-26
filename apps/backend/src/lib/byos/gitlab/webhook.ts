import { timingSafeEqual } from 'node:crypto'

import { config } from '@/config'

export function verifyWebhookToken(headerToken: string | null | undefined): boolean {
  const secret = config.byos.gitlab.webhookSecret

  if (!secret) return false
  if (!headerToken) return false
  const a = Buffer.from(headerToken)
  const b = Buffer.from(secret)

  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
