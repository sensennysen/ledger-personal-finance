import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuickLogAmount, resolveQuickLog } from '../src/lib/quickLog.ts'

const accounts = [
  { id: 'savings', name: 'BPI Savings', currency: 'PHP', type: 'savings', is_active: true },
  { id: 'wallet', name: 'GCash', currency: 'PHP', type: 'digital_wallet', is_active: true },
  { id: 'dollars', name: 'Dollar Savings', currency: 'USD', type: 'savings', is_active: true },
  { id: 'visa', name: 'BPI Visa', currency: 'PHP', type: 'credit_card', is_active: true },
]
const categories = [{ id: 'food', type: 'expense' }, { id: 'food-rule', type: 'expense' }, { id: 'salary', type: 'income' }]
const amount = (text, decimal = text) => ({ text, decimal })
const model = {
  intent: 'expense', description: 'Jollibee', account: null, destination: null,
  amount: amount('189'), currency: null, date: null, dateText: null, received: null, receivedCurrency: null,
  fee: null, feeCurrency: null, categoryId: 'food', subcategoryId: 'fast-food', subcategoryParentId: 'food',
  ambiguous: false, defaultCurrency: 'PHP', numberLocale: 'en-US',
}
function resolve(phrase, candidate = {}, options = {}) {
  return resolveQuickLog({
    phrase, candidate: { ...model, ...candidate }, today: '2026-11-19',
    accounts, expenseAccountId: 'wallet', incomeAccountId: 'savings',
    currencies: ['PHP', 'USD'], categories, rule: null, ...options,
  })
}

test('uses the profile currency and preserves the amount when the selected account differs', () => {
  const local = resolve('Jollibee 189')
  assert.equal(local.ready, true)
  assert.equal(local.values.currency, 'PHP')
  assert.equal(local.values.date, '2026-11-19')
  assert.equal(local.values.category_id, 'food')
  assert.equal(local.values.subcategory_id, 'fast-food')
  const mismatch = resolve('Jollibee 189', {}, { expenseAccountId: 'dollars' })
  assert.equal(mismatch.ready, false)
  assert.equal(mismatch.values.amount, 189)
  assert.equal(mismatch.values.currency, 'PHP')
  assert.equal(mismatch.values.account_id, '')
  const explicit = resolve('Jollibee 189 USD', { currency: 'USD' }, { expenseAccountId: 'dollars' })
  assert.equal(explicit.ready, true)
  assert.equal(explicit.values.currency, 'USD')
  assert.equal(resolve('Jollibee 189 USD', {}, { expenseAccountId: 'wallet' }).ready, false)
  assert.equal(resolve('Jollibee USD189', { currency: 'USD' }, { expenseAccountId: 'dollars' }).ready, true)
  assert.equal(resolve('Jollibee USD189').ready, false)
  assert.equal(resolve('Jollibee $189').ready, false)
})

test('checks locale, source amount, extra numbers, and explicit date before auto-save', () => {
  assert.equal(parseQuickLogAmount('1 234,56', 'fr-FR'), 1234.56)
  assert.equal(parseQuickLogAmount('1,234.56', 'en-US'), 1234.56)
  assert.equal(parseQuickLogAmount('1,2.50', 'en-US'), null)
  assert.equal(parseQuickLogAmount('1.234', 'en-US'), null)
  assert.equal(resolve('Jollibee 180', { amount: amount('180', '189') }).ready, false)
  assert.equal(resolve('Jollibee −189').ready, false)
  assert.equal(resolve('Jollibee 189 and 200').ready, false)
  assert.equal(resolve('189', { description: '189' }).ready, false)
  const yesterday = resolve('Jollibee 189 yesterday', { dateText: 'yesterday', date: '2026-11-18' })
  assert.equal(yesterday.ready, true)
  assert.equal(yesterday.values.date, '2026-11-18')
  assert.equal(resolve('Jollibee 189 tomorrow', { dateText: 'tomorrow', date: '2026-11-20' }).ready, false)
})

test('prioritizes a matching category rule and requires the subcategory to match its parent', () => {
  const result = resolve('Jollibee 189', {}, { rule: { category_id: 'food-rule', type_hint: 'expense' } })
  assert.equal(result.ready, true)
  assert.equal(result.values.category_id, 'food-rule')
  assert.equal(result.values.subcategory_id, null)
  assert.equal(resolve('Jollibee 189', { categoryId: 'salary' }).values.category_id, null)
})

