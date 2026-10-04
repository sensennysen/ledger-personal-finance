import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterScheduledLabel, balancesAsOfToday, scheduledByAccount, scheduledNetWorth } from '../src/lib/scheduledBalances.ts'

const acct = (over) => ({
  id: over.name, name: over.name, type: 'checking', currency: 'USD', balance: 0, color: '#000',
  credit_limit: null, ...over,
})
const row = (over) => ({
  type: 'expense', account_id: 'Checking', to_account_id: null, amount: 0, exchange_rate: 1,
  destination_amount: null, transfer_fee: null, date: '2026-10-20', ...over,
})
const today = '2026-10-04'
const format = (amount, currency) => `${currency} ${amount.toFixed(2)}`

test('an income and an expense dated after today are the scheduled part of the balance and net worth', () => {
  // The demo case from LED-251: -600 and +500 later in October moved checking by -100 on save.
  const accounts = [acct({ name: 'Checking', balance: 900 })]
  const rows = [row({ amount: 600 }), row({ type: 'income', amount: 500, date: '2026-10-28' })]
  assert.deepEqual([...scheduledByAccount(accounts, rows, today)], [['Checking', -100]])
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD'), -100)
  assert.equal(balancesAsOfToday(accounts, scheduledByAccount(accounts, rows, today))[0].balance, 1000)
})

test('a row dated today or earlier is not scheduled', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 })]
  const rows = [row({ amount: 600, date: today }), row({ type: 'income', amount: 500, date: '2026-09-02' })]
  assert.equal(scheduledByAccount(accounts, rows, today).size, 0)
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD'), 0)
})

test('a transfer between own accounts moves both, and net worth only by its fee', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 }), acct({ name: 'Savings', type: 'savings', balance: 100 })]
  const rows = [row({ type: 'transfer', to_account_id: 'Savings', amount: 200, transfer_fee: 2 })]
  assert.deepEqual([...scheduledByAccount(accounts, rows, today)], [['Checking', -202], ['Savings', 200]])
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD'), -2)
})

test('a card payment pays the card down and leaves net worth as it was', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 }), acct({ name: 'Visa', type: 'credit_card', balance: -300 })]
  const rows = [row({ type: 'transfer', to_account_id: 'Visa', amount: 300 })]
  assert.deepEqual([...scheduledByAccount(accounts, rows, today)], [['Checking', -300], ['Visa', 300]])
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD'), 0)
})

test('an expense into a loan credits the loan; one into any other account does not', () => {
  const accounts = [
    acct({ name: 'Checking', balance: 900 }),
    acct({ name: 'Car', type: 'loan', balance: -5000 }),
    acct({ name: 'Savings', type: 'savings', balance: 0 }),
  ]
  const rows = [row({ to_account_id: 'Car', amount: 400 }), row({ to_account_id: 'Savings', amount: 50 })]
  assert.deepEqual([...scheduledByAccount(accounts, rows, today)], [['Checking', -450], ['Car', 400]])
})

test('a transfer between two currencies credits what arrived, converted on the net worth side', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 }), acct({ name: 'Travel', type: 'savings', currency: 'EUR', balance: 91.5 })]
  const rows = [row({ type: 'transfer', to_account_id: 'Travel', amount: 100, destination_amount: 91.5 })]
  assert.deepEqual([...scheduledByAccount(accounts, rows, today)], [['Checking', -100], ['Travel', 91.5]])
  const convert = (amount, currency) => (currency === 'EUR' ? amount * 1.2 : null)
  // 91.50 EUR at 1.2 is 109.80 USD, against 100 USD sent.
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD', convert), 9.8)
})

test('an account with no rate is left out on both sides, as in the headline net worth', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 }), acct({ name: 'Travel', currency: 'EUR', balance: 500 })]
  const rows = [row({ account_id: 'Travel', amount: 80 }), row({ amount: 20 })]
  assert.equal(scheduledByAccount(accounts, rows, today).get('Travel'), -80)
  assert.equal(scheduledNetWorth(accounts, rows, today, 'USD'), -20)
})

test('rows on accounts that are not loaded are ignored', () => {
  const accounts = [acct({ name: 'Checking', balance: 900 })]
  assert.equal(scheduledByAccount(accounts, [row({ account_id: 'Closed', amount: 10 })], today).size, 0)
})

test('the label is signed and absent when nothing is scheduled', () => {
  assert.equal(afterScheduledLabel(-100, 'USD', format), 'after − USD 100.00 scheduled')
  assert.equal(afterScheduledLabel(12.5, 'USD', format), 'after + USD 12.50 scheduled')
  assert.equal(afterScheduledLabel(0, 'USD', format), null)
})
