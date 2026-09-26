import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountsOverview, formatShare, loanProgress, summarizeBalances } from '../src/lib/accountsOverview.ts'

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

test('summarizeBalances counts only the base currency and names what it left out', () => {
  const s = summarizeBalances([
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Card', type: 'credit_card', balance: -300, credit_limit: 2000 }),
    acct({ name: 'Travel', balance: 1850, currency: 'EUR' }),
    acct({ name: 'Yen', balance: 90000, currency: 'JPY' }),
    acct({ name: 'Travel 2', balance: 10, currency: 'EUR' }),
  ], 'USD')
  assert.equal(s.netWorth, 700)
  assert.equal(s.totalAssets, 1000)
  assert.equal(s.totalCreditCardDebt, 300)
  assert.deepEqual(s.excludedCurrencies, ['EUR', 'JPY'])
})

test('summarizeBalances with one currency excludes nothing', () => {
  const s = summarizeBalances([acct({ name: 'A', balance: 5 }), acct({ name: 'B', balance: -2 })], 'USD')
  assert.equal(s.netWorth, 3)
  assert.deepEqual(s.excludedCurrencies, [])
})

test('an overdrawn asset lowers net worth, and Accounts agrees with Home and Reports', () => {
  const accounts = [
    acct({ name: 'Checking', balance: -50 }),
    acct({ name: 'Savings', balance: 200 }),
    acct({ name: 'Car loan', type: 'loan', balance: -120 }),
    acct({ name: 'Travel', balance: 999, currency: 'EUR' }),
  ]
  const summary = summarizeBalances(accounts, 'USD')
  const overview = buildAccountsOverview(accounts, 'USD', undefined, today)
  assert.equal(summary.netWorth, 30)
  assert.equal(overview.totals.netWorth, summary.netWorth)
  assert.deepEqual(overview.excludedCurrencies, summary.excludedCurrencies)
})

test('net worth is rounded to cents', () => {
  const s = summarizeBalances([acct({ name: 'A', balance: 0.1 }), acct({ name: 'B', balance: 0.2 })], 'USD')
  assert.equal(s.netWorth, 0.3)
})

test('the caller decides which accounts count: inactive ones left out do not appear', () => {
  const active = [acct({ name: 'A', balance: 10 })]
  const withInactive = [...active, acct({ name: 'Old', balance: 500, is_active: false })]
  assert.equal(summarizeBalances(active, 'USD').netWorth, 10)
  assert.equal(summarizeBalances(withInactive.filter((a) => a.is_active !== false), 'USD').netWorth, 10)
})

// ── With exchange rates (LED-136) ───────────────────────────
// 1 EUR = 1.1 USD; JPY has no rate.
const eurToUsd = (amount, from) => (from === 'EUR' ? amount * 1.1 : null)

test('a converted account counts in every total, Accounts, Home and Reports alike', () => {
  const accounts = [
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Travel', balance: 1000, currency: 'EUR' }),
    acct({ name: 'Euro card', type: 'credit_card', balance: -200, currency: 'EUR' }),
  ]
  const o = buildAccountsOverview(accounts, 'USD', undefined, today, eurToUsd)
  assert.equal(o.totals.assets, 2100)
  assert.equal(o.totals.liabilities, 220)
  assert.equal(o.totals.netWorth, 1880)
  assert.deepEqual(o.excludedCurrencies, [])
  assert.deepEqual(o.convertedCurrencies, ['EUR'])
  const home = summarizeBalances(accounts, 'USD', eurToUsd)
  assert.equal(home.netWorth, o.totals.netWorth)
  assert.equal(home.totalAssets, 2100)
  assert.equal(home.totalCreditCardDebt, 220)
})

test('rows keep their own balance and gain the converted one; shares use converted values', () => {
  const o = buildAccountsOverview([
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Travel', balance: 1000, currency: 'EUR' }),
  ], 'USD', undefined, today, eurToUsd)
  assert.deepEqual(o.assets.map((r) => [r.balance, r.converted, r.excluded]), [[1000, null, false], [1000, 1100, false]])
  assert.deepEqual(o.assets.map((r) => Math.round(r.sharePct)), [48, 52])
})

test('a currency with no rate is still left out and named, next to one that converted', () => {
  const accounts = [
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Travel', balance: 1000, currency: 'EUR' }),
    acct({ name: 'Tokyo', balance: 90000, currency: 'JPY' }),
  ]
  const o = buildAccountsOverview(accounts, 'USD', undefined, today, eurToUsd)
  assert.deepEqual(o.excludedCurrencies, ['JPY'])
  assert.deepEqual(o.convertedCurrencies, ['EUR'])
  assert.equal(o.assets[2].excluded, true)
  assert.equal(o.assets[2].converted, null)
  assert.equal(o.totals.netWorth, 2100)
  const home = summarizeBalances(accounts, 'USD', eurToUsd)
  assert.deepEqual(home.excludedCurrencies, ['JPY'])
  assert.equal(home.netWorth, 2100)
})

test('without a converter nothing changes: other currencies stay out', () => {
  const o = buildAccountsOverview([acct({ name: 'Travel', balance: 1000, currency: 'EUR' })], 'USD', undefined, today)
  assert.deepEqual(o.excludedCurrencies, ['EUR'])
  assert.deepEqual(o.convertedCurrencies, [])
  assert.equal(o.totals.assets, 0)
})

test('a converted loan counts its owed amount in the base currency', () => {
  const o = buildAccountsOverview([
    acct({ name: 'Checking', balance: 1000 }),
    acct({ name: 'Euro loan', type: 'loan', balance: -400, currency: 'EUR' }),
  ], 'USD', undefined, today, eurToUsd)
  assert.equal(o.liabilities[0].owed, 400)
  assert.equal(o.liabilities[0].convertedOwed, 440)
  assert.equal(o.totals.liabilities, 440)
})
