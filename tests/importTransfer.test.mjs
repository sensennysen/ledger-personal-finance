import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeTransfer, transferCandidates, transferLegs } from '../src/lib/importTransfer.ts'

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

test('candidates are the other non-loan accounts in the same currency', () => {
  const accounts = [
    { id: 'chk', type: 'checking', currency: 'PHP' },
    { id: 'sav', type: 'savings', currency: 'PHP' },
    { id: 'usd', type: 'savings', currency: 'USD' },
    { id: 'car', type: 'loan', currency: 'PHP' },
  ]
  assert.deepEqual(transferCandidates(accounts, accounts[0]).map((account) => account.id), ['sav'])
})

test('money out goes to the other account; money in comes from it', () => {
  assert.deepEqual(transferLegs('expense', 'chk', 'sav'), { account_id: 'chk', to_account_id: 'sav' })
  assert.deepEqual(transferLegs('income', 'chk', 'sav'), { account_id: 'sav', to_account_id: 'chk' })
})
