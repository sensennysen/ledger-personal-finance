import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getItemizationGap } from '../src/lib/loanSummary.ts'

test('purchases that cover the loan leave no gap', () => {
  const r = getItemizationGap(8540, [{ total_payable: 23040, remaining_balance: 6720 }, { total_payable: 3120, remaining_balance: 1820 }])
  assert.deepEqual(r, { itemized: 8540, gap: 0 })
})

test('owed above the purchases is unitemized debt', () => {
  const r = getItemizationGap(8940, [{ total_payable: 23040, remaining_balance: 6720 }, { total_payable: 3120, remaining_balance: 1820 }])
  assert.deepEqual(r, { itemized: 8540, gap: 400 })
})

test('purchases above what the loan owes read as a negative gap', () => {
  assert.equal(getItemizationGap(500, [{ total_payable: 1000, remaining_balance: 800 }]).gap, -300)
})

test('sub-cent drift is not a disagreement', () => {
  assert.equal(getItemizationGap(100.004, [{ total_payable: 100, remaining_balance: 100 }]).gap, 0)
})

test('with no purchases the whole balance is unitemized', () => {
  assert.deepEqual(getItemizationGap(1200, []), { itemized: 0, gap: 1200 })
})

test('an unenriched purchase counts its full total', () => {
  assert.equal(getItemizationGap(300, [{ total_payable: 300 }]).gap, 0)
})
