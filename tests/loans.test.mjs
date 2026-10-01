import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysUntilDue, formatOverdue, getLoanAmountOwed, loansOwed } from '../src/lib/loans.ts'

const acct = (over) => ({ id: over.name, name: over.name, type: 'checking', currency: 'USD', balance: 0, ...over })

test('getLoanAmountOwed is the positive debt, zero for a non-loan or a credit balance', () => {
  assert.equal(getLoanAmountOwed(acct({ name: 'Car', type: 'loan', balance: -500 })), 500)
  assert.equal(getLoanAmountOwed(acct({ name: 'Paid off', type: 'loan', balance: 0 })), 0)
  assert.equal(getLoanAmountOwed(acct({ name: 'Checking', balance: -500 })), 0)
})

test('loansOwed counts loan accounts that still owe something (LED-156): the one definition shared by the search palette and the kind menu', () => {
  const accounts = [
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Car', type: 'loan', balance: -8000 }),
    acct({ name: 'Phone', type: 'loan', balance: -500 }),
    acct({ name: 'Repaid', type: 'loan', balance: 0 }),
  ]
  const owed = loansOwed(accounts)
  assert.deepEqual(owed.map((a) => a.name), ['Car', 'Phone'])
})

test('loansOwed can restrict to one currency (the kind menu totals only the base currency, LED-135)', () => {
  const accounts = [
    acct({ name: 'Car', type: 'loan', balance: -8000 }),
    acct({ name: 'Euro loan', type: 'loan', currency: 'EUR', balance: -900 }),
  ]
  assert.deepEqual(loansOwed(accounts, 'USD').map((a) => a.name), ['Car'])
  assert.deepEqual(loansOwed(accounts).map((a) => a.name), ['Car', 'Euro loan'])
})

test('with no loans, or none still owing, loansOwed is empty', () => {
  assert.deepEqual(loansOwed([acct({ name: 'Checking', balance: 500 })]), [])
  assert.deepEqual(loansOwed([acct({ name: 'Repaid', type: 'loan', balance: 0 })]), [])
})

test('daysUntilDue is parsed at local midnight, immune to a UTC offset shifting the day', () => {
  assert.equal(daysUntilDue('2026-10-01', '2026-09-29'), 2)
  assert.equal(daysUntilDue('2026-09-29', '2026-09-29'), 0)
  assert.equal(daysUntilDue('2026-09-27', '2026-09-29'), -2)
})

test('formatOverdue flags the loan detail "Next payment" the same way Home\'s Upcoming Bills does (LED-181 item, OD-8)', () => {
  assert.equal(formatOverdue(2), null)
  assert.equal(formatOverdue(0), null)
  assert.equal(formatOverdue(-1), '1 day overdue')
  assert.equal(formatOverdue(-5), '5 days overdue')
})
