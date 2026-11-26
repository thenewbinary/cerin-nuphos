// Scenarios about who may use a binding, through the real routes and access checks.
import { queueGitlabAccount } from './composio-stub.ts'
import { until } from './processes.ts'

import type { Stack } from './stack.ts'
import type { Scenario } from './ui.ts'

type Reply = { status: number; body: unknown; text: string }

export function client(apiUrl: string, token: string) {
  return async (method: string, path: string, body?: unknown): Promise<Reply> => {
    const response = await fetch(apiUrl + path, {
      method,
      redirect: 'manual',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
    const text = await response.text()

    return { status: response.status, body: parse(text), text }
  }
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function must(condition: boolean, what: string): asserts condition {
  if (!condition) throw new Error(`Expected ${what}`)
}

export type Flow = Pick<Stack, 'apiUrl' | 'token' | 'teamId' | 'signInCode'>

export type Client = ReturnType<typeof client>

/** Signs a second member in and makes them an admin: admins may use shared bindings, never a private one. */
export async function joinAsAdmin(
  stack: Flow,
  owner: Client,
): Promise<{ member: Client; memberId: string; token: string }> {
  const email = `e2e-member-${String(Date.now())}@example.com`
  const anonymous = client(stack.apiUrl, '')

  await anonymous('POST', '/auth/email/request-code', { email })
  await until('the member sign-in code to be logged', async () => stack.signInCode(email))
  const verified = await anonymous('POST', '/auth/email/verify-code', {
    email,
    code: stack.signInCode(email),
  })
  const { token } = verified.body as { token: string }
  const member = client(stack.apiUrl, token)
  const invited = await owner('POST', `/teams/${stack.teamId}/invitations`, { inviteeEmail: email })
  const invitationId = (invited.body as { invitation: { id: string } }).invitation.id

  must(
    (await member('POST', `/invitations/${invitationId}/accept`)).status === 200,
    'the invitation to be accepted',
  )
  const me = (await member('GET', '/auth/me')).body as { user?: { id: string }; id?: string }
  const memberId = me.user?.id ?? me.id ?? ''
  const promoted = await owner('PATCH', `/teams/${stack.teamId}/members/${memberId}`, {
    role: 'ADMINISTRATOR',
  })

  must(promoted.status === 200, `the member to become an admin, got ${String(promoted.status)}`)

  return { member, memberId, token }
}

/** Connects the fixture GitLab identity through Composio, without a share choice. */
export async function connectGitlab(stack: Flow, as: Client, accountId: number) {
  queueGitlabAccount(accountId)
  const started = await as('POST', `/teams/${stack.teamId}/gitlab-bindings/start-oauth`, {})

  must(started.status === 200, `start-oauth to answer 200, got ${started.text}`)
  const { state } = started.body as { state: string }
  const response = await fetch(`${stack.apiUrl}/gitlab-app/setup?state=${state}&status=success`)
  const html = await response.text()

  must(response.status === 200, `the callback to answer 200, got ${html}`)
  const serialized = /location\.href = ("(?:\\.|[^"\\])*")/u.exec(html)?.[1]

  must(serialized !== undefined, 'the callback to contain its desktop deep link')
  const callback = new URL(JSON.parse(serialized) as string)
  const code = callback.searchParams.get('code')

  must(
    callback.searchParams.get('deferred') === '1' && code !== null,
    'the callback to stage its grant',
  )

  return as('POST', `/teams/${stack.teamId}/connector-oauth/${state}/complete`, { code })
}

/** The id of the team's GitLab binding for `accountId`. */
export async function gitlabBindingId(
  stack: Flow,
  owner: Client,
  accountId: number,
): Promise<string> {
  const listed = (await owner('GET', `/teams/${stack.teamId}/gitlab-bindings`)).body as {
    bindings?: { id: string; accountId: number }[]
  }
  const binding = (listed.bindings ?? []).find((b) => b.accountId === accountId)

  must(binding !== undefined, 'the owner to see the new binding')

  return binding.id
}

// An OAuth-connected GitLab binding starts private to the member who connects it. Another admin
// can't select it, use it or re-authorize it; the member who connected it can.
export async function privateOAuthBindingFlow(stack: Flow, log: (line: string) => void = () => {}) {
  const owner = client(stack.apiUrl, stack.token)
  const accountId = 4242
  const { member, memberId } = await joinAsAdmin(stack, owner)
  const connect = async (as: Client) => connectGitlab(stack, as, accountId)

  log(`member ${memberId} joined as an admin`)
  const first = await connect(owner)

  must(first.status === 200, `the owner's completion to succeed, got ${first.text}`)
  log(`owner connects GitLab: completion ${String(first.status)}`)
  const bindingId = await gitlabBindingId(stack, owner, accountId)
  const access = async () =>
    (await owner('GET', `/teams/${stack.teamId}/gitlab-bindings/${bindingId}/access`)).body
  const before = JSON.stringify(await access())

  log(`binding ${bindingId} access: ${before}`)
  must(
    before.includes('"memberAllowList":["') && !before.includes('"*"'),
    'the binding to start private',
  )

  // Offered to a session: credential options list it for the owner only.
  const offered = async (as: Client) =>
    JSON.stringify(
      (await as('GET', `/agent/credential-options?teamId=${stack.teamId}`)).body,
    ).includes(bindingId)

  must(await offered(owner), 'the owner to be offered the binding')
  must(!(await offered(member)), 'the other admin not to be offered it')
  log('credential options: offered to the owner, not to the other admin')

  const ownerConnection = await owner(
    'GET',
    `/teams/${stack.teamId}/gitlab-bindings/${bindingId}/namespaces`,
  )
  const memberConnection = await member(
    'GET',
    `/teams/${stack.teamId}/gitlab-bindings/${bindingId}/namespaces`,
  )

  log(
    `connection: owner ${String(ownerConnection.status)}, other admin ${String(memberConnection.status)} ${memberConnection.text.slice(0, 160)}`,
  )
  must(ownerConnection.status === 200, 'the owner to use its connection')
  must(memberConnection.status === 403, 'the other admin to be refused its connection')

  // Re-authorizing the same GitLab account.
  const rebindByMember = await connect(member)

  log(
    `other admin re-authorizes: ${String(rebindByMember.status)} ${rebindByMember.text.slice(0, 200)}`,
  )
  must(rebindByMember.status === 403, 'the other admin to be refused re-authorizing it')
  must(
    JSON.stringify(await access()) === before,
    'the list to be unchanged after the refused re-authorization',
  )
  must(
    (await member('GET', `/teams/${stack.teamId}/gitlab-bindings/${bindingId}/namespaces`))
      .status === 403,
    'the other admin still to be refused after re-authorizing',
  )
  const rebindByOwner = await connect(owner)

  must(rebindByOwner.status === 200, `the owner to re-authorize it, got ${rebindByOwner.text}`)
  log(`owner re-authorizes: completion ${String(rebindByOwner.status)}`)
  must(
    JSON.stringify(await access()) === before,
    'the list to be unchanged after the owner re-authorizes',
  )
  must(
    (await owner('GET', `/teams/${stack.teamId}/gitlab-bindings/${bindingId}/namespaces`))
      .status === 200,
    'the owner still to use its connection',
  )
  log('list unchanged after both re-authorizations')
}

// Its owner shares a private binding and takes it back; another admin can't change its list.
export async function bindingListFlow(stack: Flow, log: (line: string) => void = () => {}) {
  const owner = client(stack.apiUrl, stack.token)
  const accountId = 4343
  const { member, memberId } = await joinAsAdmin(stack, owner)

  must((await connectGitlab(stack, owner, accountId)).status === 200, 'GitLab to connect')
  const bindingId = await gitlabBindingId(stack, owner, accountId)
  const path = `/teams/${stack.teamId}/gitlab-bindings/${bindingId}`
  const save = async (as: Client, memberAllowList: string[]) =>
    (await as('PUT', `${path}/access`, { memberAllowList })).status
  const usable = async (as: Client) => (await as('GET', `${path}/namespaces`)).status
  const ownerId = ((await owner('GET', `${path}/access`)).body as { memberAllowList: string[] })
    .memberAllowList[0]!

  const refused = await save(member, ['*'])

  log(`other admin shares the private binding: ${String(refused)}`)
  must(refused === 403, 'another admin to be refused changing a private list')

  must((await save(owner, [ownerId, memberId])) === 200, 'the owner to share it')
  log(`owner shares it with the other admin: their connection ${String(await usable(member))}`)
  must((await usable(member)) === 200, 'the other admin to use it once shared')

  must((await save(owner, [ownerId])) === 200, 'the owner to take it back')
  log(`owner takes it back: their connection ${String(await usable(member))}`)
  must((await usable(member)) === 403, 'the other admin to be refused once it is private again')

  // The Desktop refuses to save an empty list; the backend keeps the owner able to reopen one.
  must((await save(owner, [])) === 200, 'the owner to empty it')
  must((await usable(owner)) === 403, 'nobody to use an empty list')
  must((await save(owner, [ownerId])) === 200, 'the owner to reopen it')
  must((await usable(owner)) === 200, 'the owner to use it again')
  log('owner empties the list and reopens it')
}

export const bindingAccessScenarios: Scenario[] = [
  {
    name: 'a private OAuth binding is usable and re-authorizable only by its owner',
    run: async (_page, stack) => privateOAuthBindingFlow(stack),
  },
  {
    name: "a private binding's list is changed only by its owner",
    run: async (_page, stack) => bindingListFlow(stack),
  },
]
