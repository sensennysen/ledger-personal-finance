import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextRollover } from '../src/lib/budgetRollover.ts'
import { buildBudgetHistory, replayCarriedIn } from '../src/lib/budgetHistory.ts'

const period = (n, spent) => ({
  period_start: `2026-0${n}-01`,
  period_end: `2026-0${n}-28`,
  spent,
})

// The loop useBudgets ran inline before LED-139, kept verbatim as the reference.
function legacyLoop(periods, amount, currency, rolloverActive, behaviour) {
  let rolloverAmount = 0
  const history = []
  for (const p of periods) {
    const surplus = amount - p.spent
    history.push({
      period_start: p.period_start,
      period_end: p.period_end,
      budget_amount: amount,
      spent_amount: p.spent,
      rollover_in: rolloverActive ? rolloverAmount : 0,
      currency,
    })
    if (rolloverActive) rolloverAmount = nextRollover(rolloverAmount, surplus, amount, behaviour)
  }
  return { history, carriedIn: rolloverAmount }
}

const spends = [60, 140, 100, 20, 250]
const periods = spends.map((spent, i) => period(i + 1, spent))

test('buildBudgetHistory matches the loop useBudgets ran inline, in every mode', () => {
  for (const behaviour of ['carry', 'reset']) {
    for (const active of [true, false]) {
      assert.deepEqual(
        buildBudgetHistory(periods, 100, 'PHP', active, behaviour),
        legacyLoop(periods, 100, 'PHP', active, behaviour),
      )
    }
  }
})

test('replayCarriedIn equals the carried-in of the history it summarises', () => {
  for (const behaviour of ['carry', 'reset']) {
    const built = buildBudgetHistory(periods, 100, 'PHP', true, behaviour)
    assert.equal(replayCarriedIn(spends, 100, true, behaviour), built.carriedIn)
  }
})

test('carry and reset differ once a period is overspent', () => {
  // carry: +40, then -40 (net 0), then 0, then +80, then -150 (net -70).
  assert.equal(replayCarriedIn(spends, 100, true, 'carry'), -70)
  // reset drops the overspends: +40, +40, +40, +120, +120.
  assert.equal(replayCarriedIn(spends, 100, true, 'reset'), 120)
})

test('the form figure moves with the amount being edited', () => {
  const saved = replayCarriedIn([50, 50], 100, true, 'carry')
  const raised = replayCarriedIn([50, 50], 200, true, 'carry')
  assert.equal(saved, 100)
  assert.equal(raised, 300)
})

test('nothing carries when rollover is off or there is no history', () => {
  assert.equal(replayCarriedIn(spends, 100, false, 'carry'), 0)
  assert.equal(replayCarriedIn([], 100, true, 'carry'), 0)
  assert.deepEqual(buildBudgetHistory([], 100, 'PHP', true, 'carry'), { history: [], carriedIn: 0 })
  assert.equal(buildBudgetHistory(periods, 100, 'PHP', false, 'carry').history[3].rollover_in, 0)
})
