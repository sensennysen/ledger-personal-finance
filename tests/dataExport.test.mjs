import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAccountsCsv,
  buildBudgetsCsv,
  buildCategoriesCsv,
  buildCreditCardPaymentsCsv,
  buildExchangeRatesCsv,
  buildLoanAllocationsCsv,
  buildLoanPurchasesCsv,
  buildSavingsGoalsCsv,
  buildSubcategoriesCsv,
  buildTransactionRulesCsv,
  exportFileName,
} from '../src/lib/dataExport.ts'

const account = (overrides = {}) => ({
  name: 'Main Bank', type: 'checking', currency: 'PHP', balance: 1250.5, is_active: true, credit_limit: null,
  statement_day: null, due_day: null, statement_balance: null, statement_paid_amount: null, loan_pay_period: null,
  loan_due_days: null, loan_due_weekday: null, notes: null,
  ...overrides,
})

test('every account is one row under the header, blanks for what does not apply', () => {
  const csv = buildAccountsCsv([account(), account({ name: 'Visa', type: 'credit_card', balance: -3000, credit_limit: 20000, statement_day: 16, due_day: 5, statement_balance: 3000, statement_paid_amount: 0 })])
  const lines = csv.split('\n')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], 'Name,Type,Currency,Balance,Active,Credit Limit,Statement Day,Due Day,Statement Balance,Statement Paid,Loan Pay Period,Loan Due Days,Notes')
  assert.equal(lines[1], 'Main Bank,checking,PHP,1250.5,yes,,,,,,,,')
  assert.equal(lines[2], 'Visa,credit_card,PHP,-3000,yes,20000,16,5,3000,0,,,')
})

test('a loan account carries its due days or due weekday (LED-181 item, OD-8)', () => {
  const csv = buildAccountsCsv([
    account({ name: 'Car Loan', type: 'loan', balance: -5000, loan_pay_period: 'twice_monthly', loan_due_days: [1, 15] }),
    account({ name: 'Sari-sari credit', type: 'loan', balance: -800, loan_pay_period: 'weekly', loan_due_weekday: 5 }),
  ])
  const lines = csv.split('\n')
  assert.ok(lines[1].includes(',twice_monthly,1;15,'))
  assert.ok(lines[2].includes(',weekly,Friday,'))
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

test('savings goals, loan purchases/allocations and rules carry their own columns (LED-180)', () => {
  assert.equal(
    buildSavingsGoalsCsv([{ name: 'Emergency fund', target_amount: 50000, current_amount: 12000, currency: 'PHP', deadline: '2027-01-01', is_completed: false, notes: null }]),
    'Name,Target Amount,Current Amount,Currency,Deadline,Completed,Notes\nEmergency fund,50000,12000,PHP,2027-01-01,no,',
  )
  assert.equal(
    buildLoanPurchasesCsv([{
      name: 'Sofa', account: { name: 'Store Credit' }, category: { name: 'Home' }, principal_amount: 10000, term_months: 12,
      monthly_interest_rate: 0.02, monthly_installment: 950, total_payable: 11400, opening_installments_paid: 0,
      opening_paid_amount: 0, first_due_date: '2026-10-01', notes: null,
    }]),
    'Name,Account,Category,Principal,Term Months,Monthly Rate,Monthly Installment,Total Payable,Opening Installments Paid,Opening Paid Amount,First Due Date,Notes\nSofa,Store Credit,Home,10000,12,0.02,950,11400,0,0,2026-10-01,',
  )
  assert.equal(
    buildLoanAllocationsCsv([{ loanPurchase: { name: 'Sofa' }, transaction: { date: '2026-10-01', description: 'Store Credit payment' }, amount: 950 }]),
    'Loan Purchase,Transaction Date,Transaction Description,Amount\nSofa,2026-10-01,Store Credit payment,950',
  )
  assert.equal(
    buildTransactionRulesCsv([{ keyword: 'starbucks', category: { name: 'Coffee' }, type_hint: 'expense', priority: 5 }]),
    'Keyword,Category,Type Hint,Priority\nstarbucks,Coffee,expense,5',
  )
})

test('subcategories, credit card payments and exchange rates carry their own columns (LED-180)', () => {
  assert.equal(
    buildSubcategoriesCsv([{ name: 'Fast food', category: { name: 'Food & Dining' } }]),
    'Category,Name\nFood & Dining,Fast food',
  )
  assert.equal(
    buildCreditCardPaymentsCsv([{ account: { name: 'Visa' }, amount: 3000, payment_date: '2026-09-16', notes: null }]),
    'Account,Amount,Payment Date,Notes\nVisa,3000,2026-09-16,',
  )
  assert.equal(
    buildExchangeRatesCsv([
      { currency: 'USD', rate: 1, source: 'base', asOf: '2026-09-26' },
      { currency: 'PHP', rate: 62.6, source: 'override', asOf: '2026-09-26' },
    ]),
    'Currency,Rate,Source,As Of\nUSD,1,base,2026-09-26\nPHP,62.6,override,2026-09-26',
  )
})
