import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatedCardPayment } from '../src/lib/cardPayment.ts'

const card = { id: 'card', type: 'credit_card' }
const bank = { id: 'bank', type: 'checking' }
const loan = { id: 'loan', type: 'loan' }
const accounts = [card, bank, loan]

test('a generated transfer into a card takes the card path with the credited amount', () => {
  const payment = generatedCardPayment({ type: 'transfer', to_account_id: 'card', amount: 100, exchange_rate: 1 }, accounts)
  assert.deepEqual(payment, { card, amount: 100 })
})

test('the credited amount follows the rate when the paying account is in another currency', () => {
  const payment = generatedCardPayment({ type: 'transfer', to_account_id: 'card', amount: 100, exchange_rate: 0.5 }, accounts)
  assert.equal(payment?.amount, 50)
})

test('a transfer to a bank account is a plain insert', () => {
  assert.equal(generatedCardPayment({ type: 'transfer', to_account_id: 'bank', amount: 100 }, accounts), null)
})

test('an expense, an income and a loan repayment never take the card path', () => {
  assert.equal(generatedCardPayment({ type: 'expense', to_account_id: 'card', amount: 100 }, accounts), null)
  assert.equal(generatedCardPayment({ type: 'income', to_account_id: null, amount: 100 }, accounts), null)
  assert.equal(generatedCardPayment({ type: 'expense', to_account_id: 'loan', amount: 100 }, accounts), null)
})

test('a transfer with no destination, or an unknown one, is a plain insert', () => {
  assert.equal(generatedCardPayment({ type: 'transfer', to_account_id: null, amount: 100 }, accounts), null)
  assert.equal(generatedCardPayment({ type: 'transfer', to_account_id: 'gone', amount: 100 }, accounts), null)
})
