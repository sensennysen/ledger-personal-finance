import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountSchema } from '../src/lib/accountSchema.ts'

const base = {
  name: 'Home loan', type: 'loan', currency: 'USD', balance: 1000, color: '#000',
  credit_limit: null, statement_day: null, due_day: null,
  utilization_target_pct: 30, payment_reminder_days: 3,
  loan_pay_period: null, loan_due_days: null, loan_due_weekday: null, notes: null,
}
const paths = (r) => r.error.issues.map((i) => i.path.join('.'))

test('loan without a schedule is valid', () => {
  assert.equal(accountSchema.safeParse(base).success, true)
})

test('monthly loan schedule needs a due day', () => {
  const r = accountSchema.safeParse({ ...base, loan_pay_period: 'monthly' })
  assert.equal(r.success, false)
  assert.deepEqual(paths(r), ['loan_due_days'])
  assert.equal(accountSchema.safeParse({ ...base, loan_pay_period: 'monthly', loan_due_days: [15] }).success, true)
})

test('twice-monthly needs two different due days', () => {
  assert.equal(accountSchema.safeParse({ ...base, loan_pay_period: 'twice_monthly', loan_due_days: [5] }).success, false)
  assert.equal(accountSchema.safeParse({ ...base, loan_pay_period: 'twice_monthly', loan_due_days: [5, 5] }).success, false)
  assert.equal(accountSchema.safeParse({ ...base, loan_pay_period: 'twice_monthly', loan_due_days: [5, 20] }).success, true)
})

test('weekly needs a weekday', () => {
  assert.deepEqual(paths(accountSchema.safeParse({ ...base, loan_pay_period: 'weekly' })), ['loan_due_weekday'])
  assert.equal(accountSchema.safeParse({ ...base, loan_pay_period: 'weekly', loan_due_weekday: 0 }).success, true)
})

test('schedule fields survive parsing (edit no longer strips them)', () => {
  const r = accountSchema.safeParse({ ...base, loan_pay_period: 'twice_monthly', loan_due_days: [5, 20] })
  assert.deepEqual(r.data.loan_due_days, [5, 20])
  assert.equal(r.data.loan_pay_period, 'twice_monthly')
})

test('non-loan account ignores a stale schedule', () => {
  assert.equal(accountSchema.safeParse({ ...base, type: 'checking', loan_pay_period: 'weekly' }).success, true)
})
