import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FIRST_RUN_STEPS,
  getStepStatus,
  isSetupComplete,
} from '../src/lib/firstRunChecklist.ts'

const base = { hasAccount: false, hasTransaction: false, cycleConfirmed: false }

test('steps follow the real dependency chain: account, transaction, cycle', () => {
  assert.deepEqual(
    FIRST_RUN_STEPS.map((s) => s.id),
    ['account', 'transaction', 'cycle'],
  )
})

test('each step reflects its own condition independently', () => {
  const status = getStepStatus({ ...base, hasAccount: true })
  assert.equal(status.find((s) => s.id === 'account').done, true)
  assert.equal(status.find((s) => s.id === 'transaction').done, false)
  assert.equal(status.find((s) => s.id === 'cycle').done, false)
})

test('setup is not complete until all three are done', () => {
  assert.equal(isSetupComplete(base), false)
  assert.equal(isSetupComplete({ ...base, hasAccount: true }), false)
  assert.equal(isSetupComplete({ ...base, hasAccount: true, hasTransaction: true }), false)
  assert.equal(
    isSetupComplete({ hasAccount: true, hasTransaction: true, cycleConfirmed: true }),
    true,
  )
})

test('cycle completion does not fall back to reading startDay === 1', () => {
  // month_start_day defaults to 1 in the DB, which is indistinguishable from a
  // deliberate choice — isSetupComplete must only trust the explicit flag.
  const status = getStepStatus({ hasAccount: true, hasTransaction: true, cycleConfirmed: false })
  assert.equal(status.find((s) => s.id === 'cycle').done, false)
})
