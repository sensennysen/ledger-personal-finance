import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NAV_TABS,
  BOTTOM_NAV_TABS,
  SETTINGS_DESTINATION,
  isDestinationActive,
  isLocked,
} from '../src/lib/navDestinations.ts'

const tab = (label) => NAV_TABS.find((t) => t.label === label)

test('tabs follow the 2B order and include Categories', () => {
  assert.deepEqual(
    NAV_TABS.map((t) => t.label),
    ['Home', 'Accounts', 'Activity', 'Budgets', 'Categories', 'Reports'],
  )
})

test('bottom nav keeps the four mobile destinations', () => {
  assert.deepEqual(
    BOTTOM_NAV_TABS.map((t) => t.label),
    ['Home', 'Accounts', 'Activity', 'Budgets'],
  )
})

test('Categories is a tab at every size, not only a bottom-nav overflow', () => {
  assert.equal(tab('Categories').to, '/categories')
  assert.ok(BOTTOM_NAV_TABS.every((b) => NAV_TABS.some((t) => t.to === b.to)))
  assert.equal(isDestinationActive('/categories', tab('Categories')), true)
})

test('Home matches only the root path', () => {
  assert.equal(isDestinationActive('/', tab('Home')), true)
  assert.equal(isDestinationActive('/accounts', tab('Home')), false)
})

test('a detail route keeps its parent tab active', () => {
  assert.equal(isDestinationActive('/accounts/abc', tab('Accounts')), true)
  assert.equal(isDestinationActive('/accounts', tab('Accounts')), true)
})

test('a prefix that is not a path segment does not match', () => {
  assert.equal(isDestinationActive('/accountsx', tab('Accounts')), false)
})

test('13th Month is a route, not a tab', () => {
  assert.ok(NAV_TABS.every((t) => !isDestinationActive('/thirteenth-month', t)))
})

test('settings is reached from row 1, not the tab list', () => {
  assert.equal(isDestinationActive('/settings', SETTINGS_DESTINATION), true)
  assert.ok(NAV_TABS.every((t) => t.to !== '/settings'))
})

test('Activity, Budgets, Categories and Reports lock until setup is complete', () => {
  assert.equal(isLocked(tab('Activity'), false), true)
  assert.equal(isLocked(tab('Budgets'), false), true)
  assert.equal(isLocked(tab('Categories'), false), true)
  assert.equal(isLocked(tab('Reports'), false), true)
})

test('locked destinations unlock once setup is complete', () => {
  assert.equal(isLocked(tab('Activity'), true), false)
  assert.equal(isLocked(tab('Reports'), true), false)
})

test('Home and Accounts never lock, setup complete or not', () => {
  assert.equal(isLocked(tab('Home'), false), false)
  assert.equal(isLocked(tab('Accounts'), false), false)
})
