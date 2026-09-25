import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAccountsCsv,
  buildBudgetsCsv,
  buildCategoriesCsv,
  exportFileName,
} from '../src/lib/dataExport.ts'

const account = (overrides = {}) => ({
  name: 'Main Bank', type: 'checking', currency: 'PHP', balance: 1250.5, is_active: true, credit_limit: null,
  statement_day: null, due_day: null, statement_balance: null, statement_paid_amount: null, loan_pay_period: null, notes: null,
  ...overrides,
})

test('every account is one row under the header, blanks for what does not apply', () => {
  const csv = buildAccountsCsv([account(), account({ name: 'Visa', type: 'credit_card', balance: -3000, credit_limit: 20000, statement_day: 16, due_day: 5, statement_balance: 3000, statement_paid_amount: 0 })])
  const lines = csv.split('\n')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], 'Name,Type,Currency,Balance,Active,Credit Limit,Statement Day,Due Day,Statement Balance,Statement Paid,Loan Pay Period,Notes')
  assert.equal(lines[1], 'Main Bank,checking,PHP,1250.5,yes,,,,,,,')
  assert.equal(lines[2], 'Visa,credit_card,PHP,-3000,yes,20000,16,5,3000,0,,')
})

test('text that looks like a formula is neutralised and commas are quoted', () => {
  const csv = buildAccountsCsv([account({ name: '=HYPERLINK("x")', notes: 'pays rent, utilities' })])
  const row = csv.split('\n')[1]
  assert.ok(row.startsWith(`"'=HYPERLINK(""x"")"`))
  assert.ok(row.endsWith('"pays rent, utilities"'))
})

test('categories and budgets carry their own columns', () => {
  assert.equal(
    buildCategoriesCsv([{ name: 'Food & Dining', type: 'expense', is_default: true }, { name: 'Side gig', type: 'income', is_default: false }]),
    'Name,Type,Default\nFood & Dining,expense,yes\nSide gig,income,no',
  )
  assert.equal(
    buildBudgetsCsv([{ name: 'Groceries', category: { name: 'Food & Dining' }, amount: 5000, currency: 'PHP', period: 'monthly', start_date: '2026-09-01', end_date: null, is_active: true, rollover_enabled: false }]),
    'Name,Category,Amount,Currency,Period,Start Date,End Date,Active,Rollover\nGroceries,Food & Dining,5000,PHP,monthly,2026-09-01,,yes,no',
  )
})

test('an empty list is a header only, never a broken file', () => {
  assert.equal(buildCategoriesCsv([]), 'Name,Type,Default')
})

test('file names carry the kind and the local date', () => {
  assert.equal(exportFileName('accounts', '2026-09-26'), 'ledger-export_accounts_2026-09-26.csv')
  assert.equal(exportFileName('transactions', '2026-01-02'), 'ledger-export_transactions_2026-01-02.csv')
})
