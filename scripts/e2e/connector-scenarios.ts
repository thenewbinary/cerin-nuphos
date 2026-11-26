// Scenarios about connecting a provider from the Connectors dialog.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

import { composioDeletedAccounts } from './composio-stub.ts'
import { artifacts, until } from './processes.ts'

import type { Scenario } from './ui.ts'

export const connectorScenarios: Scenario[] = [
  {
    // #3848: Connect used to leave the dialog for Settings without starting authorization.
    name: 'a personal Connect starts authorization without leaving the current route',
    run: async (page) => {
      const fixture = await page.evaluateHandle(async (modulePath) => {
        const { api } = await import(modulePath)
        const originalStart = api.atlasStartPersonalCredential
        const originalOpen = api.appOpenExternal
        const started: string[] = []
        const opened: string[] = []
        const authorizeUrl = 'https://github.com/login/oauth/authorize?client_id=e2e&state=e2e'

        api.atlasStartPersonalCredential = async (provider: string) => {
          started.push(provider)

          return { authorizeUrl }
        }
        api.appOpenExternal = async (url: string) => {
          opened.push(url)
        }

        return {
          started,
          opened,
          authorizeUrl,
          restore: () => {
            api.atlasStartPersonalCredential = originalStart
            api.appOpenExternal = originalOpen
          },
        }
      }, '/src/api.ts')

      try {
        await page.getByRole('button', { name: 'Connectors' }).click()
        const dialog = page.getByRole('dialog', { name: 'Connectors', exact: true })
        const route = page.url()

        await dialog.getByRole('button', { name: 'Add GitHub', exact: true }).click()
        const service = page.getByRole('dialog', { name: 'GitHub', exact: true })

        await service.getByRole('button', { name: 'Connect', exact: true }).click()
        await until('the personal OAuth URL to open', async () =>
          fixture.evaluate((state) => state.opened.length > 0),
        )
        const evidence = await fixture.evaluate((state) => ({
          providerRequests: state.started,
          openedUrls: state.opened,
          expectedUrl: state.authorizeUrl,
        }))

        assert.deepEqual(evidence.providerRequests, ['github'])
        assert.deepEqual(evidence.openedUrls, [evidence.expectedUrl])
        assert.equal(page.url(), route)
        await service.waitFor({ state: 'visible' })
        assert.equal(
          await page.getByRole('heading', { name: 'Personal Credentials', exact: true }).count(),
          0,
        )
        writeFileSync(
          `${artifacts}/personal-connect-start.json`,
          JSON.stringify({ ...evidence, routeBefore: route, routeAfter: page.url() }, null, 2),
        )
        await page.screenshot({ path: `${artifacts}/personal-connect-start.png` })
        await service.getByLabel('Close modal').click()
      } finally {
        await fixture.evaluate((state) => state.restore())
        await fixture.dispose()
      }
    },
  },
  {
    name: 'Cloudflare rejecting the authorization shows its reason in the app',
    run: async (page, stack, desktop) => {
      assert(desktop)
      await page.getByRole('button', { name: 'Connectors' }).click()
      await page.getByLabel('Add Cloudflare').click()
      const share = page.getByRole('button', { name: 'All members', exact: true })
      const connect = page.getByRole('button', { name: 'Connect with Cloudflare' })
      const action = await connect.elementHandle()

      assert.equal(
        await share.evaluate(
          (field, button) =>
            Boolean(field.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING),
          action,
        ),
        true,
        'the sharing field appears before the authorization action',
      )
      await share.click()
      await page.screenshot({ path: `${artifacts}/cloudflare-connect-sharing.png` })
      const deletedBefore = composioDeletedAccounts().length

      await connect.click()
      await page.getByText('Waiting for browser authorization…').waitFor()
      assert.deepEqual(stack.cloudflareShare(), { mode: 'team', memberIds: [] })
      await page.screenshot({ path: `${artifacts}/cloudflare-waiting.png` })
      // Composio's failed redirect, with its desktop deep link delivered as the browser would.
      const query = new URLSearchParams({ state: stack.cloudflareState(), status: 'failed' })
      const response = await fetch(`${stack.apiUrl}/cloudflare-app/setup?${query.toString()}`)
      const html = await response.text()

      if (!response.ok) throw new Error(`The callback answered ${String(response.status)}`)
      const serialized = /location\.href = ("(?:\\.|[^"\\])*")/u.exec(html)?.[1]

      assert(serialized, 'the callback to contain its desktop deep link')
      await desktop.openDeepLink(JSON.parse(serialized) as string)
      const notifications = page.getByRole('region', { name: 'Notifications' })
      const rejection = notifications.getByText('Cloudflare OAuth failed: access_denied', {
        exact: true,
      })

      await rejection.waitFor()
      await connect.waitFor()
      await page.waitForTimeout(500)
      assert.equal(await rejection.count(), 1, 'one terminal authorization error')
      assert.equal(stack.cloudflareState(), '', 'the failed authorization is consumed')
      assert.equal(
        composioDeletedAccounts().length,
        deletedBefore + 1,
        'the failed Composio account is deleted once, without a retry',
      )
      await page.screenshot({ path: `${artifacts}/cloudflare-rejected.png` })
      await page.keyboard.press('Escape')
      await page.getByRole('dialog', { name: 'Connect Cloudflare' }).waitFor({ state: 'detached' })
      assert.equal(composioDeletedAccounts().length, deletedBefore + 1)
      // Leave Connectors closed for the next scenario.
      const connectors = page.getByRole('dialog', { name: 'Connectors' })

      await connectors.getByLabel('Close modal').click()
      await connectors.waitFor({ state: 'detached' })
    },
  },
]
