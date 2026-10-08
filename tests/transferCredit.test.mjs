import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinationAmountFor, isCrossCurrencyTransfer, needsAmountReceived, paymentCredit, paySourceAmounts, transferCredit } from '../src/lib/transferCredit.ts'

test('a transfer with a destination amount credits that amount', () => {
  assert.equal(transferCredit({ amount: 100, exchange_rate: 1, destination_amount: 91.5 }), 91.5)
})

test('without one it credits amount x exchange_rate, as every row before LED-185 did', () => {
  assert.equal(transferCredit({ amount: 100, exchange_rate: 1, destination_amount: null }), 100)
  assert.equal(transferCredit({ amount: 100 }), 100)
  assert.equal(transferCredit({ amount: 5625, exchange_rate: 0.0178 }), 100.13)
})

const values = (o = {}) => ({ type: 'transfer', currency: 'USD', to_account_id: 'eur', destination_amount: 91.5, ...o })

test('only a transfer into an account in another currency is cross-currency', () => {
  assert.equal(isCrossCurrencyTransfer(values(), 'EUR'), true)
  assert.equal(isCrossCurrencyTransfer(values(), 'USD'), false)
  assert.equal(isCrossCurrencyTransfer(values({ type: 'expense' }), 'EUR'), false)
  assert.equal(isCrossCurrencyTransfer(values({ to_account_id: null }), 'EUR'), false)
  // The destination account is not loaded: nothing is asked for and nothing is saved.
  assert.equal(isCrossCurrencyTransfer(values(), undefined), false)
})

test('the saved destination amount is the entered figure to the cent, else null', () => {
  assert.equal(destinationAmountFor(values({ destination_amount: 91.505 }), 'EUR'), 91.51)
  assert.equal(destinationAmountFor(values(), 'USD'), null)
  assert.equal(destinationAmountFor(values({ type: 'income', to_account_id: null }), 'EUR'), null)
  assert.equal(destinationAmountFor(values({ destination_amount: null }), 'EUR'), null)
  assert.equal(destinationAmountFor(values({ destination_amount: 0 }), 'EUR'), null)
})

test('a loan repayment credits what the loan received, else its amount (LED-269)', () => {
  assert.equal(paymentCredit({ type: 'expense', amount: 100, exchange_rate: 1, destination_amount: 5600 }), 5600)
  assert.equal(paymentCredit({ type: 'expense', amount: 100, exchange_rate: 1.5, destination_amount: null }), 100)
  assert.equal(paymentCredit({ type: 'transfer', amount: 100, exchange_rate: 1, destination_amount: 91.5 }), 91.5)
})

test('card payments and loan repayments between two currencies ask for the amount received (LED-269)', () => {
  assert.equal(needsAmountReceived(values({ type: 'expense', to_account_id: 'loan' }), 'PHP'), true)
  assert.equal(needsAmountReceived(values({ type: 'expense', to_account_id: 'loan' }), 'USD'), false)
  assert.equal(needsAmountReceived(values({ type: 'expense', to_account_id: null }), 'PHP'), false)
  assert.equal(needsAmountReceived(values({ type: 'income' }), 'EUR'), false)
  assert.equal(destinationAmountFor(values({ type: 'expense', to_account_id: 'loan', destination_amount: 5600 }), 'PHP'), 5600)
})

// LED-293: 1 USD = 0.89 EUR, the rate the switch converts the preset with.
const convert = (amount, from, to) => {
  if (from === 'USD' && to === 'EUR') return amount * 0.89
  if (from === 'EUR' && to === 'USD') return amount / 0.89
  return null
}

test('a preset kept on a same-currency Pay from stays the amount (LED-293)', () => {
  assert.deepEqual(paySourceAmounts(456, 'USD', 'USD', convert), { amount: 456, destination_amount: null })
})

test('a preset kept on a Pay from in another currency is the amount received, and the sent amount is converted (LED-293)', () => {
  assert.deepEqual(paySourceAmounts(456, 'EUR', 'USD', convert), { amount: 405.84, destination_amount: 456 })
  assert.deepEqual(paySourceAmounts(1288.69, 'EUR', 'USD', convert), { amount: 1146.93, destination_amount: 1288.69 })
})

test('with no rate the amount received is kept and the amount sent is left for the user (LED-293)', () => {
  assert.deepEqual(paySourceAmounts(456, 'PHP', 'USD', convert), { amount: null, destination_amount: 456 })
})

test('a fallback credit is rounded to cents, as the balance trigger does (LED-326)', () => {
  assert.equal(transferCredit({ amount: 10, exchange_rate: 1.0005 }), 10.01)
  assert.equal(transferCredit({ amount: 3, exchange_rate: 0.333333 }), 1)
})
