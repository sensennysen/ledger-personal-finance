import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kindMenuItems } from '../src/lib/kindMenu.ts'

const money = (n) => `$${n.toFixed(2)}`
const acct = (over) => ({ id: over.name, name: over.name, type: 'checking', currency: 'USD', balance: 0, ...over })
const opts = { baseCurrency: 'USD', formatMoney: money }
const cash = acct({ name: 'Cash', balance: 500 })

test('with no liabilities the menu is the three primary kinds', () => {
  const items = kindMenuItems([cash], opts)
  assert.deepEqual(items.map((i) => i.kind), ['expense', 'income', 'transfer'])
  assert.ok(items.every((i) => i.group === 'primary'))
})

test('primary descriptions are the static strings', () => {
  const items = kindMenuItems([cash], opts)
  assert.deepEqual(items.map((i) => i.description), [
    'Money spent from an account',
    'Money received into an account',
    'Move money between accounts',
  ])
})

test('loan repayment shows the count and total owed, pluralised', () => {
  const one = kindMenuItems([cash, acct({ name: 'Car', type: 'loan', balance: -8000 })], opts)
  assert.equal(one.find((i) => i.kind === 'loan-repayment').description, '1 loan · $8000.00 owed')
  const two = kindMenuItems(
    [cash, acct({ name: 'Car', type: 'loan', balance: -8000 }), acct({ name: 'Phone', type: 'loan', balance: -500 })],
    opts,
  )
  assert.equal(two.find((i) => i.kind === 'loan-repayment').description, '2 loans · $8500.00 owed')
})

test('loan and card items sit in the liabilities group after the primary kinds', () => {
  const items = kindMenuItems(
    [cash, acct({ name: 'Car', type: 'loan', balance: -100 }), acct({ name: 'Visa', type: 'credit_card', balance: -50 })],
    opts,
  )
  assert.deepEqual(items.map((i) => [i.kind, i.group]), [
    ['expense', 'primary'],
    ['income', 'primary'],
    ['transfer', 'primary'],
    ['loan-repayment', 'liabilities'],
    ['card-payment', 'liabilities'],
  ])
})

test('one card is named, several are counted', () => {
  const visa = acct({ name: 'BPI Rewards Visa', type: 'credit_card', balance: -1240 })
  const one = kindMenuItems([cash, visa], opts)
  assert.equal(one.find((i) => i.kind === 'card-payment').description, 'BPI Rewards Visa · $1240.00 due')
  const two = kindMenuItems([cash, visa, acct({ name: 'Amex', type: 'credit_card', balance: -60 })], opts)
  assert.equal(two.find((i) => i.kind === 'card-payment').description, '2 cards · $1300.00 due')
})

test('a card with a zero balance does not count and does not show the item alone', () => {
  const items = kindMenuItems([cash, acct({ name: 'Visa', type: 'credit_card', balance: 0 })], opts)
  assert.ok(!items.some((i) => i.kind === 'card-payment'))
  const mixed = kindMenuItems(
    [cash, acct({ name: 'Visa', type: 'credit_card', balance: 0 }), acct({ name: 'Amex', type: 'credit_card', balance: -60 })],
    opts,
  )
  assert.equal(mixed.find((i) => i.kind === 'card-payment').description, 'Amex · $60.00 due')
})

test('visibility flags hide their own item', () => {
  const accounts = [cash, acct({ name: 'Car', type: 'loan', balance: -100 }), acct({ name: 'Visa', type: 'credit_card', balance: -50 })]
  const noLoan = kindMenuItems(accounts, { ...opts, showLoanRepayment: false })
  assert.ok(!noLoan.some((i) => i.kind === 'loan-repayment'))
  assert.ok(noLoan.some((i) => i.kind === 'card-payment'))
  const noCard = kindMenuItems(accounts, { ...opts, showCardPayment: false })
  assert.ok(noCard.some((i) => i.kind === 'loan-repayment'))
  assert.ok(!noCard.some((i) => i.kind === 'card-payment'))
})

test('a loan in another currency is left out of the sentence, not summed', () => {
  const items = kindMenuItems([cash, acct({ name: 'Euro loan', type: 'loan', currency: 'EUR', balance: -900 })], opts)
  assert.equal(items.find((i) => i.kind === 'loan-repayment').description, 'Pay down a loan from another account')
})

test('the menu component renders the list and hard-codes no kind labels', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  assert.match(source, /kindMenuItems\(/)
  for (const label of ['Loan repayment', 'Card payment', 'Money spent from an account']) {
    assert.ok(!source.includes(label), `${label} should come from kindMenuItems`)
  }
})

test('the loan tile uses the gold token, not the accent', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  assert.match(source, /'loan-repayment':[^\n]*bg-gold\/15[^\n]*text-gold/)
  assert.ok(!/bg-primary|text-primary/.test(source))
})

test('below md the menu is a bottom sheet fed by the same list', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  assert.equal(source.match(/kindMenuItems\(/g).length, 1, 'both surfaces must share one call')
  assert.match(source, /useMediaQuery\('\(max-width: 767px\)'\)/)
  assert.match(source, /<SheetContent\s+side="bottom"/)
  assert.match(source, /min-h-16/)
  assert.match(source, /ChevronRight/)
  // Both surfaces read the same `primary` and `liabilities` arrays.
  assert.equal(source.match(/primary\.map\(/g).length, 2)
  assert.equal(source.match(/liabilities\.map\(/g).length, 2)
})
