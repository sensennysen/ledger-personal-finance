import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveQuickLogReceipt } from '../src/lib/quickLogReceipt.ts'
import { receiptImageUrl } from '../supabase/functions/_shared/receiptInput.ts'
import { isReceiptExtraction, quickLogFormatForReferences } from '../supabase/functions/_shared/quickLog.ts'

const accounts = [
  { id: 'cash', name: 'Cash', type: 'cash', currency: 'PHP', is_active: true },
  { id: 'wallet', name: 'Everyday Wallet', type: 'digital_wallet', currency: 'PHP', is_active: true },
  { id: 'savings', name: 'Savings', type: 'savings', currency: 'PHP', is_active: true },
  { id: 'usd', name: 'USD Wallet', type: 'digital_wallet', currency: 'USD', is_active: true },
]
const candidate = {
  intent: 'expense', description: 'Jollibee', account: null, accountId: null, destination: null,
  amount: { text: '689.50', decimal: '689.50' }, currency: 'PHP', defaultCurrency: 'PHP', numberLocale: 'en-US',
  date: '2026-11-18', dateText: 'Nov 18, 2026', paymentMethod: 'cash',
  categoryId: 'food', subcategoryId: 'fast-food', subcategoryParentId: 'food',
  received: null, receivedCurrency: null, fee: null, ambiguous: false, ambiguity: null,
}
const resolve = (changes = {}, options = {}) => resolveQuickLogReceipt({
  candidate: { ...candidate, ...changes }, today: '2026-11-20', selectedAccountId: null,
  expenseAccountId: 'wallet', incomeAccountId: 'savings', accounts, currencies: ['PHP', 'USD'],
  categories: [{ id: 'food', type: 'expense' }, { id: 'refunds', type: 'income' }], rule: null, ...options,
})

test('uses the selected account ahead of any model match and keeps the recognized payment method', () => {
  const entry = resolve({ account: 'Cash', accountId: 'cash' }, { selectedAccountId: 'wallet' })
  assert.ok(entry.ready)
  assert.equal(entry.values.account_id, 'wallet')
  assert.equal(entry.values.amount, 689.50)
  assert.equal(entry.values.notes, 'Payment method: Cash.')
  assert.equal(entry.values.subcategory_id, 'fast-food')
  assert.equal(entry.values.date, '2026-11-18')
})

test('matches a unique cash account and uses the correct marked-for-review default for ambiguous payments', () => {
  const inferred = resolve()
  assert.ok(inferred.ready)
  assert.equal(inferred.values.account_id, 'cash')
  const card = resolve({ paymentMethod: 'card' })
  assert.ok(card.ready)
  assert.equal(card.values.account_id, 'wallet')
  assert.match(card.values.notes, /Review the default expense account/)
  const refund = resolve({ intent: 'income', description: 'Refund', paymentMethod: 'card', categoryId: 'refunds' })
  assert.ok(refund.ready)
  assert.equal(refund.values.account_id, 'savings')
  assert.match(refund.values.notes, /Review the default income account/)
})

test('matches a printed provider only with a unique supported account and treats generic card labels as insufficient', () => {
  const provider = { id: 'gcash', name: 'GCash Wallet', type: 'digital_wallet', currency: 'PHP', is_active: true }
  const otherWallet = { ...provider, id: 'other-gcash', name: 'GCash Business' }
  const card = { ...provider, id: 'card', name: 'Visa', type: 'credit_card' }
  const extraction = { account: 'GCash', accountId: provider.id, paymentMethod: 'digital_wallet' }
  assert.equal(resolve(extraction, { accounts: [...accounts, provider] }).values.account_id, provider.id)
  assert.equal(resolve(extraction, { accounts: [...accounts, provider, otherWallet] }).values.account_id, 'wallet')
  assert.equal(resolve({ account: 'Visa', accountId: card.id, paymentMethod: 'card' }, { accounts: [...accounts, card] }).values.account_id, 'wallet')
})

test('keeps incomplete receipts in review with the recognized fields and reason', () => {
  assert.match(resolve({ amount: null }).reason, /final amount/)
  assert.match(resolve({ amount: { text: '300.00', decimal: '500.00' } }).reason, /final amount/)
  const mismatch = resolve({}, { selectedAccountId: 'usd' })
  assert.equal(mismatch.values.account_id, 'usd')
  assert.match(mismatch.reason, /account uses USD/)
  assert.match(resolve({ intent: 'unclear' }).reason, /transaction type/)
  assert.match(resolve({ ambiguity: 'multiple_transactions' }).reason, /more than one/)
  assert.match(resolve({ paymentMethod: null }, { expenseAccountId: null }).reason, /active account/)
  assert.match(resolve({ intent: 'transfer' }).reason, /account|transfer/)
})

test('accepts receipt image signatures and a receipt-only payment method field', () => {
  const base64 = readFileSync(new URL('../scripts/fixtures/openai-smoke-receipt.png', import.meta.url)).toString('base64')
  assert.ok(receiptImageUrl({ type: 'image/png', base64 })?.startsWith('data:image/png;base64,'))
  assert.equal(receiptImageUrl({ type: 'image/jpeg', base64 }), null)
  assert.equal(receiptImageUrl({ type: 'image/png', base64: 'data:image/png;base64,' + base64 }), null)
  assert.equal(receiptImageUrl({ type: 'text/html', base64 }), null)
  const schema = quickLogFormatForReferences([], [], [], true).schema
  assert.ok(schema.required.includes('paymentMethod'))
  assert.ok(!quickLogFormatForReferences([], [], []).schema.required.includes('paymentMethod'))
  assert.equal(isReceiptExtraction({ paymentMethod: 'cash' }), false)
})
