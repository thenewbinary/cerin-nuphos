// Scenarios about what happens to a member's bindings when they leave the team.
import {
  client,
  connectGitlab,
  gitlabBindingId,
  joinAsAdmin,
  must,
} from './binding-access-scenarios.ts'

import type { Flow } from './binding-access-scenarios.ts'
import type { Scenario } from './ui.ts'

// A removed member's private bindings are disconnected; the ones they shared stay.
export async function departureFlow(stack: Flow, log: (line: string) => void = () => {}) {
  const owner = client(stack.apiUrl, stack.token)
  const kept = 4545
  const dropped = 4646
  const { member, memberId } = await joinAsAdmin(stack, owner)

  for (const accountId of [dropped, kept]) {
    must((await connectGitlab(stack, member, accountId)).status === 200, 'GitLab to connect')
  }
  const privateId = await gitlabBindingId(stack, member, dropped)
  const sharedId = await gitlabBindingId(stack, member, kept)
  const path = `/teams/${stack.teamId}/gitlab-bindings`

  must(
    (await member('PUT', `${path}/${sharedId}/access`, { memberAllowList: ['*'] })).status === 200,
    'the member to share one binding with the team',
  )
  log(`member ${memberId} connects ${privateId} privately and shares ${sharedId}`)

  const removed = await owner('DELETE', `/teams/${stack.teamId}/members/${memberId}`)

  must(removed.status === 204, `the member to be removed, got ${String(removed.status)}`)
  const listed = JSON.stringify((await owner('GET', path)).body)

  log(
    `after removal: private ${String(listed.includes(privateId))}, shared ${String(listed.includes(sharedId))}`,
  )
  must(!listed.includes(privateId), "the removed member's private binding to be disconnected")
  must(listed.includes(sharedId), 'the binding they shared to stay connected')
}

export const departureScenarios: Scenario[] = [
  {
    name: "a removed member's private bindings are disconnected, and the ones they shared stay",
    run: async (_page, stack) => departureFlow(stack),
  },
]
