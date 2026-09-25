import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canChangeKind, kindDialogSubtitle, kindMenuItems } from '../src/lib/kindMenu.ts'

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
  assert.match(source, /useKindMenuItems\(/)
  for (const label of ['Loan repayment', 'Card payment', 'Money spent from an account']) {
    assert.ok(!source.includes(label), `${label} should come from kindMenuItems`)
  }
})

test('the loan tile uses the gold token, not the accent', () => {
  const source = readFileSync(new URL('../src/components/transactions/kindVisuals.ts', import.meta.url), 'utf8')
  assert.match(source, /'loan-repayment':[^\n]*bg-gold\/15[^\n]*text-gold/)
  assert.ok(!/bg-primary|text-primary/.test(source))
  const menu = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  assert.ok(!/bg-primary|text-primary/.test(menu))
})

test('below md the menu is a bottom sheet fed by the same list', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  assert.equal(source.match(/useKindMenuItems\(/g).length, 1, 'both surfaces must share one call')
  assert.match(source, /useMediaQuery\('\(max-width: 767px\)'\)/)
  assert.match(source, /<SheetContent\s+side="bottom"/)
  assert.match(source, /min-h-16/)
  assert.match(source, /ChevronRight/)
  // Both surfaces read the same `primary` and `liabilities` arrays.
  assert.equal(source.match(/primary\.map\(/g).length, 2)
  assert.equal(source.match(/liabilities\.map\(/g).length, 2)
})

test('E / I / T map to the three primary kinds and nothing else', async () => {
  const { KIND_SHORTCUTS, kindForShortcut } = await import('../src/lib/kindMenu.ts')
  assert.deepEqual({ ...KIND_SHORTCUTS }, { expense: 'E', income: 'I', transfer: 'T' })
  assert.equal(kindForShortcut('e'), 'expense')
  assert.equal(kindForShortcut('I'), 'income')
  assert.equal(kindForShortcut('t'), 'transfer')
  assert.equal(kindForShortcut('l'), null)
  assert.equal(kindForShortcut('c'), null)
})

test('only the primary kinds carry a key cap', () => {
  const items = kindMenuItems(
    [cash, acct({ name: 'Car', type: 'loan', balance: -100 }), acct({ name: 'Visa', type: 'credit_card', balance: -50 })],
    opts,
  )
  assert.deepEqual(items.map((i) => i.shortcut), ['E', 'I', 'T', undefined, undefined])
})

test('the dropdown renders key caps and the sheet does not', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionKindMenu.tsx', import.meta.url), 'utf8')
  const sheetPart = source.slice(source.indexOf('if (compact)'), source.indexOf('return (\n    <DropdownMenu'))
  assert.ok(!sheetPart.includes('shortcut'), 'the sheet must not show key caps')
  assert.match(source, /<DropdownMenuShortcut/)
})

test('the search palette reads the shared mapping instead of its own letters', () => {
  const source = readFileSync(new URL('../src/components/search/SearchPalette.tsx', import.meta.url), 'utf8')
  assert.match(source, /import \{ KIND_SHORTCUTS \} from '@\/lib\/kindMenu'/)
  assert.ok(!/key: '[EIT]'/.test(source))
})

const loan = acct({ name: 'Car', type: 'loan', balance: -100 })
const visa = acct({ name: 'Visa', type: 'credit_card', balance: -50 })

test('the dialog subtitle for a primary kind is the menu\'s own description', () => {
  const items = kindMenuItems([cash, loan, visa], opts)
  for (const kind of ['expense', 'income', 'transfer']) {
    assert.equal(kindDialogSubtitle(kind, items), items.find((i) => i.kind === kind).description)
  }
})

test('a payment dialog states its kind with the design caption, not the aggregate line', () => {
  const items = kindMenuItems([cash, loan, visa], opts)
  assert.equal(kindDialogSubtitle('loan-repayment', items), 'Posts as an expense against the loan · type locked')
  assert.equal(kindDialogSubtitle('card-payment', items), 'Posts as an expense against the card · type locked')
})

test('Change kind is offered from the three primary kinds only', () => {
  assert.equal(canChangeKind('expense'), true)
  assert.equal(canChangeKind('income'), true)
  assert.equal(canChangeKind('transfer'), true)
  assert.equal(canChangeKind('loan-repayment'), false)
  assert.equal(canChangeKind('card-payment'), false)
})

test('the entry header takes its text from the shared list and hard-codes none', () => {
  const source = readFileSync(new URL('../src/components/transactions/TransactionEntryHeader.tsx', import.meta.url), 'utf8')
  assert.match(source, /useKindMenuItems\(/)
  assert.match(source, /kindDialogSubtitle\(/)
  for (const text of ['Money spent from an account', 'Money received into an account', 'Move money between accounts']) {
    assert.ok(!source.includes(text), `${text} should come from kindMenuItems`)
  }
  assert.match(source, /Change kind/)
})

test('every create dialog renders the entry header and swaps kind without remounting the form', () => {
  for (const file of ['components/layout/AppLayout.tsx', 'pages/TransactionsPage.tsx', 'pages/AccountTransactionsPage.tsx']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(source, /<TransactionEntryHeader/, file)
    assert.match(source, /onChangeKind=\{setTransactionKind\}/, file)
    assert.ok(!/TRANSACTION_KIND_DIALOG_TITLES/.test(source), `${file} should not title its own dialog`)
  }
})

test('both edit dialogs use the edit header, and the form offers only the three plain kinds', () => {
  for (const file of ['pages/TransactionsPage.tsx', 'pages/AccountTransactionsPage.tsx']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(source, /<TransactionEditHeader/, file)
    assert.ok(!source.includes('Edit Transaction'), `${file} should not title the edit dialog itself`)
  }
  const form = readFileSync(new URL('../src/components/transactions/TransactionForm.tsx', import.meta.url), 'utf8')
  assert.match(form, /canChangeSavedKind\(editTarget\)/)
  assert.match(form, /\['expense', 'income', 'transfer'\] as const/)
  assert.match(form, /applyKindChange\(form\.getValues\(\), value as TransactionKind\)/)
})
