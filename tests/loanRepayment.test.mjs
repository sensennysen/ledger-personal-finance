import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exceedsOutstanding, getRepaymentPresets, previewLoanAllocation, summariseRepayment } from '../src/lib/loanRepayment.ts'

const today = new Date(2026, 8, 25)

const purchase = (overrides = {}) => ({
  id: 'p1',
  name: 'Phone',
  account_id: 'loan',
  term_months: 4,
  monthly_installment: 100,
  total_payable: 400,
  opening_paid_amount: 0,
  first_due_date: '2026-09-15',
  created_at: '2026-09-01T00:00:00Z',
  ...overrides,
})
const deadline = (dueDate, total) => ({ dueDate, total, items: [] })

test('summary with a deadline: due amount, days until, and the balance after', () => {
  const summary = summariseRepayment({
    outstanding: 400,
    deadline: deadline('2026-10-15', 100),
    amount: 100,
    date: '2026-10-15',
    purchases: [purchase()],
    allocations: [],
    today,
  })
  assert.deepEqual(summary.installmentDue, { amount: 100, date: '2026-10-15', inDays: 20 })
  assert.equal(summary.after, 300)
  assert.equal(summary.overpays, false)
})

test('summary without a deadline has no installment due', () => {
  const summary = summariseRepayment({ outstanding: 400, deadline: null, amount: 0, date: '2026-09-25', purchases: [], allocations: [], today })
  assert.equal(summary.installmentDue, null)
  assert.equal(summary.after, 400)
  assert.equal(summary.installments, null)
})

test('over-payment yields no balance after, never a negative figure', () => {
  const summary = summariseRepayment({ outstanding: 400, deadline: null, amount: 400.01, date: '2026-09-25', purchases: [purchase()], allocations: [], today })
  assert.equal(summary.overpays, true)
  assert.equal(summary.after, null)
  assert.equal(summary.installments.paidAfter, summary.installments.paid)
})

test('a blank, negative or NaN amount reads as zero', () => {
  for (const amount of [0, -5, Number.NaN]) {
    const summary = summariseRepayment({ outstanding: 250, deadline: null, amount, date: '2026-09-25', purchases: [], allocations: [], today })
    assert.equal(summary.after, 250)
    assert.equal(summary.overpays, false)
  }
})

test('the installment count steps as whole installments are cleared', () => {
  const allocations = [{ loan_purchase_id: 'p1', amount: 100 }]
  const args = { outstanding: 300, deadline: null, date: '2026-10-15', purchases: [purchase()], allocations, today }
  assert.deepEqual(summariseRepayment({ ...args, amount: 100 }).installments, { paid: 1, total: 4, paidAfter: 2 })
  assert.deepEqual(summariseRepayment({ ...args, amount: 250 }).installments, { paid: 1, total: 4, paidAfter: 3 })
  assert.deepEqual(summariseRepayment({ ...args, amount: 50 }).installments, { paid: 1, total: 4, paidAfter: 1 })
  assert.deepEqual(summariseRepayment({ ...args, amount: 300 }).installments, { paid: 1, total: 4, paidAfter: 4 })
})

test('presets: installment is the default when a deadline exists', () => {
  const presets = getRepaymentPresets(400, deadline('2026-10-15', 100))
  assert.deepEqual(presets, { installment: 100, full: 400, defaultPreset: 'installment' })
})

test('presets: no deadline defaults to custom with no installment preset', () => {
  assert.deepEqual(getRepaymentPresets(400, null), { installment: null, full: 400, defaultPreset: 'custom' })
})

test('presets: an installment larger than what is outstanding is capped at outstanding', () => {
  assert.equal(getRepaymentPresets(60, deadline('2026-10-15', 100)).installment, 60)
})

test('pay in full survives a float balance at a cent boundary', () => {
  // 0.1 + 0.2 is 0.30000000000000004: the figure shown, 0.3, must not trip the cap.
  const owed = 0.1 + 0.2
  const { full } = getRepaymentPresets(owed, null)
  assert.equal(full, 0.3)
  assert.equal(exceedsOutstanding(full, owed), false)
  // And a balance just below the cent still accepts its own rounded figure.
  assert.equal(exceedsOutstanding(getRepaymentPresets(0.29999999999999993, null).full, 0.29999999999999993), false)
  assert.equal(exceedsOutstanding(0.31, owed), true)
})

