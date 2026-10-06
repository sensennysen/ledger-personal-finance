import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importedCardPayments, importTransferAmounts, looksLikeTransfer, transferCandidates, transferLegs } from '../src/lib/importTransfer.ts'

test('bank transfer wording is suggested as a transfer', () => {
  assert.equal(looksLikeTransfer('FUND TRANSFER TO 8842'), true)
  assert.equal(looksLikeTransfer('INSTAPAY FROM J DOE'), true)
  assert.equal(looksLikeTransfer('PESONET CREDIT'), true)
  assert.equal(looksLikeTransfer('SM SUPERMARKET MAKATI'), false)
  assert.equal(looksLikeTransfer('JOLLIBEE ORTIGAS'), false)
})

test("the highest-priority matching rule's type hint decides", () => {
  const rules = [
    { keyword: 'gcash', type_hint: 'transfer', priority: 1 },
    { keyword: 'transfer fee', type_hint: 'expense', priority: 5 },
    { keyword: 'transfer', type_hint: null, priority: 9 },
  ]
  assert.equal(looksLikeTransfer('GCASH CASH IN', rules), true)
  assert.equal(looksLikeTransfer('INSTAPAY TRANSFER FEE', rules), true)
  assert.equal(looksLikeTransfer('INSTAPAY TRANSFER FEE', rules.slice(0, 2)), false)
})

test('candidates are the other non-loan accounts, in any currency (LED-269)', () => {
  const accounts = [
    { id: 'chk', type: 'checking', currency: 'PHP' },
    { id: 'sav', type: 'savings', currency: 'PHP' },
    { id: 'usd', type: 'savings', currency: 'USD' },
    { id: 'car', type: 'loan', currency: 'PHP' },
  ]
  assert.deepEqual(transferCandidates(accounts, accounts[0]).map((account) => account.id), ['sav', 'usd'])
})

test('a cross-currency import transfer saves both sides (LED-269)', () => {
  // Out of the PHP account into USD: 5,600 PHP sent, 100 USD arrived.
  assert.deepEqual(importTransferAmounts('expense', 5600, 'PHP', 'USD', 100), { amount: 5600, currency: 'PHP', destination_amount: 100 })
  // Into the PHP account from USD: 100 USD sent, 5,600 PHP arrived.
  assert.deepEqual(importTransferAmounts('income', 5600, 'PHP', 'USD', 100), { amount: 100, currency: 'USD', destination_amount: 5600 })
  // Same currency: unchanged.
  assert.deepEqual(importTransferAmounts('expense', 5600, 'PHP', 'PHP', null), { amount: 5600, currency: 'PHP', destination_amount: null })
})

test('money out goes to the other account; money in comes from it', () => {
  assert.deepEqual(transferLegs('expense', 'chk', 'sav'), { account_id: 'chk', to_account_id: 'sav' })
  assert.deepEqual(transferLegs('income', 'chk', 'sav'), { account_id: 'sav', to_account_id: 'chk' })
})

test('a credit card is offered as a transfer target (LED-270)', () => {
  const accounts = [
    { id: 'chk', type: 'checking', currency: 'PHP' },
    { id: 'visa', type: 'credit_card', currency: 'PHP' },
  ]
  assert.deepEqual(transferCandidates(accounts, accounts[0]).map((account) => account.id), ['visa'])
})

test('only transfers into a card get the statement steps, oldest first (LED-270)', () => {
  const accounts = [
    { id: 'visa', type: 'credit_card' },
    { id: 'sav', type: 'savings' },
  ]
  const rows = [
    { id: 't2', type: 'transfer', to_account_id: 'visa', amount: '300.00', exchange_rate: '1', destination_amount: null, date: '2026-09-20' },
    { id: 't1', type: 'transfer', to_account_id: 'visa', amount: 200, exchange_rate: 1, destination_amount: null, date: '2026-09-05' },
    { id: 't3', type: 'transfer', to_account_id: 'sav', amount: 50, exchange_rate: 1, destination_amount: null, date: '2026-09-01' },
    { id: 'e1', type: 'expense', to_account_id: null, amount: 80, exchange_rate: 1, destination_amount: null, date: '2026-09-02' },
  ]
  assert.deepEqual(
    importedCardPayments(rows, accounts).map((p) => [p.transactionId, p.card.id, p.amount, p.date]),
    [
      ['t1', 'visa', 200, '2026-09-05'],
      ['t2', 'visa', 300, '2026-09-20'],
    ],
  )
})
