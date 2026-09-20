import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeOverspending,
  streakLabel,
  shiftMonthKey,
  monthCycleRange,
} from '../src/lib/overspending.ts'

const budget = (o = {}) => ({
  id: 'b1', category_id: 'c1', amount: 600, currency: 'PHP', period: 'monthly',
  start_date: '2026-07-01', rollover_enabled: false, ...o,
})
const tx = (date, amount, o = {}) => ({
  category_id: 'c1', amount, date, currency: 'PHP', exchange_rate: null, ...o,
})
const run = (o) =>
  computeOverspending({
    budgets: [budget()], txs: [], month: '2026-09', startDay: 1, behaviour: 'reset',
    rangeFor: () => ({ start: '2026-09-01', end: '2026-09-30' }), ...o,
  })

test('nothing over budget yields no rows', () => {
  const r = run({ txs: [tx('2026-09-05', 600)] })
  assert.deepEqual(r.rows, [])
  assert.deepEqual(r.totals, [])
})

test('a single overspend is reported with limit and amount over', () => {
  const [row] = run({ txs: [tx('2026-09-05', 742.3)] }).rows
  assert.equal(row.limit, 600)
  assert.ok(Math.abs(row.over - 142.3) < 1e-9)
  assert.equal(row.streak, 1)
})

test('streak counts consecutive over cycles and resets after a good one', () => {
  const txs = [tx('2026-07-05', 700), tx('2026-08-05', 700), tx('2026-09-05', 700)]
  assert.equal(run({ txs }).rows[0].streak, 3)
  const broken = [tx('2026-07-05', 700), tx('2026-08-05', 100), tx('2026-09-05', 700)]
  assert.equal(run({ txs: broken }).rows[0].streak, 1)
})

test('reset: the overspend is recorded, nothing is uncarried, next limit is unchanged', () => {
  const b = budget({ rollover_enabled: true, start_date: '2026-08-01' })
  const txs = [tx('2026-08-05', 900), tx('2026-09-05', 700)]
  const [row] = run({ budgets: [b], txs, behaviour: 'reset' }).rows
  assert.equal(row.limit, 600)
  assert.equal(row.over, 100)
  assert.equal(row.uncarried, 0)
})

test('carry: a carried deficit lowers the limit and explains the overspend', () => {
  const b = budget({ rollover_enabled: true, start_date: '2026-08-01' })
  const txs = [tx('2026-08-05', 900), tx('2026-09-05', 500)]
  const [row] = run({ budgets: [b], txs, behaviour: 'carry' }).rows
  assert.equal(row.limit, 300)
  assert.equal(row.over, 200)
})

test('carry: the deficit the clamp did not absorb is reported as uncarried', () => {
  const b = budget({ rollover_enabled: true, start_date: '2026-09-01' })
  const [row] = run({ budgets: [b], txs: [tx('2026-09-05', 1500)], behaviour: 'carry' }).rows
  assert.equal(row.over, 900)
  assert.equal(row.uncarried, 300)
  const under = run({ budgets: [b], txs: [tx('2026-09-05', 1100)], behaviour: 'carry' }).rows[0]
  assert.equal(under.uncarried, 0)
})

test('non-monthly budgets report only the selected cycle', () => {
  const b = budget({ period: 'weekly', amount: 100 })
  const r = run({ budgets: [b], txs: [tx('2026-09-02', 150), tx('2026-08-20', 500)] })
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].over, 50)
  assert.equal(r.rows[0].streak, 1)
})

test('unrated foreign currency is named, not silently dropped', () => {
  const r = run({ txs: [tx('2026-09-05', 10, { currency: 'USD' })] })
  assert.deepEqual(r.unrated, ['USD'])
})

test('rows are sorted by amount over and totalled per currency', () => {
  const budgets = [
    budget({ id: 'a', category_id: 'c1' }),
    budget({ id: 'b', category_id: 'c2', amount: 300 }),
  ]
  const txs = [tx('2026-09-05', 700), tx('2026-09-06', 500, { category_id: 'c2' })]
  const r = run({ budgets, txs })
  assert.deepEqual(r.rows.map((x) => x.budgetId), ['b', 'a'])
  assert.deepEqual(r.totals, [{ currency: 'PHP', over: 300, uncarried: 0 }])
})

test('budgets that start after the selected cycle are skipped', () => {
  const r = run({ budgets: [budget({ start_date: '2026-10-01' })], txs: [tx('2026-09-05', 900)] })
  assert.deepEqual(r.rows, [])
})

test('helpers', () => {
  assert.equal(streakLabel(1), '1st')
  assert.equal(streakLabel(3), '3 in a row')
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.deepEqual(monthCycleRange('2026-09', 15), { start: '2026-09-15', end: '2026-10-14' })
})
