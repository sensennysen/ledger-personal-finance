# Implementation spec — Add Transaction: kind menu, loan picker, repayment form

Design source: `Ledger - 2B Screens.dc.html` — sections **5a** (kind menu) and **5b** (Record loan repayment).
Branch: `redesign-v1`. This document is the contract for the agent implementing the design; it names the real files and the exact behaviour changes.

---

## 1. Kind menu — `src/components/transactions/TransactionKindMenu.tsx`

Design 5a, right-hand menu. The three existing kinds keep their labels, descriptions and icons. Four changes:

### 1.1 Group the liability actions
Replace the bare `DropdownMenuSeparator` + single item with a labelled group:

```
DropdownMenuLabel  "What would you like to record?"
  Expense            Money spent from an account          ArrowUpRight    text-expense
  Income             Money received into an account       ArrowDownLeft   text-income
  Transfer           Move money between accounts          ArrowLeftRight  text-transfer
DropdownMenuSeparator
DropdownMenuLabel  "Liabilities"          ← new, same kicker style as the first label
  Loan repayment     {n} loans · {total} owed            CircleDollarSign  --gold  #9A7F3D
  Card payment       {card name} · {amount} due          CreditCard        text-expense
```

- Menu width goes from `w-72` to `w-80` to fit the amount strings.
- The **Loan repayment** icon tile uses the loan accent `var(--gold)` on a tinted ground, not `bg-primary/10` — it matches the loan colour used everywhere else in the app (`src/constants/accounts.ts` maps `loan` to `CircleDollarSign`).

### 1.2 Descriptions become live data
The static description strings are replaced by computed ones:

- Loan repayment: `` `${loanCount} loan${loanCount === 1 ? '' : 's'} · ${formatCurrency(totalOwed, currency)} owed` ``
  where `totalOwed` sums `getLoanAmountOwed(account)` (`src/lib/loans.ts`) over accounts of `type === 'loan'`. `totalLoanDebt` from `summarizeBalances` in `src/lib/creditCards.ts` already computes this — reuse it rather than re-summing.
- Card payment: the single credit card with the nearest due date, or `` `${n} cards · ${formatCurrency(totalCreditCardDebt, currency)} due` `` when more than one. `totalCreditCardDebt` also comes from `summarizeBalances`.

### 1.3 Card payment is a new item
`onSelect('card-payment')`. It is the same shape as a loan repayment — an expense that lands against a liability — and today it has **no entry point in this menu at all**.

- Add `'card-payment'` to `TransactionKind` in `src/components/transactions/transactionKinds.ts`.
- `TRANSACTION_KIND_LABELS['card-payment'] = 'Card payment'`
- `TRANSACTION_KIND_DIALOG_TITLES['card-payment'] = 'Record card payment'`
- Visibility mirrors the loan rule: show only when an account of `type === 'credit_card'` with a non-zero balance exists. Add a `showCardPayment?: boolean` prop alongside the existing `showLoanRepayment`.
- `inferTransactionKind` needs the credit-card case: an expense whose `to_account_id` points at a `credit_card` account is a `'card-payment'`, not a `'loan-repayment'`. **Both** branches currently collapse into `'loan-repayment'` because the check is only `type === 'expense' && toAccountId`. Resolve by account type, not by the presence of `to_account_id`.

### 1.4 Below `md`, the menu becomes a bottom sheet

Design 5a, mobile frames. `TransactionKindMenu` is a Radix `DropdownMenu` with `w-72`; on mobile its trigger is the corner FAB, so it renders as a 288px panel pinned to the bottom-right, overlapping the bottom nav, with every description wrapping to two lines.

Swap the surface below `md` — keep the dropdown above it (no FAB there):

- `ui/sheet.tsx` already ships, and the mobile *More* nav item already opens as a bottom sheet. Reuse that, `side="bottom"`.
- Drag handle, then "What would you like to record?" as a 17px sheet title rather than a `DropdownMenuLabel`.
- Rows full-width, `min-height: 64px`, 44px icon tile, description on one line, trailing chevron.
- The `Liabilities` group separator becomes an 8px ground-coloured band rather than a 1px rule.
- **Drop the E / I / T key caps** — desktop only.

Same five items, same order, same strings as the dropdown. Acceptance: one implementation of the item list feeding both surfaces, so the two can't drift.

