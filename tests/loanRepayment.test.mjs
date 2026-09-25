import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exceedsOutstanding, getRepaymentPresets, summariseRepayment } from '../src/lib/loanRepayment.ts'

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
  ...overrides,
})
const deadline = (dueDate, total) => ({ dueDate, total, items: [] })

test('summary with a deadline: due amount, days until, and the balance after', () => {
  const summary = summariseRepayment({
    outstanding: 400,
    deadline: deadline('2026-10-15', 100),
    amount: 100,
    purchases: [purchase()],
    allocations: [],
    today,
  })
  assert.deepEqual(summary.installmentDue, { amount: 100, date: '2026-10-15', inDays: 20 })
  assert.equal(summary.after, 300)
  assert.equal(summary.overpays, false)
})

test('summary without a deadline has no installment due', () => {
  const summary = summariseRepayment({ outstanding: 400, deadline: null, amount: 0, purchases: [], allocations: [], today })
  assert.equal(summary.installmentDue, null)
  assert.equal(summary.after, 400)
  assert.equal(summary.installments, null)
})

test('over-payment yields no balance after, never a negative figure', () => {
  const summary = summariseRepayment({ outstanding: 400, deadline: null, amount: 400.01, purchases: [purchase()], allocations: [], today })
  assert.equal(summary.overpays, true)
  assert.equal(summary.after, null)
  assert.equal(summary.installments.paidAfter, summary.installments.paid)
})

test('a blank, negative or NaN amount reads as zero', () => {
  for (const amount of [0, -5, Number.NaN]) {
    const summary = summariseRepayment({ outstanding: 250, deadline: null, amount, purchases: [], allocations: [], today })
    assert.equal(summary.after, 250)
    assert.equal(summary.overpays, false)
  }
})

test('the installment count steps as whole installments are cleared', () => {
  const allocations = [{ loan_purchase_id: 'p1', amount: 100 }]
  const args = { outstanding: 300, deadline: null, purchases: [purchase()], allocations, today }
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
