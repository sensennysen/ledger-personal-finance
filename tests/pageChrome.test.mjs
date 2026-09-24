import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveHeaderMeta } from '../src/lib/pageChrome.ts'

test('cycle-driven screens show the stepper', () => {
  for (const path of ['/', '/transactions', '/budgets', '/reports']) {
    assert.equal(resolveHeaderMeta(path).showStepper, true, path)
  }
})

test('screens that do not follow the cycle hide it', () => {
  for (const path of [
    '/accounts',
    '/categories',
    '/settings',
    '/thirteenth-month',
    '/accounts/abc',
  ]) {
    assert.equal(resolveHeaderMeta(path).showStepper, false, path)
  }
})

test('titles match the destination labels', () => {
  assert.equal(resolveHeaderMeta('/').title, 'Home')
  assert.equal(resolveHeaderMeta('/transactions').title, 'Activity')
  assert.equal(resolveHeaderMeta('/thirteenth-month').title, '13th Month')
  assert.equal(resolveHeaderMeta('/accounts/abc').title, 'Account')
})

test('unknown paths fall back to the app name without a stepper', () => {
  assert.deepEqual(resolveHeaderMeta('/nope'), {
    title: 'Ledger',
    showStepper: false,
    titleIsHeading: true,
  })
})

test('account detail leaves the visible heading to the page', () => {
  assert.equal(resolveHeaderMeta('/accounts/abc').titleIsHeading, false)
  assert.equal(resolveHeaderMeta('/accounts').titleIsHeading, true)
})

test('the Budgets goals view hides the stepper; the budgets view keeps it', () => {
  assert.equal(resolveHeaderMeta('/budgets', '?view=goals').showStepper, false)
  assert.equal(resolveHeaderMeta('/budgets', '?view=budgets').showStepper, true)
  assert.equal(resolveHeaderMeta('/budgets', '').showStepper, true)
  assert.equal(resolveHeaderMeta('/transactions', '?view=goals').showStepper, true)
})