### 1.5 Keyboard letters
`E` / `I` / `T` on the three primary kinds, rendered as a right-aligned key cap. Wire them as `DropdownMenuItem` shortcuts so they work while the menu is open. Loan repayment and Card payment get no letter — they open a second step (below) and shouldn't be one keystroke away.

---

## 2. Loan picker — **new behaviour, do not skip**

**Keep the picker. Remove the auto-pick.**

`src/components/transactions/TransactionForm.tsx` currently auto-selects the first loan the moment the form opens in repayment mode:

```ts
useEffect(() => {
  if (!isLoanRepayment || selectedLoanId || loanAccounts.length === 0) return
  handleLoanChange(loanAccounts[0].id)
}, [handleLoanChange, isLoanRepayment, loanAccounts, selectedLoanId])
```

That is wrong for anyone with more than one loan: the form opens pre-filled against an arbitrary loan, `handleLoanChange` also overwrites `currency`, `account_id` and `description`, and a user who doesn't notice records the payment against the wrong debt. The failure is silent and the entry is financially wrong.

### Required behaviour

| Loans on the account | What happens when "Loan repayment" is chosen |
|---|---|
| 0 | Item is not rendered (existing `hasLoans` rule — unchanged) |
| 1 | Skip the picker. Open the form with that loan selected — i.e. today's behaviour, which is correct for this case |
| 2+ | Open the **loan picker** step first. The form opens only after a loan is chosen |

So: narrow the auto-pick condition from `loanAccounts.length === 0` to `loanAccounts.length !== 1`. With 2+ loans, `to_account_id` must start `null` and the form must not be reachable until it is set.

### Picker step

A list step in the same dialog (not a nested dropdown — the rows carry too much data). One row per loan account:

- Loan name, and the schedule from `formatLoanSchedule(account)` (`src/lib/loans.ts`) as the secondary line
- Outstanding: `getLoanAmountOwed(account)`
- Next deadline from `getLoanDeadlines(purchases, allocations)` (`src/lib/loanInstallments.ts`) — the amount and date of the installment falling in the current cycle, when there is one
- Rows sort by nearest due date, then by largest outstanding
- Selecting a row runs the existing `handleLoanChange(loanId)` and advances to the form

Back navigation from the form returns to the picker with the selection intact. `LoanPurchaseForm.tsx` already has a two-step pattern (`advanceToRepayment`, the `Purchase` / `Repayment` stepper) — follow it so the two flows feel the same.

### When the loan is locked
`lockedLoanAccountId` (used when entering from an account page) skips the picker regardless of loan count, and the loan field stays `disabled`. Unchanged.

---

## 3. Repayment form — `TransactionForm.tsx`

Design 5b. All existing validation stays exactly as written; the design surfaces the numbers those rules depend on so they stop being discovered as errors after the fact.

### 3.1 Keep as-is
- Type locked to `expense`, type selector `disabled={isLoanRepayment}`
- Field order: **Loan to repay** first, then amount, then Pay from
- `Pay from` filtered to `account.type !== 'loan'`, not the selected loan, matching currency
- Category required — schema message: *"Choose an expense category for this loan repayment"*
- `description` prefilled `Loan payment - {loan.name}`, and only overwritten while the user hasn't typed their own (the existing `startsWith('Loan payment - ')` check)
- Submit label `Record Payment`; dialog title `Record loan repayment`
- Errors: *"Choose the loan you are repaying"*, *"Choose a different account to repay this loan"*, *"Payment cannot exceed the outstanding loan amount"*

### 3.2 Add — the summary band
Three read-only figures directly under the loan field, recomputed whenever the loan or amount changes:

| Figure | Source |
|---|---|
| Outstanding | `getLoanAmountOwed(selectedLoan)` |
| Installment due | nearest `getLoanDeadlines(...)` entry in the current cycle — amount + date + "in N days" |
| After this payment | `outstanding - amount`, with the installment count stepping (`34 of 48` → `35 of 48`) |

"After this payment" is the live one: it must update as the amount is typed, and it is the honest preview of the `amount > outstanding` rule — when it would go negative, show the existing validation error rather than a negative balance.

### 3.3 Add — amount presets
`Installment` / `Pay in full` / `Custom`.

- `Installment` (default when a deadline exists in the cycle) sets the amount to that installment total
- `Pay in full` sets it to `getLoanAmountOwed(selectedLoan)` — the cap, so it can never trip the validation
- `Custom` leaves the field as typed
- With no deadline in the current cycle, default to `Custom` with an empty amount

