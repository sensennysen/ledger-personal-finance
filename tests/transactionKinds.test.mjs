import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferTransactionKind } from '../src/components/transactions/transactionKinds.ts'

test('expense into a credit card is a card payment', () => {
  assert.equal(inferTransactionKind('expense', 'acc-1', 'credit_card'), 'card-payment')
})

test('expense into a loan is a loan repayment', () => {
  assert.equal(inferTransactionKind('expense', 'acc-1', 'loan'), 'loan-repayment')
})

test('expense with a target of unknown type keeps the loan-repayment reading', () => {
  assert.equal(inferTransactionKind('expense', 'acc-1'), 'loan-repayment')
  assert.equal(inferTransactionKind('expense', 'acc-1', null), 'loan-repayment')
})

test('plain kinds pass through', () => {
  assert.equal(inferTransactionKind('expense'), 'expense')
  assert.equal(inferTransactionKind('expense', null, 'credit_card'), 'expense')
  assert.equal(inferTransactionKind('income'), 'income')
  assert.equal(inferTransactionKind('transfer', 'acc-1', 'credit_card'), 'transfer')
  assert.equal(inferTransactionKind(undefined), 'expense')
})
