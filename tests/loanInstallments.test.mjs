import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUpcomingLoanBills, payNowDate } from '../src/lib/loanInstallments.ts'

const account = (over) => ({
  id: 'phoneLoan', name: 'Phone Loan', type: 'loan', currency: 'USD', color: '#000', icon: null,
  loan_pay_period: null, loan_due_days: null, loan_due_weekday: null,
  ...over,
})
const purchase = (over) => ({
  id: 'p1', account_id: 'phoneLoan', name: 'Purchase', term_months: 1, monthly_installment: 100,
  total_payable: 100, opening_paid_amount: 0, first_due_date: '2026-09-15',
  ...over,
})

// "Today" is Sep 26: the overdue purchase's Sep 15 installment is 11 days overdue, and the
// Sofa purchase's installment is due in 4 days (Sep 30), the last day of the cycle.
const today = new Date(2026, 8, 26)
const cycleStart = new Date(2026, 8, 1)
const cycleEnd = new Date(2026, 8, 30)

test('an overdue installment is not dropped just because it is before today (LED-173)', () => {
  const purchases = [
    purchase({ id: 'phone', name: 'Phone', monthly_installment: 250, total_payable: 250, first_due_date: '2026-09-15' }),
    purchase({ id: 'sofa', name: 'Sofa', monthly_installment: 100, total_payable: 100, first_due_date: '2026-09-30' }),
  ]
  const bills = buildUpcomingLoanBills([account()], purchases, [], cycleStart, cycleEnd, true, today)

  assert.equal(bills.length, 2)
  const overdue = bills.find((b) => b.title === 'Phone')
  const upcoming = bills.find((b) => b.title === 'Sofa')
  assert.ok(overdue, 'the overdue purchase still gets a bill')
  assert.equal(overdue.amount, 250)
  assert.equal(overdue.daysUntil, -11)
  assert.equal(upcoming.amount, 100)
  assert.equal(upcoming.daysUntil, 4)
})

test('Pay now always prefills what the repayment form will show as due, on every bill for the account (LED-173)', () => {
  const purchases = [
    purchase({ id: 'phone', name: 'Phone', monthly_installment: 250, total_payable: 250, first_due_date: '2026-09-15' }),
    purchase({ id: 'sofa', name: 'Sofa', monthly_installment: 100, total_payable: 100, first_due_date: '2026-09-30' }),
  ]
  const bills = buildUpcomingLoanBills([account()], purchases, [], cycleStart, cycleEnd, true, today)

  // The account's true next deadline is the overdue $250 installment (the same one
  // RepaymentAssist/Accounts' Coming up would show), so every bill's Pay now agrees with it.
  for (const bill of bills) {
    assert.deepEqual(bill.payment, { accountId: 'phoneLoan', amount: 250, date: '2026-09-26' })
  }
})

test('a loan with a pay period (one deadline across every purchase) also keeps an overdue deadline', () => {
  const purchases = [purchase({ id: 'p1', monthly_installment: 250, total_payable: 250, first_due_date: '2026-09-15' })]
  const bills = buildUpcomingLoanBills(
    [account({ loan_pay_period: 'monthly' })],
    purchases,
    [],
    cycleStart,
    cycleEnd,
    true,
    today,
  )
  assert.equal(bills.length, 1)
  assert.equal(bills[0].amount, 250)
  assert.equal(bills[0].daysUntil, -11)
  assert.deepEqual(bills[0].payment, { accountId: 'phoneLoan', amount: 250, date: '2026-09-26' })
})

test('a fully paid installment is not billed', () => {
  const purchases = [purchase({ id: 'p1', total_payable: 100, opening_paid_amount: 100, first_due_date: '2026-09-15' })]
  const bills = buildUpcomingLoanBills([account()], purchases, [], cycleStart, cycleEnd, true, today)
  assert.equal(bills.length, 0)
})

test('non-loan accounts are ignored', () => {
  const bills = buildUpcomingLoanBills([account({ type: 'checking' })], [purchase({})], [], cycleStart, cycleEnd, true, today)
  assert.equal(bills.length, 0)
})

// LED-195: the payment's date decides its split, so a bill past due opens on today.
test('payNowDate opens a past bill on today and keeps a bill that is not yet due', () => {
  assert.equal(payNowDate('2026-09-15', today), '2026-09-26') // overdue
  assert.equal(payNowDate('2026-09-26', today), '2026-09-26') // due today
  assert.equal(payNowDate('2026-09-30', today), '2026-09-30') // future keeps its due date
})

test('a future bill keeps its due date in Pay now (LED-195)', () => {
  const purchases = [purchase({ id: 'sofa', name: 'Sofa', monthly_installment: 100, total_payable: 100, first_due_date: '2026-09-30' })]
  const [bill] = buildUpcomingLoanBills([account()], purchases, [], cycleStart, cycleEnd, true, today)
  assert.deepEqual(bill.payment, { accountId: 'phoneLoan', amount: 100, date: '2026-09-30' })
})