test('records income into the income default or an explicitly named receiving account', () => {
  const income = { intent: 'income', description: 'Salary', amount: amount('45000'), categoryId: 'salary' }
  const result = resolve('Salary 45000', income)
  assert.equal(result.ready, true)
  assert.equal(result.values.type, 'income')
  assert.equal(result.values.account_id, 'savings')
  assert.equal(result.values.category_id, 'salary')
  assert.equal(resolve('Salary 45000 into GCash', { ...income, account: 'GCash' }).values.account_id, 'wallet')
  assert.equal(resolve('Salary 45000', income, { incomeAccountId: 'visa' }).ready, false)
})

test('checks transfer direction and fee separately, and saves ambiguous accounts for review', () => {
  const transfer = { intent: 'transfer', account: 'BPI Savings', destination: 'GCash', amount: amount('1500') }
  const phrase = 'Transfer 1500 from BPI Savings to GCash'
  const result = resolve(phrase, transfer)
  assert.equal(result.ready, true)
  assert.equal(result.values.account_id, 'savings')
  assert.equal(result.values.to_account_id, 'wallet')
  assert.equal(result.destinationCurrency, 'PHP')
  assert.equal(result.values.category_id, null)
  assert.equal(result.values.destination_amount, null)
  assert.equal(resolve(phrase + ', fee 15', { ...transfer, fee: amount('15') }).values.transfer_fee, 15)
  assert.equal(resolve(phrase + ', fee 15', { ...transfer, amount: amount('15'), fee: amount('1500') }).ready, false)
  assert.equal(resolve('Transfer 1500 including fee 15 from BPI Savings to GCash', { ...transfer, fee: amount('15') }).ready, false)
  assert.equal(resolve(phrase, { ...transfer, account: 'GCash', destination: 'BPI Savings' }).ready, false)
  assert.equal(resolve(phrase, transfer, { accounts: [...accounts, { ...accounts[1], id: 'duplicate' }] }).ready, false)
  const payment = resolve('Transfer 1500 from BPI Savings to BPI Visa', { ...transfer, destination: 'BPI Visa' })
  assert.equal(payment.ready, false)
  assert.equal(payment.kind, 'card-payment')
})

test('preserves recognized fields for asynchronous review without fabricating missing values', () => {
  const missingAmount = resolve('Jollibee', { amount: null })
  assert.equal(missingAmount.ready, false)
  assert.equal(missingAmount.values.description, 'Jollibee')
  assert.equal(missingAmount.values.category_id, 'food')
  assert.equal(missingAmount.values.amount, 0)

  const unclear = resolve('Something 189', { intent: 'unclear', description: null, ambiguous: true, categoryId: null })
  assert.equal(unclear.ready, false)
  assert.equal(unclear.kind, null)
  assert.equal(unclear.values.description, 'Something 189')
  assert.equal(unclear.values.amount, 189)
  assert.equal(unclear.values.account_id, '')

  const missingAccount = resolve('Salary 45000', {
    intent: 'income', amount: amount('45000'), description: 'Salary', categoryId: 'salary',
  }, { incomeAccountId: null })
  assert.equal(missingAccount.ready, false)
  assert.equal(missingAccount.kind, 'income')
  assert.equal(missingAccount.values.amount, 45000)
  assert.equal(missingAccount.values.currency, 'PHP')
  assert.equal(missingAccount.values.account_id, '')

  const unclearCurrency = resolve('Jollibee $189', { ambiguous: true })
  assert.equal(unclearCurrency.ready, false)
  assert.equal(unclearCurrency.values.amount, 189)
  assert.equal(unclearCurrency.values.currency, undefined)
  assert.equal(unclearCurrency.values.account_id, '')

  const namedAccount = resolve('Jollibee 189 USD from GCash', { account: 'GCash', currency: 'USD' })
  assert.equal(namedAccount.ready, false)
  assert.equal(namedAccount.values.account_id, 'wallet')
  assert.equal(namedAccount.values.currency, 'USD')
})

test('requires explicit sent and received amounts and currencies for cross-currency transfers', () => {
  const transfer = {
    intent: 'transfer', account: 'Dollar Savings', destination: 'GCash',
    amount: amount('100'), currency: 'USD', received: amount('5600'), receivedCurrency: 'PHP',
  }
  const result = resolve('Sent 100 USD from Dollar Savings to GCash, received 5600 PHP', transfer)
  assert.equal(result.ready, true)
  assert.equal(result.values.amount, 100)
  assert.equal(result.values.destination_amount, 5600)
  assert.equal(result.destinationCurrency, 'PHP')
  assert.equal(resolve('Transfer 100 USD from Dollar Savings to GCash', { ...transfer, received: null }).ready, false)
  assert.equal(resolve('Transfer 100 USD from Dollar Savings to GCash and paid 5600 PHP', transfer).ready, false)
})
