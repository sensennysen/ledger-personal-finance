import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getItemizationGap, labelAllocationInstallments, splitPurchaseProgress } from '../src/lib/loanSummary.ts'

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

test('opening progress and repayments are separate segments', () => {
  const r = splitPurchaseProgress({ total_payable: 3120, opening_paid_amount: 1300, paid_amount: 1560 })
  assert.equal(r.importedAmount, 1300)
  assert.equal(r.repaidAmount, 260)
  assert.equal(Math.round(r.importedPct * 100) / 100, 41.67)
  assert.equal(Math.round(r.repaidPct * 100) / 100, 8.33)
})

test('a purchase with no opening progress is all repaid segment', () => {
  const r = splitPurchaseProgress({ total_payable: 1000, opening_paid_amount: 0, paid_amount: 250 })
  assert.deepEqual([r.importedPct, r.repaidPct], [0, 25])
})

test('segments never exceed the bar', () => {
  const r = splitPurchaseProgress({ total_payable: 100, opening_paid_amount: 60, paid_amount: 130 })
  assert.equal(r.importedPct + r.repaidPct, 100)
})

const warranty = { id: 'w', term_months: 24, monthly_installment: 130, total_payable: 3120, opening_paid_amount: 1300 }
const allocation = (id, amount, date, purchase = 'w') => ({ id, loan_purchase_id: purchase, amount, created_at: `${date}T00:00:00Z`, transaction: { id, date, description: '' } })

test('each repayment names the installment it paid, after opening progress', () => {
  const labels = labelAllocationInstallments([warranty], [allocation('b', 130, '2026-09-15'), allocation('a', 130, '2026-08-15')])
  assert.equal(labels.get('a'), 'Installment 11')
  assert.equal(labels.get('b'), 'Installment 12')
})

test('a payment covering two installments names the range', () => {
  const labels = labelAllocationInstallments([warranty], [allocation('a', 260, '2026-08-15')])
  assert.equal(labels.get('a'), 'Installments 11–12')
})

test('a partial payment names the installment it went toward', () => {
  const labels = labelAllocationInstallments([warranty], [allocation('a', 50, '2026-08-15'), allocation('b', 80, '2026-08-20')])
  assert.equal(labels.get('a'), 'Installment 11')
  assert.equal(labels.get('b'), 'Installment 11')
})

test('the balancing final installment is numbered correctly', () => {
  const odd = { id: 'o', term_months: 3, monthly_installment: 33.33, total_payable: 100, opening_paid_amount: 66.66 }
  assert.equal(labelAllocationInstallments([odd], [allocation('a', 33.34, '2026-01-01', 'o')]).get('a'), 'Installment 3')
})