### 3.4 Add — allocation preview
`useLoanPurchases(accountId)` already returns `purchases` and `allocations`, and `LoanPurchaseTracker` already tells the user *"Repayments will show how much was applied to each purchase."* — past tense, after saving. Show it **before** saving instead:

- One row per financed purchase: name, `Installment {paid + 1} of {term}`, the amount this payment applies to it, and the remaining balance after
- Split oldest-installment-first, the same order the write path uses when it creates `loan_payment_allocations`
- Reuse `getPurchaseInstallments` / `enrichLoanPurchase` (`src/lib/loanInstallments.ts`) — do not reimplement the split, and do not let the preview and the saved allocations diverge
- Hide the whole block when the loan has no itemised purchases (the unitemised opening-debt case that `LoanPurchaseTracker` warns about)

---

## 3.5 Kind is asked once, not twice — create vs edit

Design 4c. **`TransactionKindMenu` already collects the kind before the dialog opens, and `TransactionForm` then renders a three-way type selector as its first control, pre-set to that same value.** The same decision, asked twice, two seconds apart.

### Creating (kind came from the menu)

Remove the type selector. The kind becomes the dialog's identity instead:

- Tinted icon tile + `TRANSACTION_KIND_LABELS[kind]` as the title — "New expense", "New income", "New transfer".
- The menu's own description as the subtitle (reuse the same strings; don't write new ones).
- A **Change kind** link in the header that reopens `TransactionKindMenu`. Required — without it a mis-pick costs Cancel + reopen, so removing the selector would trade a redundancy for a dead end.

### Editing (kind is a property of a saved row)

Keep the selector, labelled `Kind`, as the first control. This is the only route to fixing a mis-typed entry; today you would delete and re-record.

Changing the kind must clear the fields that no longer apply — a transfer has no `category_id`, an expense has no `to_account_id`. Clear them on change rather than letting `transactionFormSchema` reject on submit.

### Unaffected

`'loan-repayment'` and `'card-payment'` already set `disabled={isLoanRepayment}` on the selector, so they render a control that can never change. Both should drop it entirely and state the kind in the title (designs 5b, 12a).

### Acceptance

1. Choosing Expense in the menu opens a dialog titled "New expense" with no type selector.
2. **Change kind** returns to the menu with the chosen kind still highlighted.
3. Opening an existing transaction for edit shows the Kind selector set to its current type.
4. Switching an expense to a transfer in edit mode clears the category and asks for a destination account, with no submit-time error.

---

## 4. Mobile Transaction entry — remove the keypad

`src/components/transactions/QuickEntry.tsx`. Design 4c mobile.

Delete the 12-key `grid-cols-3` block and the `editEntryAmount` key handler (`src/lib/entryAmount.ts`) wiring from this screen. The amount becomes a focusable numeric field that raises the OS keyboard (`inputMode="decimal"`), keeping the same `money` type treatment at 46px.

The reclaimed vertical space goes to fields that were previously behind the "More details" disclosure: **Payee**, **Note**, the tag row, and the recurring toggle. `Account`, `Category` and `Date` stay as tappable rows. This removes one disclosure tap from the common path and lets the sheet fit 390 × 844 without scrolling — verify `main.scrollHeight === main.clientHeight` at that size.

Note that `QuickEntry` already bypasses the keypad entirely for repayments (`useState(initialKind === 'loan-repayment')` → `fullForm`), so a loan repayment never showed the keypad. With the keypad gone the two paths converge on one layout; the `fullForm` fast-path for `'loan-repayment'` can stay or go, but if it stays, extend it to `'card-payment'`.

---

## 5. Acceptance checks

1. One loan account → "Loan repayment" opens the form directly, loan pre-selected. No picker.
2. Two or more loan accounts → picker first; the form is unreachable until a loan is chosen; `to_account_id` is never auto-set.
3. Entering from a loan account page → picker skipped, loan field disabled, regardless of loan count.
4. Amount above outstanding → existing error message; "After this payment" never renders negative.
5. `Pay in full` → amount equals `getLoanAmountOwed`, and saving succeeds (it must not trip the cap by a rounding cent — use `roundMoney`).
6. Allocation preview matches the `loan_payment_allocations` rows actually written on save, purchase for purchase.
7. Card payment item appears only with a non-zero credit-card balance, and `inferTransactionKind` round-trips a saved card payment back to `'card-payment'`, not `'loan-repayment'`.
8. Mobile add-transaction sheet has no keypad and does not scroll at 390 × 844.
