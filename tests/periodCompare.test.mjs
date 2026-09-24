import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  previousCycleKey,
  cycleMonthLabel,
  summarizeRange,
  netWorthEffect,
  compareToPrevious,
  formatComparison,
} from '../src/lib/periodCompare.ts'

test('previous cycle key steps back a month, across years', () => {
  assert.equal(previousCycleKey('2026-09'), '2026-08')
  assert.equal(previousCycleKey('2026-01'), '2025-12')
})

test('cycle month label is the short month name', () => {
  assert.equal(cycleMonthLabel('2026-08'), 'Aug')
})

test('summarizeRange counts income and expenses inside the range only, converted', () => {
  const txs = [
    { date: '2026-08-31', type: 'income', amount: 999 },
    { date: '2026-09-01', type: 'income', amount: 100 },
    { date: '2026-09-10', type: 'expense', amount: 40, exchange_rate: 2 },
    { date: '2026-09-15', type: 'transfer', amount: 500 },
    { date: '2026-10-01', type: 'expense', amount: 999 },
  ]
  assert.deepEqual(summarizeRange(txs, '2026-09-01', '2026-09-30'), { income: 100, expenses: 80, net: 20 })
})

test('net worth effect: transfers cost only their fee, card payments nothing', () => {
  assert.equal(netWorthEffect({ date: '', type: 'income', amount: 50 }), 50)
  assert.equal(netWorthEffect({ date: '', type: 'expense', amount: 30 }), -30)
  assert.equal(netWorthEffect({ date: '', type: 'expense', amount: 30, to_account_id: 'card' }), 0)
  assert.equal(netWorthEffect({ date: '', type: 'transfer', amount: 500, transfer_fee: 15 }), -15)
  assert.equal(netWorthEffect({ date: '', type: 'transfer', amount: 500 }), 0)
})

test('compareToPrevious rounds to one decimal and gives a direction', () => {
  assert.deepEqual(compareToPrevious(3812.65, 3410.2), { pct: 11.8, direction: 'up' })
  assert.deepEqual(compareToPrevious(90, 100), { pct: 10, direction: 'down' })
  assert.deepEqual(compareToPrevious(100.01, 100), { pct: 0, direction: 'flat' })
})

test('a negative previous period compares against its magnitude', () => {
  // Net went from a 200 deficit to a 100 surplus: up 150%.
  assert.deepEqual(compareToPrevious(100, -200), { pct: 150, direction: 'up' })
})

test('nothing to compare against gives no percentage', () => {
  assert.deepEqual(compareToPrevious(50, 0), { pct: null, direction: 'up' })
  assert.deepEqual(compareToPrevious(0, 0), { pct: null, direction: 'flat' })
})

test('formatComparison wording', () => {
  assert.equal(formatComparison({ pct: 11.8, direction: 'up' }, 'Aug'), '↑ 11.8% vs Aug')
  assert.equal(formatComparison({ pct: 4.2, direction: 'down' }, 'Aug'), '↓ 4.2% vs Aug')
  assert.equal(formatComparison({ pct: 0, direction: 'flat' }, 'Aug'), 'Same as Aug')
  assert.equal(formatComparison({ pct: null, direction: 'up' }, 'Aug'), 'Nothing in Aug to compare')
  assert.equal(formatComparison({ pct: null, direction: 'flat' }, 'Aug'), 'Same as Aug')
})
