import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRunningBalanceMap } from '../src/lib/runningBalance.ts'

// Replays transactions forward with the same rules as the update_account_balance trigger
// (20260810120000_add_loan_tracker.sql), recording each row's own account after the row.
function replay(opening, txs) {
  const types = new Map(opening.map((a) => [a.id, a.type]))
  const balance = new Map(opening.map((a) => [a.id, a.balance]))
  const after = new Map()
  const add = (id, delta) => balance.set(id, Math.round(((balance.get(id) ?? 0) + delta) * 100) / 100)
  for (const tx of txs) {
    if (tx.type === 'income') add(tx.account_id, tx.amount)
    else if (tx.type === 'expense') {
      add(tx.account_id, -tx.amount)
      if (tx.to_account_id && types.get(tx.to_account_id) === 'loan') add(tx.to_account_id, tx.amount)
    } else {
      add(tx.account_id, -(tx.amount + (tx.transfer_fee ?? 0)))
      if (tx.to_account_id) add(tx.to_account_id, tx.amount * (tx.exchange_rate ?? 1))
    }
    after.set(tx.id, balance.get(tx.account_id))
  }
  return { final: [...balance].map(([id, b]) => ({ id, type: types.get(id), balance: b })), after }
}

const tx = (id, date, type, account_id, amount, extra = {}) => ({
  id, date, type, account_id, amount, to_account_id: null, exchange_rate: 1, transfer_fee: null, created_at: `${date}T09:00:00Z`, ...extra,
})

const opening = [
  { id: 'bank', type: 'checking', balance: 10000 },
  { id: 'usd', type: 'savings', balance: 100 },
  { id: 'card', type: 'credit_card', balance: 0 },
  { id: 'loan', type: 'loan', balance: -6000 },
]

const history = [
  tx('t1', '2026-09-01', 'income', 'bank', 20000),
  tx('t2', '2026-09-02', 'expense', 'card', 450.75),
  tx('t3', '2026-09-03', 'expense', 'bank', 1000, { to_account_id: 'loan' }),
  tx('t4', '2026-09-04', 'transfer', 'bank', 5625, { to_account_id: 'usd', exchange_rate: 0.0178, transfer_fee: 25 }),
  tx('t5', '2026-09-05', 'transfer', 'bank', 450.75, { to_account_id: 'card' }),
  tx('t6', '2026-09-05', 'expense', 'bank', 99.99, { created_at: '2026-09-05T18:00:00Z' }),
  tx('t7', '2026-09-20', 'expense', 'usd', 12.5),
]

test('each row shows its own account balance right after it, as the trigger left it', () => {
  const { final, after } = replay(opening, history)
  const map = buildRunningBalanceMap(final, history)
  for (const row of history) assert.equal(map.get(row.id), after.get(row.id), row.id)
})

test('the newest row of an account equals its live balance', () => {
  const { final } = replay(opening, history)
  const map = buildRunningBalanceMap(final, history)
  assert.equal(map.get('t7'), final.find((a) => a.id === 'usd').balance)
  assert.equal(map.get('t6'), final.find((a) => a.id === 'bank').balance)
})

test('a loan repayment and a cross-currency transfer are unwound on the receiving side too', () => {
  const { final, after } = replay(opening, history)
  const map = buildRunningBalanceMap(final, history)
  // t7 is on usd: its balance after only holds if the t4 credit (amount x rate) was undone correctly.
  assert.equal(after.get('t7'), 187.63) // 100 + 5,625 x 0.0178 = 200.13 (numeric(18,2)), less 12.50
  assert.equal(map.get('t7'), after.get('t7'))
  // The repayment reached the loan (-6,000 to -5,000); unwinding gives each other account its own figure.
  assert.equal(final.find((a) => a.id === 'loan').balance, -5000)
  assert.equal(map.get('t3'), after.get('t3'))
})

test('an unknown account gets no balance rather than a wrong one', () => {
  const map = buildRunningBalanceMap([{ id: 'bank', type: 'checking', balance: 5 }], [tx('x', '2026-09-01', 'income', 'gone', 5)])
  assert.equal(map.has('x'), false)
})

test('rows on one day keep a fixed order whatever order they arrive in', () => {
  const { final } = replay(opening, history)
  const forward = buildRunningBalanceMap(final, history)
  const reversed = buildRunningBalanceMap(final, [...history].reverse())
  assert.deepEqual([...forward].sort(), [...reversed].sort())
})
