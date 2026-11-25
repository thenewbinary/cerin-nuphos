import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DASHBOARDS_TITLE, dashboardsPageTitle } from './pageTitle.ts'

const list = [
  { id: 'a', name: 'AWS spend' },
  { id: 'b', name: 'GCP spend' },
]

test('the list page keeps the section title', () => {
  assert.equal(
    dashboardsPageTitle({ cerinDashboard: null, cerinDashboards: list, restoredTitle: 'X' }),
    DASHBOARDS_TITLE,
  )
})

test('an open dashboard is titled by its name', () => {
  assert.equal(
    dashboardsPageTitle({
      cerinDashboard: { dashboardId: 'a', dashboardName: 'AWS spend' },
      cerinDashboards: list,
      restoredTitle: undefined,
    }),
    'AWS spend',
  )
})

test('switching dashboards in the same tab follows the new one', () => {
  assert.equal(
    dashboardsPageTitle({
      cerinDashboard: { dashboardId: 'b', dashboardName: 'GCP spend' },
      cerinDashboards: list,
      restoredTitle: 'AWS spend',
    }),
    'GCP spend',
  )
})

test('a rename reported by the dashboard list wins over the stale ref name', () => {
  assert.equal(
    dashboardsPageTitle({
      cerinDashboard: { dashboardId: 'a', dashboardName: 'AWS spend' },
      cerinDashboards: [{ id: 'a', name: 'AWS spend (prod)' }],
      restoredTitle: undefined,
    }),
    'AWS spend (prod)',
  )
})

test('a restored tab shows its persisted title until the list loads', () => {
  const cerinDashboard = { dashboardId: 'a', dashboardName: 'Dashboard' }

  assert.equal(
    dashboardsPageTitle({ cerinDashboard, cerinDashboards: undefined, restoredTitle: 'Old' }),
    'Old',
  )
  assert.equal(
    dashboardsPageTitle({ cerinDashboard, cerinDashboards: list, restoredTitle: 'Old' }),
    'AWS spend',
  )
})

test('falls back to the ref name when nothing better is known', () => {
  const cerinDashboard = { dashboardId: 'new', dashboardName: 'Untitled dashboard' }

  assert.equal(
    dashboardsPageTitle({ cerinDashboard, cerinDashboards: undefined, restoredTitle: undefined }),
    'Untitled dashboard',
  )
  assert.equal(
    dashboardsPageTitle({ cerinDashboard, cerinDashboards: list, restoredTitle: 'Old' }),
    'Untitled dashboard',
  )
})
