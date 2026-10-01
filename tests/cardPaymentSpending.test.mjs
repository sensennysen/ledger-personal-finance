import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cardPaymentTransfer, isCardPaymentTransaction } from '../src/lib/cardPayment.ts'
import { buildCategoryBreakdown } from '../src/lib/categoryBreakdown.ts'
import { entryBudgetImpact } from '../src/lib/budgetImpact.ts'
import { summarizeRange } from '../src/lib/periodCompare.ts'

// LED-114 (OD-2 b): a card payment is not spending. It is saved as a transfer into the card, and
// every spending calculation counts only type 'expense', so the payment never enters one.
// These tests pin that, and keep a loan repayment (an expense with a destination) counted.

const accounts = [
  { id: 'chk', type: 'checking' },
  { id: 'card', type: 'credit_card' },
  { id: 'loan', type: 'loan' },
]

const base = {
  amount: 500,
  date: '2026-09-10',
  currency: 'PHP',
  exchange_rate: 1,
  category_id: null,
  subcategory_id: null,
  subcategory: null,
  account_id: 'chk',
  goal_id: null,
  transfer_fee: null,
}

const cardPayment = cardPaymentTransfer({ ...base, type: 'expense', to_account_id: 'card' })
const loanRepayment = { ...base, type: 'expense', to_account_id: 'loan', category_id: 'loans' }
const groceries = { ...base, type: 'expense', to_account_id: null, category_id: 'groc', amount: 120 }

test('a card payment is saved as a transfer with no category', () => {
  assert.equal(cardPayment.type, 'transfer')
  assert.equal(cardPayment.category_id, null)
  assert.equal(cardPayment.to_account_id, 'card')
})

test('isCardPaymentTransaction recognises a transfer into a credit card only', () => {
  assert.equal(isCardPaymentTransaction(cardPayment, accounts), true)
  assert.equal(isCardPaymentTransaction({ type: 'transfer', to_account_id: 'chk' }, accounts), false)
  assert.equal(isCardPaymentTransaction(loanRepayment, accounts), false)
  assert.equal(isCardPaymentTransaction(groceries, accounts), false)
  assert.equal(isCardPaymentTransaction({ type: 'transfer', to_account_id: null }, accounts), false)
})

test('the category breakdown ignores a card payment and keeps a loan repayment', () => {
  const cats = new Map([
    ['groc', { name: 'Groceries', color: '#1' }],
    ['loans', { name: 'Loans', color: '#2' }],
  ])
  const { rows: slices } = buildCategoryBreakdown([groceries, cardPayment, loanRepayment], cats, 'PHP')
  assert.deepEqual(slices.map((s) => [s.name, s.amount]), [['Loans', 500], ['Groceries', 120]])
  assert.equal(slices.some((s) => s.name === 'Uncategorized'), false)
})

test('Reports totals ignore a card payment and count a loan repayment', () => {
  const { expenses } = summarizeRange([groceries, cardPayment, loanRepayment], '2026-09-01', '2026-09-30', 'PHP')
  assert.equal(expenses, 620)
})

test('a budget impact is null for a card payment', () => {
  const budget = { category_id: 'groc', currency: 'PHP', amount: 1000 }
  const range = { start: '2026-09-01', end: '2026-09-30' }
  assert.equal(entryBudgetImpact(cardPayment, budget, range), null)
  assert.notEqual(entryBudgetImpact(groceries, budget, range), null)
})

// utils.ts and the hooks import Supabase or the "@/" alias, so node cannot run them. Check the
// filter in their source instead: budget and overspending reads fetch expenses only, and Home's
// top categories skip anything that is not an expense.
test('reads and Home top categories count only expenses', () => {
  for (const file of ['src/hooks/useBudgets.ts', 'src/hooks/useOverspending.ts']) {
    assert.match(readFileSync(file, 'utf8'), /\.eq\('type', 'expense'\)/, file)
  }
  assert.match(readFileSync('src/lib/utils.ts', 'utf8'), /tx\.type !== 'expense'/)
})
