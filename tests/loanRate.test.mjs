import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthlyRateSchema, MAX_MONTHLY_INTEREST_PCT } from '../src/lib/loanRate.ts'
import { calculateFlatMonthlyInstallment } from '../src/lib/loanInstallments.ts'

test('typical and boundary rates are accepted', () => {
  for (const v of [0, 1.25, '1.25', '', MAX_MONTHLY_INTEREST_PCT]) {
    assert.equal(monthlyRateSchema.safeParse(v).success, true, String(v))
  }
})

test('negative rate is rejected', () => {
  const r = monthlyRateSchema.safeParse(-1)
  assert.equal(r.success, false)
  assert.equal(r.error.issues[0].message, 'Interest cannot be negative')
})

test('125 for 1.25 is rejected with a hint', () => {
  const r = monthlyRateSchema.safeParse('125')
  assert.equal(r.success, false)
  assert.match(r.error.issues[0].message, /enter 1\.25/)
})

test('flat installment matches the design frame', () => {
  assert.equal(calculateFlatMonthlyInstallment(2400, 24, 1.25), 130)
})
