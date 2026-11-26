import { ObjectId } from 'mongodb'

import { findSlackIntegration } from '@/lib/byos/account'
import { AppError } from '@/lib/errors'
import { parseObjectId } from '@/lib/objectid'
import { canRequestUseBinding } from '@/middleware/auth/binding-access'

import type { SlackIntegrationVariables } from '@/middleware/auth/types'
import type { MiddlewareHandler } from 'hono'

export function requireSlackIntegration(): MiddlewareHandler<{
  Variables: SlackIntegrationVariables
}> {
  return async (c, next) => {
    const param = c.req.param('integrationId')

    if (!param || !/^[a-f0-9]{24}$/iu.test(param)) {
      throw new AppError(400, 'invalid_integration_id', 'integrationId must be an ObjectId')
    }
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = await findSlackIntegration(teamId, new ObjectId(param))

    if (!binding) {
      throw new AppError(404, 'slack_integration_not_bound', 'Slack integration is not bound')
    }
    c.set('slackIntegrationId', param)
    c.set('slackIntegrationLabel', binding.label)
    c.set('slackAccess', binding.access)
    c.set('slackBinding', binding)
    await next()
  }
}

export function requireSlackMemberAccess(): MiddlewareHandler<{
  Variables: SlackIntegrationVariables
}> {
  return async (c, next) => {
    const access = c.get('slackAccess')
    const closed = { updatedAt: new Date(0), updatedBy: '', ...access }

    if (!canRequestUseBinding(c, { ...closed, memberAllowList: access?.memberAllowList ?? [] })) {
      throw new AppError(
        403,
        'slack_integration_access_denied',
        'You are not allowed to use this Slack integration binding',
      )
    }
    await next()
  }
}
