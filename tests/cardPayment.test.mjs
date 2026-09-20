import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultCardPaymentDescription,
  getCardPaymentPresets,
  getCardPaymentSummary,
  isAutoCardPaymentDescription,
} from '../src/lib/cardPayment.ts'

test('paying the full balance clears the card', () => {
  const s = getCardPaymentSummary(-1240, 4000, 1240)
  assert.equal(s.owed, 1240)
  assert.equal(s.available, 2760)
  assert.equal(s.afterBalance, 0)
  assert.equal(s.utilisationBefore, 31)
  assert.equal(s.utilisationAfter, 0)
  assert.equal(s.overpayment, 0)
})

test('a partial payment lowers utilisation', () => {
  const s = getCardPaymentSummary(-1000, 4000, 400)
  assert.equal(s.afterBalance, -600)
  assert.equal(s.utilisationAfter, 15)
  assert.equal(s.overpayment, 0)
})

test('overpaying is allowed and becomes a statement credit', () => {
  const s = getCardPaymentSummary(-1240, 4000, 1500)
  assert.equal(s.overpayment, 260)
  assert.equal(s.afterBalance, 260)
  assert.equal(s.utilisationAfter, 0)
})

test('a card with nothing owed treats any payment as overpayment', () => {
  const s = getCardPaymentSummary(0, 4000, 50)
  assert.equal(s.owed, 0)
  assert.equal(s.overpayment, 50)
})

test('a missing or zero credit limit never yields NaN', () => {
  for (const limit of [null, 0]) {
    const s = getCardPaymentSummary(-500, limit, 100)
    assert.equal(s.available, null)
    assert.equal(s.utilisationBefore, 0)
    assert.equal(s.utilisationAfter, 0)
  }
})

test('empty or invalid amounts count as zero', () => {
  assert.equal(getCardPaymentSummary(-100, 1000, Number.NaN).afterBalance, -100)
  assert.equal(getCardPaymentSummary(-100, 1000, -5).afterBalance, -100)
})

test('presets: full balance, and statement only when a statement balance is set', () => {
  assert.deepEqual(getCardPaymentPresets({ balance: -1240 }), { full: 1240, statement: null })
  assert.deepEqual(
    getCardPaymentPresets({ balance: -1240, statement_balance: 900, statement_paid_amount: 300 }),
    { full: 1240, statement: 600 }
  )
})

test('statement preset is clamped between zero and the balance owed', () => {
  assert.equal(
    getCardPaymentPresets({ balance: -200, statement_balance: 900, statement_paid_amount: 0 }).statement,
    200
  )
  assert.equal(
    getCardPaymentPresets({ balance: -200, statement_balance: 100, statement_paid_amount: 500 }).statement,
    0
  )
})

test('default description uses the card name', () => {
  assert.equal(defaultCardPaymentDescription('BPI Visa'), 'Card payment - BPI Visa')
})

test('description is replaceable only when empty or the generated one for the previous card', () => {
  assert.equal(isAutoCardPaymentDescription(''), true)
  assert.equal(isAutoCardPaymentDescription('   '), true)
  assert.equal(isAutoCardPaymentDescription('Card payment - Visa', 'Visa'), true)
  // User-typed text is kept, even when it starts with the generated prefix.
  assert.equal(isAutoCardPaymentDescription('Card payment - March top-up', 'Visa'), false)
  assert.equal(isAutoCardPaymentDescription('Card payment - Visa'), false)
  assert.equal(isAutoCardPaymentDescription('Groceries', 'Visa'), false)
})
