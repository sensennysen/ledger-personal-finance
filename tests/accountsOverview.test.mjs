import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountsOverview, formatShare, loanProgress } from '../src/lib/accountsOverview.ts'

const acct = (over) => ({
  id: over.name, name: over.name, type: 'checking', currency: 'USD', balance: 0, color: '#000',
  credit_limit: null, statement_day: null, due_day: null, statement_balance: null, statement_paid_amount: null,
  ...over,
})
const purchase = (over) => ({
  id: 'p1', account_id: 'Car', name: 'Car', term_months: 4, monthly_installment: 100, total_payable: 400,
  opening_paid_amount: 0, first_due_date: '2026-09-15', ...over,
})
const today = new Date(2026, 8, 10) // Sep 10

test('asset shares are of the base-currency total; other currencies are excluded', () => {
  const o = buildAccountsOverview([
    acct({ name: 'Brokerage', balance: 750 }),
    acct({ name: 'Checking', balance: 248 }),
    acct({ name: 'Wallet', balance: 2 }),
    acct({ name: 'Travel', balance: 1850, currency: 'EUR' }),
  ], 'USD', undefined, today)
  assert.equal(o.totals.assets, 1000)
  assert.deepEqual(o.assets.map((r) => r.sharePct), [75, 24.8, 0.2, null])
  assert.equal(o.assets[3].excluded, true)
  assert.deepEqual(o.excludedCurrencies, ['EUR'])
  assert.equal(formatShare(0.2), '<1%')
  assert.equal(formatShare(24.8), '25%')
})

test('liabilities and net worth skip excluded accounts', () => {
  const o = buildAccountsOverview([
    acct({ name: 'Checking', balance: 5000 }),
    acct({ name: 'Visa', type: 'credit_card', balance: -1240, credit_limit: 4000 }),
    acct({ name: 'Euro card', type: 'credit_card', balance: -300, currency: 'EUR' }),
  ], 'USD', undefined, today)
  assert.equal(o.totals.liabilities, 1240)
  assert.equal(o.totals.netWorth, 3760)
  assert.equal(o.liabilities[0].utilizationPct, 31)
  assert.equal(o.liabilities[1].excluded, true)
})

test('coming up collects card dues and the next loan installment, soonest first', () => {
  const o = buildAccountsOverview([
    acct({ name: 'Visa', type: 'credit_card', balance: -1240, due_day: 1, statement_balance: 1000, statement_paid_amount: 200 }),
    acct({ name: 'Paid card', type: 'credit_card', balance: 0, due_day: 12 }),
    acct({ name: 'Car', type: 'loan', balance: -400 }),
  ], 'USD', { purchases: [purchase({})], allocations: [] }, today)
  assert.deepEqual(o.comingUp.map((c) => [c.account.name, c.amount, c.days]), [
    ['Car', 100, 5],
    ['Visa', 800, 21],
  ])
})

test('loan progress counts paid installments across purchases', () => {
  const p = loanProgress([purchase({ opening_paid_amount: 150 })], [{ loan_purchase_id: 'p1', amount: 50 }])
  assert.equal(p.paidInstallments, 2)
  assert.equal(p.totalInstallments, 4)
  assert.equal(p.pct, 50)
  assert.equal(loanProgress([], []), null)
})
