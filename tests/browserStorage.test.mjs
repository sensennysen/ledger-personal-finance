import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STORAGE_ROWS, isPersonalKey, keysInGroup, unsyncedWarning } from '../src/lib/browserStorage.ts'

const me = 'u-1'
const other = 'u-2'
// Every key a signed-in browser can hold, for this user and a previous one on the same device.
const KEYS = [
  'sb-127-auth-token',
  `ledger_cache:${me}:accounts`,
  `ledger_cache:${me}:transactions:{}`,
  'ledger_offline_queue',
  'ledger-theme',
  'ledger-font-size',
  'ledger-accent-color',
  'ledger-preferences',
  'ledger-dashboard-widgets',
  'ledger-dashboard-widget-order',
  'ledger-first-run',
  'ledger_transaction_templates',
  `${me}:cc-notifs-sent`,
  `${other}:cc-notifs-sent`,
  `13th-month-selection:${me}:2026`,
  `13th-month-selection:${me}:2025`,
  `13th-month-selection:${other}:2026`,
  'ledger_pwa_install_dismissed',
  'some-other-site-key',
]

const row = (id) => STORAGE_ROWS.find((r) => r.id === id)
const cleared = (id) => keysInGroup(row(id), KEYS, me)

test('each group clears exactly its own keys', () => {
  assert.deepEqual(cleared('cache'), [`ledger_cache:${me}:accounts`, `ledger_cache:${me}:transactions:{}`])
  assert.deepEqual(cleared('appearance'), ['ledger-theme', 'ledger-font-size', 'ledger-accent-color'])
  assert.deepEqual(cleared('preferences'), ['ledger-preferences'])
  assert.deepEqual(cleared('home-layout'), ['ledger-dashboard-widgets', 'ledger-dashboard-widget-order'])
  assert.deepEqual(cleared('checklist'), ['ledger-first-run'])
  assert.deepEqual(cleared('templates'), ['ledger_transaction_templates'])
  assert.deepEqual(cleared('install-banner'), ['ledger_pwa_install_dismissed'])
})

test('per-user groups clear only the signed-in user’s keys', () => {
  assert.deepEqual(cleared('card-reminders'), [`${me}:cc-notifs-sent`])
  assert.deepEqual(cleared('thirteenth-month'), [`13th-month-selection:${me}:2026`, `13th-month-selection:${me}:2025`])
  assert.deepEqual(keysInGroup(row('card-reminders'), KEYS, null), [], 'no user, nothing to match')
})

test('the session, queue, receipts and app files are not cleared as plain keys', () => {
  for (const id of ['session', 'queue', 'receipts', 'app-files']) assert.deepEqual(cleared(id), [], id)
  assert.equal(row('session').clear, 'signOut')
  assert.equal(row('queue').clear, 'queue')
  assert.equal(row('receipts').clear, 'receipts')
  assert.equal(row('app-files').clear, 'none')
})

test('no key is claimed by two groups, and only the session, queue and other sites are left to their owners', () => {
  const owners = new Map()
  for (const r of STORAGE_ROWS) {
    for (const key of keysInGroup(r, KEYS, me)) {
      assert.ok(!owners.has(key), `${key} is in ${owners.get(key)} and ${r.id}`)
      owners.set(key, r.id)
    }
  }
  const unclaimed = KEYS.filter((key) => !owners.has(key))
  assert.deepEqual(unclaimed, [
    'sb-127-auth-token',
    'ledger_offline_queue',
    `${other}:cc-notifs-sent`,
    `13th-month-selection:${other}:2026`,
    'some-other-site-key',
  ])
})

test('clearing the queue or receipts warns when unsynced changes would be lost', () => {
  assert.match(unsyncedWarning(row('queue'), 3, 0), /^3 changes not yet synced will be lost/)
  assert.match(unsyncedWarning(row('queue'), 1, 0), /^1 change not yet synced/)
  assert.equal(unsyncedWarning(row('queue'), 0, 0), null)
  assert.match(unsyncedWarning(row('receipts'), 2, 1), /^1 transaction waiting to sync will be saved without its receipt/)
  assert.equal(unsyncedWarning(row('receipts'), 2, 0), null)
  assert.equal(unsyncedWarning(row('templates'), 5, 5), null)
})

test('after sign-out only appearance, the install flag and other sites\' keys are left (LED-268)', () => {
  // The session, the queue and pending receipts go through their owners at sign-out, not as plain keys.
  const byOwners = new Set(['sb-127-auth-token', 'ledger_offline_queue'])
  const left = KEYS.filter((key) => !isPersonalKey(key) && !byOwners.has(key))
  assert.deepEqual(left, ['ledger-theme', 'ledger-font-size', 'ledger-accent-color', 'ledger_pwa_install_dismissed', 'some-other-site-key'])
})

test('sign-out also removes a previous user\'s per-user copies on this browser (LED-268)', () => {
  assert.ok(isPersonalKey(`${other}:cc-notifs-sent`))
  assert.ok(isPersonalKey(`13th-month-selection:${other}:2026`))
  assert.ok(isPersonalKey(`ledger_cache:${other}:accounts`))
})

test('every group cleared at sign-out says so in the notice', () => {
  for (const id of ['cache', 'preferences', 'home-layout', 'checklist', 'templates', 'card-reminders', 'thirteenth-month']) {
    assert.match(row(id).removed, /sign out/, id)
    for (const key of keysInGroup(row(id), KEYS, me)) assert.ok(isPersonalKey(key), `${key} (${id}) is not cleared at sign-out`)
  }
  for (const id of ['appearance', 'install-banner']) assert.doesNotMatch(row(id).removed, /sign out/, id)
})