// Parity with allocate_loan_payment. Every expected figure below was read from the
// loan_payment_allocations rows a local Supabase wrote for the same purchases and payments
// (LED-107, 2026-09-25); the SQL cannot run under node --test, so these pin the port to it.
let seq = 0
const buy = (id, name, monthly, term, firstDue, opening = 0) => ({
  id,
  name,
  account_id: 'loan',
  term_months: term,
  monthly_installment: monthly,
  total_payable: Math.round(monthly * term * 100) / 100,
  opening_paid_amount: opening,
  first_due_date: firstDue,
  created_at: `2026-09-01T00:00:0${seq++ % 10}Z`,
})
const split = (purchases, allocations, amount, date) => {
  const { applied } = previewLoanAllocation(purchases, allocations, amount, date)
  return Object.fromEntries(applied.map((row) => [row.loan_purchase_id, row.amount]))
}
const pair = () => [buy('A', 'A', 300, 12, '2026-09-15'), buy('B', 'B', 180, 6, '2026-09-15')]

test('preview matches the SQL: exactly what is due', () => {
  assert.deepEqual(split(pair(), [], 480, '2026-09-15'), { A: 300, B: 180 })
})

test('preview matches the SQL: a payment above what is due spills to remaining balance', () => {
  assert.deepEqual(split(pair(), [], 620, '2026-09-15'), { A: 410, B: 210 })
})

test('preview matches the SQL: dated before the due date the split is by remaining balance (LED-83)', () => {
  assert.deepEqual(split(pair(), [], 620, '2026-09-01'), { A: 476.92, B: 143.08 })
})

test('preview follows the Date field across a due date', () => {
  assert.notDeepEqual(split(pair(), [], 620, '2026-09-01'), split(pair(), [], 620, '2026-09-15'))
})

test('preview matches the SQL: cent rounding across three purchases', () => {
  const purchases = [buy('A', 'A', 33.33, 3, '2026-09-15'), buy('B', 'B', 66.67, 3, '2026-09-15'), buy('C', 'C', 10.01, 7, '2026-09-15')]
  assert.deepEqual(split(purchases, [], 100, '2026-09-01'), { A: 27.02, B: 54.05, C: 18.93 })
})

test('preview matches the SQL: a second payment sees what the first one applied', () => {
  const first = [{ loan_purchase_id: 'A', amount: 300 }, { loan_purchase_id: 'B', amount: 180 }]
  assert.deepEqual(split(pair(), first, 700, '2026-10-15'), { A: 477.42, B: 222.58 })
})

test('preview matches the SQL: opening progress counts as paid', () => {
  const purchases = [buy('A', 'A', 300, 12, '2026-08-15', 300), buy('B', 'B', 180, 6, '2026-09-15')]
  assert.deepEqual(split(purchases, [], 300, '2026-09-15'), { A: 187.5, B: 112.5 })
})

test('preview matches the SQL: a payment cannot exceed what a purchase still owes', () => {
  assert.deepEqual(split([buy('A', 'A', 33.33, 3, '2026-09-15')], [], 100, '2026-12-15'), { A: 99.99 })
})

test('preview matches the SQL: only the purchase with something due is paid first', () => {
  const purchases = [buy('A', 'A', 300, 12, '2026-08-15'), buy('B', 'B', 180, 6, '2026-10-15')]
  assert.deepEqual(split(purchases, [], 450, '2026-09-15'), { A: 450 })
  const after = [{ loan_purchase_id: 'A', amount: 450 }]
  assert.deepEqual(split(purchases, after, 200, '2026-10-20'), { A: 142.86, B: 57.14 })
})

test('preview rows: installment reached, amount applied and balance after', () => {
  const { rows } = previewLoanAllocation(pair(), [], 480, '2026-09-15')
  assert.deepEqual(rows, [
    { purchaseId: 'A', purchaseName: 'A', installmentNumber: 1, termMonths: 12, applied: 300, remainingAfter: 3300 },
    { purchaseId: 'B', purchaseName: 'B', installmentNumber: 1, termMonths: 6, applied: 180, remainingAfter: 900 },
  ])
})

test('preview rows skip a fully paid purchase and are empty with no purchases', () => {
  const paid = buy('P', 'Paid', 100, 2, '2026-01-15', 200)
  assert.deepEqual(previewLoanAllocation([paid], [], 50, '2026-09-15').rows, [])
  assert.deepEqual(previewLoanAllocation([], [], 50, '2026-09-15'), { rows: [], applied: [] })
})

test('the applied allocations sum to the payment, capped at what is owed', () => {
  const total = (amount) => previewLoanAllocation(pair(), [], amount, '2026-09-15').applied.reduce((sum, row) => sum + row.amount, 0)
  assert.equal(Math.round(total(620) * 100) / 100, 620)
  assert.equal(Math.round(total(99999) * 100) / 100, 4680)
})
