import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entryDialogWidthClass, inferTransactionKind, TRANSACTION_KIND_DIALOG_TITLES } from '../src/components/transactions/transactionKinds.ts'

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

test('a new transaction dialog is titled by its kind', () => {
  assert.equal(TRANSACTION_KIND_DIALOG_TITLES.expense, 'New expense')
  assert.equal(TRANSACTION_KIND_DIALOG_TITLES.income, 'New income')
  assert.equal(TRANSACTION_KIND_DIALOG_TITLES.transfer, 'New transfer')
  assert.equal(TRANSACTION_KIND_DIALOG_TITLES['loan-repayment'], 'Record loan repayment')
  assert.equal(TRANSACTION_KIND_DIALOG_TITLES['card-payment'], 'Record card payment')
})

test('only the card payment modal is widened to 720px, and never below sm', () => {
  assert.match(entryDialogWidthClass('card-payment'), /sm:max-w-\[min\(720px,calc\(100vw-3rem\)\)\]/)
  for (const kind of ['expense', 'income', 'transfer', 'loan-repayment']) {
    assert.equal(entryDialogWidthClass(kind), 'max-w-md', kind)
  }
  assert.ok(entryDialogWidthClass('card-payment').split(' ').includes('max-w-md'), 'the phone keeps the compact width')
})

test('every create dialog sizes itself with the shared width helper', async () => {
  const { readFileSync } = await import('node:fs')
  for (const file of ['components/layout/AppLayout.tsx', 'pages/TransactionsPage.tsx', 'pages/AccountTransactionsPage.tsx']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(source, /entryDialogWidthClass\(/, file)
  }
})
