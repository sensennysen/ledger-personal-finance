import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultCardPaymentDescription,
  getCardPaymentPresets,
  getCardDateInfo,
  getCardPaymentSummary,
  isAutoCardPaymentDescription,
  resolveInitialCardId,
} from '../src/lib/cardPayment.ts'
import { daysUntilDayOfMonth, nextDayOfMonthDate } from '../src/lib/creditCards.ts'

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

const at = (y, m, d) => new Date(y, m - 1, d)

test('the design example: on Sep 10 the statement closes Sep 16 and payment is due Oct 1', () => {
  const today = at(2026, 9, 10)
  assert.deepEqual(getCardDateInfo(16, today), { label: 'Sep 16', daysUntil: 6 })
  assert.deepEqual(getCardDateInfo(1, today), { label: 'Oct 1', daysUntil: 21 })
})

test('a day that is today counts as today, and one that has passed rolls to next month', () => {
  assert.deepEqual(getCardDateInfo(10, at(2026, 9, 10)), { label: 'Sep 10', daysUntil: 0 })
  assert.deepEqual(getCardDateInfo(9, at(2026, 9, 10)), { label: 'Oct 9', daysUntil: 29 })
})

test('December rolls into January and a short month clamps the day', () => {
  assert.equal(getCardDateInfo(5, at(2026, 12, 20)).label, 'Jan 5')
  assert.equal(nextDayOfMonthDate(31, at(2026, 2, 10)).getDate(), 28)
  assert.equal(nextDayOfMonthDate(31, at(2026, 3, 1)).getDate(), 31)
})

test('an unset or out-of-range day has no date', () => {
  for (const day of [null, undefined, 0, 32]) {
    assert.equal(getCardDateInfo(day, at(2026, 9, 10)), null)
    assert.equal(nextDayOfMonthDate(day, at(2026, 9, 10)), null)
  }
})

test('daysUntilDayOfMonth still counts the same days', () => {
  assert.equal(daysUntilDayOfMonth(16, at(2026, 9, 10)), 6)
  assert.equal(daysUntilDayOfMonth(1, at(2026, 9, 10)), 21)
  assert.equal(daysUntilDayOfMonth(31, at(2026, 2, 10)), 18)
  assert.equal(daysUntilDayOfMonth(null, at(2026, 9, 10)), null)
})

const visa = { id: 'visa', balance: -1240 }
const mc = { id: 'mc', balance: -300 }
const empty = { id: 'empty', balance: 0 }

test('a locked card is always the one picked', () => {
  assert.equal(resolveInitialCardId([visa, mc], 'mc'), 'mc')
})

test('with two cards owing nothing is picked for the user', () => {
  assert.equal(resolveInitialCardId([visa, mc], null), null)
  assert.equal(resolveInitialCardId([visa, mc, empty], null), null)
})

test('the one card that owes is picked, even beside a paid-off card', () => {
  assert.equal(resolveInitialCardId([visa, empty], null), 'visa')
  assert.equal(resolveInitialCardId([visa], null), 'visa')
})

test('a single card with nothing owed is still picked, and no cards picks nothing', () => {
  assert.equal(resolveInitialCardId([empty], null), 'empty')
  assert.equal(resolveInitialCardId([empty, { id: 'e2', balance: 0 }], null), null)
  assert.equal(resolveInitialCardId([], null), null)
})
