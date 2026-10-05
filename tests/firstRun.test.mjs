import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEGACY_FIRST_RUN_KEY, firstRunState, legacyFirstRunUpload } from '../src/lib/firstRun.ts'

const now = '2026-10-06T08:00:00.000Z'

test('a profile with no times shows the checklist, with the cycle unconfirmed', () => {
  assert.deepEqual(firstRunState(null), { dismissed: false, cycleConfirmed: false })
  assert.deepEqual(firstRunState({ setup_checklist_dismissed_at: null, pay_cycle_confirmed_at: null }), { dismissed: false, cycleConfirmed: false })
})

test('a recorded time means done', () => {
  assert.deepEqual(
    firstRunState({ setup_checklist_dismissed_at: now, pay_cycle_confirmed_at: now }),
    { dismissed: true, cycleConfirmed: true },
  )
})

test('the old key uploads what it marks done and the account has not recorded', () => {
  const raw = JSON.stringify({ dismissed: true, cycleConfirmed: true })
  assert.deepEqual(legacyFirstRunUpload(raw, {}, now), { setup_checklist_dismissed_at: now, pay_cycle_confirmed_at: now })
  assert.deepEqual(
    legacyFirstRunUpload(raw, { setup_checklist_dismissed_at: '2026-01-01T00:00:00Z' }, now),
    { pay_cycle_confirmed_at: now },
  )
})

test('nothing done, unreadable, or already recorded uploads nothing', () => {
  assert.deepEqual(legacyFirstRunUpload(null, {}, now), {})
  assert.deepEqual(legacyFirstRunUpload('{x', {}, now), {})
  assert.deepEqual(legacyFirstRunUpload(JSON.stringify({ dismissed: false, cycleConfirmed: 'yes' }), {}, now), {})
  assert.deepEqual(
    legacyFirstRunUpload(JSON.stringify({ dismissed: true }), { setup_checklist_dismissed_at: now }, now),
    {},
  )
})

test('the old key is the one the storage notice lists', () => {
  assert.equal(LEGACY_FIRST_RUN_KEY, 'ledger-first-run')
})
