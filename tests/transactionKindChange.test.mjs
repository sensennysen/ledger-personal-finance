import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyKindChange } from '../src/lib/transactionKindChange.ts'
import { inferTransactionKind } from '../src/components/transactions/transactionKinds.ts'

const base = {
  type: 'expense',
  account_id: 'acc-1',
  to_account_id: null,
  category_id: 'cat-food',
  subcategory_id: 'sub-groceries',
  amount: 86.4,
  currency: 'USD',
  exchange_rate: 1,
  description: 'Grocery run',
  notes: 'weekly',
  date: '2026-09-09',
  transfer_fee: null,
  is_recurring: true,
  recurrence_interval: 'monthly',
  recurrence_end_date: null,
  receipt_url: 'r.png',
  tags: ['home'],
  goal_id: 'goal-1',
}

const SHARED = [
  'account_id', 'amount', 'currency', 'exchange_rate', 'description', 'notes', 'date',
  'is_recurring', 'recurrence_interval', 'recurrence_end_date', 'receipt_url', 'tags',
]

const KINDS = ['income', 'expense', 'transfer']

test('every pair of primary kinds keeps the shared fields and sets the type', () => {
  for (const from of KINDS) {
    for (const to of KINDS) {
      const next = applyKindChange({ ...base, type: from }, to)
      assert.equal(next.type, to, `${from} -> ${to}`)
      for (const key of SHARED) assert.deepEqual(next[key], base[key], `${from} -> ${to}: ${key}`)
    }
  }
})

test('every pair leaves no destination account unless the user picks one later', () => {
  for (const from of KINDS) {
    for (const to of KINDS) {
      const next = applyKindChange({ ...base, type: from, to_account_id: from === 'transfer' ? 'acc-2' : null }, to)
      assert.equal(next.to_account_id, null, `${from} -> ${to}`)
    }
  }
})

test('expense -> transfer clears category, subcategory and goal', () => {
  const next = applyKindChange(base, 'transfer')
  assert.equal(next.category_id, null)
  assert.equal(next.subcategory_id, null)
  assert.equal(next.goal_id, null)
})

test('transfer -> expense clears the destination account and the fee', () => {
  const next = applyKindChange({ ...base, type: 'transfer', category_id: null, subcategory_id: null, to_account_id: 'acc-2', transfer_fee: 1.5 }, 'expense')
  assert.equal(next.to_account_id, null)
  assert.equal(next.transfer_fee, null)
})

test('income <-> expense drops the category, because categories are typed', () => {
  assert.equal(applyKindChange(base, 'income').category_id, null)
  assert.equal(applyKindChange({ ...base, type: 'income' }, 'expense').category_id, null)
})

test('expense -> the same kind keeps the category and goal', () => {
  const next = applyKindChange(base, 'expense')
  assert.equal(next.category_id, 'cat-food')
  assert.equal(next.subcategory_id, 'sub-groceries')
  assert.equal(next.goal_id, 'goal-1')
})

test('a liability kind is an expense with an empty target and keeps its category', () => {
  for (const kind of ['loan-repayment', 'card-payment']) {
    const next = applyKindChange(base, kind)
    assert.equal(next.type, 'expense')
    assert.equal(next.to_account_id, null)
    assert.equal(next.category_id, 'cat-food')
  }
  assert.equal(applyKindChange({ ...base, type: 'income' }, 'card-payment').category_id, null)
})

test('a changed row still infers its kind from type and target', () => {
  assert.equal(inferTransactionKind(applyKindChange(base, 'transfer').type, null, null), 'transfer')
  const back = applyKindChange({ ...base, type: 'transfer', to_account_id: 'acc-2' }, 'expense')
  assert.equal(inferTransactionKind(back.type, back.to_account_id, null), 'expense')
})

test('the input is not mutated', () => {
  const copy = structuredClone(base)
  applyKindChange(base, 'transfer')
  assert.deepEqual(base, copy)
})
